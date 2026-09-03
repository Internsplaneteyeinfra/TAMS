/**
 * Site signal orchestrator — independent resolution via Promise.allSettled.
 * One failed provider must not crash the entire analysis.
 */

import { analyzeFlood } from '../flood/floodAnalysisEngine'
import { analyzeLandCover, landCoverHintToLegacy } from '../landCover/landCoverAnalysisEngine'
import { analyzeSettlement } from '../settlement/settlementAnalysisEngine'
import { analyzeTerrain } from '../terrain/terrainAnalysisEngine'
import { analyzeWater } from '../water/waterAnalysisEngine'
import type { SiteSignalsEnrichment } from './types'

export type ResolveSiteSignalsInput = {
  lat: number
  lon: number
  corridor?: Array<{ lat: number; lon: number }>
}

export type SiteSignalsOrchestratorResult = SiteSignalsEnrichment & {
  /** Legacy land cover hint for scoring.ts compatibility */
  landCoverHint: 'barren' | 'vegetation' | 'built' | 'water' | 'unknown'
  waterKm: number | null
  buildingKm: number | null
  elevationM: number | null
  slopeDeg: number | null
}

export async function resolveSiteSignalEnrichment(
  input: ResolveSiteSignalsInput
): Promise<SiteSignalsOrchestratorResult> {
  const { lat, lon, corridor } = input

  const [terrainSettled, settlementSettled, landSettled] = await Promise.allSettled([
    analyzeTerrain(lat, lon, corridor),
    analyzeSettlement(lat, lon),
    analyzeLandCover(lat, lon),
  ])

  const terrain = terrainSettled.status === 'fulfilled' ? terrainSettled.value : null
  const settlement = settlementSettled.status === 'fulfilled' ? settlementSettled.value : null
  const landCover = landSettled.status === 'fulfilled' ? landSettled.value : null

  let water: Awaited<ReturnType<typeof analyzeWater>> | null = null
  let flood: Awaited<ReturnType<typeof analyzeFlood>> | null = null

  try {
    water = await analyzeWater(lat, lon, terrain?.drainageDirection ?? 'S', {
      slopeDeg: terrain?.slopeDeg ?? null,
      relativeDepressionM: terrain?.relativeDepressionM ?? null,
    })
  } catch {
    water = null
  }

  try {
    flood = await analyzeFlood(lat, lon, terrain, water)
  } catch {
    flood = null
  }

  const landCoverHint = landCover ? landCoverHintToLegacy(landCover.hint) : 'unknown'
  const waterKm = water?.nearestDistanceM != null ? water.nearestDistanceM / 1000 : null
  const buildingKm = settlement?.nearestSettlementM != null ? settlement.nearestSettlementM / 1000 : null

  return {
    terrain,
    water,
    flood,
    settlement,
    landCover,
    landCoverHint,
    waterKm,
    buildingKm,
    elevationM: terrain?.elevationM ?? null,
    slopeDeg: terrain?.slopeDeg ?? null,
  }
}
