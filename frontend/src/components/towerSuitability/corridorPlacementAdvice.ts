/**
 * Compare planned KML corridor towers vs existing mapped towers
 * within the user-selected search radius — suggestions only (not orders).
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

/** How well this line matches the selected / suggested kV class. */
export type LineKvSuitability = 'good' | 'fair' | 'poor' | 'unknown'

export interface PlannedTowerAdvice {
  index: number
  lat: number
  lon: number
  chainageM: number
  verdict: PlacementVerdict
  reason: string
  nearestExistingM: number | null
  nearestExistingName?: string
  nearestExistingId?: string
  nearestExistingLat?: number | null
  nearestExistingLon?: number | null
  /** Suggested shift / reuse position (too_close → offset; skip_existing → existing tower) */
  suggestedLat?: number | null
  suggestedLon?: number | null
  /** Why we suggest connecting to the nearest mapped tower for this pad */
  connectRationale?: string
  ruleNote: string
}

export interface CorridorConnectHint {
  id: string
  name: string
  kind: 'tower' | 'pole' | 'substation' | 'plant' | 'line'
  lat: number
  lon: number
  distanceKm: number
  voltageKv: number | null
  /** Why this is a useful connect target for the selected line */
  note: string
}

/** Suggested power take-off: station ↔ best new pad (+ nearest existing tower). */
export interface PowerConnectSuggestion {
  /** Planned pad index best for taking power toward the station */
  bestPadIndex: number
  bestPadLat: number
  bestPadLon: number
  bestPadVerdict: PlacementVerdict
  station: CorridorConnectHint
  /** Existing tower nearest to that substation (grid side) */
  towerNearStation: CorridorConnectHint | null
  /** Existing tower nearest to the corridor / best pad */
  towerNearPad: CorridorConnectHint | null
  stationToPadKm: number
  stationToTowerKm: number | null
  padToTowerKm: number | null
  voltageFit: 'exact' | 'close' | 'mismatch' | 'unknown'
  /** Screening confidence that this interconnect is a good fit (not a certificate) */
  confidencePct: number
  confidenceNote: string
  summary: string
}

export interface CorridorPlacementAdvice {
  voltageLabel: string
  voltageKv: number | null
  spanM: number
  minSpanM: number
  maxSpanM: number
  rulingSpanM: number
  rowWidthM: number
  plannedCount: number
  canPlaceCount: number
  skipExistingCount: number
  tooCloseCount: number
  reviewCount: number
  items: PlannedTowerAdvice[]
  summary: string
  rulesSummary: string
  existingAlongCorridor: number
  /** User-selected search radius used for this advice */
  searchRadiusKm: number
  /** Assets found inside the search radius of the corridor */
  assetsInRadiusCount: number
  /** Existing towers/poles within radius of the line */
  towersInRadiusCount: number
  lineSuitability: LineKvSuitability
  /** Map stroke / badge color for the corridor */
  lineColor: string
  /** Soft narrative: why this line + kV is a reasonable suggestion */
  whyFollow: string
  /** Soft narrative: reasons you may choose a different line / kV */
  whyNotFollow: string
  /** Disclaimer — suggestions, not orders */
  suggestionNote: string
  nearestTower: CorridorConnectHint | null
  nearestStation: CorridorConnectHint | null
  /** Up to 5 nearest mapped towers/poles to the corridor (for list UI) */
  nearestTowersTop5: CorridorConnectHint[]
  /** Up to 3 nearest substations/plants to the corridor */
  nearestStationsTop3: CorridorConnectHint[]
  /** Full power take-off suggestion (SS → new T# → existing tower) */
  powerConnect: PowerConnectSuggestion | null
  /** Nearby voltages seen in the radius (for compare) */
  nearbyVoltagesKv: number[]
  /** Suggested practical connect distance (km) toward nearest station/tower */
  suggestedConnectKm: number | null
}

function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineM([lat1, lon1], [lat2, lon2])
}

/** Move pad away from existing tower until target spacing (m) is reached. */
function suggestShiftPosition(
  exLat: number,
  exLon: number,
  padLat: number,
  padLon: number,
  targetDistM: number
): { lat: number; lon: number } {
  const d = distM(exLat, exLon, padLat, padLon)
  if (d < 1) {
    const dLat = targetDistM / 111320
    return { lat: padLat + dLat, lon: padLon }
  }
  const scale = targetDistM / d
  return {
    lat: exLat + (padLat - exLat) * scale,
    lon: exLon + (padLon - exLon) * scale,
  }
}

