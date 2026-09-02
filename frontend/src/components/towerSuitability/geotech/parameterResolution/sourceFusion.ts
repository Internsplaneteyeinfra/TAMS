/**
 * Fuse measured, project, GIS, and correlated sources into one resolved value.
 */

import type { ResolvedParameter, ResolutionStatus } from './parameterTypes'
import { scoreConfidence } from './confidenceEngine'

export interface SourceCandidate {
  value: number
  status: ResolutionStatus
  method: string
  source: string
  weight: number
}

const STATUS_PRIORITY: ResolutionStatus[] = [
  'MEASURED',
  'PROJECT_DATA',
  'REFERENCE_CALIBRATED',
  'GIS_DERIVED',
  'SATELLITE_DERIVED',
  'CALCULATED',
  'ENGINEERING_CORRELATED',
  'MODEL_PREDICTED',
  'ESTIMATED',
]

export function fuseNumeric(
  unit: string,
  candidates: SourceCandidate[],
  uncertaintyPct = 0.15
): ResolvedParameter {
  const valid = candidates.filter((c) => Number.isFinite(c.value))
  if (!valid.length) {
    return {
      value: 0,
      unit,
      status: 'MODEL_PREDICTED',
      method: 'No candidate sources — should not occur in normal GIS analysis',
      sourceChain: [],
      confidence: 0,
      uncertaintyRange: null,
    }
  }
  valid.sort((a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status))
  const best = valid[0]
  const conf = scoreConfidence({
    status: best.status,
    sourceCount: valid.length,
    agreementPct:
      valid.length > 1
        ? 100 - (Math.abs(valid[0].value - valid[1].value) / Math.max(valid[0].value, 1)) * 100
        : 85,
  })
  return {
    value: best.value,
    unit,
    status: best.status,
    method: best.method,
    sourceChain: valid.map((c) => c.source),
    confidence: conf,
    uncertaintyRange: {
      low: Number((best.value * (1 - uncertaintyPct)).toFixed(3)),
      high: Number((best.value * (1 + uncertaintyPct)).toFixed(3)),
    },
  }
}
