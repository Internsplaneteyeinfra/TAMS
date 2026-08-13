/**
 * Live lookup: nearest substations, plants, towers & lines — and where you can place.
 * Sources: TAMS GIS + OSM Overpass (not DISCOM load-flow or sanctioned MW).
 */

import { fetchGisProximity, fetchGisTowers, type Asset } from '@/lib/api'
import { spanForVoltageKv } from './lineTowers'

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

/** Live power-search radii the UI may pick. 1000 km is not supported — APIs time out. */
export const SEARCH_RADIUS_OPTIONS_KM = [8, 15, 25, 50] as const
export const DEFAULT_SEARCH_RADIUS_KM = 8
export const MIN_SEARCH_RADIUS_KM = 8
export const MAX_SEARCH_RADIUS_KM = 50

export function clampSearchRadiusKm(km?: number): number {
  const n = Number(km)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SEARCH_RADIUS_KM
  return Math.min(MAX_SEARCH_RADIUS_KM, Math.max(MIN_SEARCH_RADIUS_KM, Math.round(n)))
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

type OverpassEl = {
  id?: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function overpassJson(
  query: string
): Promise<{ elements?: OverpassEl[]; overpassUnavailable?: boolean } | null> {
  // Overpass mirrors often need 20–35s — do not abort early or we get false "no towers"
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

/** Normalise voltage strings: "33000", "33 kV", "33KV", "110000", "220 kV", "400000" → kV. Never invent. */
export function normalizeVoltageToKv(raw?: string | number | null): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null
    return raw >= 1000 ? Math.round(raw / 1000) : Math.round(raw)
  }
  const parsed = parseAllOsmVoltageKv(String(raw))
  return parsed[0] ?? null
}

export function parseAllOsmVoltageKv(raw?: string): number[] {
  if (!raw) return []
  const parts = String(raw)
    .split(/[;/|,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const kvs = new Set<number>()
  for (const part of parts) {
    const kvWord = part.match(/(\d+(?:\.\d+)?)\s*k\s*v\b/i)
    if (kvWord) {
      const n = Number(kvWord[1])
      if (Number.isFinite(n) && n > 0) kvs.add(Math.round(n))
      continue
    }
    const n = Number(part.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n) || n <= 0) continue
    // Volts (≥1000) → kV; already-kV values stay as-is
    kvs.add(n >= 1000 ? Math.round(n / 1000) : Math.round(n))
  }
  return [...kvs].sort((a, b) => b - a)
}

function assetVoltageKv(asset: Asset & { distance_km?: number; metadata?: Record<string, unknown> }): number | null {
  if (typeof asset.voltage_level_kv === 'number' && asset.voltage_level_kv > 0) {
    return normalizeVoltageToKv(asset.voltage_level_kv)
  }
  const meta = asset.metadata ?? {}
  const fromMeta = normalizeVoltageToKv(
    meta.voltage_kv != null ? String(meta.voltage_kv) : null
  )
  if (fromMeta != null) return fromMeta
  const cls = String(meta.substation_class ?? '')
  return normalizeVoltageToKv(cls)
}

export type NearbyPowerKind = 'substation' | 'plant' | 'tower' | 'line' | 'pole'

export interface NearbyPowerAsset {
  id: string
  name: string
  kind: NearbyPowerKind
  distanceKm: number
  voltageKv: number | null
  voltagesKv: number[]
  /** True when kV guessed from structure type (pole → 11–33), not an OSM voltage tag. */
  voltageInferred?: boolean
  role?: string
  operator?: string
  source: 'tams' | 'osm'
  lat: number
  lon: number
}

export type InterconnectEase = 'easy' | 'moderate' | 'hard'

/** Power-network decision — never treat API failure as engineering NO. */
export type PowerNetworkVerdict = 'yes' | 'no' | 'unknown'

export interface PlacementTip {
  title: string
  detail: string
  /** Honest accuracy band for this tip */
  accuracy: string
}

export interface PowerSearchDiagnostics {
  tamsTowerCount: number
  tamsSsCount: number
  osmAssetCount: number
  tamsOk: boolean
  osmOk: boolean
  searchRadiusKm: number
  errors: string[]
}

export interface NearbyPowerSupply {
  assets: NearbyPowerAsset[]
  /** Existing towers only (TAMS/OSM) — never planned T1…Tn */
  existingPowerTowers: NearbyPowerAsset[]
  existingPowerLines: NearbyPowerAsset[]
  existingSubstations: NearbyPowerAsset[]
  nearest: NearbyPowerAsset | null
  nearestTower: NearbyPowerAsset | null
  nearestPole: NearbyPowerAsset | null
  nearestSubstation: NearbyPowerAsset | null
  nearestLine: NearbyPowerAsset | null
  availableVoltageKv: number[]
  suggestedVoltageKv: number | null
  suggestedSource: 'tams' | 'osm' | null
  recommendedVoltageConfidence: 'high' | 'medium' | 'low'
  recommendedVoltageSource: string
  interconnectEase: InterconnectEase
  /** Three-state power verdict */
  powerNetworkVerdict: PowerNetworkVerdict
  /** False when TAMS and OSM both failed or returned no usable assets */
  dataAvailable: boolean
  diagnostics: PowerSearchDiagnostics
  placementTips: PlacementTip[]
  liveOk: boolean
  searchRadiusKm: number
  note: string
  corridorAssetCount: number
  osmQueryOk: boolean
  /** Straight-line Haversine to nearest existing asset (km) */
  directDistanceKm: number | null
  /** Screening estimate = direct × 1.2 */
  estimatedPracticalConnectionDistanceKm: number | null
  /** @deprecated alias of estimatedPracticalConnectionDistanceKm */
  connectionDistanceKm: number | null
  routeDifficulty: 'low' | 'moderate' | 'high'
  alternativeSiteHint: { directionDeg: number; distanceKm: number; reason: string } | null
}

function kindRank(kind: NearbyPowerKind): number {
  switch (kind) {
    case 'substation':
      return 0
    case 'plant':
      return 1
    case 'line':
      return 2
    case 'tower':
      return 3
    case 'pole':
      return 4
    default:
      return 5
  }
}

function dedupeNearby(assets: NearbyPowerAsset[]): NearbyPowerAsset[] {
  const out: NearbyPowerAsset[] = []
  for (const a of assets.sort((x, y) => {
    const d = x.distanceKm - y.distanceKm
    if (Math.abs(d) > 0.02) return d
    return kindRank(x.kind) - kindRank(y.kind)
  })) {
    // Poles/towers can be dense — tighter dedupe for them
    const thresh = a.kind === 'pole' || a.kind === 'tower' ? 0.06 : 0.25
    const dup = out.find(
      (b) =>
        haversineKm(a.lat, a.lon, b.lat, b.lon) < thresh &&
        (a.kind === b.kind ||
          ((a.kind === 'tower' || a.kind === 'pole') && (b.kind === 'tower' || b.kind === 'pole')))
    )
    if (dup) {
      if (a.voltageKv != null && (dup.voltageKv == null || dup.voltageInferred)) {
        dup.voltageKv = a.voltageKv
        dup.voltageInferred = a.voltageInferred
        dup.voltagesKv = [...new Set([...dup.voltagesKv, ...a.voltagesKv])].sort((x, y) => y - x)
      } else if (a.voltagesKv.length) {
        dup.voltagesKv = [...new Set([...dup.voltagesKv, ...a.voltagesKv])].sort((x, y) => y - x)
        if (dup.voltageKv == null && dup.voltagesKv[0] != null) dup.voltageKv = dup.voltagesKv[0]
      }
      if (a.kind === 'tower' && dup.kind === 'pole') dup.kind = 'tower'
      if (a.source === 'tams' && dup.source === 'osm') {
        dup.name = a.name
        dup.source = 'tams'
      }
      continue
    }
    out.push({ ...a })
  }
  return out
}

function sampleCorridorPoints(
  corridor: Array<{ lat: number; lon: number }>,
  maxPoints = 10
): Array<{ lat: number; lon: number }> {
  if (!corridor.length) return []
  if (corridor.length <= maxPoints) return corridor
  const out: Array<{ lat: number; lon: number }> = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * (corridor.length - 1)) / (maxPoints - 1))
    out.push(corridor[idx])
  }
  return out
}

