/**
 * Settlement analysis — OSM buildings/places (not Photon as primary).
 */

import { overpassNearestKm } from '../siteSignals/overpassClient'
import type { SettlementAnalysisResult } from '../siteSignals/types'

const SETTLEMENT_SELECTORS = [
  'way["building"]',
  'node["place"~"city|town|village|hamlet|suburb"]',
  'way["landuse"="residential"]',
]

async function photonSettlementFallback(lat: number, lon: number): Promise<number | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent('village town')}&lat=${lat}&lon=${lon}&limit=8&osm_tag=${encodeURIComponent('place:village')}`
  const json = (await fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as {
    features?: { geometry?: { coordinates?: [number, number] } }[]
  } | null
  let best: number | null = null
  for (const f of json?.features ?? []) {
    const c = f.geometry?.coordinates
    if (!c) continue
    const R = 6371
    const dLat = ((c[1] - lat) * Math.PI) / 180
    const dLon = ((c[0] - lon) * Math.PI) / 180
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) * Math.cos((c[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
    const d = 2 * R * Math.asin(Math.sqrt(x))
    if (best == null || d < best) best = d
  }
  return best
}

export async function analyzeSettlement(lat: number, lon: number): Promise<SettlementAnalysisResult> {
  const primary = await overpassNearestKm(lat, lon, 4000, SETTLEMENT_SELECTORS)
  let nearestM = primary.found && primary.live ? primary.km * 1000 : null
  const sources = ['OSM Overpass']

  if (nearestM == null) {
    const fb = await photonSettlementFallback(lat, lon)
    if (fb != null) {
      nearestM = fb * 1000
      sources.push('Photon (low-confidence fallback)')
    }
  }

  const density: SettlementAnalysisResult['buildingDensity'] =
    nearestM == null ? 'NONE' : nearestM < 400 ? 'HIGH' : nearestM < 1200 ? 'MODERATE' : 'LOW'

  const conflict: SettlementAnalysisResult['residentialConflict'] =
    nearestM != null && nearestM < 300 ? 'HIGH' : nearestM != null && nearestM < 800 ? 'MODERATE' : 'LOW'

  const impact: SettlementAnalysisResult['towerImpact'] =
    conflict === 'HIGH' ? 'CONSTRAINED' : conflict === 'MODERATE' ? 'FAIR' : 'GOOD'

  return {
    nearestSettlementM: nearestM,
    buildingDensity: density,
    residentialConflict: conflict,
    towerImpact: impact,
    confidence: primary.live ? 74 : nearestM != null ? 48 : 0,
    sources,
  }
}
