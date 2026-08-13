/**
 * Compare planned KML corridor towers vs existing mapped towers
 * using CEA / utility span bands — where you can place vs must skip.
 */

import type { NearbyPowerAsset } from './nearbyPowerSupply'
import { type PlannedTower, type VoltageClassStandard } from './lineTowers'
import type { KmlLatLng } from './fetchSiteSignals'

function haversineM(a: KmlLatLng, b: KmlLatLng): number {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

export type PlacementVerdict = 'place' | 'skip_existing' | 'too_close' | 'review'

export interface PlannedTowerAdvice {
  index: number
  lat: number
  lon: number
  chainageM: number
  verdict: PlacementVerdict
  reason: string
  /** Nearest existing tower distance (m), if any within search */
  nearestExistingM: number | null
  nearestExistingName?: string
  /** Government / CEA span rule applied */
  ruleNote: string
}

export interface CorridorPlacementAdvice {
  voltageLabel: string
  spanM: number
  minSpanM: number
  maxSpanM: number
  rulingSpanM: number
  rowWidthM: number
  plannedCount: number
  /** New pads you can still add */
  canPlaceCount: number
  /** Skip — existing tower already covers this pad */
  skipExistingCount: number
  /** Too close to existing (< conflict radius) */
  tooCloseCount: number
  reviewCount: number
  items: PlannedTowerAdvice[]
  summary: string
  rulesSummary: string
  existingAlongCorridor: number
}

function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineM([lat1, lon1], [lat2, lon2])
}

/**
 * Existing assets near the corridor (within lateral buffer of the line).
 */
function existingNearCorridor(
  path: KmlLatLng[],
  existing: NearbyPowerAsset[],
  lateralBufferM: number
): NearbyPowerAsset[] {
  if (!path.length || !existing.length) return []
  return existing.filter((a) => {
    if (a.kind !== 'tower' && a.kind !== 'pole' && a.kind !== 'line') return false
    let best = Number.POSITIVE_INFINITY
    for (const [la, lo] of path) {
      const d = distM(a.lat, a.lon, la, lo)
      if (d < best) best = d
    }
    // Also sample segment midpoints for longer segments
    for (let i = 1; i < path.length; i++) {
      const mid: KmlLatLng = [(path[i - 1][0] + path[i][0]) / 2, (path[i - 1][1] + path[i][1]) / 2]
      const d = distM(a.lat, a.lon, mid[0], mid[1])
      if (d < best) best = d
    }
    return best <= lateralBufferM
  })
}

function nearestExisting(
  lat: number,
  lon: number,
  existing: NearbyPowerAsset[]
): { asset: NearbyPowerAsset; distM: number } | null {
  let best: { asset: NearbyPowerAsset; distM: number } | null = null
  for (const a of existing) {
    if (a.kind !== 'tower' && a.kind !== 'pole') continue
    const d = distM(lat, lon, a.lat, a.lon)
    if (!best || d < best.distM) best = { asset: a, distM: d }
  }
  return best
}

/**
 * For each planned T1…Tn on the KML line, decide place vs skip using
 * CEA min/ruling/max span against nearby mapped towers.
 */
