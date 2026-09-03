import type { NearbyPowerAsset } from './nearbyPowerSupply'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function metersLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${Math.round(km * 1000)} m`
}

/** Closest point on a segment to an external point (meters). */
function closestOnSegment(
  plat: number,
  plon: number,
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): { lat: number; lon: number; distM: number; t: number } {
  const ax = a.lon
  const ay = a.lat
  const bx = b.lon
  const by = b.lat
  const px = plon
  const py = plat
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const clat = ay + t * dy
  const clon = ax + t * dx
  const distM = haversineKm(plat, plon, clat, clon) * 1000
  return { lat: clat, lon: clon, distM, t }
}

/** Nearest point on corridor polyline to a target (for distance lines). */
export function closestPointOnCorridor(
  lat: number,
  lon: number,
  corridor: Array<{ lat: number; lon: number }>
): { lat: number; lon: number; distM: number; chainageM: number } {
  if (!corridor.length) {
    return { lat, lon, distM: 0, chainageM: 0 }
  }
  if (corridor.length === 1) {
    const d = haversineKm(lat, lon, corridor[0].lat, corridor[0].lon) * 1000
    return { lat: corridor[0].lat, lon: corridor[0].lon, distM: d, chainageM: 0 }
  }

  let best = {
    lat: corridor[0].lat,
    lon: corridor[0].lon,
    distM: Number.POSITIVE_INFINITY,
    chainageM: 0,
  }
  let chainage = 0

  for (let i = 1; i < corridor.length; i++) {
    const a = corridor[i - 1]
    const b = corridor[i]
    const segKm = haversineKm(a.lat, a.lon, b.lat, b.lon)
    const hit = closestOnSegment(lat, lon, a, b)
    const chainAt = chainage + hit.t * segKm * 1000
    if (hit.distM < best.distM) {
      best = { lat: hit.lat, lon: hit.lon, distM: hit.distM, chainageM: chainAt }
    }
    chainage += segKm * 1000
  }
  return best
}

/** Chainage (m) of a point projected onto the corridor polyline. */
export function chainageOnCorridor(
  lat: number,
  lon: number,
  corridor: Array<{ lat: number; lon: number }>
): number {
  return closestPointOnCorridor(lat, lon, corridor).chainageM
}

export function sortAssetsAlongCorridor(
  assets: NearbyPowerAsset[],
  corridor: Array<{ lat: number; lon: number }>
): NearbyPowerAsset[] {
  if (!corridor.length) return assets
  return [...assets].sort(
    (a, b) =>
      chainageOnCorridor(a.lat, a.lon, corridor) - chainageOnCorridor(b.lat, b.lon, corridor)
  )
}

export function buildTransmissionTowerLinks(
  assets: NearbyPowerAsset[],
  maxLinkKm = 2.5
): Array<{ from: NearbyPowerAsset; to: NearbyPowerAsset; km: number }> {
  const towers = assets.filter((a) => a.kind === 'tower' || a.kind === 'pole')
  if (towers.length < 2) return []

  const used = new Set<string>()
  const links: Array<{ from: NearbyPowerAsset; to: NearbyPowerAsset; km: number }> = []

  for (const a of towers) {
    let best: NearbyPowerAsset | null = null
    let bestD = maxLinkKm
    for (const b of towers) {
      if (a.id === b.id) continue
      const d = haversineKm(a.lat, a.lon, b.lat, b.lon)
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    if (!best) continue
    const key = [a.id, best.id].sort().join('|')
    if (used.has(key)) continue
    used.add(key)
    links.push({ from: a, to: best, km: bestD })
  }

  return links
}

export function chainLinksAlongCorridor(
  assets: NearbyPowerAsset[],
  corridor: Array<{ lat: number; lon: number }>,
  kinds: Array<NearbyPowerAsset['kind']> = ['tower', 'pole'],
  maxGapKm = 3
): Array<{ from: NearbyPowerAsset; to: NearbyPowerAsset; km: number }> {
  const pool = sortAssetsAlongCorridor(
    assets.filter((a) => kinds.includes(a.kind)),
    corridor
  )
  const out: Array<{ from: NearbyPowerAsset; to: NearbyPowerAsset; km: number }> = []
  for (let i = 1; i < pool.length; i++) {
    const km = haversineKm(pool[i - 1].lat, pool[i - 1].lon, pool[i].lat, pool[i].lon)
    if (km <= maxGapKm) out.push({ from: pool[i - 1], to: pool[i], km })
  }
  return out
}

/** Corridor-ordered chain + short nearest-neighbor mesh for visible power-line overlay. */
export function transmissionLineSegments(
  assets: NearbyPowerAsset[],
  corridor: Array<{ lat: number; lon: number }>
): Array<{ from: NearbyPowerAsset; to: NearbyPowerAsset; km: number }> {
  const along = chainLinksAlongCorridor(assets, corridor, ['tower', 'pole'], 4)
  const mesh = buildTransmissionTowerLinks(
    assets.filter((a) => a.kind === 'tower' || a.kind === 'pole'),
    2.5
  )
  const seen = new Set(along.map((l) => [l.from.id, l.to.id].sort().join('|')))
  const merged = [...along]
  for (const m of mesh) {
    const key = [m.from.id, m.to.id].sort().join('|')
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(m)
    }
  }
  return merged
}
