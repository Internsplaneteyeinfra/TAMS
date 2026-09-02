/**
 * Phase H — CBR / access road verdict (consumes Phase G CBR output).
 */

import type { GeotechnicalIntelligence } from '../types'
import { provenancePhrase, verdictToColor, confidenceFromScore } from './adapters'
import type { DimensionVerdict } from './types'

export function evaluateCbrVerdict(geo: GeotechnicalIntelligence): DimensionVerdict {
  const cbr = geo.cbrEngineAnalysis
  const trace = [] as DimensionVerdict['evidenceTrace']

  if (!cbr) {
    return {
      dimension: 'ACCESS_ROAD',
      status: 'INSUFFICIENT_DATA',
      color: 'GREY',
      evidenceStrength: 'LEVEL_4_ASSUMED_UNKNOWN',
      confidence: 'VERY_LOW',
      supportingEvidence: [],
      uncertainties: ['CBR analysis not available'],
      requiredNextAction: 'Complete soil profile for transmission access road assessment',
      evidenceTrace: trace,
    }
  }

  const fieldRequired = cbr.byDepth.some((d) => d.correlatedCbrPct.status === 'FIELD_TEST_REQUIRED')
  const correlated = cbr.byDepth.filter((d) => d.correlatedCbrPct.status === 'ENGINEERING_CORRELATED')
  const measured = cbr.measuredByDepth.some((d) => d.measuredCBR.status === 'MEASURED')
  const minCbr = correlated.length
    ? Math.min(...correlated.map((d) => d.correlatedCbrPct.value as number))
    : null
  const poorRoad = minCbr != null && minCbr <= 5

  let verdictStatus: DimensionVerdict['status'] = 'INVESTIGATION_REQUIRED'
  if (poorRoad) verdictStatus = 'ENGINEERING_CONSTRAINT_IDENTIFIED'
  else if (fieldRequired && correlated.length === 0) verdictStatus = 'INVESTIGATION_REQUIRED'
  else if (fieldRequired) verdictStatus = 'INVESTIGATION_REQUIRED'
  else if (correlated.length === 4) verdictStatus = 'CONDITIONALLY_SUPPORTIVE'
  else if (correlated.length > 0) verdictStatus = 'CONDITIONALLY_SUPPORTIVE'
  else verdictStatus = 'INVESTIGATION_REQUIRED'

  const uncertainties = [
    'CBR values are engineering-correlated — not laboratory soaked CBR',
    fieldRequired ? 'One or more depth layers require field soaked CBR test' : '',
    'Transmission tower access and construction roads — not solar road design',
  ].filter(Boolean)

  const score = measured ? 78 : correlated.length === 4 ? 42 : fieldRequired ? 20 : 30

  return {
    dimension: 'ACCESS_ROAD',
    status: verdictStatus,
    color: verdictToColor(verdictStatus),
    evidenceStrength: measured ? 'LEVEL_1_MEASURED' : correlated.length ? 'LEVEL_2_ENGINEERING_CORRELATION' : 'LEVEL_4_ASSUMED_UNKNOWN',
    confidence: confidenceFromScore(score),
    supportingEvidence: [
      cbr.recommendedDesignCbr.value != null
        ? `${provenancePhrase(cbr.recommendedDesignCbr.status)} recommended design CBR of ${cbr.recommendedDesignCbr.value}% (conservative minimum across 0–2 m)`
        : '',
      correlated.length > 0 ? `Correlated CBR available for ${correlated.length}/4 depth layers` : '',
    ].filter(Boolean),
    uncertainties,
    requiredNextAction:
      fieldRequired || cbr.recommendedDesignCbr.value == null
        ? 'Do not generate final road design — field soaked CBR test required'
        : 'Preliminary access route planning may continue; confirm with field soaked CBR before pavement design',
    evidenceTrace: trace,
  }
}
