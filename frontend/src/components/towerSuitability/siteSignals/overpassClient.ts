/**
 * Shared Overpass client — routes through Next.js proxy with multi-endpoint fallback (backend).
 */

export type OverpassElement = {
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms)
    promise
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch(() => {
        clearTimeout(t)
        resolve(fallback)
      })
  })
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function elementPoint(el: OverpassElement): { lat: number; lon: number } | null {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return { lat: el.lat as number, lon: el.lon as number }
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) return el.center
  return null
}

export function nearestElementKm(lat: number, lon: number, elements: OverpassElement[]): number | null {
  let best: number | null = null
  for (const el of elements) {
    const p = elementPoint(el)
    if (!p) continue
    const d = haversineKm(lat, lon, p.lat, p.lon)
    if (best == null || d < best) best = d
  }
  return best
}

/** Query Overpass via app proxy (backend tries multiple public endpoints). */
export async function queryOverpass(query: string, timeoutMs = 48000): Promise<OverpassElement[] | null> {
  const json = await withTimeout(
    (async () => {
      const res = await fetch('/api/geo/overpass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) return null
      const body = (await res.json()) as { elements?: OverpassElement[]; overpassUnavailable?: boolean }
      if (body.overpassUnavailable) return null
      return body.elements ?? []
    })(),
    timeoutMs,
    null
  )
  return json
}

/** Nearest feature distance for OSM selectors around a point. */
export async function overpassNearestKm(
  lat: number,
  lon: number,
  radiusM: number,
  selectors: string[]
): Promise<{ km: number; found: boolean; live: boolean; elements: OverpassElement[] }> {
  const body = selectors.map((sel) => `${sel}(around:${radiusM},${lat},${lon});`).join('')
  const query = `[out:json][timeout:18];(${body});out center 80;`
  const elements = await queryOverpass(query)
  if (!elements) return { km: radiusM / 1000, found: false, live: false, elements: [] }
  const nearest = nearestElementKm(lat, lon, elements)
  if (nearest == null) return { km: radiusM / 1000, found: false, live: true, elements }
  return { km: nearest, found: true, live: true, elements }
}
