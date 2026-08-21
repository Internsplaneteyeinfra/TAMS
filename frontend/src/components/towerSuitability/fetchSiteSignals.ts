import { findNearbyPowerSupply } from './nearbyPowerSupply'
import type { SiteSignals } from './scoring'
import { fetchGeotechNearest } from '@/lib/geotechApi'
import { fetchSoilScreening } from './soilScreening'

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
  const end = new Date()
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().slice(0, 10)
  const endStr = end.toISOString().slice(0, 10)
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&daily=wind_speed_10m_max&wind_speed_unit=ms`
  const archive = (await fetchJson(archiveUrl, 9000)) as {
    daily?: { wind_speed_10m_max?: Array<number | null> }
  } | null
  const hist = (archive?.daily?.wind_speed_10m_max ?? []).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  )
  if (hist.length >= 14) return hist.reduce((s, v) => s + v, 0) / hist.length

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=wind_speed_10m_max&wind_speed_unit=ms&timezone=auto&forecast_days=16`
  const forecast = (await fetchJson(forecastUrl, 7000)) as {
    daily?: { wind_speed_10m_max?: number[] }
  } | null
  const arr = forecast?.daily?.wind_speed_10m_max ?? []
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

type OverpassEl = {
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function overpassJson(query: string): Promise<{ elements?: OverpassEl[] } | null> {
  return withTimeout(
    (async () => {
      const res = await fetch('/api/geo/overpass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) return null
      const json = (await res.json()) as {
        elements?: OverpassEl[]
        overpassUnavailable?: boolean
      }
      if (json.overpassUnavailable) return null
      return json
    })(),
    48000,
    null
  )
}

function elementPoint(el: OverpassEl): { lat: number; lon: number } | null {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return { lat: el.lat as number, lon: el.lon as number }
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) return el.center
  return null
}

function nearestElementKm(lat: number, lon: number, elements: OverpassEl[]): number | null {
  let best: number | null = null
  for (const el of elements) {
    const p = elementPoint(el)
    if (!p) continue
    const d = haversineKm(lat, lon, p.lat, p.lon)
    if (best == null || d < best) best = d
  }
  return best
}

function parseOsmVoltageTag(raw?: string): number | null {
  if (!raw) return null
  const parts = raw.split(/[;/|,]+/).map((p) => p.trim()).filter(Boolean)
  const kvs: number[] = []
  for (const part of parts) {
    const kvWord = part.match(/(\d+(?:\.\d+)?)\s*k\s*v\b/i)
    if (kvWord) {
      const n = Number(kvWord[1])
      if (Number.isFinite(n) && n > 0) kvs.push(Math.round(n))
      continue
    }
    const n = Number(part.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n) || n <= 0) continue
    kvs.push(n >= 1000 ? Math.round(n / 1000) : Math.round(n))
  }
  if (!kvs.length) return null
  return Math.max(...kvs)
}

/** Nearest OSM power-line voltage near a corridor point. */
export async function inferOsmLineVoltageKv(
  lat: number,
  lon: number,
  radiusM = 8000
): Promise<number | null> {
  const query = `[out:json][timeout:16];(
    way["power"="line"](around:${radiusM},${lat},${lon});
    way["power"="minor_line"](around:${radiusM},${lat},${lon});
    way["power"="cable"](around:${radiusM},${lat},${lon});
  );out tags center 40;`
  const json = await overpassJson(query)
  if (!json?.elements?.length) return null
  let bestKv: number | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const el of json.elements) {
    const kv = parseOsmVoltageTag(el.tags?.voltage || el.tags?.['voltage:primary'])
    if (kv == null) continue
    const p = elementPoint(el)
    const d = p ? haversineKm(lat, lon, p.lat, p.lon) : radiusM / 1000
    if (d < bestD) {
      bestD = d
      bestKv = kv
    }
  }
  return bestKv
}

