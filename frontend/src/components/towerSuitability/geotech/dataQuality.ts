/**
 * Data quality + report readiness for geotechnicalIntelligence.
 */

import type {
  DataQualitySummary,
  GeoDataStatus,
  GeotechnicalIntelligence,
  ProvenanceValue,
  ReportClassification,
  ReportReadiness,
  SoilProfileInterval,
} from './types'

const CRITICAL_ALWAYS = [
  'SPT_N_VALUE',
  'DIRECT_SHEAR_PARAMETERS',
  'GROUNDWATER_LEVEL',
  'FIELD_EARTH_RESISTIVITY',
  'ATTERBERG_LIMITS',
  'SOAKED_CBR',
] as const

function walkProvenance(obj: unknown, out: ProvenanceValue[]): void {
  if (obj == null) return
  if (typeof obj !== 'object') return
  const rec = obj as Record<string, unknown>
  if (
    'status' in rec &&
    'value' in rec &&
    'unit' in rec &&
    typeof rec.status === 'string'
  ) {
    out.push(rec as unknown as ProvenanceValue)
    return
  }
  if (Array.isArray(obj)) {
    for (const item of obj) walkProvenance(item, out)
    return
  }
  for (const v of Object.values(rec)) walkProvenance(v, out)
}

function countByStatus(params: ProvenanceValue[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const p of params) {
    c[p.status] = (c[p.status] || 0) + 1
  }
  return c
}

export function classifyReport(
  fieldMatched: boolean,
  measuredCount: number,
  profile: SoilProfileInterval[]
): ReportClassification {
  const hasModelled = profile.some(
    (p) => p.sandPct.status === 'MODELLED' || p.clayPct.status === 'MODELLED'
  )
  if (fieldMatched && measuredCount >= 8) {
    return 'FIELD_VALIDATED_GEOTECHNICAL_REPORT'
  }
  if (fieldMatched && measuredCount >= 1) {
    return 'FIELD_SUPPORTED_PRELIMINARY_ENGINEERING_ANALYSIS'
  }
  if (hasModelled) return 'GIS_BASED_PRELIMINARY_SCREENING'
  return 'GIS_BASED_PRELIMINARY_SCREENING'
}

export function buildDataQuality(
  params: ProvenanceValue[],
  fieldMatched: boolean
): DataQualitySummary {
  const counts = countByStatus(params)
  const total = params.length || 1
  const measured = counts.MEASURED || 0
  const modelled = counts.MODELLED || 0
  const estimated = counts.ESTIMATED || 0
  const derived = counts.DERIVED || 0
  const available = measured + modelled + estimated + derived + (counts.CALCULATED || 0)

  const overallConfidence = Math.round(
    (measured * 90 + modelled * 45 + estimated * 32 + derived * 40) / Math.max(1, available)
  )

  const missingCritical: string[] = [...CRITICAL_ALWAYS]
  if (!fieldMatched) {
    missingCritical.push('MATCHED_FIELD_INVESTIGATION')
  }

  return {
    overallConfidence: Number.isFinite(overallConfidence) ? overallConfidence : 0,
    measuredCoverage: Number(((measured / total) * 100).toFixed(1)),
    modelledCoverage: Number(((modelled / total) * 100).toFixed(1)),
    estimatedCoverage: Number(((estimated / total) * 100).toFixed(1)),
    derivedCoverage: Number(((derived / total) * 100).toFixed(1)),
    missingCriticalParameters: missingCritical,
    fieldValidationRequired: measured < 5,
  }
}

export function buildReportReadiness(params: ProvenanceValue[]): ReportReadiness {
  const counts = countByStatus(params)
  const total = params.length
  const measured = counts.MEASURED || 0
  const modelled = counts.MODELLED || 0
  const estimated = counts.ESTIMATED || 0
  const derived = counts.DERIVED || 0
  const calculated = counts.CALCULATED || 0
  const fieldReq = counts.FIELD_TEST_REQUIRED || 0
  const missing =
    (counts.NO_DATA || 0) +
    (counts.INSUFFICIENT_DATA || 0) +
    (counts.OUT_OF_RANGE || 0)
  const available = measured + modelled + estimated + derived + calculated

  return {
    totalParameters: total,
    availableParameters: available,
    measuredParameters: measured,
    modelledParameters: modelled,
    estimatedParameters: estimated,
    derivedParameters: derived,
    calculatedParameters: calculated,
    missingParameters: missing,
    fieldTestRequiredParameters: fieldReq,
    completionPercentage: total ? Number(((available / total) * 100).toFixed(1)) : 0,
    missingCriticalData: [...CRITICAL_ALWAYS],
  }
}

export function collectAllProvenance(intel: Partial<GeotechnicalIntelligence>): ProvenanceValue[] {
  const out: ProvenanceValue[] = []
  walkProvenance(intel.location, out)
  walkProvenance(intel.soilProfile, out)
  walkProvenance(intel.soilLayerParameters, out)
  walkProvenance(intel.boreholeInvestigationPlan, out)
  walkProvenance(intel.soilTestSummary, out)
  walkProvenance(intel.engineeringParameters, out)
  walkProvenance(intel.cbrAnalysis, out)
  walkProvenance(intel.cbrEngineAnalysis, out)
  walkProvenance(intel.resistivityAnalysis, out)
  walkProvenance(intel.resistivityEngineAnalysis, out)
  walkProvenance(intel.soilVerdictAnalysis, out)
  walkProvenance(intel.sbcAnalysis, out)
  walkProvenance(intel.sbcEngineAnalysis, out)
  walkProvenance(intel.settlementAnalysis, out)
  walkProvenance(intel.pileAnalysis, out)
  walkProvenance(intel.pileEngineAnalysis, out)
  return out.filter((p) => p && typeof p.status === 'string')
}

export function assertNoDataNeverZero(params: ProvenanceValue[]): string[] {
  const bad: string[] = []
  const blocked: GeoDataStatus[] = [
    'NO_DATA',
    'FIELD_TEST_REQUIRED',
    'INSUFFICIENT_DATA',
  ]
  for (const p of params) {
    if (blocked.includes(p.status) && p.value === 0) {
      bad.push(`${p.source}:${p.method}:${p.status}`)
    }
  }
  return bad
}
