/**
 * Flood intelligence — live forecast only when configured; otherwise multi-source susceptibility model.
 * Does NOT fake Google Flood Hub data.
 */

import type { FloodAnalysisResult, FloodRiskLevel } from '../siteSignals/types'
import type { TerrainAnalysisResult } from '../siteSignals/types'
import type { WaterAnalysisResult } from '../siteSignals/types'

function riskFromScore(score: number): FloodRiskLevel {
  if (score >= 80) return 'VERY_HIGH'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MODERATE'
  if (score >= 20) return 'LOW'
  return 'VERY_LOW'
}

async function recentRainfallMm(lat: number, lon: number): Promise<number | null> {
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start.toISOString().slice(0, 10)}&end_date=${end.toISOString().slice(0, 10)}&daily=precipitation_sum`
  const json = (await fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as {
    daily?: { precipitation_sum?: number[] }
  } | null
  const arr = json?.daily?.precipitation_sum ?? []
  if (!arr.length) return null
  return arr.reduce((s, v) => s + (v ?? 0), 0)
}

export async function analyzeFlood(
  lat: number,
  lon: number,
  terrain: TerrainAnalysisResult | null,
  water: WaterAnalysisResult | null
): Promise<FloodAnalysisResult> {
  const ts = new Date().toISOString()
  const riverM = water?.nearestDistanceM ?? null
  const slope = terrain?.slopeDeg ?? 5
  const depression = terrain?.relativeDepressionM ?? 0
  const rainfall = await recentRainfallMm(lat, lon)

  let score = 15
  const reasons: string[] = []

  if (riverM != null) {
    if (riverM < 200) {
      score += 35
      reasons.push(`River/water mapped within ${Math.round(riverM)} m`)
    } else if (riverM < 800) {
      score += 18
      reasons.push(`Water feature within ${Math.round(riverM)} m`)
    } else {
      score += 4
    }
  }

  if (slope < 3) {
    score += 12
    reasons.push('Very flat terrain — reduced natural drainage')
  } else if (slope > 12) {
    score -= 4
  }

  if (depression > 2) {
    score += 14
    reasons.push('Local terrain depression tendency')
  }

  if (rainfall != null && rainfall > 80) {
    score += 10
    reasons.push(`Recent 7-day rainfall ~${Math.round(rainfall)} mm`)
  }

  if (water?.waterRisk === 'HIGH' || water?.waterRisk === 'VERY_HIGH') {
    score += 8
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  return {
    score,
    risk: riskFromScore(score),
    liveForecastAvailable: false,
    liveForecastStatus: 'Historical susceptibility model — configure GOOGLE_FLOOD_API_KEY on backend for live forecast',
    historicalExposure: score >= 50 ? 'Elevated historical flood susceptibility proxy' : 'Low historical susceptibility proxy',
    riverDistanceM: riverM,
    terrainDrainageRisk: slope < 5 ? 'Moderate — flat/low slope' : 'Lower — steeper drainage',
    relativeElevationRisk: depression > 1.5 ? 'Local depression present' : 'No significant depression',
    reasoning: reasons.length ? reasons.join('; ') : 'Terrain and water distance within acceptable screening band',
    confidence: riverM != null ? 68 : 52,
    sources: ['Open-Meteo rainfall', 'OSM water proximity', 'Copernicus DEM slope/depression'],
    lastUpdated: ts,
  }
}
