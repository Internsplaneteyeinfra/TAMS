/**
 * Phase E — SBC Engineering Analysis orchestrator.
 * Reuses A–D pipeline inputs; does not duplicate soil data collection.
 */

import { noData, provenance } from '../provenance'
import type { BoreholeInvestigationPlan } from '../boreholePlanning'
import type { EngineeringParameterSet, SoilLayerParameters, SoilProfileInterval } from '../types'
import {
  calculateBearingCapacity,
  insufficientShearProvenance,
  provenanceForShearSbc,
  resolveSoilAtDepth,
} from './bearingCapacity'
import { buildDesignParameters } from './designParameters'
import { buildDepthCorrectionRow } from './depthCorrection'
import { calculateSizeCorrection } from './sizeCorrection'
import { governingSbc, settlementControlledCapacity } from './settlementAnalysis'
import { aggregateCalculationStatus, validateSbcInputs } from './sbcValidation'
import type {
  ALL_SBC_DEPTHS_M,
  BoreholeSbcAnalysis,
  SbcDepthMatrixRow,
  SbcEngineAnalysis,
  SbcFoundationInputs,
  SbcSourceTypeLabel,
} from './types'
import { ALL_SBC_DEPTHS_M as DEPTHS } from './types'

export function defaultScreeningFoundation(): SbcFoundationInputs {
  return {
    foundationType: '1.0 m × 1.0 m square isolated stub footing (screening assumption)',
    widthM: 1.0,
    lengthM: 1.0,
    assumedScreeningDefaults: true,
    fosShear: 2.5,
    allowableSettlementMm: 25,
    groundwater: 'unknown',
  }
}

function sourceTypeLabel(depthM: number): SbcSourceTypeLabel {
  return depthM <= 2.0 ? 'Calculated' : 'Engineering Depth Model'
}

