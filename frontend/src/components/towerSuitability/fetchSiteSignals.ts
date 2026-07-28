import { fetchGisTowers } from '@/lib/api'
import type { SiteSignals } from './scoring'

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

/** Never hang the UI on slow public APIs. */
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

async function fetchJson(url: string, ms = 7000): Promise<unknown | null> {
  return withTimeout(
    (async () => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    })(),
    ms,
    null
  )
}

async function fetchElevations(
  points: { lat: number; lon: number }[]
): Promise<(number | null)[]> {
  const lats = points.map((p) => p.lat).join(',')
  const lons = points.map((p) => p.lon).join(',')
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`
  const json = (await fetchJson(url, 7000)) as { elevation?: number[] } | null
  if (!json?.elevation) return points.map(() => null)
  return json.elevation.map((e) => (Number.isFinite(e) ? e : null))
}

async function fetchWind(lat: number, lon: number): Promise<number | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=wind_speed_10m_max&wind_speed_unit=ms&timezone=auto&forecast_days=7`
  const json = (await fetchJson(url, 7000)) as {
    daily?: { wind_speed_10m_max?: number[] }
  } | null
  const arr = json?.daily?.wind_speed_10m_max ?? []
  if (!arr.length) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

async function nearestRoadOsrm(lat: number, lon: number): Promise<number | null> {
  const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}?number=1`
  const json = (await fetchJson(url, 6000)) as {
    waypoints?: { distance?: number; location?: [number, number] }[]
  } | null
  const wp = json?.waypoints?.[0]
  if (wp?.distance != null && Number.isFinite(wp.distance)) return wp.distance / 1000
  if (wp?.location) return haversineKm(lat, lon, wp.location[1], wp.location[0])
  return null
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
}

/** Photon (Komoot) — fast nearby OSM search; avoids Overpass 504s. */
async function photonNearestKm(
  lat: number,
  lon: number,
  osmTag: string
): Promise<number | null> {
  const url = `https://photon.komoot.io/api/?q=&lat=${lat}&lon=${lon}&limit=8&osm_tag=${encodeURIComponent(osmTag)}`
  const json = (await fetchJson(url, 6500)) as { features?: PhotonFeature[] } | null
  const feats = json?.features ?? []
  let best: number | null = null
  for (const f of feats) {
    const c = f.geometry?.coordinates
    if (!c || c.length < 2) continue
    const d = haversineKm(lat, lon, c[1], c[0])
    if (best == null || d < best) best = d
  }
  return best
}

async function nearestAmongTags(lat: number, lon: number, tags: string[]): Promise<number | null> {
  const dists = await Promise.all(tags.map((t) => photonNearestKm(lat, lon, t)))
  let best: number | null = null
  for (const d of dists) {
    if (d == null) continue
    if (best == null || d < best) best = d
  }
  return best
}

async function landCoverFast(lat: number, lon: number): Promise<SiteSignals['landCoverHint']> {
  const json = (await fetchJson(`/api/geo/nominatim?lat=${lat}&lon=${lon}`, 6500)) as {
    category?: string
    type?: string
    addresstype?: string
    extratags?: Record<string, string>
    address?: Record<string, string>
  } | null
  if (!json) return 'unknown'
  const blob = [
    json.category,
    json.type,
    json.addresstype,
    json.extratags?.landuse,
    json.extratags?.natural,
    json.address?.landuse,
    json.address?.suburb,
    json.address?.village,
    json.address?.town,
    json.address?.city,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/water|river|lake|reservoir/.test(blob)) return 'water'
  if (/industrial|residential|commercial|building/.test(blob)) return 'built'
  if (/forest|wood|farm|meadow|grass|orchard|scrub|field/.test(blob)) return 'vegetation'
  if (/quarry|bare|rock|heath|sand/.test(blob)) return 'barren'
  if (/village|hamlet|locality|county|state/.test(blob)) return 'vegetation'
  return 'unknown'
}

async function nearestTamsTowerKm(lat: number, lon: number): Promise<number | null> {
  try {
    const pad = 0.75
    const bbox = `${lon - pad},${lat - pad},${lon + pad},${lat + pad}`
    const towers = await withTimeout(fetchGisTowers(bbox, undefined, 1200), 7000, {
      assets: [],
      truncated: false,
      total: 0,
      limit: 1200,
    })
    let best: number | null = null
    for (const t of towers.assets) {
      const d = haversineKm(lat, lon, t.latitude, t.longitude)
      if (best == null || d < best) best = d
    }
    return best
  } catch {
    return null
  }
}

export type ProgressFn = (message: string, percent: number) => void

/**
 * Fast screening — Overpass removed (public mirrors 502/504).
 * All sources run in parallel with ~6–7s caps.
 */
export async function collectSiteSignals(
  lat: number,
  lon: number,
  onProgress?: ProgressFn
): Promise<SiteSignals> {
  onProgress?.('Loading DEM, roads, places & weather…', 20)

  const offset = 0.0012
  const grid = [
    { lat, lon },
    { lat: lat + offset, lon },
    { lat: lat - offset, lon },
    { lat, lon: lon + offset },
    { lat, lon: lon - offset },
  ]

  const [elevations, windMs, roadKm, waterKm, buildingKm, photonPowerKm, land, tamsTowerKm] =
    await Promise.all([
      fetchElevations(grid),
      fetchWind(lat, lon),
      nearestRoadOsrm(lat, lon),
      nearestAmongTags(lat, lon, ['waterway', 'natural:water', 'landuse:reservoir']),
      nearestAmongTags(lat, lon, ['building', 'place:village', 'place:town', 'place:hamlet']),
      nearestAmongTags(lat, lon, ['power:tower', 'power:substation', 'power:line', 'power:pole']),
      landCoverFast(lat, lon),
      nearestTamsTowerKm(lat, lon),
    ])

  onProgress?.('Computing screening score…', 92)

  const centerElev = elevations[0]
  let slopeDeg: number | null = null
  if (centerElev != null) {
    let maxSlope = 0
    for (let i = 1; i < elevations.length; i++) {
      const e = elevations[i]
      if (e == null) continue
      const rise = Math.abs(e - centerElev)
      const s = (Math.atan(rise / 130) * 180) / Math.PI
      if (s > maxSlope) maxSlope = s
    }
    slopeDeg = maxSlope
  }

  const towerKm =
    tamsTowerKm != null && photonPowerKm != null
      ? Math.min(tamsTowerKm, photonPowerKm)
      : tamsTowerKm ?? photonPowerKm

  return {
    lat,
    lon,
    elevationM: centerElev,
    slopeDeg,
    roadKm,
    waterKm,
    buildingKm,
    towerKm,
    substationKm: photonPowerKm,
    windMs,
    landCoverHint: land,
  }
}

