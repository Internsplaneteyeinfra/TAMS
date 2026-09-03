/**

 * Universal parameter resolution — single entry for all geotech engines.

 */



import type { EngineeringParameterSet } from '../types'

import { provenance } from '../provenance'

import { mergeResolvedParameters } from './projectDataFusion'

import type {

  LayerEngineeringParameters,

  ParameterResolutionInput,

  ResolvedParameterContext,

} from './parameterTypes'



export function buildResolvedParameterContext(input: ParameterResolutionInput): ResolvedParameterContext {

  return mergeResolvedParameters(input)

}



/** Map resolved site parameters to legacy EngineeringParameterSet for existing engines. */

export function toEngineeringParameterSet(ctx: ResolvedParameterContext): EngineeringParameterSet {

  const s = ctx.site

  const map = (r: typeof s.cohesionKpa, unit: string) =>

    provenance(r.value, {

      unit,

      source: r.sourceChain.join(' → ') || 'Parameter resolution PR-1',

      method: r.method,

      confidence: r.confidence,

      status: r.status as import('../types').GeoDataStatus,

      engineeringLimitation:

        r.status === 'MEASURED' || r.status === 'PROJECT_DATA'

          ? undefined

          : 'GIS-derived engineering estimate — validate by field investigation for final design',

      validityRange: r.uncertaintyRange

        ? `${r.uncertaintyRange.low}–${r.uncertaintyRange.high}`

        : undefined,

    })



  return {

    gammaKnM3: map(s.unitWeightKnM3, 'kN/m³'),

    dryDensityGcc: provenance(s.unitWeightTm3.value, {

      unit: 'g/cm³',

      source: 'Derived from resolved unit weight',

      method: 'ρ = γ / 9.81',

      confidence: s.unitWeightKnM3.confidence,

      status: s.unitWeightKnM3.status as import('../types').GeoDataStatus,

    }),

    phiDeg: map(s.frictionAngleDeg, '°'),

    cohesionKpa: map(s.cohesionKpa, 'kPa'),

    notes: s.notes,

  }

}



export function resolveLayerAtDepth(

  ctx: ResolvedParameterContext,

  depthM: number

): LayerEngineeringParameters | null {

  if (depthM <= 0.5) return ctx.byLayer.find((l) => l.reportDepth === '0.0-0.5m') ?? null

  if (depthM <= 1.0) return ctx.byLayer.find((l) => l.reportDepth === '0.5-1.0m') ?? null

  if (depthM <= 1.5) return ctx.byLayer.find((l) => l.reportDepth === '1.0-1.5m') ?? null

  return ctx.byLayer.find((l) => l.reportDepth === '1.5-2.0m') ?? ctx.byLayer[ctx.byLayer.length - 1] ?? null

}

