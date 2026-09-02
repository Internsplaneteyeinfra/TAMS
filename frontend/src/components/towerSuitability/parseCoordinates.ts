/**
 * Parse start-projection coordinates.
 * Accepts WGS84 lat/lon OR UTM northing/easting (metres) for India.
 */

export type ParsedCoords = {
  lat: number
  lon: number
  format: 'wgs84' | 'utm'
  utmZone?: number
  note?: string
}

export type ParseCoordsResult = ParsedCoords | { error: string }

/** Approximate India bounds for UTM zone disambiguation */
const INDIA_LON = { min: 68, max: 98 }
const INDIA_LAT = { min: 6, max: 38 }

function isLikelyLatLon(a: number, b: number): boolean {
  return Math.abs(a) <= 90 && Math.abs(b) <= 180
}

function isLikelyUtmMetres(northing: number, easting: number): boolean {
  // Typical UTM: easting 100k–900k, northing (N hemisphere India) ~0.7M–4.2M
  return (
    easting >= 80_000 &&
    easting <= 920_000 &&
    northing >= 500_000 &&
    northing <= 5_000_000
  )
}

/**
 * UTM → WGS84 (WGS84 ellipsoid). Northern hemisphere only (India).
 * Based on USGS Bulletin 1532 / Karney simplified formulas.
 */
export function utmToLatLon(
  easting: number,
  northing: number,
  zone: number
): { lat: number; lon: number } {
  const a = 6378137.0
  const f = 1 / 298.257223563
  const k0 = 0.9996
  const e = Math.sqrt(f * (2 - f))
  const e1sq = (e * e) / (1 - e * e)

  const x = easting - 500000.0
  const y = northing

  const m = y / k0
  const mu =
    m /
    (a *
      (1 -
        (e * e) / 4 -
        (3 * Math.pow(e, 4)) / 64 -
        (5 * Math.pow(e, 6)) / 256))

  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e))

  const j1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32
  const j2 = (21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32
  const j3 = (151 * Math.pow(e1, 3)) / 96
  const j4 = (1097 * Math.pow(e1, 4)) / 512

  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu)

  const sinfp = Math.sin(fp)
  const cosfp = Math.cos(fp)
  const tanfp = Math.tan(fp)

  const c1 = e1sq * cosfp * cosfp
  const t1 = tanfp * tanfp
  const r1 = (a * (1 - e * e)) / Math.pow(1 - e * e * sinfp * sinfp, 1.5)
  const n1 = a / Math.sqrt(1 - e * e * sinfp * sinfp)
  const d = x / (n1 * k0)

  const q1 = (n1 * tanfp) / r1
  const q2 = (d * d) / 2
  const q3 =
    ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * e1sq) * Math.pow(d, 4)) / 24
  const q4 =
    ((61 +
      90 * t1 +
      298 * c1 +
      45 * t1 * t1 -
      252 * e1sq -
      3 * c1 * c1) *
      Math.pow(d, 6)) /
    720

  const lat = ((fp - q1 * (q2 - q3 + q4)) * 180) / Math.PI

  const q5 = d
  const q6 = ((1 + 2 * t1 + c1) * Math.pow(d, 3)) / 6
  const q7 =
    ((5 -
      2 * c1 +
      28 * t1 -
      3 * c1 * c1 +
      8 * e1sq +
      24 * t1 * t1) *
      Math.pow(d, 5)) /
    120

  const lon0 = (zone - 1) * 6 - 180 + 3
  const lon = lon0 + (((q5 - q6 + q7) / cosfp) * 180) / Math.PI

  return { lat, lon }
}

function scoreIndiaFit(lat: number, lon: number): number {
  const inLon = lon >= INDIA_LON.min && lon <= INDIA_LON.max
  const inLat = lat >= INDIA_LAT.min && lat <= INDIA_LAT.max
  if (inLon && inLat) return 0
  const dLon = Math.min(
    Math.abs(lon - INDIA_LON.min),
    Math.abs(lon - INDIA_LON.max),
    lon >= INDIA_LON.min && lon <= INDIA_LON.max ? 0 : 999
  )
  const dLat = Math.min(
    Math.abs(lat - INDIA_LAT.min),
    Math.abs(lat - INDIA_LAT.max),
    lat >= INDIA_LAT.min && lat <= INDIA_LAT.max ? 0 : 999
  )
  // Prefer points near India if slightly outside
  const midLat = (INDIA_LAT.min + INDIA_LAT.max) / 2
  const midLon = (INDIA_LON.min + INDIA_LON.max) / 2
  return Math.hypot(lat - midLat, lon - midLon) + (inLon ? 0 : dLon) + (inLat ? 0 : dLat)
}

/** Best UTM zone 42–47 (India) for given easting/northing. */
function bestUtmZoneForIndia(easting: number, northing: number): {
  zone: number
  lat: number
  lon: number
} {
  let best = { zone: 44, lat: 0, lon: 0, score: Infinity }
  for (let zone = 42; zone <= 47; zone++) {
    const { lat, lon } = utmToLatLon(easting, northing, zone)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue
    const score = scoreIndiaFit(lat, lon)
    if (score < best.score) best = { zone, lat, lon, score }
  }
  return { zone: best.zone, lat: best.lat, lon: best.lon }
}

/**
 * Parse a pair of field values.
 * Convention in UI:
 *   left field  = Latitude OR Northing
 *   right field = Longitude OR Easting
 */
export function parseStartCoordinates(
  latOrNorthingRaw: string,
  lonOrEastingRaw: string
): ParseCoordsResult {
  const a = Number(String(latOrNorthingRaw).trim().replace(/,/g, ''))
  const b = Number(String(lonOrEastingRaw).trim().replace(/,/g, ''))
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { error: 'Enter valid numbers for latitude/northing and longitude/easting.' }
  }

  // WGS84 lat / lon
  if (isLikelyLatLon(a, b)) {
    if (a < -90 || a > 90 || b < -180 || b > 180) {
      return { error: 'Latitude must be −90…90 and longitude −180…180.' }
    }
    return { lat: a, lon: b, format: 'wgs84' }
  }

  // UTM: left = Northing, right = Easting
  if (isLikelyUtmMetres(a, b)) {
    const { zone, lat, lon } = bestUtmZoneForIndia(b, a)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { error: 'Could not convert northing/easting to lat/lon.' }
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { error: 'Converted coordinates are out of range. Check northing/easting.' }
    }
    return {
      lat,
      lon,
      format: 'utm',
      utmZone: zone,
      note: `Converted UTM Zone ${zone}N → ${lat.toFixed(5)}°, ${lon.toFixed(5)}°`,
    }
  }

  // Sometimes users swap: left easting, right northing
  if (isLikelyUtmMetres(b, a)) {
    const { zone, lat, lon } = bestUtmZoneForIndia(a, b)
    return {
      lat,
      lon,
      format: 'utm',
      utmZone: zone,
      note: `Converted UTM Zone ${zone}N (E/N swapped) → ${lat.toFixed(5)}°, ${lon.toFixed(5)}°`,
    }
  }

  return {
    error:
      'Could not read coordinates. Use lat/lon (−90…90 / −180…180) or UTM northing/easting in metres (India zones 42–47N).',
  }
}

/** True when camera-facing longitude is over the India land band. */
export function isFacingIndiaLongitude(lon: number): boolean {
  let L = lon
  while (L > 180) L -= 360
  while (L < -180) L += 360
  return L >= INDIA_LON.min && L <= INDIA_LON.max
}
