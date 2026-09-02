/**
 * Phase H — confidence scoring (separate from verdict).
 */

import type { EvidenceSummary, ConfidenceLevel, DimensionVerdict, ConflictRecord } from './types'
import { confidenceFromScore } from './adapters'

export function calculateOverallConfidence(
  evidence: EvidenceSummary,
  dimensions: DimensionVerdict[],
  conflicts: ConflictRecord[],
  dataQualityScore: number
): ConfidenceLevel {
  let score = dataQualityScore

  score += evidence.measured.length * 12
  score += evidence.correlated.length * 4
  score += evidence.modelled.length * 2
  score -= evidence.missing.length * 6
  score -= conflicts.filter((c) => c.severity === 'HIGH').length * 15
  score -= conflicts.filter((c) => c.severity === 'MEDIUM').length * 8

  const allLow = dimensions.every((d) => d.confidence === 'LOW' || d.confidence === 'VERY_LOW')
  if (allLow) score = Math.min(score, 35)

  return confidenceFromScore(Math.max(0, Math.min(100, score)))
}

export function confidenceExplanation(
  confidence: ConfidenceLevel,
  evidence: EvidenceSummary
): string {
  if (confidence === 'HIGH') {
    return 'Confidence is high due to measured field evidence supporting key parameters.'
  }
  if (confidence === 'MODERATE') {
    return 'Confidence is moderate — a mix of correlated and modelled inputs with some field data.'
  }
  if (confidence === 'LOW') {
    return `Confidence is low — results are based primarily on engineering correlations and geospatial models rather than site-specific investigation (${evidence.missing.length} critical gaps).`
  }
  return 'Confidence is very low — insufficient data for reliable engineering conclusions.'
}