function classifyOsmPower(tags: Record<string, string>): NearbyPowerKind | null {
  const power = tags.power || ''
  if (power === 'plant') return 'plant'
  if (power === 'substation') return 'substation'
  if (power === 'line' || power === 'minor_line' || power === 'cable') return 'line'
  if (power === 'tower' || power === 'portal') return 'tower'
  if (power === 'pole' || power === 'catenary_mast') return 'pole'
  return null
}

function inferDistributionKv(kind: NearbyPowerKind, tags: Record<string, string>): {
  kv: number | null
  inferred: boolean
  voltages: number[]
} {
  const tagged = parseAllOsmVoltageKv(
    tags.voltage || tags['voltage:primary'] || tags['voltage:secondary']
  )
  if (tagged.length) return { kv: tagged[0], inferred: false, voltages: tagged }
  // Never invent a voltage from structure type — leave unknown
  return { kv: null, inferred: false, voltages: [] }
}

function elementsToAssets(
  elements: OverpassEl[],
  focus: { lat: number; lon: number }
): NearbyPowerAsset[] {
  const out: NearbyPowerAsset[] = []
  for (const el of elements) {
    const p = elementPoint(el)
    if (!p) continue
    const tags = el.tags ?? {}
    const kind = classifyOsmPower(tags)
    if (!kind) continue
    const { kv, inferred, voltages } = inferDistributionKv(kind, tags)
    const name =
      tags.name ||
      tags['name:en'] ||
      tags.ref ||
      (kind === 'plant'
        ? 'Power plant (OSM)'
        : kind === 'substation'
          ? 'Substation (OSM)'
          : kind === 'line'
            ? `${tags.power === 'minor_line' ? 'Distribution line' : 'Power line'}${
                kv != null ? ` ~${kv} kV` : ''
              } (OSM)`
            : kind === 'pole'
              ? `Distribution pole${kv != null ? ` ~${kv} kV` : ''} (OSM)`
              : `Transmission tower${kv != null ? ` ${kv} kV` : ''} (OSM)`)

    const role =
      kind === 'plant'
        ? tags['plant:source'] || 'generation'
        : kind === 'substation'
          ? tags.substation || 'substation'
          : kind === 'line'
            ? tags.power === 'minor_line'
              ? 'LV/MV distribution line'
              : tags.circuits
                ? `${tags.circuits} circuit`
                : 'transmission line'
            : kind === 'pole'
              ? 'distribution pole (LV/MV)'
              : tags.structure || tags.design || 'lattice tower'

    out.push({
      id: `osm-${kind}-${el.id ?? `${p.lat.toFixed(5)}-${p.lon.toFixed(5)}`}`,
      name,
      kind,
      distanceKm: haversineKm(focus.lat, focus.lon, p.lat, p.lon),
      voltageKv: kv,
      voltagesKv: voltages,
      voltageInferred: inferred || undefined,
      role,
      operator: tags.operator || tags.owner,
      source: 'osm',
      lat: p.lat,
      lon: p.lon,
    })
  }
  return out
}