function distToPathM(lat: number, lon: number, path: KmlLatLng[]): number {
  if (!path.length) return Number.POSITIVE_INFINITY
  let best = Number.POSITIVE_INFINITY
  for (const [la, lo] of path) {
    const d = distM(lat, lon, la, lo)
    if (d < best) best = d
  }
  for (let i = 1; i < path.length; i++) {
    const mid: KmlLatLng = [(path[i - 1][0] + path[i][0]) / 2, (path[i - 1][1] + path[i][1]) / 2]
    const d = distM(lat, lon, mid[0], mid[1])
    if (d < best) best = d
  }
  return best
}

function assetsWithinRadiusOfPath(
  path: KmlLatLng[],
  existing: NearbyPowerAsset[],
  radiusKm: number
): NearbyPowerAsset[] {
  const radiusM = Math.max(0.5, radiusKm) * 1000
  if (!path.length || !existing.length) return []
  return existing.filter((a) => distToPathM(a.lat, a.lon, path) <= radiusM)
}

function existingNearCorridor(
  path: KmlLatLng[],
  existing: NearbyPowerAsset[],
  lateralBufferM: number
): NearbyPowerAsset[] {
  if (!path.length || !existing.length) return []
  return existing.filter((a) => {
    if (a.kind !== 'tower' && a.kind !== 'pole' && a.kind !== 'line') return false
    return distToPathM(a.lat, a.lon, path) <= lateralBufferM
  })
}

function nearestOfKinds(
  path: KmlLatLng[],
  assets: NearbyPowerAsset[],
  kinds: NearbyPowerAsset['kind'][]
): { asset: NearbyPowerAsset; distM: number } | null {
  let best: { asset: NearbyPowerAsset; distM: number } | null = null
  for (const a of assets) {
    if (!kinds.includes(a.kind)) continue
    const d = distToPathM(a.lat, a.lon, path)
    if (!best || d < best.distM) best = { asset: a, distM: d }
  }
  return best
}

function nearestExisting(
  lat: number,
  lon: number,
  existing: NearbyPowerAsset[]
): { asset: NearbyPowerAsset; distM: number } | null {
  return nearestAssetToPoint(lat, lon, existing, ['tower', 'pole'])
}

function nearestAssetToPoint(
  lat: number,
  lon: number,
  assets: NearbyPowerAsset[],
  kinds: NearbyPowerAsset['kind'][]
): { asset: NearbyPowerAsset; distM: number } | null {
  let best: { asset: NearbyPowerAsset; distM: number } | null = null
  for (const a of assets) {
    if (!kinds.includes(a.kind)) continue
    const d = distM(lat, lon, a.lat, a.lon)
    if (!best || d < best.distM) best = { asset: a, distM: d }
  }
  return best
}

function toHint(
  asset: NearbyPowerAsset,
  distMVal: number,
  note: string
): CorridorConnectHint {
  return {
    id: asset.id,
    name: asset.name,
    kind:
      asset.kind === 'pole'
        ? 'pole'
        : asset.kind === 'plant'
          ? 'plant'
          : asset.kind === 'substation'
            ? 'substation'
            : asset.kind === 'line'
              ? 'line'
              : 'tower',
    lat: asset.lat,
    lon: asset.lon,
    distanceKm: distMVal / 1000,
    voltageKv: asset.voltageKv,
    note,
  }
}

