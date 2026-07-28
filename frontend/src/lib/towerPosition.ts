/**
 * OSM / KML tower coordinates often sit a few metres off Google satellite imagery.
 * Shift live map placements by configurable east/north metres so 3D models sit on the pad.
 *
 * Tune via:
 *   NEXT_PUBLIC_TOWER_OFFSET_EAST_M  (default 18 — positive = east)
 *   NEXT_PUBLIC_TOWER_OFFSET_NORTH_M (default 6  — positive = north)
 */

function envMeters(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export const TOWER_OFFSET_EAST_M = envMeters('NEXT_PUBLIC_TOWER_OFFSET_EAST_M', 18)
export const TOWER_OFFSET_NORTH_M = envMeters('NEXT_PUBLIC_TOWER_OFFSET_NORTH_M', 6)

/** Apply N/E metre offset to WGS84 lon/lat. */
export function applyTowerNeOffset(longitude: number, latitude: number): {
  longitude: number
  latitude: number
} {
  const eastM = TOWER_OFFSET_EAST_M
  const northM = TOWER_OFFSET_NORTH_M
  if (!eastM && !northM) {
    return { longitude, latitude }
  }
  const latRad = (latitude * Math.PI) / 180
  const mPerDegLat = 111_320
  const mPerDegLon = Math.max(111_320 * Math.cos(latRad), 1)
  return {
    longitude: longitude + eastM / mPerDegLon,
    latitude: latitude + northM / mPerDegLat,
  }
}

/** Return a shallow copy of an asset with display lon/lat for Cesium / Leaflet placement. */
export function withTowerNeOffset<T extends { longitude: number; latitude: number }>(asset: T): T {
  const { longitude, latitude } = applyTowerNeOffset(asset.longitude, asset.latitude)
  return { ...asset, longitude, latitude }
}
