/**
 * Phase A — GIS-based recommended geotechnical investigation point planning.
 * Points are PROPOSED — not field-completed boreholes.
 */

export type InvestigationGeometryType = 'point' | 'line' | 'polygon'

export type BoreholePointStatus = 'PROPOSED_GIS_INVESTIGATION_POINT'

export interface InvestigationGeometry {
  type: InvestigationGeometryType
  coordinates: Array<{ lat: number; lon: number }>
  areaSqM?: number
  lengthM?: number
  perimeterM?: number
}

export interface RecommendedInvestigationPoint {
  boreholeId: string
  latitude: number
  longitude: number
  recommendedInvestigationDepthM: number
  spacingM: number | null
  selectionReason: string
  coverageZone: string
  dataConfidencePct: number
  status: BoreholePointStatus
  chainageM?: number
}

export interface BoreholeInvestigationPlan {
  geometryType: InvestigationGeometryType
  totalPoints: number
  recommendedSpacingM: number
  estimatedCoveragePct: number
  terrainVariationNote: string
  soilVariabilityNote: string
  points: RecommendedInvestigationPoint[]
  analysisSummary: string
}

const R = 6371000

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function lineLengthM(coords: Array<{ lat: number; lon: number }>): number {
  let len = 0
  for (let i = 1; i < coords.length; i++) {
    len += haversineM(coords[i - 1].lat, coords[i - 1].lon, coords[i].lat, coords[i].lon)
  }
  return len
}

/** Shoelace area on WGS84 (planar approx — adequate for site-scale polygons). */
function polygonAreaSqM(coords: Array<{ lat: number; lon: number }>): number {
  if (coords.length < 3) return 0
  const lat0 = coords.reduce((s, c) => s + c.lat, 0) / coords.length
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180)
  let area = 0
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    const xi = coords[i].lon * mPerDegLon
    const yi = coords[i].lat * mPerDegLat
    const xj = coords[j].lon * mPerDegLon
    const yj = coords[j].lat * mPerDegLat
    area += xi * yj - xj * yi
  }
  return Math.abs(area) / 2
}

function pointInPolygon(lat: number, lon: number, poly: Array<{ lat: number; lon: number }>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lon
    const yi = poly[i].lat
    const xj = poly[j].lon
    const yj = poly[j].lat
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function interpolateAlongLine(
  coords: Array<{ lat: number; lon: number }>,
  distM: number
): { lat: number; lon: number; chainageM: number } {
  let acc = 0
  for (let i = 1; i < coords.length; i++) {
    const seg = haversineM(coords[i - 1].lat, coords[i - 1].lon, coords[i].lat, coords[i].lon)
    if (acc + seg >= distM) {
      const t = seg > 0 ? (distM - acc) / seg : 0
      return {
        lat: coords[i - 1].lat + t * (coords[i].lat - coords[i - 1].lat),
        lon: coords[i - 1].lon + t * (coords[i].lon - coords[i - 1].lon),
        chainageM: distM,
      }
    }
    acc += seg
  }
  const last = coords[coords.length - 1]
  return { lat: last.lat, lon: last.lon, chainageM: acc }
}

function gridPointsInPolygon(
  poly: Array<{ lat: number; lon: number }>,
  spacingM: number
): Array<{ lat: number; lon: number }> {
  const lats = poly.map((p) => p.lat)
  const lons = poly.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const lat0 = (minLat + maxLat) / 2
  const dLat = spacingM / 111320
  const dLon = spacingM / (111320 * Math.cos((lat0 * Math.PI) / 180))
  const out: Array<{ lat: number; lon: number }> = []
  for (let lat = minLat; lat <= maxLat + 1e-9; lat += dLat) {
    for (let lon = minLon; lon <= maxLon + 1e-9; lon += dLon) {
      if (pointInPolygon(lat, lon, poly)) out.push({ lat, lon })
    }
  }
  return out
}

function centroid(coords: Array<{ lat: number; lon: number }>): { lat: number; lon: number } {
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length
  const lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length
  return { lat, lon }
}

export function parseInvestigationGeometry(input: {
  type: InvestigationGeometryType
  coordinates: Array<{ lat: number; lon: number }>
}): InvestigationGeometry {
  const coords = input.coordinates.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
  if (input.type === 'line') {
    const lengthM = lineLengthM(coords)
    return { type: 'line', coordinates: coords, lengthM }
  }
  if (input.type === 'polygon') {
    const areaSqM = polygonAreaSqM(coords)
    let perimeterM = 0
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length
      perimeterM += haversineM(coords[i].lat, coords[i].lon, coords[j].lat, coords[j].lon)
    }
    return { type: 'polygon', coordinates: coords, areaSqM, perimeterM }
  }
  return { type: 'point', coordinates: coords.slice(0, 1) }
}