/** Parse first Point / Placemark coordinates from a KML string. */
export function parseKmlFirstPoint(kmlText: string): { lat: number; lon: number } | null {
  const parsed = parseKmlDocument(kmlText)
  return parsed?.focus ?? null
}

export type KmlLatLng = [number, number] // [lat, lon] for Leaflet

export type KmlFeature =
  | { type: 'Point'; latlngs: KmlLatLng[]; name?: string }
  | { type: 'LineString'; latlngs: KmlLatLng[]; name?: string }
  | { type: 'Polygon'; latlngs: KmlLatLng[]; name?: string }

export interface ParsedKml {
  features: KmlFeature[]
  /** Best analysis focus (centroid of largest polygon, else first geometry) */
  focus: { lat: number; lon: number }
}

function parseCoordTuples(raw: string): KmlLatLng[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => {
      const [lonS, latS] = tok.split(',')
      const lon = parseFloat(lonS)
      const lat = parseFloat(latS)
      return Number.isFinite(lat) && Number.isFinite(lon) ? ([lat, lon] as KmlLatLng) : null
    })
    .filter((p): p is KmlLatLng => p != null)
}

function localName(el: Element): string {
  return (el.localName || el.nodeName || '').replace(/^.*:/, '').toLowerCase()
}

function placemarkName(pm: Element): string | undefined {
  for (const child of Array.from(pm.children)) {
    if (localName(child) === 'name') {
      const t = (child.textContent || '').trim()
      return t || undefined
    }
  }
  return undefined
}

function centroid(latlngs: KmlLatLng[]): { lat: number; lon: number } {
  let lat = 0
  let lon = 0
  for (const [a, b] of latlngs) {
    lat += a
    lon += b
  }
  const n = Math.max(1, latlngs.length)
  return { lat: lat / n, lon: lon / n }
}

/** Full KML geometry parse for map outlines (Point / LineString / Polygon). */
export function parseKmlDocument(kmlText: string): ParsedKml | null {
  try {
    const doc = new DOMParser().parseFromString(kmlText, 'text/xml')
    if (doc.querySelector('parsererror')) return null

    const features: KmlFeature[] = []
    const placemarks = Array.from(doc.getElementsByTagName('*')).filter(
      (el) => localName(el) === 'placemark'
    )
    const roots = placemarks.length ? placemarks : [doc.documentElement]

    for (const root of roots) {
      const name = placemarks.length ? placemarkName(root) : undefined
      const nodes = Array.from(root.getElementsByTagName('*'))
      for (const el of nodes) {
        const tag = localName(el)
        if (tag === 'point') {
          const coordsEl = Array.from(el.getElementsByTagName('*')).find(
            (c) => localName(c) === 'coordinates'
          )
          const pts = parseCoordTuples(coordsEl?.textContent || '')
          if (pts.length) features.push({ type: 'Point', latlngs: pts, name })
        } else if (tag === 'linestring') {
          const coordsEl = Array.from(el.getElementsByTagName('*')).find(
            (c) => localName(c) === 'coordinates'
          )
          const pts = parseCoordTuples(coordsEl?.textContent || '')
          if (pts.length >= 2) features.push({ type: 'LineString', latlngs: pts, name })
        } else if (tag === 'polygon') {
          const outer =
            Array.from(el.getElementsByTagName('*')).find(
              (c) => localName(c) === 'outerboundaryis'
            ) || el
          const coordsEl = Array.from(outer.getElementsByTagName('*')).find(
            (c) => localName(c) === 'coordinates'
          )
          const pts = parseCoordTuples(coordsEl?.textContent || '')
          if (pts.length >= 3) features.push({ type: 'Polygon', latlngs: pts, name })
        }
      }
    }

    if (!features.length) {
      const coords = doc.getElementsByTagName('coordinates')
      for (let i = 0; i < coords.length; i++) {
        const pts = parseCoordTuples(coords[i].textContent || '')
        if (pts.length >= 3) features.push({ type: 'Polygon', latlngs: pts })
        else if (pts.length === 2) features.push({ type: 'LineString', latlngs: pts })
        else if (pts.length === 1) features.push({ type: 'Point', latlngs: pts })
      }
    }

    if (!features.length) return null

    const polygons = features.filter((f) => f.type === 'Polygon')
    const biggest = polygons.sort((a, b) => b.latlngs.length - a.latlngs.length)[0]
    const focusFeat = biggest || features[0]
    const focus = centroid(focusFeat.latlngs)

    return { features, focus }
  } catch {
    return null
  }
}

/** Nirona, Bhuj demo pad from geotech brief */
export const DEMO_NIRONA = {
  lat: 23.446103,
  lon: 69.599508,
  label: 'Nirona · Bhuj demo pad',
}
