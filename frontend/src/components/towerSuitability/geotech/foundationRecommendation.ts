/**
 * H2 — Foundation recommendation from soil verdict, SBC, pile, terrain.
 */

import type { GeotechnicalIntelligence } from './types'

export type FoundationCategory =
  | 'SHALLOW_FOUNDATION'
  | 'RAFT_FOUNDATION'
  | 'PILE_FOUNDATION'
  | 'GROUND_IMPROVEMENT'
  | 'SITE_NOT_RECOMMENDED'

export interface FoundationRecommendation {
  category: FoundationCategory
  label: string
  whyRecommended: string
  governingParameters: string[]
  potentialRisks: string[]
  alternativeFoundation: string | null
  confidence: 'HIGH' | 'MODERATE' | 'LOW'
  disclaimer: string
}

export function recommendFoundation(geo: GeotechnicalIntelligence): FoundationRecommendation {
  const sbc = geo.sbcEngineAnalysis?.siteSummary.adoptedPreliminary?.value
  const sbcStatus = geo.sbcEngineAnalysis?.calculationStatus
  const slope = geo.location.slopeDeg.value ?? 0
  const clayHeavy = (geo.soilLayerParameters ?? []).some((l) => (l.clayPct.value ?? 0) >= 30)
  const pileOk = geo.pileEngineAnalysis?.byBorehole[0]?.matrix.some(
    (c) => c.verticalCapacity.safe_T.value != null && (c.verticalCapacity.safe_T.value as number) >= 5
  )
  const cbr = geo.cbrEngineAnalysis?.recommendedDesignCbr.value
  const verdict = geo.soilVerdictAnalysis?.overall.status

  const governing: string[] = []
  const risks: string[] = []

  if (slope > 12) {
    governing.push(`Slope ${slope.toFixed(1)}° exceeds shallow footing comfort`)
    risks.push('Slope instability and differential settlement on sloping ground')
  }
  if (clayHeavy) {
    governing.push('Clay fraction ≥ 30% in upper profile')
    risks.push('Volume change and reduced drained shear strength in clay layers')
  }
  if (sbc != null) governing.push(`Preliminary SBC ≈ ${sbc} T/m²`)
  if (cbr != null && cbr < 5) {
    governing.push(`Low design CBR (${cbr}%)`)
    risks.push('Poor construction access — ground improvement may be needed for haul roads')
  }

  let category: FoundationCategory = 'SHALLOW_FOUNDATION'
  let why = 'Preliminary SBC and soil profile support isolated shallow footings at screened depth.'
  let alternative: string | null = 'Pile foundation if tower loads exceed shallow capacity'
  let confidence: FoundationRecommendation['confidence'] = 'MODERATE'

  if (verdict === 'INSUFFICIENT_DATA' && !sbc) {
    category = 'SITE_NOT_RECOMMENDED'
    why = 'Insufficient resolved soil parameters for preliminary foundation selection — commission investigation.'
    alternative = null
    confidence = 'LOW'
  } else if (slope > 15 || (sbc != null && sbc < 8 && pileOk)) {
    category = 'PILE_FOUNDATION'
    why = pileOk
      ? 'Shallow capacity marginal or slope constraint — preliminary pile matrix shows usable capacity.'
      : 'Slope or low SBC favours deep foundation — verify pile capacity with field investigation.'
    alternative = 'Raft on improved platform where pile access is difficult'
    confidence = pileOk ? 'MODERATE' : 'LOW'
  } else if (clayHeavy && (sbc == null || sbc < 12)) {
    category = 'GROUND_IMPROVEMENT'
    why = 'Clay-dominated profile with limited shallow capacity — consider replacement, preloading, or piles.'
    alternative = 'Pile foundation bypassing weak clay'
    confidence = 'MODERATE'
  } else if (sbc != null && sbc >= 15 && slope <= 8 && sbcStatus === 'CALCULATED') {
    category = 'SHALLOW_FOUNDATION'
    why = 'GIS-engineered SBC and moderate slope support shallow isolated footings for preliminary planning.'
    confidence = geo.fieldInvestigationMatch.usedForMeasuredParams ? 'HIGH' : 'MODERATE'
  } else if (sbc != null && sbc >= 10 && slope <= 10) {
    category = 'RAFT_FOUNDATION'
    why = 'Moderate bearing capacity — raft may distribute loads where pad spacing is tight.'
    alternative = 'Shallow isolated footings if geotechnical investigation confirms uniform strata'
    confidence = 'MODERATE'
  }

  if (!risks.length) risks.push('All values are GIS/model estimates — field verification mandatory before construction')

  return {
    category,
    label: category.replace(/_/g, ' '),
    whyRecommended: why,
    governingParameters: governing.length ? governing : ['Soil profile screening', 'Preliminary SBC analysis'],
    potentialRisks: risks,
    alternativeFoundation: alternative,
    confidence,
    disclaimer:
      'Preliminary engineering recommendation only — not structural design approval. Final foundation type requires field investigation and licensed structural design.',
  }
}
