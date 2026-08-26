import type { KmlFeature, KmlLatLng } from './fetchSiteSignals'

/** Fallback when voltage unknown — mid 132–220 kV practice. */
export const DEFAULT_TOWER_SPAN_M = 350

/**
 * Screening spans for India (typical corridor planning).
 * Not a certified structural design — final spans need sag-tension, wind/ice zone,
 * IS 5613 / CEA safety clearances, and utility standards.
 */
export interface VoltageClassStandard {
  kv: number
  /** Ruling / average span used for tower count estimate */
  rulingSpanM: number
  /** Practical denser spacing (more towers) */
  minSpanM: number
  /** Practical longer span before sag/clearance risk rises */
  maxSpanM: number
  /** Indicative ROW width (m) — order of magnitude from practice */
  rowWidthM: number
  label: string
  note: string
}

export const VOLTAGE_CLASS_STANDARDS: VoltageClassStandard[] = [
  {
    kv: 33,
    rulingSpanM: 120,
    minSpanM: 80,
    maxSpanM: 180,
    rowWidthM: 15,
    label: '33 kV',
    note: 'Often poles/H-poles; short spans for distribution / sub-transmission.',
  },
  {
    kv: 66,
    rulingSpanM: 200,
    minSpanM: 150,
    maxSpanM: 250,
    rowWidthM: 18,
    label: '66 kV',
    note: 'Sub-transmission; denser than 132 kV.',
  },
  {
    kv: 110,
    rulingSpanM: 280,
    minSpanM: 220,
    maxSpanM: 320,
    rowWidthM: 22,
    label: '110 kV',
    note: 'Regional class; treat near 132 kV practice.',
  },
  {
    kv: 132,
    rulingSpanM: 320,
    minSpanM: 280,
    maxSpanM: 380,
    rowWidthM: 27,
    label: '132 kV',
    note: 'Common STU lines; ~300–350 m ruling span in flat terrain.',
  },
  {
    kv: 220,
    rulingSpanM: 360,
    minSpanM: 320,
    maxSpanM: 420,
    rowWidthM: 35,
    label: '220 kV',
    note: 'EHV; longer spans; higher clearance & ROW.',
  },
  {
    kv: 400,
    rulingSpanM: 400,
    minSpanM: 360,
    maxSpanM: 480,
    rowWidthM: 46,
    label: '400 kV',
    note: 'CEA EHV practice; span limited by sag, wind, river crossings.',
  },
  {
    kv: 765,
    rulingSpanM: 450,
    minSpanM: 400,
    maxSpanM: 520,
    rowWidthM: 64,
    label: '765 kV',
    note: 'UHV; specialized towers; large ROW and strict clearances.',
  },
]

export const VOLTAGE_OPTIONS_KV = VOLTAGE_CLASS_STANDARDS.map((s) => s.kv)

export type SpanPolicy = 'ruling' | 'dense' | 'long'

export function standardForVoltageKv(voltageKv: number | null): VoltageClassStandard | null {
  if (voltageKv == null) return null
  const exact = VOLTAGE_CLASS_STANDARDS.find((s) => s.kv === voltageKv)
  if (exact) return exact
  // nearest class
  let best = VOLTAGE_CLASS_STANDARDS[0]
  let bestD = Math.abs(best.kv - voltageKv)
  for (const s of VOLTAGE_CLASS_STANDARDS) {
    const d = Math.abs(s.kv - voltageKv)
    if (d < bestD) {
      best = s
      bestD = d
    }
  }
  return best
}

export function spanForVoltageKv(voltageKv: number | null, policy: SpanPolicy = 'ruling'): number {
  const std = standardForVoltageKv(voltageKv)
  if (!std) return DEFAULT_TOWER_SPAN_M
  if (policy === 'dense') return std.minSpanM
  if (policy === 'long') return std.maxSpanM
  return std.rulingSpanM
}

export function parseVoltageFromText(...parts: Array<string | undefined | null>): number | null {
  // Join in chunks — never spread huge KML feature lists as call args (stack overflow).
  const blob = parts.filter(Boolean).join(' ')
  if (!blob.trim()) return null
  const kvWord = blob.match(/(\d+(?:\.\d+)?)\s*k\s*v\b/i)
  if (kvWord) {
    const n = Number(kvWord[1])
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }
  const volts = blob.match(/\b(\d{4,7})\b/)
  if (volts) {
    const n = Number(volts[1])
    if (n >= 1000) return Math.round(n / 1000)
  }
  const classMatch = blob.match(/\b(33|66|110|132|220|400|500|765)\b/)
  if (classMatch) return Number(classMatch[1])
  return null
}

