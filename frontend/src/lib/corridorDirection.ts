import type { Asset } from '@/lib/api'

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export type CorridorDirectionBrief = {
  assetId: string
  name: string
  flow: string
  startLabel: string
  endLabel: string
  voltageLabel: string
  lengthLabel: string | null
}

function bearingBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const p1 = (a.lat * Math.PI) / 180
  const p2 = (b.lat * Math.PI) / 180
  const dl = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

/** Pure direction brief for corridor LineString assets (no Leaflet). */
export function buildCorridorDirectionBrief(asset: Asset): CorridorDirectionBrief | null {
  if (asset.asset_type !== 'line' || asset.geometry?.type !== 'LineString') return null
  const coords = asset.geometry.coordinates as number[][]
  if (!coords || coords.length < 2) return null

  const start = { lat: coords[0][1], lng: coords[0][0] }
  const end = {
    lat: coords[coords.length - 1][1],
    lng: coords[coords.length - 1][0],
  }
  const bearing = bearingBetween(start, end)
  const to = COMPASS_8[Math.round(bearing / 45) % 8]
  const from = COMPASS_8[Math.round(((bearing + 180) % 360) / 45) % 8]
  const kvRaw = asset.metadata?.voltage_kv
  const kv = typeof kvRaw === 'number' ? kvRaw : typeof kvRaw === 'string' ? Number(kvRaw) : null
  const lengthKm =
    typeof asset.metadata?.length_km === 'number' ? `${asset.metadata.length_km} km` : null

  return {
    assetId: asset.id,
    name: asset.name,
    flow: `${from} → ${to}`,
    startLabel: formatCoord(start.lat, start.lng),
    endLabel: formatCoord(end.lat, end.lng),
    voltageLabel: kv != null && Number.isFinite(kv) ? `${kv} kV` : 'Unclassified',
    lengthLabel: lengthKm,
  }
}