function buildPowerConnect(input: {
  stationAsset: NearbyPowerAsset
  stationDistToPathM: number
  plannedTowers: PlannedTower[]
  items: PlannedTowerAdvice[]
  assets: NearbyPowerAsset[]
  voltageKv: number | null
  searchRadiusKm: number
}): PowerConnectSuggestion {
  const { stationAsset, stationDistToPathM, items, assets, voltageKv, searchRadiusKm } = input

  const station = toHint(
    stationAsset,
    stationDistToPathM,
    `Nearest substation / plant for power take-off within ${searchRadiusKm} km of your line.`
  )

  // Prefer a "place" pad closest to the station; else any pad closest to station
  const placePads = items.filter((i) => i.verdict === 'place')
  const pool = placePads.length ? placePads : items
  let best = pool[0]
  let bestD = distM(stationAsset.lat, stationAsset.lon, best.lat, best.lon)
  for (const p of pool) {
    const d = distM(stationAsset.lat, stationAsset.lon, p.lat, p.lon)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }

  // Existing tower nearest to the substation (grid side)
  const twAtSs = nearestAssetToPoint(stationAsset.lat, stationAsset.lon, assets, ['tower', 'pole'])
  const towerNearStation = twAtSs
    ? toHint(
        twAtSs.asset,
        twAtSs.distM,
        `Existing tower nearest to “${stationAsset.name}” — typical grid-side reference for interconnect.`
      )
    : null

  // Existing tower nearest to the best new pad
  const twAtPad = nearestAssetToPoint(best.lat, best.lon, assets, ['tower', 'pole'])
  const towerNearPad = twAtPad
    ? toHint(
        twAtPad.asset,
        twAtPad.distM,
        `Existing tower nearest to suggested new pad T${best.index}.`
      )
    : null

  const stationToPadKm = bestD / 1000
  const stationToTowerKm = towerNearStation ? towerNearStation.distanceKm : null
  const padToTowerKm = towerNearPad ? towerNearPad.distanceKm : null

  let voltageFit: PowerConnectSuggestion['voltageFit'] = 'unknown'
  if (voltageKv != null && stationAsset.voltageKv != null) {
    const delta = Math.abs(voltageKv - stationAsset.voltageKv)
    if (delta === 0) voltageFit = 'exact'
    else if (delta <= 40) voltageFit = 'close'
    else voltageFit = 'mismatch'
  } else if (
    voltageKv != null &&
    (towerNearStation?.voltageKv != null || towerNearPad?.voltageKv != null)
  ) {
    const ref = towerNearStation?.voltageKv ?? towerNearPad?.voltageKv!
    const delta = Math.abs(voltageKv - ref)
    if (delta === 0) voltageFit = 'exact'
    else if (delta <= 40) voltageFit = 'close'
    else voltageFit = 'mismatch'
  }

  // Screening confidence for “good fit to take power”
  let conf = 42
  if (best.verdict === 'place') conf += 18
  else if (best.verdict === 'review') conf += 6
  else conf -= 8

  if (stationToPadKm <= 2) conf += 18
  else if (stationToPadKm <= 5) conf += 12
  else if (stationToPadKm <= 10) conf += 6
  else if (stationToPadKm <= searchRadiusKm) conf += 2
  else conf -= 10

  if (voltageFit === 'exact') conf += 16
  else if (voltageFit === 'close') conf += 8
  else if (voltageFit === 'mismatch') conf -= 12

  if (towerNearStation && towerNearStation.distanceKm <= 3) conf += 8
  if (towerNearPad && towerNearPad.distanceKm <= 2) conf += 4

  conf = Math.max(28, Math.min(92, Math.round(conf)))

  const voltageFitText =
    voltageFit === 'exact'
      ? 'exact kV match'
      : voltageFit === 'close'
        ? 'close kV match'
        : voltageFit === 'mismatch'
          ? 'kV mismatch — may need transformation'
          : 'kV unknown on open maps'

  const confidenceNote = `Screening confidence ~${conf}% that connecting new T${best.index} toward “${station.name}” is a good power take-off idea (${voltageFitText}, ~${stationToPadKm.toFixed(1)} km). Not a bay booking or utility approval.`

  const summary = [
    `Best new pad for power: T${best.index} → station “${station.name}” (~${stationToPadKm.toFixed(2)} km).`,
    towerNearStation
      ? `Station’s nearest existing tower: “${towerNearStation.name}” (~${towerNearStation.distanceKm.toFixed(2)} km from SS).`
      : 'No existing tower mapped next to that station in this search.',
    towerNearPad && towerNearPad.id !== towerNearStation?.id
      ? `Existing tower near your new pad: “${towerNearPad.name}” (~${towerNearPad.distanceKm.toFixed(2)} km).`
      : null,
    confidenceNote,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    bestPadIndex: best.index,
    bestPadLat: best.lat,
    bestPadLon: best.lon,
    bestPadVerdict: best.verdict,
    station,
    towerNearStation,
    towerNearPad,
    stationToPadKm,
    stationToTowerKm,
    padToTowerKm,
    voltageFit,
    confidencePct: conf,
    confidenceNote,
    summary,
  }
}