function analyzeBorehole(
  borehole: {
    boreholeId: string
    latitude: number
    longitude: number
    recommendedInvestigationDepthM: number
  },
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayers: SoilLayerParameters[] | undefined,
  foundation: SbcFoundationInputs,
  screeningTextureClass?: string | null
): BoreholeSbcAnalysis {
  const designDepthM = 1.5
  const soilOpts = { screeningTextureClass }
  const representativeSoil = resolveSoilAtDepth(designDepthM, engineering, profile, soilLayers, soilOpts)
  const validation = validateSbcInputs(representativeSoil)
  const designParameters = buildDesignParameters(foundation, representativeSoil, engineering, designDepthM)

  const byDepth: SbcDepthMatrixRow[] = DEPTHS.map((depthM) => {
    const soil = resolveSoilAtDepth(depthM, engineering, profile, soilLayers, soilOpts)
    const depthValidation = validateSbcInputs(soil)
    const dataBasis = soil.dataBasis
    const sourceLabel = sourceTypeLabel(depthM)

    if (!depthValidation.passed) {
      return {
        depthM,
        dataBasis,
        sourceTypeLabel: sourceLabel,
        calculationStatus: depthValidation.status,
        shearSafeCapacityTm2: insufficientShearProvenance(depthValidation.message),
        settlementControlledCapacityTm2: noData(
          'T/m²',
          'Settlement capacity requires shear-valid soil inputs first',
          'INSUFFICIENT_DATA'
        ),
        netSafeBearingCapacityTm2: noData(
          'T/m²',
          depthValidation.message,
          depthValidation.status === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
            ? 'FIELD_TEST_REQUIRED'
            : 'INSUFFICIENT_DATA'
        ),
        governingCondition: 'None',
        confidencePct: null,
        depthCorrection: buildDepthCorrectionRow(depthM, dataBasis, null),
        steps: [
          {
            step: 1,
            name: 'Validation gate',
            formula: 'Require defensible c, φ, γ before SBC',
            inputs: { missing: depthValidation.missingParameters.join(', ') },
            result: null,
            unit: '—',
            notes: depthValidation.message,
          },
        ],
        factors: {},
        components: {},
        assumptions: [
          dataBasis === 'PRIMARY_GEOSPATIAL_MODEL'
            ? '0–2.0 m: PRIMARY GEOSPATIAL SOIL MODEL'
            : '2.0–4.0 m: ENGINEERING DEPTH EXTRAPOLATION',
        ],
      }
    }

    const bearing = calculateBearingCapacity(depthM, soil, foundation)!
    const settlement = settlementControlledCapacity(foundation, depthM)
    const gov = governingSbc(bearing.qnetSafeTm2, settlement.settlementControlledCapacityTm2.value)

    const netProv =
      gov.value != null
        ? provenance(gov.value, {
            unit: 'T/m²',
            source: 'Phase E governing minimum',
            method: `SBC = min(shear=${bearing.qnetSafeTm2.toFixed(1)}, settlement=${settlement.settlementControlledCapacityTm2.value ?? 'N/A'}) → ${gov.governing}`,
            formula: 'Governing SBC = min(Shear Safe Capacity, Settlement-Controlled Capacity)',
            confidence:
              soil.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION'
                ? 28
                : gov.governing === 'Settlement' && settlement.canAssess
                  ? 55
                  : 42,
            status:
              soil.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION' ? 'MODEL_PREDICTED' : 'CALCULATED',
            engineeringLimitation:
              gov.governing === 'Settlement'
                ? 'Governing condition: settlement — verify Es and tower load'
                : 'Governing condition: shear — preliminary IS 6403',
          })
        : insufficientShearProvenance('Governing SBC could not be determined')

    const allSteps = [
      ...bearing.steps,
      ...settlement.steps,
      {
        step: bearing.steps.length + settlement.steps.length + 1,
        name: 'Governing SBC',
        formula: 'min(shear safe, settlement controlled)',
        inputs: {
          shear_Tm2: bearing.qnetSafeTm2,
          settlement_Tm2: settlement.settlementControlledCapacityTm2.value,
        },
        result: gov.value != null ? `${gov.value} (${gov.governing})` : null,
        unit: 'T/m²',
      },
    ]

    return {
      depthM,
      dataBasis,
      sourceTypeLabel: sourceLabel,
      calculationStatus: 'CALCULATED',
      shearSafeCapacityTm2: provenanceForShearSbc(
        bearing.qnetSafeTm2,
        soil,
        foundation,
        depthM,
        sourceLabel
      ),
      settlementControlledCapacityTm2: settlement.settlementControlledCapacityTm2,
      netSafeBearingCapacityTm2: netProv,
      governingCondition: gov.governing,
      confidencePct: netProv.confidence,
      depthCorrection: buildDepthCorrectionRow(depthM, dataBasis, bearing),
      steps: allSteps,
      factors: bearing.factors,
      components: bearing.components,
      assumptions: [
        dataBasis === 'PRIMARY_GEOSPATIAL_MODEL'
          ? '0.0–2.0 m: PRIMARY GEOSPATIAL SOIL MODEL — SoilGrids thickness-weighted layers'
          : '2.0–4.0 m: ENGINEERING DEPTH EXTRAPOLATION — not directly observed',
        'IS 6403:1981 general shear with shape & depth factors',
        gov.governing === 'Settlement'
          ? 'Governing: settlement-controlled capacity (Es required)'
          : 'Governing: shear failure capacity',
      ],
    }
  })

  const sizeCorrection = calculateSizeCorrection(representativeSoil, foundation, designDepthM)
  const calculatedDepths = byDepth.filter((d) => d.calculationStatus === 'CALCULATED')
  const calcStatus = aggregateCalculationStatus(byDepth.map((d) => d.calculationStatus))

  const designRow =
    calculatedDepths.find((d) => d.depthM === designDepthM) ||
    calculatedDepths[calculatedDepths.length - 1]

  const adopted = designRow?.netSafeBearingCapacityTm2 ?? noData('T/m²', validation.message, 'INSUFFICIENT_DATA')

  const settlementSteps = designRow?.steps.filter((s) => s.name.includes('Settlement')) ?? []

  return {
    boreholeId: borehole.boreholeId,
    latitude: borehole.latitude,
    longitude: borehole.longitude,
    recommendedFoundationDepthM: designRow?.depthM ?? designDepthM,
    netSafeBearingCapacityTm2: adopted,
    governingCondition: designRow?.governingCondition ?? 'None',
    confidencePct: designRow?.confidencePct ?? null,
    dataBasisSummary:
      '0–2.0 m: GIS + engineering correlation · 2.0–4.0 m: engineering depth extrapolation',
    calculationStatus: calcStatus,
    message:
      calculatedDepths.length > 0
        ? `IS 6403 SBC computed at ${calculatedDepths.length}/${DEPTHS.length} depths for ${borehole.boreholeId}. Governing: ${designRow?.governingCondition ?? '—'}.`
        : validation.message,
    designParameters,
    soilInputs: representativeSoil,
    byDepth,
    sizeCorrection,
    validation,
    settlementSteps,
  }
}

