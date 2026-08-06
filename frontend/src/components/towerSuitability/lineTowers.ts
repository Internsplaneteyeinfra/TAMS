import type { KmlFeature, KmlLatLng } from './fetchSiteSignals'

/** Typical 132–220 kV transmission span in India. */
export const DEFAULT_TOWER_SPAN_M = 350

export function parseVoltageFromText(...parts: Array<string | undefined | null>): number | null {
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

export function spanForVoltageKv(voltageKv: number | null): number {
  if (voltageKv == null) return DEFAULT_TOWER_SPAN_M
  if (voltageKv <= 33) return 180
  if (voltageKv <= 66) return 220
  if (voltageKv <= 132) return 300
  if (voltageKv <= 220) return 350
  if (voltageKv <= 400) return 400
  return 450
}

export function voltageLabel(voltageKv: number | null): string {
  return voltageKv != null ? `${voltageKv} kV` : 'Voltage unknown'
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
  voltageSource: 'kml' | 'tams' | 'osm' | 'default'
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
    while (true) {
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

  const kmlVoltage = parseVoltageFromText(
    options?.extraText,
    ...selected.map((row) => row.feature.name),
    ...selected.map((row) => row.feature.description),
    ...selected.map((row) => row.feature.extendedText),
    ...features.map((f) => f.name),
    ...features.map((f) => f.description),
    ...features.map((f) => f.extendedText)
  )
  const voltageKv = kmlVoltage ?? options?.voltageKv ?? null
  const spanM = options?.spanM ?? spanForVoltageKv(voltageKv)
  const voltageSource: LineTowerPlan['voltageSource'] =
    kmlVoltage != null ? 'kml' : options?.voltageKv != null ? options.voltageSource ?? 'tams' : 'default'

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