export function lineSuitabilityColor(s: LineKvSuitability): string {
  switch (s) {
    case 'good':
      return '#16a34a' // green — line looks suitable for this kV
    case 'fair':
      return '#ca8a04' // amber — workable with review
    case 'poor':
      return '#dc2626' // red — mismatch / crowded
    default:
      return '#64748b' // slate — unknown
  }
}

function scoreLineKvSuitability(input: {
  voltageKv: number | null
  nearbyVoltages: number[]
  canPlaceCount: number
  plannedCount: number
  tooCloseCount: number
  skipExistingCount: number
  nearestStationKm: number | null
  searchRadiusKm: number
}): LineKvSuitability {
  const {
    voltageKv,
    nearbyVoltages,
    canPlaceCount,
    plannedCount,
    tooCloseCount,
    skipExistingCount,
    nearestStationKm,
    searchRadiusKm,
  } = input

  if (voltageKv == null && nearbyVoltages.length === 0) return 'unknown'

  let score = 6
  if (voltageKv != null && nearbyVoltages.length) {
    const closest = nearbyVoltages.reduce(
      (best, v) => (Math.abs(v - voltageKv) < Math.abs(best - voltageKv) ? v : best),
      nearbyVoltages[0]
    )
    const delta = Math.abs(closest - voltageKv)
    if (delta === 0) score += 3
    else if (delta <= 40) score += 1.5
    else if (delta <= 110) score -= 0.5
    else score -= 2.5
  } else if (voltageKv != null) {
    score -= 0.5 // no tagged nearby kV to match
  }

  const placeRatio = plannedCount > 0 ? canPlaceCount / plannedCount : 0
  if (placeRatio >= 0.85) score += 1.5
  else if (placeRatio >= 0.55) score += 0.5
  else score -= 1.5

  if (tooCloseCount + skipExistingCount > plannedCount * 0.4) score -= 2
  if (nearestStationKm != null && nearestStationKm <= searchRadiusKm * 0.5) score += 1
  else if (nearestStationKm != null && nearestStationKm > searchRadiusKm) score -= 1

  if (score >= 8) return 'good'
  if (score >= 5.5) return 'fair'
  if (score >= 3.5) return 'fair'
  return 'poor'
}

/**
 * For each planned T1…Tn on the KML line, suggest place vs skip using
 * CEA min/ruling/max span against nearby mapped towers inside the search radius.
 */