export function runSbcEngineAnalysis(opts: {
  engineering: EngineeringParameterSet
  profile: SoilProfileInterval[]
  soilLayerParameters?: SoilLayerParameters[]
  boreholePlan?: BoreholeInvestigationPlan | null
  foundation?: SbcFoundationInputs
  lat?: number
  lon?: number
  screeningTextureClass?: string | null
}): SbcEngineAnalysis {
  const foundation = opts.foundation ?? defaultScreeningFoundation()
  const points = opts.boreholePlan?.points?.length
    ? opts.boreholePlan.points
    : [
        {
          boreholeId: 'BH-01',
          latitude: opts.lat ?? 0,
          longitude: opts.lon ?? 0,
          recommendedInvestigationDepthM: 2.0,
          spacingM: null,
          selectionReason: 'Site focus',
          coverageZone: 'Centroid',
          dataConfidencePct: 70,
          status: 'PROPOSED_GIS_INVESTIGATION_POINT' as const,
        },
      ]

  const byBorehole = points.map((p) =>
    analyzeBorehole(
      {
        boreholeId: p.boreholeId,
        latitude: p.latitude,
        longitude: p.longitude,
        recommendedInvestigationDepthM: p.recommendedInvestigationDepthM,
      },
      opts.engineering,
      opts.profile,
      opts.soilLayerParameters,
      foundation,
      opts.screeningTextureClass
    )
  )

  const primary = byBorehole[0]
  const calcStatus = aggregateCalculationStatus(byBorehole.map((b) => b.calculationStatus))

  const legacyStatus =
    calcStatus === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
      ? 'INSUFFICIENT_DATA'
      : calcStatus === 'CALCULATED' || calcStatus === 'PARTIAL'
        ? calcStatus
        : 'INSUFFICIENT_DATA'

  return {
    version: 'SBC-E1',
    codeReference:
      'IS 6403:1981 — Code of practice for determination of bearing capacity of shallow foundations',
    calculationStatus: calcStatus,
    message: primary?.message ?? 'SBC analysis not run',
    foundation,
    byBorehole,
    siteSummary: {
      boreholeId: primary?.boreholeId ?? 'BH-01',
      adoptedPreliminary: primary?.netSafeBearingCapacityTm2 ?? noData('T/m²', 'No SBC computed'),
      recommendedFoundationDepthM: primary?.recommendedFoundationDepthM ?? null,
      governingCondition: primary?.governingCondition ?? 'None',
      confidencePct: primary?.confidencePct ?? null,
      byDepth: primary?.byDepth ?? [],
      settlementConsideration:
        primary?.governingCondition === 'Settlement'
          ? 'Governing SBC limited by settlement-controlled capacity — verify Es and tower load'
          : primary?.settlementSteps.length
            ? 'Settlement capacity assessed where Es available; otherwise shear governs'
            : 'Settlement-controlled capacity requires verified Es (FIELD_TEST_REQUIRED)',
    },
  }
}

