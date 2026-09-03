/**
 * Phase H — Pile foundation verdict (consumes Phase F output).
 */

import type { GeotechnicalIntelligence } from '../types'
import { provenancePhrase, verdictToColor, confidenceFromScore } from './adapters'
import type { DimensionVerdict } from './types'

export function evaluatePileVerdict(geo: GeotechnicalIntelligence): DimensionVerdict {
  const pile = geo.pileEngineAnalysis
  const trace = [] as DimensionVerdict['evidenceTrace']

  if (!pile?.byBorehole.length) {
    return {
      dimension: 'PILE_FOUNDATION',
      status: 'INSUFFICIENT_DATA',
      color: 'GREY',
      evidenceStrength: 'LEVEL_4_ASSUMED_UNKNOWN',
      confidence: 'VERY_LOW',
      supportingEvidence: [],
      uncertainties: ['Pile analysis not available'],
      requiredNextAction: 'Complete soil profile and pile analysis inputs',
      evidenceTrace: trace,
    }
  }

  const bh = pile.siteSummary
  const calculated = bh.matrix.filter((c) => c.calculationStatus === 'CALCULATED')
  const hasCapacity = bh.matrix.some((c) => c.verticalCapacity.safe_T.value != null)
  const lateralBlocked = bh.matrix.every((c) => c.lateralCapacity.safe_T.status === 'FIELD_TEST_REQUIRED')

  let verdictStatus: DimensionVerdict['status'] = 'INVESTIGATION_REQUIRED'
  if (calculated.length > 0 || hasCapacity) verdictStatus = 'CONDITIONALLY_SUPPORTIVE'
  else if (
    pile.calculationStatus === 'INSUFFICIENT_DATA' ||
    pile.calculationStatus === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
  )
    verdictStatus = 'INVESTIGATION_REQUIRED'

  const sample = calculated[0] ?? bh.matrix[0]
  const hasMeasured = sample?.verticalCapacity.safe_T.status === 'MEASURED'

  const uncertainties = [
    'Pile capacities are correlated static estimates — not pile load test results',
    lateralBlocked ? 'Lateral capacity blocked pending tower structural loads' : '',
    bh.matrix.some((c) => c.missingParameters.includes('sptN')) ? 'SPT N not available — not fabricated' : '',
    'Groundwater condition unknown for uplift assessment',
  ].filter(Boolean)

  const score = hasMeasured ? 75 : calculated.length >= 3 ? 45 : 28

  return {
    dimension: 'PILE_FOUNDATION',
    status: verdictStatus,
    color: verdictToColor(verdictStatus),
    evidenceStrength: hasMeasured ? 'LEVEL_1_MEASURED' : calculated.length ? 'LEVEL_2_ENGINEERING_CORRELATION' : 'LEVEL_4_ASSUMED_UNKNOWN',
    confidence: confidenceFromScore(score),
    supportingEvidence:
      calculated.length > 0
        ? [
            `Preliminary pile feasibility appears supportive for ${calculated.length}/6 combinations (${provenancePhrase(sample.verticalCapacity.safe_T.status)} vertical capacity)`,
          ]
        : [],
    uncertainties,
    requiredNextAction:
      calculated.length > 0
        ? 'Borehole and in-situ verification (SPT/CPT) required before adopting pile design capacities'
        : 'Field investigation required — insufficient c–φ inputs for pile capacity',
    evidenceTrace: trace,
  }
}
