/**
 * Build additive geotechnicalIntelligence block (GEO-1).
 * Must not mutate SiteSignals used by production scoring.
 */

import {
  buildDataQuality,
  buildReportReadiness,
  classifyReport,
  collectAllProvenance,
} from './dataQuality'
import {
  buildEngineeringDepthProfile,
  toSourceObservations,
  type RawSoilGridsSlice,
} from './depthProfile'
import {
  buildResolvedParameterContext,
  toEngineeringParameterSet,
  mapProjectCbrByDepth,
  validateParameterCompleteness,
  type ProjectGeotechRecord,
} from './parameterResolution'
import { recommendFoundation } from './foundationRecommendation'
import { validateResolvedContext } from './geotechValidation'
import { runSbcEngineAnalysis, toLegacySbcAnalysis } from './sbc/sbcEngine'
import { runSettlementAnalysis } from './settlementEngine'
import { runPileEngineAnalysis, toLegacyPileAnalysis } from './pile/pileEngine'
import { runCbrEngineAnalysis, toLegacyCbrAnalysis } from './cbr/cbrEngine'
import { runResistivityEngineAnalysis, toLegacyResistivityAnalysis } from './resistivity/resistivityEngine'
import { runSoilVerdictAnalysis } from './verdict/soilVerdictEngine'
import { noData, provenance } from './provenance'
import {
  planBoreholeInvestigation,
  type InvestigationGeometry,
} from './boreholePlanning'
import { buildSoilLayerParameters } from './soilParameterEngine'
import { buildSoilTestSummary } from './soilTestSummary'
import type {
  FieldInvestigationMatch,
  GeotechnicalIntelligence,
  ReportDepthId,
} from './types'
import type { SiteSignals } from '../scoring'
import type { SoilScreening } from '../soilScreening'

function mapPileCell(cell: import('./pileEngine').PileCellResult) {
  return {
    diameterMm: cell.diameterMm,
    depthM: cell.depthM,
    calculationStatus: cell.calculationStatus,
    missingParameters: cell.missingParameters,
    vertical: cell.vertical,
    uplift: cell.uplift,
    lateral: cell.lateral,
    inputs: cell.inputs as unknown as Record<string, number | string | null>,
    layerProfile: cell.layerProfile,
    endBearing: cell.endBearing,
    shaftFriction: cell.shaftFriction,
    ultimateVertical_T: cell.ultimateVertical_T,
    ultimateUplift_T: cell.ultimateUplift_T,
    steps: cell.steps,
    assumptions: cell.assumptions,
  }
}

function matchFieldInvestigation(signals: SiteSignals): FieldInvestigationMatch {
  const g = signals.geotech
  if (!g) {
    return {
      matched: false,
      investigationId: null,
      siteCode: null,
      distanceKm: null,
      geologyCompatibility: 'not_assessed',
      depthCoverageM: null,
      matchConfidence: null,
      reason: 'No borehole investigation in TAMS geotech database within 5 km of this site. Add field/lab data at /geotech to unlock MEASURED SBC, CBR, SPT, and resistivity.',
      usedForMeasuredParams: false,
    }
  }
  // Strict: only use measured params when distance is very close (same site).
  // Within 5 km we note proximity but do NOT copy Nirona soil layers to arbitrary pads.
  const useMeasured = g.distance_km <= 0.25
  return {
    matched: useMeasured,
    investigationId: g.id,
    siteCode: g.site_code,
    distanceKm: g.distance_km,
    geologyCompatibility: 'not_assessed',
    depthCoverageM: null,
    matchConfidence: useMeasured ? 80 : Math.max(10, Math.round(40 - g.distance_km * 5)),
    reason: useMeasured
      ? `Investigation ${g.site_code} within 250 m — treated as same-site field data`
      : `Nearest investigation ${g.site_code} at ${g.distance_km.toFixed(2)} km — too far to transfer layer lab values (reference only)`,
    usedForMeasuredParams: useMeasured,
  }
}

