/**
 * Water analysis — OSM Overpass chain + terrain drainage supplement.
 */

import { resolveSignal } from '../siteSignals/signalResolver'
import { overpassNearestKm } from '../siteSignals/overpassClient'
import type { WaterAnalysisResult, WaterBodyType, WaterRiskLevel } from '../siteSignals/types'

const WATER_SELECTORS = [
  'way["natural"="water"]',
  'relation["natural"="water"]',
  'way["waterway"]',
  'way["landuse"="reservoir"]',
  'way["landuse"="basin"]',
  'way["water"]',
  'way["natural"="wetland"]',
]

function classifyWaterType(tags?: Record<string, string>): WaterBodyType {
  if (!tags) return 'unknown'
  const w = `${tags.waterway ?? ''} ${tags.natural ?? ''} ${tags.landuse ?? ''} ${tags.water ?? ''}`.toLowerCase()
  if (/river/.test(w)) return 'river'
  if (/stream|ditch|drain/.test(w)) return 'stream'
  if (/canal/.test(w)) return 'canal'
  if (/reservoir|basin/.test(w)) return 'reservoir'
  if (/lake|pond/.test(w)) return 'lake'
  if (/wetland|marsh|swamp/.test(w)) return 'wetland'
  if (/water/.test(w)) return 'water'
  return 'unknown'
}

function waterRiskFromDistance(m: number): WaterRiskLevel {
  if (m < 100) return 'VERY_HIGH'
  if (m < 300) return 'HIGH'
  if (m < 800) return 'MODERATE'
  if (m < 2000) return 'LOW'
  return 'VERY_LOW'
}

async function photonWaterFallback(lat: number, lon: number): Promise<number | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent('lake river reservoir')}&lat=${lat}&lon=${lon}&limit=8&osm_tag=${encodeURIComponent('natural:water')}`
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

/** Terrain-based drainage proxy when no water mapped nearby. */
function terrainWaterProxyKm(slopeDeg: number | null, relativeDepressionM: number | null): number {
  const slope = slopeDeg ?? 5
  const depression = relativeDepressionM ?? 0
  const base = 2.5 - slope * 0.08 + depression * 0.15
  return Math.max(0.4, Math.min(6, base))
}

export async function analyzeWater(
  lat: number,
  lon: number,
  drainageDirection: string,
  terrain?: { slopeDeg: number | null; relativeDepressionM: number | null }
): Promise<WaterAnalysisResult> {
  let detectedType: WaterBodyType = 'unknown'

  const signal = await resolveSignal({
    id: 'water',
    primary: async () => {
      const hit = await overpassNearestKm(lat, lon, 8000, WATER_SELECTORS)
      if (!hit.live || !hit.found) return null
      const el = hit.elements[0]
      detectedType = classifyWaterType(el?.tags)
      return hit.km * 1000
    },
    secondary: async () => {
      const hit = await overpassNearestKm(lat, lon, 12000, WATER_SELECTORS)
      if (!hit.live || !hit.found) return null
      return hit.km * 1000
    },
    tertiary: async () => {
      const km = await photonWaterFallback(lat, lon)
      return km != null ? km * 1000 : null
    },
    engineeringFallback: async () => terrainWaterProxyKm(terrain?.slopeDeg ?? null, terrain?.relativeDepressionM ?? null) * 1000,
    modelConfidence: 48,
    sourceTypeForModel: 'ENGINEERING_CORRELATION',
    methodForModel: 'Terrain slope + local depression drainage proxy',
  })

  const distM = signal.value
  const risk = distM != null ? waterRiskFromDistance(distM) : 'MODERATE'

  return {
    nearestDistanceM: distM,
    waterType: detectedType,
    waterRisk: risk,
    drainageDirection,
    sources: signal.providerChain,
    confidence: signal.confidence,
    signal,
  }
}
