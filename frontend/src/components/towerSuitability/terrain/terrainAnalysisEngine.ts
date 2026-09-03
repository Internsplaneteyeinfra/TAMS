/**
 * Terrain analysis — Open-Meteo elevation grid + slope/aspect/drainage.
 */

import { getCachedSignal, setCachedSignal, signalCacheKey } from '../siteSignals/signalCache'
import type { TerrainAnalysisResult, TerrainClass } from '../siteSignals/types'
import { haversineKm } from '../siteSignals/overpassClient'

async function fetchJson(url: string, ms = 7000): Promise<unknown | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch(() => {
        clearTimeout(t)
        resolve(null)
      })
  })
}

function aspectLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function classifyTerrain(slopeDeg: number | null): TerrainClass {
  if (slopeDeg == null) return 'FLAT'
  if (slopeDeg < 3) return 'FLAT'
  if (slopeDeg < 8) return 'GENTLE'
  if (slopeDeg < 15) return 'MODERATE'
  if (slopeDeg < 25) return 'STEEP'
  return 'RUGGED'
}

function sampleGrid(
  lat: number,
  lon: number,
  corridor?: Array<{ lat: number; lon: number }>
): Array<{ lat: number; lon: number }> {
  if (corridor && corridor.length >= 2) {
    const step = Math.max(1, Math.floor(corridor.length / 8))
    const pts = corridor.filter((_, i) => i % step === 0)
    return pts.length >= 3 ? pts : corridor
  }
  const offset = 0.0012
  return [
    { lat, lon },
    { lat: lat + offset, lon },
    { lat: lat - offset, lon },
    { lat, lon: lon + offset },
    { lat, lon: lon - offset },
  ]
}

export async function analyzeTerrain(
  lat: number,
  lon: number,
  corridor?: Array<{ lat: number; lon: number }>
): Promise<TerrainAnalysisResult> {
  const key = signalCacheKey('terrain', lat, lon, corridor?.length ? `c${corridor.length}` : null)
  const cached = getCachedSignal<TerrainAnalysisResult>(key)
  if (cached) return cached

  const grid = sampleGrid(lat, lon, corridor)
  const lats = grid.map((p) => p.lat).join(',')
  const lons = grid.map((p) => p.lon).join(',')
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`
  const json = (await fetchJson(url)) as { elevation?: number[] } | null
  const elevations = (json?.elevation ?? []).map((e) => (Number.isFinite(e) ? e : null))

  const centerElev = elevations[0] ?? null
  let maxSlope = 0
  let steepestAspect = 0
  let minElev = centerElev
  let maxElev = centerElev

  if (centerElev != null) {
    for (let i = 1; i < elevations.length; i++) {
      const e = elevations[i]
      if (e == null) continue
      if (minElev == null || e < minElev) minElev = e
      if (maxElev == null || e > maxElev) maxElev = e
      const runM = haversineKm(lat, lon, grid[i].lat, grid[i].lon) * 1000
      if (runM < 1) continue
      const rise = e - centerElev
      const s = (Math.atan(Math.abs(rise) / runM) * 180) / Math.PI
      if (s > maxSlope) {
        maxSlope = s
        const dLon = grid[i].lon - lon
        const y = Math.sin((dLon * Math.PI) / 180) * Math.cos((grid[i].lat * Math.PI) / 180)
        const x =
          Math.cos((lat * Math.PI) / 180) * Math.sin((grid[i].lat * Math.PI) / 180) -
          Math.sin((lat * Math.PI) / 180) * Math.cos((grid[i].lat * Math.PI) / 180) * Math.cos((dLon * Math.PI) / 180)
        steepestAspect = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
      }
    }
  }

  const slopeDeg = centerElev != null ? maxSlope : null
  const relativeDepressionM =
    centerElev != null && minElev != null && maxElev != null ? centerElev - minElev : null
  const drainageDir = aspectLabel(steepestAspect || 180)

  const result: TerrainAnalysisResult = {
    elevationM: centerElev,
    slopeDeg,
    aspectDeg: steepestAspect,
    aspectLabel: drainageDir,
    terrainClass: classifyTerrain(slopeDeg),
    drainageDirection: drainageDir,
    relativeDepressionM,
    confidence: centerElev != null ? 78 : 0,
    source: 'Open-Meteo Elevation / Copernicus DEM',
    method: 'Multi-point elevation grid slope screening',
  }

  if (centerElev != null) setCachedSignal(key, result, 'long')
  return result
}

export function terrainSlopeFromElevations(
  lat: number,
  lon: number,
  grid: Array<{ lat: number; lon: number }>,
  elevations: (number | null)[]
): number | null {
  const centerElev = elevations[0]
  if (centerElev == null) return null
  let maxSlope = 0
  for (let i = 1; i < elevations.length; i++) {
    const e = elevations[i]
    if (e == null) continue
    const runM = haversineKm(lat, lon, grid[i].lat, grid[i].lon) * 1000
    if (runM < 1) continue
    const rise = Math.abs(e - centerElev)
    const s = (Math.atan(rise / runM) * 180) / Math.PI
    if (s > maxSlope) maxSlope = s
  }
  return maxSlope
}
