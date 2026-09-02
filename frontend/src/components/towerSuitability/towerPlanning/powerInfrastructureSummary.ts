/**
 * Phase I — power infrastructure summary with provenance (explicit user-triggered only).
 */

import type { NearbyPowerSupply } from '../nearbyPowerSupply'
import type { PowerInfrastructureSummary } from './types'

function bearingLabel(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(brng / 45) % 8]
}

export function summarizePowerInfrastructure(
  power: NearbyPowerSupply | null,
  fromLat: number,
  fromLon: number,
  searchRadiusKm: number
): PowerInfrastructureSummary {
  if (!power || (!power.nearestTower && !power.nearestSubstation && !power.nearestLine)) {
    return {
      nearestLabel: 'None detected',
      infrastructureType: '—',
      distanceKm: null,
      direction: null,
      source: 'OpenStreetMap / TAMS GIS',
      method: `Corridor-aware search within ${searchRadiusKm} km`,
      confidence: 'LOW',
      status: 'NOT_DETECTED',
      message:
        'No power infrastructure detected in the currently available GIS dataset and search radius. This does not mean no infrastructure exists on site.',
      raw: power,
    }
  }

  const nearest =
    power.nearestSubstation &&
    (!power.nearestTower ||
      (power.nearestSubstation.distanceKm ?? 99) <= (power.nearestTower.distanceKm ?? 99))
      ? { kind: 'Substation / Plant', asset: power.nearestSubstation }
      : power.nearestTower
        ? { kind: 'Transmission Tower', asset: power.nearestTower }
        : power.nearestLine
          ? { kind: 'Transmission Line', asset: power.nearestLine }
          : null

  if (!nearest?.asset) {
    return summarizePowerInfrastructure(null, fromLat, fromLon, searchRadiusKm)
  }

  const dist = nearest.asset.distanceKm ?? null
  const direction =
    nearest.asset.lat != null && nearest.asset.lon != null
      ? bearingLabel(fromLat, fromLon, nearest.asset.lat, nearest.asset.lon)
      : null

  const sourceParts = [
    power.diagnostics?.tamsTowerCount ? 'TAMS GIS' : null,
    power.diagnostics?.osmAssetCount ? 'OpenStreetMap' : null,
  ].filter(Boolean)

  return {
    nearestLabel: nearest.asset.name || nearest.asset.id || 'Nearest asset',
    infrastructureType: nearest.kind,
    distanceKm: dist,
    direction,
    source: sourceParts.join(' + ') || 'GIS dataset',
    method: `Explicit user-triggered search within ${searchRadiusKm} km`,
    confidence: power.diagnostics?.osmOk === false && power.diagnostics?.tamsOk === false ? 'LOW' : 'MODERATE',
    status: 'GIS_DETECTED',
    message: 'GIS-detected infrastructure — verification required before design decisions.',
    raw: power,
  }
}
