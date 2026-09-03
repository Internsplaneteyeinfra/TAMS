/**
 * Central confidence scoring — no random values, no false 99–100% for satellite predictions.
 */

import type { ResolutionStatus } from './parameterTypes'

const STATUS_BASE: Record<ResolutionStatus, number> = {
  MEASURED: 78,
  PROJECT_DATA: 72,
  REFERENCE_CALIBRATED: 58,
  GIS_DERIVED: 48,
  SATELLITE_DERIVED: 42,
  ENGINEERING_CORRELATED: 38,
  MODEL_PREDICTED: 35,
  CALCULATED: 52,
  ESTIMATED: 40,
}

export function scoreConfidence(opts: {
  status: ResolutionStatus
  sourceCount?: number
  depthM?: number
  agreementPct?: number
  heterogeneity?: 'low' | 'medium' | 'high'
}): number {
  let score = STATUS_BASE[opts.status] ?? 35
  const sources = opts.sourceCount ?? 1
  score += Math.min(12, (sources - 1) * 4)
  if (opts.agreementPct != null && opts.agreementPct >= 85) score += 6
  if (opts.agreementPct != null && opts.agreementPct < 60) score -= 8
  const depth = opts.depthM ?? 1.0
  if (depth > 2.0) score -= Math.min(15, (depth - 2.0) * 4)
  if (opts.heterogeneity === 'high') score -= 10
  if (opts.heterogeneity === 'medium') score -= 4
  return Math.max(18, Math.min(75, Math.round(score)))
}

export function confidenceLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 58) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}