/** Map Phase E engine output to legacy sbcAnalysis shape for reports/UI backward compat. */
export function toLegacySbcAnalysis(engine: SbcEngineAnalysis) {
  const primary = engine.byBorehole[0]
  const legacyStatus =
    engine.calculationStatus === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
      ? 'INSUFFICIENT_DATA'
      : engine.calculationStatus === 'CALCULATED' || engine.calculationStatus === 'PARTIAL'
        ? engine.calculationStatus
        : 'INSUFFICIENT_DATA'

  return {
    calculationStatus: legacyStatus as 'CALCULATED' | 'INSUFFICIENT_DATA' | 'PARTIAL',
    message: engine.message,
    codeReference: engine.codeReference,
    foundation: {
      foundationType: engine.foundation.foundationType,
      widthM: engine.foundation.widthM,
      lengthM: engine.foundation.lengthM,
      assumedScreeningDefaults: engine.foundation.assumedScreeningDefaults,
      fosShear: engine.foundation.fosShear,
    },
    soilInputs: primary
      ? {
          cTm2: primary.soilInputs.cTm2,
          phiDeg: primary.soilInputs.phiDeg,
          gammaTm3: primary.soilInputs.gammaTm3,
          cStatus: primary.soilInputs.cStatus,
          phiStatus: primary.soilInputs.phiStatus,
          gammaStatus: primary.soilInputs.gammaStatus,
          textureHint: primary.soilInputs.textureHint,
        }
      : undefined,
    byDepth: (primary?.byDepth ?? []).map((d) => ({
      depthM: d.depthM,
      calculationStatus: d.calculationStatus,
      dataBasis: d.dataBasis,
      sourceTypeLabel: d.sourceTypeLabel,
      governingCondition: d.governingCondition,
      confidencePct: d.confidencePct,
      netSafeBearingCapacityTm2: d.netSafeBearingCapacityTm2,
      shearSafeCapacityTm2: d.shearSafeCapacityTm2,
      settlementControlledCapacityTm2: d.settlementControlledCapacityTm2,
      depthCorrection: d.depthCorrection,
      steps: d.steps,
      factors: d.factors,
      components: d.components,
      assumptions: d.assumptions,
    })),
    adoptedPreliminary: engine.siteSummary.adoptedPreliminary,
    settlementConsideration: engine.siteSummary.settlementConsideration,
    sizeCorrection: primary?.sizeCorrection,
    validation: primary?.validation,
    designParameters: primary?.designParameters,
  }
}

// Re-export for pile engine / legacy imports
export { resolveSoilAtDepth as resolveSbcSoilInputs } from './bearingCapacity'
export type { SbcSoilInputs, SbcFoundationInputs, SbcCalculationStep } from './types'

/** Legacy entry — site-level single-footing analysis at 4 primary depths only. */
export function runSbcAnalysis(
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  foundation: SbcFoundationInputs = defaultScreeningFoundation(),
  soilLayerParameters?: SoilLayerParameters[]
) {
  const engine = runSbcEngineAnalysis({
    engineering,
    profile,
    soilLayerParameters,
    foundation,
  })
  return toLegacySbcAnalysis(engine)
}

export function calculateSbcAtDepth(
  depthM: number,
  soil: import('./types').SbcSoilInputs,
  foundation: SbcFoundationInputs
) {
  const validation = validateSbcInputs(soil)
  if (!validation.passed) {
    return {
      depthM,
      calculationStatus: 'INSUFFICIENT_DATA' as const,
      netSafeBearingCapacityTm2: insufficientShearProvenance(validation.message),
      steps: [],
      factors: {},
      components: {},
      assumptions: [],
    }
  }
  const bearing = calculateBearingCapacity(depthM, soil, foundation)!
  return {
    depthM,
    calculationStatus: 'CALCULATED' as const,
    netSafeBearingCapacityTm2: provenanceForShearSbc(
      bearing.qnetSafeTm2,
      soil,
      foundation,
      depthM,
      sourceTypeLabel(depthM)
    ),
    steps: bearing.steps,
    factors: bearing.factors,
    components: bearing.components,
    assumptions: [],
  }
}