export function voltageLabel(voltageKv: number | null): string {
  return voltageKv != null ? `${voltageKv} kV` : 'Voltage unknown'
}

/** Human label for how voltage was chosen — honest about live vs planning. */
export function voltageSourceLabel(
  source: 'kml' | 'tams' | 'osm' | 'manual' | 'default' | 'substation'
): string {
  switch (source) {
    case 'tams':
      return 'Live · TAMS GIS nearby tower'
    case 'substation':
      return 'Live · nearest substation / plant (TAMS or OSM)'
    case 'osm':
      return 'Live · OSM power line voltage tag'
    case 'kml':
      return 'From KML metadata'
    case 'manual':
      return 'Manual · CEA planning class you selected'
    default:
      return 'Not set — pick voltage for CEA planning bands'
  }
}

export function towerPredictionNote(
  lengthKm: number,
  spanM: number,
  towerCount: number,
  std?: VoltageClassStandard | null
): string {
  const base = `Corridor ${lengthKm.toFixed(2)} km ÷ ${spanM} m span ≈ ${towerCount} towers (T1 at start, then every span).`
  if (!std) return `${base} Pick a voltage class for standard spacing.`
  return `${base} ${std.label} practice: ${std.minSpanM}–${std.maxSpanM} m (ruling ${std.rulingSpanM} m). ROW ~${std.rowWidthM} m.`
}

export function estimateTowerBand(lengthKm: number, std: VoltageClassStandard): {
  dense: number
  ruling: number
  long: number
} {
  const lengthM = lengthKm * 1000
  const count = (span: number) => Math.max(1, Math.floor(lengthM / span) + 1)
  return {
    dense: count(std.minSpanM),
    ruling: count(std.rulingSpanM),
    long: count(std.maxSpanM),
  }
}

function haversineM(a: KmlLatLng, b: KmlLatLng): number {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function polylineLengthM(latlngs: KmlLatLng[]): number {
  let total = 0
  for (let i = 1; i < latlngs.length; i++) total += haversineM(latlngs[i - 1], latlngs[i])
  return total
}

function interpolate(a: KmlLatLng, b: KmlLatLng, t: number): KmlLatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

export interface PlannedTower {
  lat: number
  lon: number
  chainageM: number
  index: number
}

export function placeTowersAlongLine(
  latlngs: KmlLatLng[],
  spanM = DEFAULT_TOWER_SPAN_M
): PlannedTower[] {
  if (latlngs.length === 0) return []
  if (latlngs.length === 1) {
    return [{ lat: latlngs[0][0], lon: latlngs[0][1], chainageM: 0, index: 1 }]
  }

  const towers: PlannedTower[] = [
    { lat: latlngs[0][0], lon: latlngs[0][1], chainageM: 0, index: 1 },
  ]

  let distSinceLast = 0
  let chainage = 0

  for (let i = 1; i < latlngs.length; i++) {
    const start = latlngs[i - 1]
    const end = latlngs[i]
    const segLen = haversineM(start, end)
    if (segLen < 0.5) continue

    let traveled = 0
    let from = start
    let remaining = segLen

    while (distSinceLast + remaining >= spanM - 0.5) {
      const need = spanM - distSinceLast
      const t = Math.min(1, need / Math.max(remaining, 0.001))
      const point = interpolate(from, end, t)
      chainage += need
      towers.push({
        lat: point[0],
        lon: point[1],
        chainageM: chainage,
        index: towers.length + 1,
      })
      from = point
      traveled += need
      remaining = segLen - traveled
      distSinceLast = 0
    }

    distSinceLast += remaining
    chainage += remaining
  }

  const lastPt = latlngs[latlngs.length - 1]
  const lastTower = towers[towers.length - 1]
  const tail = haversineM([lastTower.lat, lastTower.lon], lastPt)
  if (tail > spanM * 0.3) {
    towers.push({
      lat: lastPt[0],
      lon: lastPt[1],
      chainageM: chainage,
      index: towers.length + 1,
    })
  } else {
    lastTower.lat = lastPt[0]
    lastTower.lon = lastPt[1]
    lastTower.chainageM = chainage
  }

  return towers.map((t, i) => ({ ...t, index: i + 1 }))
}

export interface LineTowerPlan {
  lineCount: number
  lengthKm: number
  spanM: number
  towerCount: number
  towers: PlannedTower[]
  voltageKv: number | null
  voltageSource: 'kml' | 'tams' | 'osm' | 'manual' | 'default' | 'substation'
}

function dropClosing(latlngs: KmlLatLng[]): KmlLatLng[] {
  if (latlngs.length < 2) return latlngs
  const a = latlngs[0]
  const b = latlngs[latlngs.length - 1]
  if (Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(a[1] - b[1]) < 1e-8) return latlngs.slice(0, -1)
  return latlngs
}

function polygonToCorridor(latlngs: KmlLatLng[]): KmlLatLng[] {
  const ring = dropClosing(latlngs)
  if (ring.length < 2) return ring
  let a = 0
  let b = 1
  let best = 0
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 1; j < ring.length; j++) {
      const d = haversineM(ring[i], ring[j])
      if (d > best) {
        best = d
        a = i
        b = j
      }
    }
  }
  const walk = (start: number, end: number, dir: 1 | -1): KmlLatLng[] => {
    const out: KmlLatLng[] = []
    let i = start
    // Walk around the ring until we reach `end` (guaranteed for a closed ring)
    for (let step = 0; step <= ring.length; step++) {
      out.push(ring[i])
      if (i === end) break
      i = (i + dir + ring.length) % ring.length
    }
    return out
  }
  const forward = walk(a, b, 1)
  const backward = walk(a, b, -1)
  return polylineLengthM(forward) <= polylineLengthM(backward) ? forward : backward
}

