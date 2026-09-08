/**
 * Phase D — Exact soil test summary in reference report structure.
 */

import { noData } from './provenance'
import { toProvenance, type ResolvedParameter } from './parameterResolution/parameterTypes'
import { indicativeFromUsda, resolveGroundWaterTableDisplay } from './report/reportSoilTestTables'
import { transmissionLineMaterialRemark } from './report/transmissionLineRemarks'
import type {
  BoreholeInvestigationPlan,
  GeotechnicalIntelligence,
  ProvenanceValue,
  SoilLayerParameters,
  SoilTestSummaryBundle,
  SoilTestSummaryRecord,
} from './types'

function sbcForLayer(
  geo: GeotechnicalIntelligence,
  depthToM: number,
  texture: string | null
): ProvenanceValue<number | null> {
  const match = geo.sbcAnalysis.byDepth?.find((d) => Math.abs(d.depthM - depthToM) < 0.05)
  const calc = match?.netSafeBearingCapacityTm2
  if (calc?.value != null && Number.isFinite(calc.value) && calc.status === 'CALCULATED') {
    return calc
  }
  const ind = indicativeFromUsda(texture)
  if (ind.sbcMid != null) {
    return {
      value: ind.sbcMid,
      unit: 'T/m²',
      source: 'TAMS texture screening',
      method: 'Indicative SBC mid from USDA texture (screening)',
      confidence: 35,
      status: 'ESTIMATED',
      engineeringLimitation: 'Not IS 6403 calculated — texture screening only',
    }
  }
  return noData('T/m²', 'SBC unavailable without texture or IS 6403 inputs')
}

function cbrForLayer(
  geo: GeotechnicalIntelligence,
  reportDepth: string,
  texture: string | null
): ProvenanceValue<number | null> {
  const resolved = geo.resolvedParameterContext?.byLayer.find((l) => l.reportDepth === reportDepth)
  if (resolved?.estimatedCbrPct.value != null) {
    return toProvenance(resolved.estimatedCbrPct) as ProvenanceValue<number | null>
  }
  const meas = geo.cbrAnalysis.measuredByDepth.find((r) => r.reportDepth === reportDepth)
  if (meas?.measuredCBR.value != null && meas.measuredCBR.status === 'MEASURED') {
    return meas.measuredCBR
  }
  const est = geo.cbrAnalysis.estimatedByDepth.find((r) => r.reportDepth === reportDepth)
  if (est?.estimatedCBR.value) {
    const { low, high } = est.estimatedCBR.value
    return {
      value: Math.round((low + high) / 2),
      unit: '%',
      source: est.estimatedCBR.source,
      method: est.estimatedCBR.method,
      confidence: est.estimatedCBR.confidence,
      status: 'ESTIMATED',
      engineeringLimitation: 'Texture-based CBR range mid — not soaked lab CBR',
    }
  }
  const ind = indicativeFromUsda(texture)
  if (ind.cbrMid != null) {
    return {
      value: ind.cbrMid,
      unit: '%',
      source: 'TAMS texture screening',
      method: 'Indicative CBR mid from texture',
      confidence: 35,
      status: 'ESTIMATED',
    }
  }
  return noData('%', 'CBR correlation unavailable')
}

