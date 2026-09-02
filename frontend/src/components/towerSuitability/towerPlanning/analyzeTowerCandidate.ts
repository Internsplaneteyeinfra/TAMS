/**
 * Phase I — analyze tower candidate using existing suitability engine (no A–H recalculation).
 */

import { collectSiteSignals } from '../fetchSiteSignals'
import { scoreSiteSignals } from '../scoring'
import type { GeotechnicalIntelligence } from '../geotech'
import type { TowerCandidate, TowerCandidateAnalysis } from './types'

export async function analyzeTowerCandidate(opts: {
  candidate: TowerCandidate
  geotechnicalIntelligence: GeotechnicalIntelligence
  corridor?: Array<{ lat: number; lon: number }>
  searchRadiusKm: number
  onProgress?: (message: string, percent: number) => void
}): Promise<TowerCandidateAnalysis> {
  const signals = await collectSiteSignals(
    opts.candidate.latitude,
    opts.candidate.longitude,
    (message, percent) => opts.onProgress?.(message, percent),
    {
      corridor: opts.corridor && opts.corridor.length >= 2 ? opts.corridor : undefined,
      searchRadiusKm: opts.searchRadiusKm,
      includePowerInfrastructure: false,
    }
  )

  const suitability = scoreSiteSignals(signals)

  const mandatory =
    opts.geotechnicalIntelligence.soilVerdictAnalysis?.investigationPriorities
      .filter((p) => p.mandate === 'MANDATORY')
      .map((p) => p.investigationType) ?? []

  return {
    candidate: opts.candidate,
    suitability,
    geotechnicalContext: opts.geotechnicalIntelligence,
    finalStatus: 'PRELIMINARY_RECOMMENDATION',
    mandatoryInvestigations: mandatory,
    analyzedAt: new Date().toISOString(),
  }
}