/**
 * OSM search around the selected lat/lon (8–50 km), plus optional corridor samples.
 * Returns assets + whether any Overpass query succeeded.
 */
async function osmNearbyPowerAssets(
  lat: number,
  lon: number,
  searchRadiusKm: number,
  corridor?: Array<{ lat: number; lon: number }>
): Promise<{ assets: NearbyPowerAsset[]; queryOk: boolean; error?: string }> {
  const radiusKm = clampSearchRadiusKm(searchRadiusKm)
  const radiusM = Math.round(radiusKm * 1000)
  const focus = { lat, lon }
  const samples = sampleCorridorPoints(
    corridor && corridor.length >= 2 ? corridor : [{ lat, lon }],
    radiusKm >= 25 ? 10 : 6
  )
  const timeoutSec = radiusKm >= 25 ? 25 : 18
  const outLimit = radiusKm >= 50 ? 60 : radiusKm >= 25 ? 100 : 150
  // Poles explode Overpass at wide radius — keep them only for local pad screening.
  const poleClause =
    radiusKm <= 15
      ? `node["power"="pole"](around:${radiusM},${lat},${lon});`
      : ''

  // Primary: circle around selected lat/lon (not only corridor)
  const aroundFocus = `[out:json][timeout:${timeoutSec}];(
    node["power"="tower"](around:${radiusM},${lat},${lon});
    node["power"="portal"](around:${radiusM},${lat},${lon});
    ${poleClause}
    way["power"="line"](around:${radiusM},${lat},${lon});
    way["power"="minor_line"](around:${radiusM},${lat},${lon});
    way["power"="cable"](around:${radiusM},${lat},${lon});
    node["power"="substation"](around:${radiusM},${lat},${lon});
    way["power"="substation"](around:${radiusM},${lat},${lon});
  );out tags center ${outLimit};`

  const ssRadiusM = Math.round(Math.max(radiusKm, 15) * 1000)
  const ssQuery = `[out:json][timeout:${timeoutSec}];(
    node["power"="substation"](around:${ssRadiusM},${lat},${lon});
    way["power"="substation"](around:${ssRadiusM},${lat},${lon});
    node["power"="plant"](around:${ssRadiusM},${lat},${lon});
    way["power"="plant"](around:${ssRadiusM},${lat},${lon});
  );out tags center 40;`

  const [focusRes, ss] = await Promise.all([overpassJson(aroundFocus), overpassJson(ssQuery)])

  const queryOk = focusRes != null || ss != null
  if (!queryOk) {
    console.warn('[nearbyPower] OSM Overpass unavailable for', { lat, lon, radiusM })
    return { assets: [], queryOk: false, error: 'OSM Overpass did not respond' }
  }

  const merged = [
    ...elementsToAssets(focusRes?.elements ?? [], focus),
    ...elementsToAssets(ss?.elements ?? [], focus),
  ]

  for (const a of merged) {
    let best = a.distanceKm
    for (const s of samples) {
      const d = haversineKm(s.lat, s.lon, a.lat, a.lon)
      if (d < best) best = d
    }
    a.distanceKm = best
  }

  console.info('[nearbyPower] OSM assets', {
    count: merged.length,
    towers: merged.filter((a) => a.kind === 'tower').length,
    lines: merged.filter((a) => a.kind === 'line').length,
    ss: merged.filter((a) => a.kind === 'substation').length,
    radiusKm: radiusM / 1000,
  })

  return { assets: merged, queryOk: true }
}