export function buildSoilTestSummary(
  geo: GeotechnicalIntelligence,
  layers: SoilLayerParameters[],
  boreholePlan?: BoreholeInvestigationPlan | null
): SoilTestSummaryBundle {
  const generatedAt = geo.generatedAt
  const points = boreholePlan?.points?.length
    ? boreholePlan.points
    : [
        {
          boreholeId: 'BH-01',
          latitude: geo.location.lat,
          longitude: geo.location.lon,
          recommendedInvestigationDepthM: 2.0,
          spacingM: null,
          selectionReason: 'Default site focus — no investigation geometry supplied',
          coverageZone: 'Site centroid',
          dataConfidencePct: 70,
          status: 'PROPOSED_GIS_INVESTIGATION_POINT' as const,
        },
      ]

  const records: SoilTestSummaryRecord[] = []
  let serial = 0

  for (const bh of points) {
    for (const L of layers) {
      serial += 1
      const profileRow = geo.soilProfile.find((p) => p.reportDepth === L.reportDepth)
      const texture = profileRow?.usdaTexture.value ?? null
      const resolved = geo.resolvedParameterContext?.byLayer.find((r) => r.reportDepth === L.reportDepth)

      // Prefer Phase C layer params; fall back to resolved GIS/engineering values so
      // BH tables never show blank Sa/Si/Cl while MDD/SBC are filled from the same engine.
      const pickPv = (
        primary: ProvenanceValue<number | null>,
        fromResolved: ResolvedParameter | undefined,
        fromProfile?: ProvenanceValue<number | null>
      ): ProvenanceValue<number | null> => {
        if (primary.value != null && Number.isFinite(primary.value)) return primary
        if (fromResolved?.value != null && Number.isFinite(fromResolved.value)) {
          return toProvenance(fromResolved) as ProvenanceValue<number | null>
        }
        if (fromProfile?.value != null && Number.isFinite(fromProfile.value)) return fromProfile
        return primary
      }

      const sandPct = pickPv(L.sandPct, resolved?.sandPct, profileRow?.sandPct)
      const siltPct = pickPv(L.siltPct, resolved?.siltPct, profileRow?.siltPct)
      const clayPct = pickPv(L.clayPct, resolved?.clayPct, profileRow?.clayPct)
      const gravelPct = pickPv(L.gravelPct, resolved?.gravelPct, profileRow?.gravelPct)
      const liquidLimit = pickPv(L.liquidLimit, resolved?.liquidLimit)
      const plasticLimit = pickPv(L.plasticLimit, resolved?.plasticLimit)
      const plasticityIndex = pickPv(L.plasticityIndex, resolved?.plasticityIndex)
      const soilClassification =
        L.soilClassification.value != null
          ? L.soilClassification
          : resolved?.isClassification?.value && resolved.isClassification.value !== '—'
            ? (toProvenance(resolved.isClassification) as ProvenanceValue<string | null>)
            : profileRow?.isSoilClassification?.value
              ? profileRow.isSoilClassification
              : L.soilClassification

      const dry =
        resolved?.dryDensityGcc.value ??
        profileRow?.dryDensityGcc.value ??
        null
      const remark = transmissionLineMaterialRemark({
        sand: sandPct.value,
        silt: siltPct.value,
        clay: clayPct.value,
        dryDensityGcc: dry,
        soilClass: soilClassification.value,
        depthToM: L.depthToM,
        gravel: gravelPct.value,
      })
      const gwtText = resolveGroundWaterTableDisplay(geo, bh.recommendedInvestigationDepthM)

      records.push({
        serialNumber: serial,
        boreholeId: bh.boreholeId,
        latitude: bh.latitude,
        longitude: bh.longitude,
        startDate: null,
        endDate: null,
        time: null,
        investigationDepthM: bh.recommendedInvestigationDepthM,
        layerDepthLabel: L.reportDepthLabel,
        layerThicknessM: L.layerThicknessM,
        gravelPct,
        sandPct,
        siltPct,
        clayPct,
        liquidLimit,
        plasticLimit,
        plasticityIndex,
        soilClassification,
        maximumDryDensityGcc: (resolved
          ? toProvenance(resolved.maximumDryDensityGcc)
          : noData('g/cc', 'MDD unavailable')) as ProvenanceValue<number | null>,
        optimumMoistureContentPct: (resolved
          ? toProvenance(resolved.optimumMoistureContentPct)
          : noData('%', 'OMC unavailable')) as ProvenanceValue<number | null>,
        dryDensityGcc: (resolved
          ? toProvenance(resolved.dryDensityGcc)
          : profileRow?.dryDensityGcc ?? noData('g/cc', 'Dry density unavailable')) as ProvenanceValue<number | null>,
        freeSwellingIndexPct: (resolved
          ? toProvenance(resolved.freeSwellingIndexPct)
          : noData('%', 'FSI unavailable')) as ProvenanceValue<number | null>,
        bulkDensityGcc: (resolved
          ? toProvenance(resolved.bulkDensityGcc)
          : profileRow?.bulkDensityGcc ?? noData('g/cc', 'Bulk density unavailable')) as ProvenanceValue<number | null>,
        ucsKgCm2: (resolved ? toProvenance(resolved.ucsKgCm2) : noData('kg/cm²', 'UCS unavailable')) as ProvenanceValue<number | null>,
        specificGravity: (resolved ? toProvenance(resolved.specificGravity) : noData('', 'SG unavailable')) as ProvenanceValue<number | null>,
        sbcTm2: sbcForLayer(geo, L.depthToM, texture),
        cbrPct: cbrForLayer(geo, L.reportDepth, texture),
        soilClass: soilClassification,
        remarks: remark,
        groundWaterTableM: {
          value: null,
          unit: 'm',
          source: 'Screening convention',
          method: gwtText,
          confidence: 40,
          status: 'ESTIMATED',
          engineeringLimitation: 'Field groundwater observation recommended during boring',
        },
      })
    }
  }

  const validationNotes = [
    'Status: Proposed GIS Investigation Point — not field-completed borehole.',
    'Grain size (G/Sa/Si/Cl): modelled + normalized to 100% where GIS fractions exist.',
    'LL/PL: engineering-correlated where clay ≥ 8%; PI always calculated as LL − PL.',
    'MDD, OMC, FSI, UCS, SG: modelled engineering estimates from PR-1 parameter resolution when GIS data exists.',
    'GWT: screening text per reference report when field observation not recorded.',
    `${records.length} summary row(s) = ${points.length} point(s) × ${layers.length} layer(s).`,
  ]

  return {
    generatedAt,
    totalRecords: records.length,
    validationNotes,
    records,
  }
}