function featurePath(feature: KmlFeature): KmlLatLng[] | null {
  if (feature.type === 'LineString' && feature.latlngs.length >= 2) return feature.latlngs
  if (feature.type === 'Polygon' && feature.latlngs.length >= 3) {
    const path = polygonToCorridor(feature.latlngs)
    return path.length >= 2 ? path : null
  }
  if (feature.type === 'Point' && feature.latlngs.length >= 1) return [feature.latlngs[0]]
  return null
}

function pathMidpoint(path: KmlLatLng[]): KmlLatLng {
  return path[Math.floor(path.length / 2)] || path[0]
}

export function planTowersFromKml(
  features: KmlFeature[],
  options?: {
    spanM?: number
    spanPolicy?: SpanPolicy
    voltageKv?: number | null
    voltageSource?: Exclude<LineTowerPlan['voltageSource'], 'kml' | 'default'>
    extraText?: string
    focus?: { lat: number; lon: number }
  }
): LineTowerPlan | null {
  const candidates = features
    .map((feature) => {
      const path = featurePath(feature)
      if (!path) return null
      return { feature, path, lengthM: polylineLengthM(path) }
    })
    .filter((row): row is { feature: KmlFeature; path: KmlLatLng[]; lengthM: number } => row != null)

  if (!candidates.length) return null

  const focus = options?.focus
  const ranked = [...candidates].sort((a, b) => {
    if (focus) {
      const am = pathMidpoint(a.path)
      const bm = pathMidpoint(b.path)
      const ad = haversineM(am, [focus.lat, focus.lon])
      const bd = haversineM(bm, [focus.lat, focus.lon])
      if (ad !== bd) return ad - bd
    }
    return b.lengthM - a.lengthM
  })

  const selected = ranked[0] ? [ranked[0]] : []
  if (!selected.length) return null

  const voltageParts: Array<string | undefined | null> = [options?.extraText]
  for (const row of selected) {
    voltageParts.push(row.feature.name, row.feature.description, row.feature.extendedText)
  }
  // Cap feature scan — large KMZ/KML can have thousands of placemarks.
  const sample = features.length > 40 ? features.slice(0, 40) : features
  for (const f of sample) {
    voltageParts.push(f.name, f.description, f.extendedText)
  }
  const kmlVoltage = parseVoltageFromText(...voltageParts)
  const manual = options?.voltageSource === 'manual' && options.voltageKv != null
  const voltageKv = manual ? options!.voltageKv! : kmlVoltage ?? options?.voltageKv ?? null
  const spanM = options?.spanM ?? spanForVoltageKv(voltageKv, options?.spanPolicy ?? 'ruling')
  const voltageSource: LineTowerPlan['voltageSource'] = manual
    ? 'manual'
    : kmlVoltage != null
      ? 'kml'
      : options?.voltageKv != null
        ? options.voltageSource ?? 'tams'
        : 'default'

  let lengthM = 0
  const towers: PlannedTower[] = []
  for (const row of selected) {
    lengthM += row.lengthM || 1
    if (row.path.length === 1) {
      towers.push({ lat: row.path[0][0], lon: row.path[0][1], chainageM: 0, index: towers.length + 1 })
    } else {
      towers.push(...placeTowersAlongLine(row.path, spanM))
    }
  }

  return {
    lineCount: selected.length,
    lengthKm: lengthM / 1000,
    spanM,
    towerCount: towers.length,
    voltageKv,
    voltageSource,
    towers: towers.map((t, i) => ({ ...t, index: i + 1 })),
  }
}
