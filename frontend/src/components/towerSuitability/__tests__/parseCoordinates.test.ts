import { describe, expect, it } from 'vitest'

import {
  isFacingIndiaLongitude,
  parseStartCoordinates,
  utmToLatLon,
} from '../parseCoordinates'

describe('parseStartCoordinates', () => {
  it('accepts WGS84 lat/lon', () => {
    const r = parseStartCoordinates('22.9734', '78.6569')
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.format).toBe('wgs84')
    expect(r.lat).toBeCloseTo(22.9734, 4)
    expect(r.lon).toBeCloseTo(78.6569, 4)
  })

  it('converts UTM northing/easting (India) to lat/lon', () => {
    // Known approx: Zone 44N, E≈500000 near 81°E, N≈2500000 ~22.6°N
    const { lat, lon } = utmToLatLon(500000, 2500000, 44)
    expect(lat).toBeGreaterThan(20)
    expect(lat).toBeLessThan(25)
    expect(lon).toBeGreaterThan(78)
    expect(lon).toBeLessThan(84)

    const r = parseStartCoordinates(String(2500000), String(500000))
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.format).toBe('utm')
    expect(r.lat).toBeGreaterThan(6)
    expect(r.lon).toBeGreaterThan(68)
  })

  it('rejects garbage', () => {
    const r = parseStartCoordinates('abc', 'def')
    expect('error' in r).toBe(true)
  })
})

describe('isFacingIndiaLongitude', () => {
  it('marks India lon band', () => {
    expect(isFacingIndiaLongitude(78.6)).toBe(true)
    expect(isFacingIndiaLongitude(120)).toBe(false)
    expect(isFacingIndiaLongitude(-10)).toBe(false)
  })
})
