/**
 * Physical and engineering validation — recalculate bounds, never silent bad values.
 */

import type { LayerEngineeringParameters, ResolvedParameterContext } from './parameterResolution/parameterTypes'

export interface ValidationIssue {
  parameter: string
  message: string
  severity: 'warning' | 'error'
}

export function validateGrainFractions(layer: LayerEngineeringParameters): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const sum =
    layer.gravelPct.value + layer.sandPct.value + layer.siltPct.value + layer.clayPct.value
  if (sum < 98 || sum > 102) {
    issues.push({
      parameter: 'grain_size_sum',
      message: `Grain fractions sum to ${sum.toFixed(1)}% — expected ≈100%`,
      severity: 'warning',
    })
  }
  return issues
}

export function validateAtterberg(layer: LayerEngineeringParameters): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const ll = layer.liquidLimit.value
  const pl = layer.plasticLimit.value
  const pi = layer.plasticityIndex.value
  if (ll > 0 && pl > 0 && pl > ll) {
    issues.push({ parameter: 'PL', message: 'Plastic limit exceeds liquid limit', severity: 'error' })
  }
  if (ll > 0 && pl >= 0 && Math.abs(pi - (ll - pl)) > 0.5) {
    issues.push({ parameter: 'PI', message: `PI (${pi}) ≠ LL − PL (${ll - pl})`, severity: 'error' })
  }
  return issues
}

export function validateEngineeringRanges(layer: LayerEngineeringParameters): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const checks: Array<{ p: keyof LayerEngineeringParameters; min: number; max: number }> = [
    { p: 'frictionAngleDeg', min: 10, max: 45 },
    { p: 'cohesionKpa', min: 0, max: 150 },
    { p: 'equivalentSptN', min: 1, max: 60 },
    { p: 'estimatedCbrPct', min: 0, max: 50 },
    { p: 'estimatedResistivityOhmM', min: 5, max: 2000 },
  ]
  for (const { p, min, max } of checks) {
    const param = layer[p] as { value: number }
    if (param.value < min || param.value > max) {
      issues.push({
        parameter: String(p),
        message: `${String(p)} = ${param.value} outside ${min}–${max}`,
        severity: 'error',
      })
    }
  }
  return issues
}

export function validateResolvedContext(ctx: ResolvedParameterContext): ValidationIssue[] {
  const all: ValidationIssue[] = []
  for (const layer of ctx.byLayer) {
    all.push(...validateGrainFractions(layer), ...validateAtterberg(layer), ...validateEngineeringRanges(layer))
  }
  return all
}
