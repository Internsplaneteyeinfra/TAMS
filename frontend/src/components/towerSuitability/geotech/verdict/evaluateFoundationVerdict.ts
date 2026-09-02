/**
 * Phase H — Foundation verdict (consumes Phase E SBC output).
 */

import type { GeotechnicalIntelligence } from '../types'
import { provenancePhrase, verdictToColor, confidenceFromScore } from './adapters'
import type { DimensionVerdict } from './types'

export function evaluateFoundationVerdict(geo: GeotechnicalIntelligence): DimensionVerdict {
  const sbc = geo.sbcEngineAnalysis
  const layers = geo.soilLayerParameters ?? []
  const trace = [] as DimensionVerdict['evidenceTrace']

  if (!layers.length && !sbc) {
    return {
      dimension: 'FOUNDATION',
      status: 'INSUFFICIENT_DATA',
      color: 'GREY',
      evidenceStrength: 'LEVEL_4_ASSUMED_UNKNOWN',
      confidence: 'VERY_LOW',
      supportingEvidence: [],
      uncertainties: ['No soil profile or SBC analysis available'],
      requiredNextAction: 'Commission borehole investigation and laboratory testing',
      evidenceTrace: trace,
    }
  }

  const status = sbc?.calculationStatus
  const adopted = sbc?.siteSummary.adoptedPreliminary
  const hasMeasured = adopted?.status === 'MEASURED'
  const hasCalculated = status === 'CALCULATED' || status === 'PARTIAL'
  const clayHeavy = layers.some((l) => (l.clayPct.value ?? 0) >= 25)
  const cohesionResolved =
    geo.resolvedParameterContext?.site.cohesionKpa.status !== 'FIELD_TEST_REQUIRED' &&
    geo.resolvedParameterContext?.site.cohesionKpa.value != null
  const cohesionBlocked = !cohesionResolved && geo.engineeringParameters.cohesionKpa.status === 'FIELD_TEST_REQUIRED'

  let verdictStatus: DimensionVerdict['status'] = 'INSUFFICIENT_DATA'
  if (hasMeasured && hasCalculated) verdictStatus = 'PRELIMINARILY_SUPPORTIVE'
  else if (hasCalculated) verdictStatus = 'PRELIMINARILY_SUPPORTIVE'
  else if (clayHeavy && cohesionBlocked) verdictStatus = 'INVESTIGATION_REQUIRED'
  else if (status === 'INSUFFICIENT_DATA' || status === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT')
    verdictStatus = 'INVESTIGATION_REQUIRED'
  else verdictStatus = 'CONDITIONALLY_SUPPORTIVE'

  const uncertainties: string[] = []
  if (!hasMeasured) uncertainties.push('No measured SBC or borehole shear strength at this site')
  if (cohesionBlocked) uncertainties.push('Cohesion for clay layers requires laboratory verification')
  if (sbc?.foundation.groundwater === 'unknown') uncertainties.push('Groundwater influence on foundation not assessed')

  const score = hasMeasured ? 80 : hasCalculated ? 48 : clayHeavy ? 25 : 35

  return {
    dimension: 'FOUNDATION',
    status: verdictStatus,
    color: verdictToColor(verdictStatus),
    evidenceStrength: hasMeasured ? 'LEVEL_1_MEASURED' : hasCalculated ? 'LEVEL_2_ENGINEERING_CORRELATION' : 'LEVEL_4_ASSUMED_UNKNOWN',
    confidence: confidenceFromScore(score),
    supportingEvidence: [
      hasCalculated && adopted?.value != null
        ? `${provenancePhrase(adopted.status)} preliminary SBC of ${adopted.value} T/m²`
        : geo.soilScreeningSummary?.indicativeSbcTm2.value
          ? `Indicative screening SBC range ${geo.soilScreeningSummary.indicativeSbcTm2.value.low}–${geo.soilScreeningSummary.indicativeSbcTm2.value.high} T/m²`
          : 'Soil classification and grain size from shared soil profile',
    ].filter(Boolean) as string[],
    uncertainties,
    requiredNextAction:
      verdictStatus === 'PRELIMINARILY_SUPPORTIVE' && !hasMeasured
        ? 'Preliminary planning may continue; final foundation design requires borehole and in-situ verification'
        : 'Borehole investigation, SPT/shear testing, and laboratory Atterberg limits required before final design',
    evidenceTrace: trace,
  }
}
