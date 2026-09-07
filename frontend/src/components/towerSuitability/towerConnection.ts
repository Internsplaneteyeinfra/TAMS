import type { PlannedTower } from './lineTowers'
import type { NearbyPowerAsset } from './nearbyPowerSupply'
import type { PlannedTowerAdvice } from './corridorPlacementAdvice'
import type { SelectedTowerDetail } from './TowerAssetDetailCard'
import { bearingLabel, corridorPerpendicularM, nearestPowerStation } from './towerMapMetrics'

/** Same thresholds as scoring.ts road factor (OSRM nearest). */
export function roadAccessSuitability(roadKm: number | null | undefined): {
  label: string
  note: string
  score: number
} {
  if (roadKm == null || !Number.isFinite(roadKm)) {
    return {
      label: 'Uncertain',
      note: 'Live road lookup failed — treat access as uncertain.',
      score: 3,
    }
  }
  // Mirror scoring thresholdScore(road, 0.5, 8, false)
  let score: number
  if (roadKm <= 0.5) score = 10
  else if (roadKm >= 8) score = 0
  else score = ((8 - roadKm) / (8 - 0.5)) * 10
  const label =
    roadKm <= 0.5 ? 'Good' : roadKm <= 3 ? 'Acceptable' : roadKm <= 8 ? 'Distant' : 'Poor'
  const note =
    roadKm > 3
      ? 'Distant from mapped roads — construction access risk.'
      : 'Reasonable access for tower erection logistics.'
  return { label, note, score: Math.round(score * 10) / 10 }
}

export type TowerConnectionOverlay = {
  key: string
  from: { lat: number; lon: number; label: string }
  to: { lat: number; lon: number; label: string; id?: string }
  straightM: number
  /** Perpendicular snap on the user corridor (existing tower → line). */
  corridorSnap?: { lat: number; lon: number }
  corridorDistM?: number
  nearestStation?: {
    name: string
    distM: number
    direction: string
    lat: number
    lon: number
  }
  roadDirection?: string
  showRoad: boolean
  roadKm?: number | null
  roadCoords?: Array<[number, number]>
  roadLoading?: boolean
  rationale?: string
  /** OSRM nearest-road snap (same as pad / site road-access factor). */
  roadAccessKm?: number | null
  roadAccessLat?: number | null
  roadAccessLon?: number | null
  roadAccessLoading?: boolean
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function connectionKeyFor(detail: SelectedTowerDetail): string {
  return detail.kind === 'planned' ? `planned-${detail.index}` : `existing-${detail.asset.id}`
}

export function buildConnectionOverlay(
  detail: SelectedTowerDetail,
  advice: PlannedTowerAdvice | undefined,
  plannedTowers: PlannedTower[],
  corridorPath: Array<{ lat: number; lon: number }>,
  nearbyAssets: NearbyPowerAsset[]
): TowerConnectionOverlay | null {
  if (detail.kind === 'planned') {
    const a = advice ?? detail.advice
    if (a?.nearestExistingLat == null || a.nearestExistingLon == null) return null
    const straightM =
      a.nearestExistingM ??
      haversineM(detail.lat, detail.lon, a.nearestExistingLat, a.nearestExistingLon)
    const roadDirection = bearingLabel(detail.lat, detail.lon, a.nearestExistingLat, a.nearestExistingLon)
    return {
      key: `planned-${detail.index}`,
      from: { lat: detail.lat, lon: detail.lon, label: `T${detail.index}` },
      to: {
        lat: a.nearestExistingLat,
        lon: a.nearestExistingLon,
        label: a.nearestExistingName ?? 'Existing tower',
        id: a.nearestExistingId,
      },
      straightM,
      roadDirection,
      showRoad: true,
      roadLoading: true,
      rationale: a.connectRationale,
    }
  }

  const { lat, lon } = detail.asset
  const stationHit = nearestPowerStation(nearbyAssets, lat, lon)
  const nearestStation = stationHit
    ? {
        name: stationHit.asset.name,
        distM: stationHit.distM,
        direction: bearingLabel(lat, lon, stationHit.asset.lat, stationHit.asset.lon),
        lat: stationHit.asset.lat,
        lon: stationHit.asset.lon,
      }
    : undefined

  if (corridorPath.length >= 2) {
    const snap = corridorPerpendicularM(lat, lon, corridorPath)
    const roadDirection = bearingLabel(lat, lon, snap.snapLat, snap.snapLon)
    return {
      key: `existing-${detail.asset.id}`,
      from: { lat, lon, label: detail.asset.name },
      to: { lat: snap.snapLat, lon: snap.snapLon, label: 'Your line (closest point)' },
      straightM: snap.distM,
      corridorSnap: { lat: snap.snapLat, lon: snap.snapLon },
      corridorDistM: snap.distM,
      nearestStation,
      roadDirection,
      showRoad: true,
      roadLoading: true,
      rationale: `Minimum distance from this tower to your corridor — ${Math.round(snap.distM)} m perpendicular.`,
    }
  }

  let best: PlannedTower | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const t of plannedTowers) {
    const d = haversineM(lat, lon, t.lat, t.lon)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  if (!best) return null
  return {
    key: `existing-${detail.asset.id}`,
    from: { lat, lon, label: detail.asset.name },
    to: { lat: best.lat, lon: best.lon, label: `T${best.index}` },
    straightM: bestD,
    nearestStation,
    roadDirection: bearingLabel(lat, lon, best.lat, best.lon),
    showRoad: true,
    roadLoading: true,
    rationale: `Connect existing “${detail.asset.name}” toward planned T${best.index} on your corridor.`,
  }
}

export function formatMeters(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}