export function planBoreholeInvestigation(
  geometry: InvestigationGeometry,
  context?: {
    slopeDeg?: number | null
    elevationM?: number | null
    soilTextureHint?: string | null
  }
): BoreholeInvestigationPlan {
  const depthM = 2.0
  const slope = context?.slopeDeg
  const terrainNote =
    slope != null
      ? `Terrain slope ~${slope.toFixed(1)}° at focus — ${slope > 12 ? 'consider extra points on steep segments' : 'moderate relief for GIS screening'}.`
      : 'Terrain variation assessed from open DEM at investigation focus.'

  const soilNote = context?.soilTextureHint
    ? `Open GIS soil texture hint: ${context.soilTextureHint} — points spaced for spatial soil variability screening.`
    : 'Soil variability assessed from SoilGrids / open GIS at each recommended point.'

  const raw: Array<Omit<RecommendedInvestigationPoint, 'boreholeId' | 'status'>> = []

  if (geometry.type === 'point' && geometry.coordinates[0]) {
    const p = geometry.coordinates[0]
    raw.push({
      latitude: p.lat,
      longitude: p.lon,
      recommendedInvestigationDepthM: depthM,
      spacingM: null,
      selectionReason: 'Single-site investigation — representative GIS soil profile at selected coordinates.',
      coverageZone: 'Point site (~250 m SoilGrids pixel)',
      dataConfidencePct: 78,
    })
  } else if (geometry.type === 'line' && geometry.coordinates.length >= 2) {
    const lengthM = geometry.lengthM ?? lineLengthM(geometry.coordinates)
    const spacingM = Math.min(800, Math.max(150, Math.round(lengthM / Math.min(10, Math.max(2, Math.ceil(lengthM / 400))))))
    const count = Math.max(2, Math.min(12, Math.ceil(lengthM / spacingM) + 1))
    const actualSpacing = lengthM / Math.max(1, count - 1)
    for (let i = 0; i < count; i++) {
      const dist = i === count - 1 ? lengthM : (actualSpacing * i)
      const pt = interpolateAlongLine(geometry.coordinates, dist)
      raw.push({
        latitude: pt.lat,
        longitude: pt.lon,
        recommendedInvestigationDepthM: depthM,
        spacingM: i === 0 ? null : actualSpacing,
        chainageM: pt.chainageM,
        selectionReason:
          i === 0
            ? 'Line start — corridor entry soil/terrain reference.'
            : i === count - 1
              ? 'Line end — corridor exit soil/terrain reference.'
              : `Chainage ~${Math.round(pt.chainageM)} m — along-alignment spacing for transmission corridor screening.`,
        coverageZone: `Corridor segment · chainage ${Math.round(pt.chainageM)} m`,
        dataConfidencePct: Math.max(62, 82 - Math.floor(lengthM / 2000)),
      })
    }
  } else if (geometry.type === 'polygon' && geometry.coordinates.length >= 3) {
    const areaSqM = geometry.areaSqM ?? polygonAreaSqM(geometry.coordinates)
    const areaHa = areaSqM / 10000
    const spacingM = Math.min(500, Math.max(80, Math.round(Math.sqrt(areaSqM) / 2.5)))
    let candidates = gridPointsInPolygon(geometry.coordinates, spacingM)
    if (!candidates.length) candidates = [centroid(geometry.coordinates)]
    const c = centroid(geometry.coordinates)
    if (!candidates.some((p) => haversineM(p.lat, p.lon, c.lat, c.lon) < spacingM * 0.3)) {
      candidates.unshift(c)
    }
    candidates = candidates.slice(0, 12)
    candidates.forEach((p, i) => {
      const distPrev =
        i === 0 ? null : haversineM(candidates[i - 1].lat, candidates[i - 1].lon, p.lat, p.lon)
      raw.push({
        latitude: p.lat,
        longitude: p.lon,
        recommendedInvestigationDepthM: depthM,
        spacingM: distPrev,
        selectionReason:
          i === 0
            ? 'Polygon centroid — central soil/terrain representative for the investigation area.'
            : `Grid node ${i + 1} — covers ${areaHa.toFixed(2)} ha site with ~${spacingM} m GIS spacing.`,
        coverageZone: `Interior grid · ~${spacingM} m spacing`,
        dataConfidencePct: Math.max(60, 85 - Math.floor(areaHa)),
      })
    })
  }

  const points: RecommendedInvestigationPoint[] = raw.map((r, i) => ({
    ...r,
    boreholeId: `BH-${String(i + 1).padStart(2, '0')}`,
    status: 'PROPOSED_GIS_INVESTIGATION_POINT' as const,
  }))

  const avgSpacing =
    points.filter((p) => p.spacingM != null).reduce((s, p) => s + (p.spacingM ?? 0), 0) /
      Math.max(1, points.filter((p) => p.spacingM != null).length) || 0

  const coveragePct =
    geometry.type === 'polygon'
      ? Math.min(95, 55 + points.length * 8)
      : geometry.type === 'line'
        ? Math.min(92, 60 + points.length * 5)
        : 70

  const summary = `Recommended ${points.length} GIS investigation point(s) for ${geometry.type} geometry. Status: Proposed GIS Investigation Point — not field-completed. Primary investigation depth: 0.0–2.0 m.`

  return {
    geometryType: geometry.type,
    totalPoints: points.length,
    recommendedSpacingM: Math.round(avgSpacing || spacingFromGeometry(geometry)),
    estimatedCoveragePct: coveragePct,
    terrainVariationNote: terrainNote,
    soilVariabilityNote: soilNote,
    points,
    analysisSummary: summary,
  }
}

function spacingFromGeometry(g: InvestigationGeometry): number {
  if (g.type === 'line' && g.lengthM) return Math.min(800, Math.max(150, g.lengthM / 4))
  if (g.type === 'polygon' && g.areaSqM) return Math.min(500, Math.max(80, Math.sqrt(g.areaSqM) / 2.5))
  return 0
}

/** Build geometry from KML-style lat/lon pairs. */
export function geometryFromPath(
  coords: Array<[number, number]>,
  closed: boolean
): InvestigationGeometry | null {
  if (!coords.length) return null
  if (coords.length === 1) {
    return parseInvestigationGeometry({
      type: 'point',
      coordinates: [{ lat: coords[0][0], lon: coords[0][1] }],
    })
  }
  const points = coords.map(([lat, lon]) => ({ lat, lon }))
  if (closed && coords.length >= 3) {
    return parseInvestigationGeometry({ type: 'polygon', coordinates: points })
  }
  return parseInvestigationGeometry({ type: 'line', coordinates: points })
}