export function analyzeCorridorPlacement(input: {
  plannedTowers: PlannedTower[]
  corridorPath: KmlLatLng[]
  existingAssets: NearbyPowerAsset[]
  std: VoltageClassStandard | null
  spanM: number
  voltageKv: number | null
}): CorridorPlacementAdvice | null {
  const { plannedTowers, corridorPath, existingAssets, std, spanM, voltageKv } = input
  if (!plannedTowers.length) return null

  const minSpanM = std?.minSpanM ?? Math.round(spanM * 0.75)
  const maxSpanM = std?.maxSpanM ?? Math.round(spanM * 1.25)
  const rulingSpanM = std?.rulingSpanM ?? spanM
  const rowWidthM = std?.rowWidthM ?? 35
  const voltageLabel = std?.label ?? (voltageKv != null ? `${voltageKv} kV` : 'Voltage unset')

  // Conflict: new pad too close to existing tower (reuse that location instead)
  const conflictM = Math.max(40, Math.min(120, Math.round(minSpanM * 0.35)))
  // Lateral: existing tower counts as "on this corridor"
  const lateralM = Math.max(80, Math.round(rowWidthM * 1.5))

  const along = existingNearCorridor(
    corridorPath.length >= 2 ? corridorPath : plannedTowers.map((t) => [t.lat, t.lon] as KmlLatLng),
    existingAssets,
    lateralM
  )

  const items: PlannedTowerAdvice[] = plannedTowers.map((t) => {
    const near = nearestExisting(t.lat, t.lon, along.length ? along : existingAssets)
    const d = near?.distM ?? null
    const name = near?.asset.name
    const ruleNote = `${voltageLabel}: min ${minSpanM} m · usual ${rulingSpanM} m · max ${maxSpanM} m · ROW ~${rowWidthM} m`

    if (d != null && d <= conflictM) {
      return {
        index: t.index,
        lat: t.lat,
        lon: t.lon,
        chainageM: t.chainageM,
        verdict: 'skip_existing' as const,
        reason: `Do not place here. Existing tower “${name}” is only ${Math.round(
          d
        )} m away. Reuse that tower or move this pad (too close: under ${conflictM} m).`,
        nearestExistingM: d,
        nearestExistingName: name,
        ruleNote,
      }
    }

    if (d != null && d < minSpanM) {
      return {
        index: t.index,
        lat: t.lat,
        lon: t.lon,
        chainageM: t.chainageM,
        verdict: 'too_close' as const,
        reason: `Do not place here. For ${voltageLabel}, towers must be at least ~${minSpanM} m apart (utility practice). Existing “${name}” is ${Math.round(
          d
        )} m away — under the minimum span. Shift along the line or skip.`,
        nearestExistingM: d,
        nearestExistingName: name,
        ruleNote,
      }
    }

    if (d != null && d <= rulingSpanM * 1.15) {
      return {
        index: t.index,
        lat: t.lat,
        lon: t.lon,
        chainageM: t.chainageM,
        verdict: 'review' as const,
        reason: `Review before placing. Existing “${name}” is ${Math.round(
          d
        )} m away (ruling span ~${rulingSpanM} m). A new tower may not be needed — confirm with survey.`,
        nearestExistingM: d,
        nearestExistingName: name,
        ruleNote,
      }
    }

    return {
      index: t.index,
      lat: t.lat,
      lon: t.lon,
      chainageM: t.chainageM,
      verdict: 'place' as const,
      reason:
        d != null
          ? `OK to place. Nearest existing tower is ${Math.round(
              d
            )} m away (≥ min ${minSpanM} m). Aim for ~${rulingSpanM} m spacing.`
          : `OK to place. No mapped tower nearby. Use ~${rulingSpanM} m spacing (${minSpanM}–${maxSpanM} m band).`,
      nearestExistingM: d,
      nearestExistingName: name,
      ruleNote,
    }
  })

  const canPlaceCount = items.filter((i) => i.verdict === 'place').length
  const skipExistingCount = items.filter((i) => i.verdict === 'skip_existing').length
  const tooCloseCount = items.filter((i) => i.verdict === 'too_close').length
  const reviewCount = items.filter((i) => i.verdict === 'review').length

  const summary = [
    `Your line plan: ${plannedTowers.length} towers at ${spanM} m span (${voltageLabel}).`,
    `Can place: ${canPlaceCount}.`,
    skipExistingCount ? `Cannot place (tower already there): ${skipExistingCount}.` : null,
    tooCloseCount ? `Cannot place (under min span): ${tooCloseCount}.` : null,
    reviewCount ? `Review first: ${reviewCount}.` : null,
    along.length
      ? `${along.length} mapped tower(s)/pole(s) within ${lateralM} m of this line.`
      : 'No mapped towers near this line — use open-corridor spacing.',
  ]
    .filter(Boolean)
    .join(' ')

  const rulesSummary = `${voltageLabel}: keep towers ${minSpanM}–${maxSpanM} m apart (usual ${rulingSpanM} m). ROW about ${rowWidthM} m. Screening only — final design needs utility approval.`

  return {
    voltageLabel,
    spanM,
    minSpanM,
    maxSpanM,
    rulingSpanM,
    rowWidthM,
    plannedCount: plannedTowers.length,
    canPlaceCount,
    skipExistingCount,
    tooCloseCount,
    reviewCount,
    items,
    summary,
    rulesSummary,
    existingAlongCorridor: along.length,
  }
}