function slicesFromSoilScreening(soil: SoilScreening | null | undefined): RawSoilGridsSlice[] {
  if (!soil?.layers?.length) return []
  return soil.layers.map((L) => ({
    depthLabel: L.depthLabel,
    clayPct: L.clayPct,
    sandPct: L.sandPct,
    siltPct: L.siltPct,
    bulkDensityGcc: L.bulkDensityGcc,
    ph: L.ph,
    coarseFragPct: L.coarseFragPct,
    organicCarbonGkg: (L as { organicCarbonGkg?: number | null }).organicCarbonGkg ?? null,
  }))
}

export interface BuildGeotechOptions {
  investigationGeometry?: InvestigationGeometry | null
}

export function buildGeotechnicalIntelligence(
  signals: SiteSignals,
  options?: BuildGeotechOptions
): GeotechnicalIntelligence {
  const soil = signals.soilScreening
  const observations = toSourceObservations(slicesFromSoilScreening(soil))
  const fieldMatch = matchFieldInvestigation(signals)
  const soilProfile = buildEngineeringDepthProfile(observations)
  const boreholeInvestigationPlan = options?.investigationGeometry
    ? planBoreholeInvestigation(options.investigationGeometry, {
        slopeDeg: signals.slopeDeg,
        elevationM: signals.elevationM,
        soilTextureHint: soil?.textureClass ?? null,
      })
    : planBoreholeInvestigation(
        {
          type: 'point',
          coordinates: [{ lat: signals.lat, lon: signals.lon }],
        },
        {
          slopeDeg: signals.slopeDeg,
          elevationM: signals.elevationM,
          soilTextureHint: soil?.textureClass ?? null,
        }
      )

  const soilLayerParameters = buildSoilLayerParameters(soilProfile)

  const projectData: ProjectGeotechRecord | null = signals.geotech
    ? {
        siteCode: signals.geotech.site_code,
        distanceKm: signals.geotech.distance_km,
        usedForMeasured: fieldMatch.usedForMeasuredParams,
        investigation: signals.geotech.full ?? null,
      }
    : null

  const resolvedParameterContext = buildResolvedParameterContext({
    profile: soilProfile,
    soilLayers: soilLayerParameters,
    screeningTextureClass: soil?.textureClass ?? null,
    elevationM: signals.elevationM,
    slopeDeg: signals.slopeDeg,
    projectData,
    measured: fieldMatch.usedForMeasuredParams ? {} : undefined,
  })
  validateResolvedContext(resolvedParameterContext)
  const parameterCompleteness = validateParameterCompleteness(resolvedParameterContext)
  const engineering = toEngineeringParameterSet(resolvedParameterContext)

  let measuredCbrMap: Partial<Record<ReportDepthId, number>> | undefined
  if (fieldMatch.usedForMeasuredParams && projectData?.investigation) {
    measuredCbrMap = mapProjectCbrByDepth(projectData.investigation)
  }

  const cbrEngineAnalysis = runCbrEngineAnalysis({
    soilProfile,
    soilLayerParameters,
    measuredByDepth: measuredCbrMap,
  })
  const cbrAnalysis = toLegacyCbrAnalysis(cbrEngineAnalysis)

  const resistivityEngineAnalysis = runResistivityEngineAnalysis({
    soilLayerParameters,
    measuredOhmM:
      fieldMatch.usedForMeasuredParams ? signals.geotech?.adopted_resistivity_ohm_m : null,
    measuredSource: signals.geotech?.site_code
      ? `Field geotech ${signals.geotech.site_code}`
      : undefined,
  })
  const resistivityAnalysis = toLegacyResistivityAnalysis(resistivityEngineAnalysis)

  const soilScreeningSummary = soil
    ? {
        provider: soil.provider,
        textureClass: provenance(soil.textureClass, {
          unit: 'USDA class',
          source: 'ISRIC SoilGrids 2.0',
          method: '0–30 cm average texture from sand/silt/clay fractions',
          confidence: soil.confidencePct,
          status: 'MODELLED',
        }),
        indicativeSbcTm2: provenance(soil.indicativeSbcTm2, {
          unit: 'T/m²',
          source: 'TAMS texture screening table',
          method: 'Indicative SBC range from USDA texture class (screening only)',
          correlation: 'lookup(textureClass) → [SBC_low, SBC_high]',
          inputValues: { textureClass: soil.textureClass },
          confidence: soil.confidencePct,
          status: 'ESTIMATED',
          assumptions: ['Not IS 6403 calculated net safe bearing capacity', 'For planning / screening only'],
          engineeringLimitation:
            'Clay sites need lab cohesion before IS 6403 — this range is texture-based screening',
        }),
        indicativeCbrPct: provenance(soil.indicativeCbrPct, {
          unit: '%',
          source: 'TAMS texture screening table',
          method: 'Indicative CBR range from USDA texture class',
          inputValues: { textureClass: soil.textureClass },
          confidence: Math.max(35, soil.confidencePct - 5),
          status: 'ESTIMATED',
          engineeringLimitation: 'Not laboratory soaked CBR',
        }),
        confidencePct: provenance(soil.confidencePct, {
          unit: '%',
          source: soil.provider,
          method: 'Open GIS soil model confidence',
          confidence: soil.confidencePct,
          status: 'MODELLED',
        }),
        confidenceNote: provenance(soil.confidenceNote, {
          unit: 'text',
          source: soil.provider,
          method: 'Screening disclaimer',
          confidence: null,
          status: 'DERIVED',
        }),
      }
    : undefined

  const siteContext = {
    roadKm:
      signals.roadKm != null
        ? provenance(signals.roadKm, {
            unit: 'km',
            source: 'OSRM nearest driving road',
            method: 'router.project-osrm.org/nearest',
            confidence: 70,
            status: signals.liveOk?.road ? 'DERIVED' : 'ESTIMATED',
          })
        : noData('km', 'Road distance unavailable'),
    waterKm:
      signals.waterKm != null
        ? provenance(signals.waterKm, {
            unit: 'km',
            source: 'OSM Overpass',
            method: 'Nearest water feature',
            confidence: 55,
            status: 'MODELLED',
          })
        : noData('km', 'Water distance unavailable'),
    buildingKm:
      signals.buildingKm != null
        ? provenance(signals.buildingKm, {
            unit: 'km',
            source: 'OSM Overpass',
            method: 'Nearest settlement/building',
            confidence: 55,
            status: 'MODELLED',
          })
        : noData('km', 'Settlement distance unavailable'),
    windMs:
      signals.windMs != null
        ? provenance(signals.windMs, {
            unit: 'm/s',
            source: 'Open-Meteo',
            method: '16-day wind speed mean',
            confidence: 60,
            status: 'MODELLED',
          })
        : noData('m/s', 'Wind unavailable'),
  }

  const sbcEngineAnalysis = runSbcEngineAnalysis({
    engineering,
    profile: soilProfile,
    soilLayerParameters,
    boreholePlan: boreholeInvestigationPlan,
    lat: signals.lat,
    lon: signals.lon,
    screeningTextureClass: soil?.textureClass ?? null,
  })
  const sbcRaw = toLegacySbcAnalysis(sbcEngineAnalysis)
  const sbcAnalysis = {
    calculationStatus: sbcRaw.calculationStatus,
    message: sbcRaw.message,
    codeReference: sbcRaw.codeReference,
    foundation: {
      foundationType: sbcRaw.foundation.foundationType,
      widthM: sbcRaw.foundation.widthM,
      lengthM: sbcRaw.foundation.lengthM,
      assumedScreeningDefaults: sbcRaw.foundation.assumedScreeningDefaults,
      fosShear: sbcRaw.foundation.fosShear,
    },
    soilInputs: sbcRaw.soilInputs
      ? {
          cTm2: sbcRaw.soilInputs.cTm2,
          phiDeg: sbcRaw.soilInputs.phiDeg,
          gammaTm3: sbcRaw.soilInputs.gammaTm3,
          cStatus: sbcRaw.soilInputs.cStatus,
          phiStatus: sbcRaw.soilInputs.phiStatus,
          gammaStatus: sbcRaw.soilInputs.gammaStatus,
          textureHint: sbcRaw.soilInputs.textureHint,
        }
      : undefined,
    byDepth: sbcRaw.byDepth.map((d) => ({ ...d })),
    adoptedPreliminary: sbcRaw.adoptedPreliminary,
    settlementConsideration: sbcRaw.settlementConsideration,
    sizeCorrection: sbcRaw.sizeCorrection,
    validation: sbcRaw.validation,
    designParameters: sbcRaw.designParameters,
  }

  const settlementRaw = runSettlementAnalysis({
    foundation: sbcRaw.foundation,
    foundationDepthM: 1.5,
    // No tower load from GIS — leave TOWER_LOAD_REQUIRED until structural input provided
  })
  const settlementAnalysis = {
    calculationStatus: settlementRaw.calculationStatus,
    message: settlementRaw.message,
    codeReference: settlementRaw.codeReference,
    requiredInputs: settlementRaw.requiredInputs,
    missingInputs: settlementRaw.missingInputs,
    readiness: settlementRaw.readiness,
    towerLoadPlaceholder: settlementRaw.towerLoadPlaceholder,
    settlementMm: settlementRaw.settlementMm,
    settlementStatus: settlementRaw.settlementStatus,
    steps: settlementRaw.steps,
    assumptions: settlementRaw.assumptions,
  }

  const pileEngineAnalysis = runPileEngineAnalysis({
    engineering,
    profile: soilProfile,
    soilLayerParameters,
    boreholePlan: boreholeInvestigationPlan,
    screeningTextureClass: soil?.textureClass ?? null,
    lat: signals.lat,
    lon: signals.lon,
  })
  const pileRaw = toLegacyPileAnalysis(pileEngineAnalysis)
  const pileAnalysis = {
    codeReference: pileRaw.codeReference,
    method: pileRaw.method,
    message: pileRaw.message,
    '450mm': {
      '1.0m': mapPileCell(pileRaw['450mm']['1.0m']),
      '1.5m': mapPileCell(pileRaw['450mm']['1.5m']),
      '2.0m': mapPileCell(pileRaw['450mm']['2.0m']),
    },
    '600mm': {
      '1.0m': mapPileCell(pileRaw['600mm']['1.0m']),
      '1.5m': mapPileCell(pileRaw['600mm']['1.5m']),
      '2.0m': mapPileCell(pileRaw['600mm']['2.0m']),
    },
  }

  const location = {
    lat: signals.lat,
    lon: signals.lon,
    elevationM:
      signals.elevationM != null
        ? provenance(signals.elevationM, {
            unit: 'm',
            source: 'Open-Meteo elevation API',
            method: 'DEM sample',
            confidence: 70,
            status: 'MODELLED' as const,
          })
        : noData<number>('m', 'Elevation unavailable'),
    slopeDeg:
      signals.slopeDeg != null
        ? provenance(signals.slopeDeg, {
            unit: '°',
            source: 'Open-Meteo elevation grid',
            method: 'Local DEM gradient',
            confidence: 65,
            status: 'DERIVED' as const,
          })
        : noData<number>('°', 'Slope unavailable'),
    landCover: provenance(signals.landCoverHint, {
      unit: 'class',
      source: 'OpenStreetMap Overpass',
      method: 'Nearby landuse/natural tags',
      confidence: 55,
      status: 'MODELLED',
    }),
    placeLabel: signals.placeLabel
      ? provenance(signals.placeLabel, {
          unit: 'text',
          source: 'Nominatim',
          method: 'Reverse geocode',
          confidence: 60,
          status: 'MODELLED',
        })
      : noData<string>('text', 'Place label unavailable'),
  }

  const draft: GeotechnicalIntelligence = {
    version: 'GEO-1',
    reportClassification: 'GIS_BASED_PRELIMINARY_SCREENING',
    location,
    soilScreeningSummary,
    siteContext,
    soilProfile,
    soilLayerParameters,
    boreholeInvestigationPlan,
    resolvedParameterContext,
    parameterCompleteness,
    foundationRecommendation: null as import('./foundationRecommendation').FoundationRecommendation | null,
    sourceObservations: observations,
    engineeringParameters: engineering,
    engineeringParameterEstimation: engineering,
    sbcAnalysis,
    sbcEngineAnalysis,
    settlementAnalysis,
    pileAnalysis,
    pileEngineAnalysis,
    cbrAnalysis,
    cbrEngineAnalysis,
    resistivityAnalysis,
    resistivityEngineAnalysis,
    fieldInvestigationMatch: fieldMatch,
    dataQuality: {
      overallConfidence: 0,
      measuredCoverage: 0,
      modelledCoverage: 0,
      estimatedCoverage: 0,
      derivedCoverage: 0,
      missingCriticalParameters: [],
      fieldValidationRequired: true,
    },
    limitations: [
      'This is a PRELIMINARY GIS-BASED SCREENING report. For final design, commission borehole investigation + laboratory testing at this site.',
      'Phase A–D: Recommended Geotechnical Investigation Points are GIS-proposed — not field-completed boreholes.',
      boreholeInvestigationPlan
        ? `Borehole plan: ${boreholeInvestigationPlan.totalPoints} proposed point(s), ~${boreholeInvestigationPlan.recommendedSpacingM} m spacing, ${boreholeInvestigationPlan.estimatedCoveragePct}% estimated coverage.`
        : null,
      'SoilGrids provides MODELLED sand/silt/clay, density, and pH to 2.0 m — these ARE populated in Sections 1.1–1.2 and Soil Test Summary.',
      'Texture-based indicative SBC and CBR ranges ARE available for planning (see §1.1) even when IS 6403 cannot run for clay without lab cohesion.',
      'SPT N, Atterberg limits, soaked CBR, groundwater depth, and field resistivity cannot be measured remotely — enter at TAMS /geotech after field work.',
      'bdod is bulk density (g/cm³), not soil depth — never interpret bdod as metres of soil.',
      'NO_DATA parameters remain null — never replaced with zero.',
      'Parameter resolution PR-1: c, φ, γ, equivalent SPT N, MDD, OMC, UCS, SG, FSI, CBR are GIS-predicted engineering estimates unless field MEASURED data overrides.',
      'SPT N values are GIS-predicted equivalent N — not field Standard Penetration Tests.',
      sbcRaw.calculationStatus === 'INSUFFICIENT_DATA' && soil
        ? `IS 6403 SBC: INSUFFICIENT_DATA — use indicative screening SBC ${soil.indicativeSbcTm2.low}–${soil.indicativeSbcTm2.high} T/m² for preliminary planning until lab cohesion is available.`
        : sbcRaw.calculationStatus === 'INSUFFICIENT_DATA'
          ? 'SBC: INSUFFICIENT_DATA — IS 6403 not run without valid φ, γ, and c (or drained-sand assumption).'
          : `SBC: ${sbcRaw.calculationStatus} — ${sbcRaw.message}`,
      `Settlement: ${settlementRaw.calculationStatus} — ${settlementRaw.message}`,
      `Pile: ${pileRaw.message}`,
      `CBR (Phase G): ${cbrEngineAnalysis.message}`,
      `Resistivity (Phase G): ${resistivityEngineAnalysis.message}`,
      soil
        ? `SoilGrids texture class (0–30 cm): ${soil.textureClass} — grain-size fractions populated for all 0.0–2.0 m intervals.`
        : 'SoilGrids screening unavailable for this location.',
      fieldMatch.reason,
      signals.geotech && !fieldMatch.usedForMeasuredParams
        ? `Reference: nearest TAMS investigation ${signals.geotech.site_code} (${signals.geotech.distance_km.toFixed(2)} km) — not transferred to this site.`
        : null,
    ].filter(Boolean) as string[],
    reportReadiness: {
      totalParameters: 0,
      availableParameters: 0,
      measuredParameters: 0,
      modelledParameters: 0,
      estimatedParameters: 0,
      derivedParameters: 0,
      calculatedParameters: 0,
      missingParameters: 0,
      fieldTestRequiredParameters: 0,
      completionPercentage: 0,
      missingCriticalData: [],
    },
    generatedAt: new Date().toISOString(),
  }

  const params = collectAllProvenance(draft)
  const measuredCount = params.filter((p) => p.status === 'MEASURED').length
  draft.reportClassification = classifyReport(
    fieldMatch.matched,
    measuredCount,
    soilProfile
  )
  draft.dataQuality = buildDataQuality(params, fieldMatch.matched)
  draft.reportReadiness = buildReportReadiness(params)
  draft.soilTestSummary = buildSoilTestSummary(draft, soilLayerParameters, boreholeInvestigationPlan)
  draft.soilVerdictAnalysis = runSoilVerdictAnalysis(draft)
  draft.foundationRecommendation = recommendFoundation(draft)

  return draft
}
