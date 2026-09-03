/**
 * Map metrics — perpendicular corridor distance, nearest station, road labels.
 */

import type { NearbyPowerAsset } from './nearbyPowerSupply'
import { closestPointOnCorridor } from './towerGridLinks'

export function formatDistMeters(m: number): string {
  if (!Number.isFinite(m)) return '—'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

export function corridorPerpendicularM(
  lat: number,
  lon: number,
  corridor: Array<{ lat: number; lon: number }>
): { distM: number; snapLat: number; snapLon: number; chainageM: number } {
  const hit = closestPointOnCorridor(lat, lon, corridor)
  return {
    distM: hit.distM,
    snapLat: hit.lat,
    snapLon: hit.lon,
    chainageM: hit.chainageM,
  }
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function nearestPowerStation(
  assets: NearbyPowerAsset[],
  fromLat: number,
  fromLon: number
): { asset: NearbyPowerAsset; distM: number } | null {
  const pool = assets.filter((a) => a.kind === 'substation' || a.kind === 'plant')
  if (!pool.length) return null
  let best: NearbyPowerAsset | null = null
  let bestM = Number.POSITIVE_INFINITY
  for (const a of pool) {
    const d = haversineM(fromLat, fromLon, a.lat, a.lon)
    if (d < bestM) {
      bestM = d
      best = a
    }
  }
  if (!best) return null
  return { asset: best, distM: bestM }
}

/** Bearing label from point A to B (N/NE/E…). */
export function bearingLabel(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(brng / 45) % 8]
}
