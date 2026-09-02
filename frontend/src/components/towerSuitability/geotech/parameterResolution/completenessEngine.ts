/**
 * G2 — Parameter completeness verification before engineering analysis.
 */

import type { LayerEngineeringParameters, ResolvedParameterContext } from './parameterTypes'

export type CompletenessParameterId =
  | 'gravel'
  | 'sand'
  | 'silt'
  | 'clay'
  | 'liquidLimit'
  | 'plasticLimit'
  | 'plasticityIndex'
  | 'soilClassification'
  | 'bulkDensity'
  | 'dryDensity'
  | 'mdd'
  | 'omc'
  | 'specificGravity'
  | 'cohesion'
  | 'frictionAngle'
  | 'equivalentSptN'
  | 'ucs'
  | 'fsi'
  | 'cbr'
  | 'resistivity'
  | 'unitWeight'

export interface CompletenessEntry {
  id: CompletenessParameterId
  label: string
  value: number | string | null
  unit: string
  status: string
  source: string
  method: string
  confidence: number
  calculationTrace: string
  resolved: boolean
}

export interface ParameterCompletenessResult {
  completeParameters: CompletenessEntry[]
  partiallyResolvedParameters: CompletenessEntry[]
  unresolvedParameters: CompletenessEntry[]
  completionPct: number
}

const UNRESOLVED_STATUSES = new Set(['NO_DATA', 'FIELD_TEST_REQUIRED', 'INSUFFICIENT_DATA'])

function entryFromResolved(
  id: CompletenessParameterId,
  label: string,
  r: { value: number | string; unit: string; status: string; sourceChain: string[]; method: string; confidence: number },
  trace: string
): CompletenessEntry {
  const resolved = !UNRESOLVED_STATUSES.has(r.status) && r.value != null && Number.isFinite(r.value as number)
  return {
    id,
    label,
    value: r.value,
    unit: r.unit,
    status: r.status,
    source: r.sourceChain[0] ?? 'Parameter resolution',
    method: r.method,
    confidence: r.confidence,
    calculationTrace: trace,
    resolved: resolved || typeof r.value === 'string',
  }
}

function layerEntries(layer: LayerEngineeringParameters, depthLabel: string): CompletenessEntry[] {
  const prefix = `${depthLabel}: `
  return [
    entryFromResolved('gravel', prefix + 'Gravel', layer.gravelPct, 'Grain size normalization'),
    entryFromResolved('sand', prefix + 'Sand', layer.sandPct, 'SoilGrids texture'),
    entryFromResolved('silt', prefix + 'Silt', layer.siltPct, 'SoilGrids texture'),
    entryFromResolved('clay', prefix + 'Clay', layer.clayPct, 'SoilGrids texture'),
    entryFromResolved('liquidLimit', prefix + 'LL', layer.liquidLimit, 'PI correlation C-LL'),
    entryFromResolved('plasticLimit', prefix + 'PL', layer.plasticLimit, 'PI correlation C-PL'),
    entryFromResolved('plasticityIndex', prefix + 'PI', layer.plasticityIndex, 'PI = LL − PL'),
    entryFromResolved('soilClassification', prefix + 'IS Class', layer.isClassification, 'IS 1498 from texture'),
    entryFromResolved('bulkDensity', prefix + 'Bulk density', layer.bulkDensityGcc, 'SoilGrids bdod'),
    entryFromResolved('dryDensity', prefix + 'Dry density', layer.dryDensityGcc, 'Density model'),
    entryFromResolved('mdd', prefix + 'MDD', layer.maximumDryDensityGcc, 'Texture correlation'),
    entryFromResolved('omc', prefix + 'OMC', layer.optimumMoistureContentPct, 'Texture correlation'),
    entryFromResolved('specificGravity', prefix + 'SG', layer.specificGravity, 'Mineralogical proxy'),
    entryFromResolved('cohesion', prefix + 'Cohesion', layer.cohesionKpa, 'Clay/PI correlation'),
    entryFromResolved('frictionAngle', prefix + 'φ', layer.frictionAngleDeg, 'Texture handbook'),
    entryFromResolved('equivalentSptN', prefix + 'Equiv. SPT N', layer.equivalentSptN, 'GIS equivalent N model'),
    entryFromResolved('ucs', prefix + 'UCS', layer.ucsKgCm2, 'Cohesion consistency model'),
    entryFromResolved('fsi', prefix + 'FSI', layer.freeSwellingIndexPct, 'Swelling potential model'),
    entryFromResolved('cbr', prefix + 'CBR', layer.estimatedCbrPct, 'Texture/PI CBR correlation'),
    entryFromResolved('resistivity', prefix + 'Resistivity', layer.estimatedResistivityOhmM, 'Grain-size resistivity model'),
    entryFromResolved('unitWeight', prefix + 'γ', layer.unitWeightKnM3, 'Bulk density × g'),
  ]
}

export function validateParameterCompleteness(ctx: ResolvedParameterContext): ParameterCompletenessResult {
  const all: CompletenessEntry[] = []
  for (const layer of ctx.byLayer) {
    all.push(...layerEntries(layer, layer.reportDepthLabel))
  }

  const site = ctx.site
  all.push(
    entryFromResolved('cohesion', 'Site cohesion', site.cohesionKpa, 'Fused site cohesion'),
    entryFromResolved('frictionAngle', 'Site φ', site.frictionAngleDeg, 'Fused site φ'),
    entryFromResolved('unitWeight', 'Site γ', site.unitWeightKnM3, 'Fused site unit weight'),
    entryFromResolved('equivalentSptN', 'Site equiv. SPT N', site.equivalentSptN, 'Fused site SPT N')
  )

  const complete = all.filter((e) => e.resolved)
  const unresolved = all.filter((e) => !e.resolved)
  const partial = unresolved.filter((e) => e.value != null)

  const completionPct = all.length ? Math.round((complete.length / all.length) * 100) : 0

  return {
    completeParameters: complete,
    partiallyResolvedParameters: partial,
    unresolvedParameters: unresolved.filter((e) => e.value == null),
    completionPct,
  }
}

export function resolveMissingParameter(
  id: CompletenessParameterId,
  ctx: ResolvedParameterContext
): CompletenessEntry | null {
  const result = validateParameterCompleteness(ctx)
  const found =
    result.completeParameters.find((e) => e.id === id) ??
    result.partiallyResolvedParameters.find((e) => e.id === id) ??
    result.unresolvedParameters.find((e) => e.id === id)
  return found ?? null
}