/** Live OSM around-site query. `null` = request failed; otherwise min km or search radius if none. */
async function liveOsmDistanceKm(
  lat: number,
  lon: number,
  radiusM: number,
  selectors: string[]
): Promise<{ km: number; found: boolean; live: boolean }> {
  const body = selectors.map((sel) => `${sel}(around:${radiusM},${lat},${lon});`).join('')
  const query = `[out:json][timeout:18];(${body});out center 80;`
  const json = await overpassJson(query)
  if (!json) return { km: radiusM / 1000, found: false, live: false }
  const nearest = nearestElementKm(lat, lon, json.elements ?? [])
  if (nearest == null) return { km: radiusM / 1000, found: false, live: true }
  return { km: nearest, found: true, live: true }
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
}

async function photonFallbackKm(lat: number, lon: number, query: string, osmTag?: string): Promise<number | null> {
  const tag = osmTag ? `&osm_tag=${encodeURIComponent(osmTag)}` : ''
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lon}&limit=12${tag}`
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

/** Reverse-geocode a pad to "City, State" for the analysis header. */
export async function resolveCityStateLabel(lat: number, lon: number): Promise<string | null> {
  const json = (await fetchJson(`/api/geo/nominatim?lat=${lat}&lon=${lon}`, 6500)) as {
    name?: string
    address?: Record<string, string>
  } | null
  const address = json?.address
  if (!address) return null

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.city_district ||
    address.suburb ||
    address.county ||
    address.hamlet ||
    json?.name ||
    ''
  const state = address.state || address.state_district || ''
  const cityName = city.trim()
  const stateName = state.trim()
  if (cityName && stateName && cityName.toLowerCase() !== stateName.toLowerCase()) {
    return `${cityName}, ${stateName}`
  }
  if (cityName) return cityName
  if (stateName) return stateName
  return null
}

async function landCoverLive(lat: number, lon: number): Promise<SiteSignals['landCoverHint']> {
  const query = `[out:json][timeout:15];(
    way["landuse"](around:180,${lat},${lon});
    way["natural"](around:180,${lat},${lon});
    node["landuse"](around:180,${lat},${lon});
    node["natural"](around:180,${lat},${lon});
  );out tags 30;`
  const osm = await overpassJson(query)
  const blob = (osm?.elements ?? [])
    .flatMap((el) => [el.tags?.landuse, el.tags?.natural, el.tags?.water])
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (blob) {
    if (/water|river|lake|reservoir|pond|basin|wetland/.test(blob)) return 'water'
    if (/industrial|residential|commercial|retail|construction|garages/.test(blob)) return 'built'
    if (/forest|wood|farm|farmland|meadow|grass|orchard|scrub|vineyard|allotments/.test(blob)) {
      return 'vegetation'
    }
    if (/quarry|bare_rock|scree|sand|heath|shingle|brownfield/.test(blob)) return 'barren'
  }

  const json = (await fetchJson(`/api/geo/nominatim?lat=${lat}&lon=${lon}`, 6500)) as {
    category?: string
    type?: string
    addresstype?: string
    extratags?: Record<string, string>
    address?: Record<string, string>
  } | null
  if (!json) return 'unknown'
  const named = [
    json.category,
    json.type,
    json.addresstype,
    json.extratags?.landuse,
    json.extratags?.natural,
    json.address?.landuse,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/water|river|lake|reservoir/.test(named)) return 'water'
  if (/industrial|residential|commercial|building/.test(named)) return 'built'
  if (/forest|wood|farm|meadow|grass|orchard|scrub|field/.test(named)) return 'vegetation'
  if (/quarry|bare|rock|heath|sand/.test(named)) return 'barren'
  return 'unknown'
}

export type ProgressFn = (message: string, percent: number) => void

/**
 * Live screening from Open-Meteo DEM/wind, OSRM roads, OSM Overpass, TAMS grid.
 */
export async function collectSiteSignals(
  lat: number,
  lon: number,
  onProgress?: ProgressFn,
  options?: { corridor?: Array<{ lat: number; lon: number }>; searchRadiusKm?: number }
): Promise<SiteSignals> {
  onProgress?.('Fetching live DEM, OSM, roads & weather…', 18)

  const offset = 0.0012
  const grid = [
    { lat, lon },
    { lat: lat + offset, lon },
    { lat: lat - offset, lon },
    { lat, lon: lon + offset },
    { lat, lon: lon - offset },
  ]

  // Do NOT call TAMS towers here — findNearbyPowerSupply does that once.
  // Parallel TAMS bbox scans pile up and cause 120s proxy 502s.
  const [elevations, windMs, roadKm, waterLive, settleLive, land] = await Promise.all([
    fetchElevations(grid),
    fetchWind(lat, lon),
    nearestRoadOsrm(lat, lon),
    liveOsmDistanceKm(lat, lon, 8000, [
      'way["natural"="water"]',
      'relation["natural"="water"]',
      'way["waterway"]',
      'way["landuse"="reservoir"]',
      'way["landuse"="basin"]',
      'way["water"]',
    ]),
    liveOsmDistanceKm(lat, lon, 4000, [
      'way["building"]',
      'node["place"~"city|town|village|hamlet|suburb"]',
      'way["landuse"="residential"]',
    ]),
    landCoverLive(lat, lon),
  ])

  onProgress?.('Merging live grid + OSM power assets…', 78)

  let waterKm = waterLive.live || waterLive.found ? waterLive.km : null
  let buildingKm = settleLive.live || settleLive.found ? settleLive.km : null
  let osmPowerKm: number | null = null
  const usedFallback: { water?: boolean; settlement?: boolean; grid?: boolean } = {}

  if (waterKm == null) {
    const fallback = await photonFallbackKm(lat, lon, 'lake river reservoir', 'natural:water')
    if (fallback != null) {
      waterKm = fallback
      usedFallback.water = true
    }
  }
  if (buildingKm == null) {
    const fallback = await photonFallbackKm(lat, lon, 'village town', 'place:village')
    if (fallback != null) {
      buildingKm = fallback
      usedFallback.settlement = true
    }
  }

  onProgress?.('Computing slope & screening signals…', 88)

  const centerElev = elevations[0]
  let slopeDeg: number | null = null
  if (centerElev != null) {
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
    slopeDeg = maxSlope
  }

  onProgress?.('Searching existing power + open soil map…', 92)
  const [nearbyPower, geotechNearest, placeLabel, soilScreening] = await Promise.all([
    findNearbyPowerSupply(lat, lon, options?.searchRadiusKm ?? 8, {
      waterKm,
      buildingKm,
      slopeDeg,
      landCover: land,
      corridor: options?.corridor,
    }),
    withTimeout(fetchGeotechNearest(lat, lon, 5), 6000, null),
    withTimeout(resolveCityStateLabel(lat, lon), 6500, null),
    withTimeout(fetchSoilScreening(lat, lon), 12000, null),
  ])

  // Tower / power distances only from the dedicated search (avoids duplicate API load)
  const nearbyTowerKm = nearbyPower.nearestTower?.distanceKm ?? null
  const nearbyLineKm = nearbyPower.nearestLine?.distanceKm ?? null
  const nearbyPoleKm = nearbyPower.nearestPole?.distanceKm ?? null
  osmPowerKm =
    nearbyPower.nearest?.distanceKm ??
    nearbyTowerKm ??
    nearbyLineKm ??
    nearbyPoleKm ??
    null
  if (!nearbyPower.dataAvailable) {
    usedFallback.grid = true
  }

  const towerKmCandidates = [nearbyTowerKm, osmPowerKm].filter(
    (v): v is number => v != null
  )
  const towerKm = towerKmCandidates.length ? Math.min(...towerKmCandidates) : null

  const nearbySsKm = nearbyPower.nearestSubstation?.distanceKm ?? null

  const geotech =
    geotechNearest && geotechNearest.id
      ? {
          id: geotechNearest.id,
          site_code: geotechNearest.site_code,
          site_name: geotechNearest.site_name,
          distance_km: geotechNearest.distance_km,
          adopted_sbc_tm2: geotechNearest.adopted_sbc_tm2,
          design_depth_m: geotechNearest.design_depth_m,
          governing_cbr_pct: geotechNearest.governing_cbr_pct,
          adopted_resistivity_ohm_m: geotechNearest.adopted_resistivity_ohm_m,
          groundwater_note: geotechNearest.groundwater_note,
          recommended_pile: geotechNearest.recommended_pile,
        }
      : null

  const soil =
    soilScreening && placeLabel
      ? { ...soilScreening, placeName: placeLabel }
      : soilScreening

  return {
    lat,
    lon,
    elevationM: centerElev,
    slopeDeg,
    roadKm,
    waterKm,
    buildingKm,
    towerKm,
    substationKm: nearbySsKm ?? osmPowerKm,
    windMs,
    landCoverHint: land,
    fetchedAt: new Date().toISOString(),
    liveOk: {
      dem: centerElev != null,
      road: roadKm != null,
      water: (waterLive.live && !usedFallback.water) || (waterKm != null && !usedFallback.water),
      settlement:
        (settleLive.live && !usedFallback.settlement) ||
        (buildingKm != null && !usedFallback.settlement),
      grid:
        nearbyPower.assets.length > 0 ||
        nearbyTowerKm != null ||
        (osmPowerKm != null && !usedFallback.grid),
      wind: windMs != null,
      landcover: land !== 'unknown',
      geotech: geotech != null,
      soilScreening: soil != null,
    },
    usedFallback:
      usedFallback.water || usedFallback.settlement || usedFallback.grid ? usedFallback : undefined,
    nearbyPower,
    geotech,
    soilScreening: soil,
    placeLabel,
  }
}

/** Parse first Point / Placemark coordinates from a KML string. */
export function parseKmlFirstPoint(kmlText: string): { lat: number; lon: number } | null {
  const parsed = parseKmlDocument(kmlText)
  return parsed?.focus ?? null
}

export type KmlLatLng = [number, number] // [lat, lon] for Leaflet

export type KmlFeature =
  | { type: 'Point'; latlngs: KmlLatLng[]; name?: string; description?: string; extendedText?: string }
  | { type: 'LineString'; latlngs: KmlLatLng[]; name?: string; description?: string; extendedText?: string }
  | { type: 'Polygon'; latlngs: KmlLatLng[]; name?: string; description?: string; extendedText?: string }

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

function placemarkDescription(pm: Element): string | undefined {
  for (const child of Array.from(pm.children)) {
    if (localName(child) === 'description') {
      const t = (child.textContent || '').trim()
      return t || undefined
    }
  }
  return undefined
}

function placemarkExtendedText(pm: Element): string | undefined {
  const parts: string[] = []
  for (const el of Array.from(pm.getElementsByTagName('*'))) {
    if (localName(el) !== 'simpledata') continue
    const name = el.getAttribute('name') || ''
    const val = (el.textContent || '').trim()
    if (name && val) parts.push(`${name} ${val}`)
  }
  return parts.length ? parts.join(' ') : undefined
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
      const description = placemarks.length ? placemarkDescription(root) : undefined
      const extendedText = placemarks.length ? placemarkExtendedText(root) : undefined
      const nodes = Array.from(root.getElementsByTagName('*'))
      for (const el of nodes) {
        const tag = localName(el)
        if (tag === 'point') {
          const coordsEl = Array.from(el.getElementsByTagName('*')).find(
            (c) => localName(c) === 'coordinates'
          )
          const pts = parseCoordTuples(coordsEl?.textContent || '')
          if (pts.length) features.push({ type: 'Point', latlngs: pts, name, description, extendedText })
        } else if (tag === 'linestring') {
          const coordsEl = Array.from(el.getElementsByTagName('*')).find(
            (c) => localName(c) === 'coordinates'
          )
          const pts = parseCoordTuples(coordsEl?.textContent || '')
          if (pts.length >= 2) features.push({ type: 'LineString', latlngs: pts, name, description, extendedText })
        } else if (tag === 'polygon') {
          const outer =
            Array.from(el.getElementsByTagName('*')).find(
              (c) => localName(c) === 'outerboundaryis'
            ) || el
          const coordsEl = Array.from(outer.getElementsByTagName('*')).find(
            (c) => localName(c) === 'coordinates'
          )
          const pts = parseCoordTuples(coordsEl?.textContent || '')
          if (pts.length >= 3) features.push({ type: 'Polygon', latlngs: pts, name, description, extendedText })
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