export function analyzeCorridorPlacement(input: {
  plannedTowers: PlannedTower[]
  corridorPath: KmlLatLng[]
  existingAssets: NearbyPowerAsset[]
  std: VoltageClassStandard | null
  spanM: number
  voltageKv: number | null
  searchRadiusKm?: number
}): CorridorPlacementAdvice | null {
  const { plannedTowers, corridorPath, existingAssets, std, spanM, voltageKv } = input
  if (!plannedTowers.length) return null

  const searchRadiusKm = Math.max(1, input.searchRadiusKm ?? 8)
  const minSpanM = std?.minSpanM ?? Math.round(spanM * 0.75)
  const maxSpanM = std?.maxSpanM ?? Math.round(spanM * 1.25)
  const rulingSpanM = std?.rulingSpanM ?? spanM
  const rowWidthM = std?.rowWidthM ?? 35
  const voltageLabel = std?.label ?? (voltageKv != null ? `${voltageKv} kV` : 'Voltage unset')

  const path: KmlLatLng[] =
    corridorPath.length >= 2
      ? corridorPath
      : plannedTowers.map((t) => [t.lat, t.lon] as KmlLatLng)

  const inRadius = assetsWithinRadiusOfPath(path, existingAssets, searchRadiusKm)
  const towersInRadius = inRadius.filter((a) => a.kind === 'tower' || a.kind === 'pole')

  const conflictM = Math.max(40, Math.min(120, Math.round(minSpanM * 0.35)))
  const lateralM = Math.max(80, Math.round(rowWidthM * 1.5))

  const along = existingNearCorridor(path, inRadius.length ? inRadius : existingAssets, lateralM)
  const spacingPool = along.length ? along : towersInRadius

  const items: PlannedTowerAdvice[] = plannedTowers.map((t) => {
    const near = nearestExisting(t.lat, t.lon, spacingPool.length ? spacingPool : inRadius)
    const d = near?.distM ?? null
    const name = near?.asset.name
    const nearId = near?.asset.id
    const nearLat = near?.asset.lat ?? null
    const nearLon = near?.asset.lon ?? null
    const ruleNote = `${voltageLabel}: min ${minSpanM} m · usual ${rulingSpanM} m · max ${maxSpanM} m · ROW ~${rowWidthM} m`

    const base = {
      index: t.index,
      lat: t.lat,
      lon: t.lon,
      chainageM: t.chainageM,
      nearestExistingM: d,
      nearestExistingName: name,
      nearestExistingId: nearId,
      nearestExistingLat: nearLat,
      nearestExistingLon: nearLon,
      ruleNote,
    }

    if (d != null && d <= conflictM) {
      return {
        ...base,
        verdict: 'skip_existing' as const,
        reason: `Suggestion: skip this pad — existing “${name}” is only ${Math.round(
          d
        )} m away. You may reuse that tower or shift this pad (under ${conflictM} m). Not an order.`,
        suggestedLat: nearLat,
        suggestedLon: nearLon,
        connectRationale: `Reuse existing “${name}” (${Math.round(d)} m) — too close to justify a new tower. Tap to see road vs straight-line connect to your corridor.`,
      }
    }

    if (d != null && d < minSpanM) {
      const shift =
        nearLat != null && nearLon != null
          ? suggestShiftPosition(nearLat, nearLon, t.lat, t.lon, minSpanM)
          : null
      return {
        ...base,
        verdict: 'too_close' as const,
        reason: `Suggestion: for ${voltageLabel}, aim for ≥ ~${minSpanM} m between towers. Existing “${name}” is ${Math.round(
          d
        )} m away — under the planning min. Consider shifting along the line. Screening only.`,
        suggestedLat: shift?.lat ?? null,
        suggestedLon: shift?.lon ?? null,
        connectRationale: `Shift T${t.index} to ≥${minSpanM} m from “${name}” (now ${Math.round(d)} m). Amber ghost on map shows the suggested offset.`,
      }
    }

    if (d != null && d <= rulingSpanM * 1.15) {
      return {
        ...base,
        verdict: 'review' as const,
        reason: `Suggestion: review first. Existing “${name}” is ${Math.round(
          d
        )} m away (usual span ~${rulingSpanM} m). A new tower may not be needed — confirm with survey.`,
        connectRationale: `“${name}” is ${Math.round(d)} m away — within usual span band. Review whether a new tower is needed before building.`,
      }
    }

    return {
      ...base,
      verdict: 'place' as const,
      reason:
        d != null
          ? `Suggestion: this pad looks workable. Nearest mapped tower is ${Math.round(
              d
            )} m away (≥ min ${minSpanM} m). Aim for ~${rulingSpanM} m spacing if you adopt this plan.`
          : `Suggestion: no mapped tower nearby in the ${searchRadiusKm} km search. Open-corridor spacing ~${rulingSpanM} m (${minSpanM}–${maxSpanM} m) is a starting idea only.`,
      connectRationale:
        d != null && name
          ? `Nearest mapped tower “${name}” is ${Math.round(d)} m — spacing meets min ${minSpanM} m for ${voltageLabel}. Good candidate for line interconnect screening.`
          : undefined,
    }
  })

  const canPlaceCount = items.filter((i) => i.verdict === 'place').length
  const skipExistingCount = items.filter((i) => i.verdict === 'skip_existing').length
  const tooCloseCount = items.filter((i) => i.verdict === 'too_close').length
  const reviewCount = items.filter((i) => i.verdict === 'review').length

  const nearTw = nearestOfKinds(path, inRadius, ['tower', 'pole'])
  const nearSs = nearestOfKinds(path, inRadius, ['substation', 'plant'])

  // Also search full asset list if radius filter left stations/towers empty
  const poolForConnect = inRadius.length ? inRadius : existingAssets
  const nearSsFallback = nearSs ?? nearestOfKinds(path, existingAssets, ['substation', 'plant'])
  const nearTwFallback = nearTw ?? nearestOfKinds(path, existingAssets, ['tower', 'pole'])

  const nearestTower: CorridorConnectHint | null = nearTwFallback
    ? toHint(
        nearTwFallback.asset,
        nearTwFallback.distM,
        nearTwFallback.distM / 1000 <= searchRadiusKm
          ? `Nearest existing tower/pole to your corridor (within ${searchRadiusKm} km search).`
          : `Nearest existing tower/pole found for orientation (may be outside tight buffer).`
      )
    : null

  const nearestStation: CorridorConnectHint | null = nearSsFallback
    ? toHint(
        nearSsFallback.asset,
        nearSsFallback.distM,
        nearSsFallback.distM / 1000 <= searchRadiusKm
          ? `Nearest substation / plant to your corridor — candidate for taking power.`
          : `Nearest station found for planning orientation.`
      )
    : null

  const towerPool = existingAssets.filter((a) => a.kind === 'tower' || a.kind === 'pole')
  const ssPool = existingAssets.filter((a) => a.kind === 'substation' || a.kind === 'plant')

  const nearestTowersTop5 = towerPool
    .map((a) => ({ asset: a, distM: distToPathM(a.lat, a.lon, path) }))
    .sort((a, b) => a.distM - b.distM)
    .slice(0, 5)
    .map(({ asset, distM }) =>
      toHint(
        asset,
        distM,
        distM / 1000 <= searchRadiusKm
          ? `Mapped tower/pole within ${searchRadiusKm} km of your line.`
          : `Nearest mapped tower/pole (may be outside tight buffer).`
      )
    )

  const nearestStationsTop3 = ssPool
    .map((a) => ({ asset: a, distM: distToPathM(a.lat, a.lon, path) }))
    .sort((a, b) => a.distM - b.distM)
    .slice(0, 3)
    .map(({ asset, distM }) =>
      toHint(
        asset,
        distM,
        distM / 1000 <= searchRadiusKm
          ? `Substation/plant within ${searchRadiusKm} km of your line.`
          : `Nearest station for orientation.`
      )
    )

  const powerConnect =
    nearSsFallback != null
      ? buildPowerConnect({
          stationAsset: nearSsFallback.asset,
          stationDistToPathM: nearSsFallback.distM,
          plannedTowers,
          items,
          assets: poolForConnect.length ? poolForConnect : existingAssets,
          voltageKv,
          searchRadiusKm,
        })
      : null

  const nearbyVoltagesKv = [
    ...new Set(
      (inRadius.length ? inRadius : existingAssets)
        .flatMap((a) => (a.voltagesKv?.length ? a.voltagesKv : a.voltageKv != null ? [a.voltageKv] : []))
        .filter((v) => Number.isFinite(v) && v > 0)
    ),
  ].sort((a, b) => b - a)

  const suggestedConnectKm =
    powerConnect?.stationToPadKm ?? nearestStation?.distanceKm ?? nearestTower?.distanceKm ?? null

  const lineSuitability = scoreLineKvSuitability({
    voltageKv,
    nearbyVoltages: nearbyVoltagesKv,
    canPlaceCount,
    plannedCount: plannedTowers.length,
    tooCloseCount,
    skipExistingCount,
    nearestStationKm: nearestStation?.distanceKm ?? null,
    searchRadiusKm,
  })
  const lineColor = lineSuitabilityColor(lineSuitability)

  const matchKv =
    voltageKv != null && nearbyVoltagesKv.length
      ? nearbyVoltagesKv.reduce(
          (best, v) => (Math.abs(v - voltageKv) < Math.abs(best - voltageKv) ? v : best),
          nearbyVoltagesKv[0]
        )
      : null

  const whyFollow = [
    voltageKv != null
      ? `We suggest considering ${voltageLabel} on this corridor because the planned span band (~${rulingSpanM} m) matches common ${voltageLabel} practice.`
      : `Pick a kV class (Controls) to see whether this line looks suitable for that tower type.`,
    matchKv != null && voltageKv != null && matchKv === voltageKv
      ? `Mapped assets nearby already show ${matchKv} kV — a good voltage match for interconnect ideas.`
      : matchKv != null && voltageKv != null
        ? `Nearby tagged voltage is about ${matchKv} kV (your pick ${voltageKv} kV) — workable if you step-up/down or re-pick kV.`
        : towersInRadius.length
          ? `${towersInRadius.length} existing tower(s)/pole(s) sit inside your ${searchRadiusKm} km search of this line — useful for spacing checks.`
          : `Open corridor in the ${searchRadiusKm} km search — fewer conflicts with mapped towers.`,
    nearestStation
      ? powerConnect
        ? `Power take-off idea: new T${powerConnect.bestPadIndex} → “${nearestStation.name}” (~${powerConnect.stationToPadKm.toFixed(1)} km, ~${powerConnect.confidencePct}% screening confidence).`
        : `Nearest station “${nearestStation.name}” is ~${nearestStation.distanceKm.toFixed(1)} km away — a candidate connect direction if you adopt this route.`
      : nearestTower
        ? `Nearest mapped tower “${nearestTower.name}” is ~${nearestTower.distanceKm.toFixed(1)} km from the line — use it as a spacing / tap reference.`
        : `No station mapped in this search yet — widen radius or re-analyze after drawing closer to the grid.`,
    powerConnect?.towerNearStation
      ? `That station’s nearest existing tower is “${powerConnect.towerNearStation.name}” (~${powerConnect.towerNearStation.distanceKm.toFixed(2)} km from the SS).`
      : null,
    `Can-place pads on this plan: ${canPlaceCount}/${plannedTowers.length} (screening).`,
  ]
    .filter(Boolean)
    .join(' ')

  const whyNotFollow = [
    tooCloseCount + skipExistingCount > 0
      ? `${tooCloseCount + skipExistingCount} pad(s) look crowded vs existing towers — you may prefer a parallel offset or a different span/kV.`
      : `Placement conflicts look low for this plan, but field survey can still change the picture.`,
    matchKv != null && voltageKv != null && Math.abs(matchKv - voltageKv) > 80
      ? `Large voltage mismatch (${voltageKv} vs nearby ${matchKv} kV) — consider selecting a closer kV class yourself, or plan transformation.`
      : nearbyVoltagesKv.length === 0
        ? `No tagged voltages in the ${searchRadiusKm} km search — we cannot strongly prefer one kV; try your own selection and compare.`
        : `If you want a smaller/larger class, change kV in Controls — the map and this panel will re-score the same line.`,
    !nearestStation && !nearestTower
      ? `Nothing to interconnect toward inside ${searchRadiusKm} km — following this line alone may leave a long spur.`
      : suggestedConnectKm != null && suggestedConnectKm > searchRadiusKm * 0.75
        ? `Connect distance (~${suggestedConnectKm.toFixed(1)} km) is toward the edge of your search — a nearer line/station elsewhere may be easier.`
        : `Still verify ROW, clearances, and bay availability with the utility before committing.`,
  ].join(' ')

  const summary = [
    `Suggestion for this line: ${plannedTowers.length} towers at ${spanM} m span (${voltageLabel}), tested inside ${searchRadiusKm} km.`,
    `Workable pads: ${canPlaceCount}.`,
    skipExistingCount ? `Reuse / skip ideas: ${skipExistingCount}.` : null,
    tooCloseCount ? `Under-min-span ideas: ${tooCloseCount}.` : null,
    reviewCount ? `Review first: ${reviewCount}.` : null,
    `Mapped assets in radius: ${inRadius.length} · towers/poles: ${towersInRadius.length}.`,
  ]
    .filter(Boolean)
    .join(' ')

  const rulesSummary = `${voltageLabel}: keep towers ${minSpanM}–${maxSpanM} m apart (usual ${rulingSpanM} m). ROW about ${rowWidthM} m. Suggestions only — final design needs utility approval.`

  const suggestionNote =
    'These are planning suggestions from open maps + CEA-style span bands — not an order to place any tower. Change kV or radius anytime to compare.'

  return {
    voltageLabel,
    voltageKv,
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
    searchRadiusKm,
    assetsInRadiusCount: inRadius.length,
    towersInRadiusCount: towersInRadius.length,
    lineSuitability,
    lineColor,
    whyFollow,
    whyNotFollow,
    suggestionNote,
    nearestTower,
    nearestStation,
    nearestTowersTop5,
    nearestStationsTop3,
    powerConnect,
    nearbyVoltagesKv,
    suggestedConnectKm,
  }
}