async function tamsNearbySubstations(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<{ assets: NearbyPowerAsset[]; ok: boolean; error?: string }> {
  try {
    const res = await withTimeout(
      fetchGisProximity(lat, lon, radiusKm, ['substation']),
      12000,
      null as unknown as Awaited<ReturnType<typeof fetchGisProximity>>
    )
    if (!res) {
      console.warn('[nearbyPower] TAMS proximity timeout/empty', { lat, lon, radiusKm })
      return { assets: [], ok: false, error: 'TAMS proximity timeout' }
    }
    const assets = (res.assets ?? []).map((a) => {
      const asset = a as Asset & { distance_km?: number }
      const kv = assetVoltageKv(asset)
      const meta = asset.metadata ?? {}
      return {
        id: `tams-ss-${asset.id}`,
        name: asset.name || 'Substation (TAMS)',
        kind: 'substation' as const,
        distanceKm:
          typeof asset.distance_km === 'number'
            ? asset.distance_km
            : haversineKm(lat, lon, asset.latitude, asset.longitude),
        voltageKv: kv,
        voltagesKv: kv != null ? [kv] : [],
        role: String(meta.substation_class ?? meta.power ?? 'transmission'),
        operator: meta.operator ? String(meta.operator) : undefined,
        source: 'tams' as const,
        lat: asset.latitude,
        lon: asset.longitude,
      }
    })
    console.info('[nearbyPower] TAMS substations', { count: assets.length, radiusKm })
    return { assets, ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.warn('[nearbyPower] TAMS proximity error', error)
    return { assets: [], ok: false, error }
  }
}

async function tamsNearbyTowers(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<{ assets: NearbyPowerAsset[]; ok: boolean; error?: string }> {
  // One bbox only — parallel wide scans previously hung the backend (120s → 502)
  const padKm = clampSearchRadiusKm(radiusKm)
  const deg = padKm / 111
  const bbox = `${lon - deg},${lat - deg},${lon + deg},${lat + deg}`
  const towerLimit = padKm >= 25 ? 800 : 300
  try {
    const res = await withTimeout(
      fetchGisTowers(bbox, undefined, towerLimit),
      55000,
      null as unknown as Awaited<ReturnType<typeof fetchGisTowers>>
    )
    if (!res) {
      console.warn('[nearbyPower] TAMS towers timeout', { lat, lon, padKm })
      return { assets: [], ok: false, error: 'TAMS GIS towers timeout' }
    }
    const assets = (res.assets ?? [])
      .map((t) => {
        const kv = assetVoltageKv(t)
        const d = haversineKm(lat, lon, t.latitude, t.longitude)
        return {
          id: `tams-twr-${t.id}`,
          name: t.name || 'Tower (TAMS)',
          kind: 'tower' as const,
          distanceKm: d,
          voltageKv: kv,
          voltagesKv: kv != null ? [kv] : [],
          role: 'transmission tower',
          source: 'tams' as const,
          lat: t.latitude,
          lon: t.longitude,
        }
      })
      .filter((a) => a.distanceKm <= padKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, padKm >= 25 ? 80 : 40)

    console.info('[nearbyPower] TAMS towers', { count: assets.length, padKm })
    return { assets, ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.warn('[nearbyPower] TAMS towers error', error)
    return { assets: [], ok: false, error }
  }
}

function pickSuggested(assets: NearbyPowerAsset[]): NearbyPowerAsset | null {
  // Prefer tagged voltage on SS/tower/line; poles with inferred 11 kV still useful
  const tagged = assets.filter((a) => a.voltageKv != null && !a.voltageInferred)
  const pool = tagged.length ? tagged : assets.filter((a) => a.voltageKv != null)
  const use = pool.length ? pool : assets
  if (!use.length) return null
  return [...use].sort((a, b) => {
    // Prefer assets already on/near corridor
    if (a.distanceKm <= 0.15 && b.distanceKm > 0.15) return -1
    if (b.distanceKm <= 0.15 && a.distanceKm > 0.15) return 1
    const kind = kindRank(a.kind) - kindRank(b.kind)
    if (kind !== 0) return kind
    return a.distanceKm - b.distanceKm
  })[0]
}

function interconnectEaseFrom(
  nearest: NearbyPowerAsset | null,
  nearestTower: NearbyPowerAsset | null,
  nearestPole: NearbyPowerAsset | null
): InterconnectEase {
  const d = Math.min(
    nearest?.distanceKm ?? Number.POSITIVE_INFINITY,
    nearestTower?.distanceKm ?? Number.POSITIVE_INFINITY,
    nearestPole?.distanceKm ?? Number.POSITIVE_INFINITY
  )
  if (!Number.isFinite(d)) return 'hard'
  // Poles along the drawn line = existing LV corridor — easy tap / rebuild
  if (d <= 0.25) return 'easy'
  if (d <= 2) return 'easy'
  if (d <= 12) return 'moderate'
  return 'hard'
}

function buildPlacementTips(input: {
  lat: number
  lon: number
  nearest: NearbyPowerAsset | null
  nearestTower: NearbyPowerAsset | null
  nearestPole: NearbyPowerAsset | null
  nearestSubstation: NearbyPowerAsset | null
  suggestedKv: number | null
  ease: InterconnectEase
  corridorAssetCount: number
  waterKm: number | null
  buildingKm: number | null
  slopeDeg: number | null
  landCover: string
}): PlacementTip[] {
  const tips: PlacementTip[] = []
  const {
    nearest,
    nearestTower,
    nearestPole,
    nearestSubstation,
    suggestedKv,
    ease,
    corridorAssetCount,
    waterKm,
    buildingKm,
    slopeDeg,
    landCover,
  } = input
  const spanM = spanForVoltageKv(suggestedKv, 'ruling')
  const target = nearestPole || nearestTower || nearest

  if (nearestPole && nearestPole.distanceKm <= 0.35) {
    tips.push({
      title: 'Existing low-voltage poles already on this corridor',
      detail: `${corridorAssetCount > 1 ? `${corridorAssetCount} mapped poles/lines` : 'Distribution poles'} sit within ~${(
        nearestPole.distanceKm * 1000
      ).toFixed(0)} m of your drawn line — typically 11–33 kV roadside feeders. Power take-off / rebuild along this ROW is simpler than greenfield. For 220 kV you still need a separate EHV corridor or rebuild to that class; do not assume poles carry 220 kV.`,
      accuracy:
        'OSM poles · distance to your drawn line. Structure type implies LV/MV; voltage tags often missing in rural India.',
    })
  } else if (ease === 'easy' && target) {
    tips.push({
      title: 'Power take-off is simple here',
      detail: `Existing ${powerKindLabel(target.kind).toLowerCase()} “${target.name}” is only ${target.distanceKm.toFixed(
        2
      )} km away${
        suggestedKv != null ? ` (~${suggestedKv} kV)` : ''
      }. Prefer a short spur / angle tower toward that corridor instead of a long greenfield line.`,
      accuracy: 'Live map distance ±~50–150 m; bay / MW capacity still needs utility OK.',
    })
  } else if (ease === 'moderate' && target) {
    tips.push({
      title: 'Tap existing corridor — moderate spur',
      detail: `Nearest grid asset ${target.distanceKm.toFixed(1)} km away. Route new towers along open land toward that asset; keep ruling span ~${spanM} m${
        suggestedKv != null ? ` for ${suggestedKv} kV` : ''
      }.`,
      accuracy: 'Corridor geometry from open data; final alignment needs survey + ROW.',
    })
  } else {
    tips.push({
      title: 'Mapped grid not found near corridor',
      detail:
        'OSM/TAMS have no poles/towers here yet — but satellite may still show roadside poles. Verify on imagery: if poles exist along your orange line, treat as LV corridor rebuild and pick 11/33 kV (or survey nameplate). For new 220 kV, this remains a longer greenfield spur to the nearest EHV SS.',
      accuracy: 'Open-data gap common in rural India — imagery truth > OSM when poles are visible.',
    })
  }

  if ((nearestTower || nearestPole) && (nearestTower?.distanceKm ?? nearestPole?.distanceKm ?? 99) <= 5) {
    const ref = nearestPole && (!nearestTower || nearestPole.distanceKm <= nearestTower.distanceKm)
      ? nearestPole
      : nearestTower!
    tips.push({
      title: 'Place / rebuild pads along the existing roadside ROW',
      detail: `Keep new structures on the same side of the road as the existing line toward ${ref.lat.toFixed(
        5
      )}, ${ref.lon.toFixed(5)}. For distribution reuse use ~80–120 m pole spans; for ${
        suggestedKv != null && suggestedKv >= 66 ? `${suggestedKv} kV` : 'EHV'
      } use ruling ~${spanM} m and wider clearances — do not reuse LV pole spacing for 220 kV.`,
      accuracy: `Span guidance from CEA practice bands (${spanM} m ruling for selected class) — not certified design.`,
    })
  }

  if (nearestSubstation) {
    tips.push({
      title: 'Prefer connection toward nearest substation',
      detail: `“${nearestSubstation.name}” @ ${nearestSubstation.distanceKm.toFixed(1)} km${
        nearestSubstation.voltageKv != null ? ` · ${nearestSubstation.voltageKv} kV` : ''
      }. Align corridor so dead-end / gantry points toward this SS for simpler power evacuation.`,
      accuracy: 'Mapped SS location live; bay availability not verified.',
    })
  }

  if (slopeDeg != null && slopeDeg > 8) {
    tips.push({
      title: 'Shift pad to flatter ground',
      detail: `Current slope ${slopeDeg.toFixed(1)}° — move 50–200 m to flatter farmland / ridge shelf before fixing tower coordinates.`,
      accuracy: 'DEM ~30 m — local micro-relief may differ; verify on site.',
    })
  }
  if (waterKm != null && waterKm < 0.25) {
    tips.push({
      title: 'Move away from mapped water',
      detail: `Water only ${waterKm.toFixed(2)} km away — place towers upslope / inland with ≥150–300 m buffer for flood/scour screening.`,
      accuracy: 'OSM water features; seasonal nullahs may be missing.',
    })
  }
  if (buildingKm != null && buildingKm < 0.1) {
    tips.push({
      title: 'Increase settlement setback',
      detail: `Buildings ~${(buildingKm * 1000).toFixed(0)} m away — shift pad into open field to reduce social / ROW conflict.`,
      accuracy: 'OSM buildings — incomplete in rural areas; check imagery.',
    })
  }
  if (landCover === 'built') {
    tips.push({
      title: 'Avoid built-up parcel',
      detail: 'Land cover hint is built-up — place towers on barren / agricultural open land outside the settlement footprint.',
      accuracy: 'OSM landuse hint only.',
    })
  } else if (landCover === 'barren' || landCover === 'vegetation') {
    tips.push({
      title: 'Open land is workable for pads',
      detail:
        landCover === 'barren'
          ? 'Barren/open hint favours foundation pads — keep access track from the nearest road.'
          : 'Vegetated land — plan legal clearance / crop compensation before pad cut.',
      accuracy: 'OSM landuse — not cadastral ownership.',
    })
  }

  return tips.slice(0, 6)
}

export async function findNearbyPowerSupply(
  lat: number,
  lon: number,
  searchRadiusKm = DEFAULT_SEARCH_RADIUS_KM,
  context?: {
    waterKm?: number | null
    buildingKm?: number | null
    slopeDeg?: number | null
    landCover?: string
    /** Drawn / uploaded corridor vertices — optional; search is always around lat/lon */
    corridor?: Array<{ lat: number; lon: number }>
  }
): Promise<NearbyPowerSupply> {
  const radiusKm = clampSearchRadiusKm(searchRadiusKm)
  const errors: string[] = []

  // Prefer OSM first (usually answers in 20–40s). TAMS KML can take longer on cold start.
  const osmPromise = osmNearbyPowerAssets(lat, lon, radiusKm, context?.corridor)
  const tamsTowersPromise = tamsNearbyTowers(lat, lon, radiusKm)
  const tamsSsPromise = tamsNearbySubstations(lat, lon, Math.max(radiusKm, 10))

  const osm = await osmPromise
  const [tamsTowers, tamsSs] = await Promise.all([tamsTowersPromise, tamsSsPromise])
  if (!tamsTowers.ok && tamsTowers.error) errors.push(tamsTowers.error)
  if (!tamsSs.ok && tamsSs.error) errors.push(tamsSs.error)
  if (!osm.queryOk && osm.error) errors.push(osm.error)

  const tamsHasAssets = tamsTowers.assets.length > 0 || tamsSs.assets.length > 0

  console.info('[nearbyPower] source summary', {
    lat,
    lon,
    radiusKm,
    tamsTowers: tamsTowers.assets.length,
    tamsSs: tamsSs.assets.length,
    tamsOk: tamsTowers.ok || tamsSs.ok,
    osmAssets: osm.assets.length,
    osmOk: osm.queryOk,
    errors,
  })

  const assets = dedupeNearby([
    ...tamsTowers.assets,
    ...tamsSs.assets,
    ...osm.assets,
  ]).slice(0, 50)

  const existingPowerTowers = assets.filter((a) => a.kind === 'tower')
  const existingPowerLines = assets.filter((a) => a.kind === 'line')
  const existingSubstations = assets.filter((a) => a.kind === 'substation')

  const nearestPole = assets.find((a) => a.kind === 'pole') ?? null
  const nearestTower = existingPowerTowers[0] ?? null
  const nearestSubstation = existingSubstations[0] ?? null
  const nearestLineFeat = existingPowerLines[0] ?? null
  const suggested = pickSuggested(assets)
  const nearest =
    suggested ??
    nearestTower ??
    nearestLineFeat ??
    nearestSubstation ??
    nearestPole ??
    assets[0] ??
    null

  const corridorAssetCount = assets.filter(
    (a) =>
      (a.kind === 'pole' || a.kind === 'tower' || a.kind === 'line') && a.distanceKm <= 0.5
  ).length

  // Only tagged voltages — never invent
  const availableSet = new Set<number>()
  for (const a of assets) {
    if (a.voltageInferred) continue
    for (const kv of a.voltagesKv) availableSet.add(kv)
    if (a.voltageKv != null) availableSet.add(a.voltageKv)
  }
  const availableVoltageKv = [...availableSet].sort((a, b) => b - a)

  let suggestedVoltageKv: number | null = null
  let suggestedSource: 'tams' | 'osm' | null = null
  if (suggested && suggested.voltageKv != null && !suggested.voltageInferred) {
    suggestedVoltageKv = suggested.voltageKv
    suggestedSource = suggested.source
  } else if (nearestTower?.voltageKv != null && !nearestTower.voltageInferred) {
    suggestedVoltageKv = nearestTower.voltageKv
    suggestedSource = nearestTower.source
  } else if (nearestLineFeat?.voltageKv != null && !nearestLineFeat.voltageInferred) {
    suggestedVoltageKv = nearestLineFeat.voltageKv
    suggestedSource = nearestLineFeat.source
  } else if (nearestSubstation?.voltageKv != null) {
    suggestedVoltageKv = nearestSubstation.voltageKv
    suggestedSource = nearestSubstation.source
  }

  const ease = interconnectEaseFrom(nearest, nearestTower, nearestPole)

  const directDistanceKm = nearest?.distanceKm ?? null
  const estimatedPracticalConnectionDistanceKm =
    directDistanceKm != null ? Number((directDistanceKm * 1.2).toFixed(3)) : null

  const w = context?.waterKm ?? null
  const b = context?.buildingKm ?? null
  const sl = context?.slopeDeg ?? null
  let routeDifficulty: 'low' | 'moderate' | 'high' = 'low'
  if ((w != null && w < 0.15) || (b != null && b < 0.1) || (sl != null && sl > 18)) {
    routeDifficulty = 'high'
  } else if ((w != null && w < 0.4) || (b != null && b < 0.25) || (sl != null && sl > 10)) {
    routeDifficulty = 'moderate'
  }

  let recommendedVoltageConfidence: 'high' | 'medium' | 'low' = 'low'
  let recommendedVoltageSource = 'Unknown — no tagged voltage'
  if (suggestedVoltageKv != null && suggestedSource) {
    recommendedVoltageConfidence = 'high'
    recommendedVoltageSource =
      suggestedSource === 'tams' ? 'TAMS GIS mapped data' : 'OSM mapped data'
  }

  const tamsOk = tamsTowers.ok || tamsSs.ok || tamsHasAssets
  const osmOk = osm.queryOk
  const anySourceOk = tamsOk || osmOk
  const dataAvailable = assets.length > 0 && anySourceOk

  // Three-state verdict — API failure is NEVER a NO
  let powerNetworkVerdict: PowerNetworkVerdict = 'unknown'
  if (!anySourceOk || (!assets.length && !anySourceOk)) {
    powerNetworkVerdict = 'unknown'
  } else if (!assets.length) {
    // Sources responded but found nothing in radius
    powerNetworkVerdict = 'unknown'
  } else if (directDistanceKm != null && directDistanceKm > 30) {
    powerNetworkVerdict = 'no'
  } else if (
    directDistanceKm != null &&
    directDistanceKm > 20 &&
    routeDifficulty === 'high'
  ) {
    powerNetworkVerdict = 'no'
  } else if (directDistanceKm != null && directDistanceKm <= 20) {
    powerNetworkVerdict = 'yes'
  } else if (directDistanceKm != null && directDistanceKm <= 30) {
    powerNetworkVerdict = routeDifficulty === 'high' ? 'no' : 'yes'
  } else {
    powerNetworkVerdict = 'unknown'
  }

  // Alternative hint only when we have real infrastructure to point toward
  let alternativeSiteHint: { directionDeg: number; distanceKm: number; reason: string } | null =
    null
  if (powerNetworkVerdict === 'no' && nearest && directDistanceKm != null) {
    const dLat = nearest.lat - lat
    const dLon = nearest.lon - lon
    const bearingRad = Math.atan2(dLon * Math.cos((lat * Math.PI) / 180), dLat)
    const directionDeg = Math.round(((bearingRad * 180) / Math.PI + 360) % 360)
    const moveKm = Number((directDistanceKm * 0.7).toFixed(1))
    alternativeSiteHint = {
      directionDeg,
      distanceKm: moveKm,
      reason: `Move ~${moveKm} km toward existing ${nearest.kind} "${nearest.name}" (${directDistanceKm.toFixed(1)} km away) to shorten connection.`,
    }
  }

  let note: string
  if (powerNetworkVerdict === 'unknown') {
    note =
      !anySourceOk
        ? 'Power data unavailable — TAMS GIS and OSM Overpass did not return usable assets. This is not an engineering rejection; re-analyze when data is available.'
        : 'No existing towers/lines/substations found within the search radius. Connectivity cannot be assessed from open data.'
  } else if (nearestTower && nearestTower.source === 'tams') {
    note = `Existing TAMS tower “${nearestTower.name}” @ ${nearestTower.distanceKm.toFixed(2)} km${
      suggestedVoltageKv != null ? ` · ${suggestedVoltageKv} kV tagged` : ' · voltage unknown'
    }.`
  } else if (nearest) {
    note = `Nearest existing ${powerKindLabel(nearest.kind).toLowerCase()} “${nearest.name}” @ ${nearest.distanceKm.toFixed(2)} km${
      suggestedVoltageKv != null ? ` · ${suggestedVoltageKv} kV` : ' · voltage unknown'
    }.`
  } else {
    note = 'Power network search completed with no nearest asset.'
  }

  const placementTips =
    dataAvailable
      ? buildPlacementTips({
          lat,
          lon,
          nearest,
          nearestTower,
          nearestPole,
          nearestSubstation,
          suggestedKv: suggestedVoltageKv,
          ease,
          corridorAssetCount,
          waterKm: context?.waterKm ?? null,
          buildingKm: context?.buildingKm ?? null,
          slopeDeg: context?.slopeDeg ?? null,
          landCover: context?.landCover ?? 'unknown',
        })
      : []

  const diagnostics: PowerSearchDiagnostics = {
    tamsTowerCount: tamsTowers.assets.length,
    tamsSsCount: tamsSs.assets.length,
    osmAssetCount: osm.assets.length,
    tamsOk,
    osmOk,
    searchRadiusKm: radiusKm,
    errors,
  }

  return {
    assets,
    existingPowerTowers,
    existingPowerLines,
    existingSubstations,
    nearest,
    nearestTower,
    nearestPole,
    nearestSubstation,
    nearestLine: nearestLineFeat,
    availableVoltageKv,
    suggestedVoltageKv,
    suggestedSource,
    recommendedVoltageConfidence,
    recommendedVoltageSource,
    interconnectEase: ease,
    powerNetworkVerdict,
    dataAvailable,
    diagnostics,
    placementTips,
    liveOk: dataAvailable,
    searchRadiusKm: radiusKm,
    note,
    corridorAssetCount,
    osmQueryOk: osmOk,
    directDistanceKm,
    estimatedPracticalConnectionDistanceKm,
    connectionDistanceKm: estimatedPracticalConnectionDistanceKm,
    routeDifficulty,
    alternativeSiteHint,
  }
}

export function powerKindLabel(kind: NearbyPowerKind): string {
  switch (kind) {
    case 'plant':
      return 'Power plant'
    case 'substation':
      return 'Substation'
    case 'line':
      return 'Power line'
    case 'tower':
      return 'Transmission tower'
    case 'pole':
      return 'Distribution pole'
    default:
      return 'Grid asset'
  }
}

export function interconnectEaseLabel(ease: InterconnectEase): string {
  if (ease === 'easy') return 'Easy tap'
  if (ease === 'moderate') return 'Moderate spur'
  return 'Hard / greenfield'
}
