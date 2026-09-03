/**
 * J1 — Tower location suggestion engine (wraps existing corridor planner).
 */

import type { KmlFeature } from '../fetchSiteSignals'
import type { GeotechnicalIntelligence } from '../geotech'
import type { NearbyPowerSupply } from '../nearbyPowerSupply'
import type { SuitabilityResult } from '../scoring'
import { generateTowerCandidates } from './generateTowerCandidates'
import type { PowerInfrastructureSummary, TowerCandidate } from './types'

export interface TowerSuggestionInput {
  planningKmlFeatures: KmlFeature[]
  geo: GeotechnicalIntelligence
  power: NearbyPowerSupply | null
  powerSummary: PowerInfrastructureSummary
  searchRadiusKm: number
  voltageKv?: number | null
  baseSuitability?: SuitabilityResult
}

export interface TowerSuggestionResult {
  candidates: TowerCandidate[]
  generatedAt: string
  method: string
}

/** Generate ranked tower candidate locations along line/polygon geometry. */
export function suggestTowerLocations(input: TowerSuggestionInput): TowerSuggestionResult {
  const candidates = generateTowerCandidates({
    planningKmlFeatures: input.planningKmlFeatures,
    geo: input.geo,
    power: input.power,
    powerSummary: input.powerSummary,
    searchRadiusKm: input.searchRadiusKm,
    voltageKv: input.voltageKv,
    baseSuitability: input.baseSuitability,
  })

  return {
    candidates,
    generatedAt: new Date().toISOString(),
    method:
      'Corridor span planning + soil/terrain screening + optional power proximity (GIS-detected infrastructure only)',
  }
}
