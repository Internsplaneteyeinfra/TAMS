import type { Asset, Alert } from '@/lib/api'
import { getPlaceById, getPlacePath, type PlaceNode } from '@/config/places'

function metaString(asset: Asset, key: string): string | undefined {
  const v = asset.metadata?.[key]
  return v != null ? String(v) : undefined
}

function inBounds(asset: Asset, bounds: [[number, number], [number, number]]): boolean {
  const [[south, west], [north, east]] = bounds
  return asset.latitude >= south && asset.latitude <= north && asset.longitude >= west && asset.longitude <= east
}

function matchesPlaceNode(asset: Asset, node: PlaceNode): boolean {
  if (node.stateOrCountry) {
    const state = metaString(asset, 'country_or_state')
    if (state?.toLowerCase() === node.stateOrCountry.toLowerCase()) return true
    if (node.bounds && inBounds(asset, node.bounds)) return true
    return false
  }

  if (node.region) {
    const region = metaString(asset, 'region')
    if (region?.toLowerCase() === node.region.toLowerCase()) return true
    if (node.bounds && inBounds(asset, node.bounds)) return true
    return false
  }

  if (node.bounds && !node.children?.length) {
    return inBounds(asset, node.bounds)
  }

  return false
}

/** Asset belongs to the selected place or any of its geographic descendants via bounds/state. */
export function assetMatchesPlace(asset: Asset, placeId: string): boolean {
  const path = getPlacePath(placeId)
  if (path.length === 0) return true

  const leaf = path[path.length - 1]

  if (leaf.bounds && !leaf.stateOrCountry && !leaf.region && !leaf.children?.length) {
    return inBounds(asset, leaf.bounds)
  }

  for (let i = path.length - 1; i >= 0; i--) {
    const node = path[i]
    if (node.stateOrCountry || node.region || node.bounds) {
      return matchesPlaceNode(asset, node)
    }
  }

  return true
}

export function filterAssetsByPlace(assets: Asset[], placeId: string): Asset[] {
  if (placeId === 'india') {
    return assets.filter((a) => metaString(a, 'region')?.toLowerCase() === 'india' || assetMatchesPlace(a, placeId))
  }
  return assets.filter((a) => assetMatchesPlace(a, placeId))
}

export function filterAlertsByPlace(alerts: Alert[], assets: Asset[], placeId: string): Alert[] {
  const ids = new Set(filterAssetsByPlace(assets, placeId).map((a) => a.id))
  return alerts.filter((a) => ids.has(a.asset_id))
}

export interface RegionStats {
  placeLabel: string
  placeId: string
  totalAssets: number
  substations: number
  towers: number
  lines: number
  transformers: number
  solar: number
  lineKm: number
  criticalAlerts: number
  openAlerts: number
  coveragePct: number
  healthyPct: number
}

export function computeRegionStats(
  assets: Asset[],
  alerts: Alert[],
  placeId: string,
  kmlStats?: { towers: number; lines: number; substations: number; total: number; line_km?: number } | null
): RegionStats {
  const path = getPlacePath(placeId)
  const place = getPlaceById(placeId)
  const filtered = filterAssetsByPlace(assets, placeId)
  const openAlerts = filterAlertsByPlace(
    alerts.filter((a) => a.status === 'open'),
    assets,
    placeId
  )
  const criticalAlerts = openAlerts.filter(
    (a) => a.priority === 'critical' || a.priority === 'high'
  )

  const substations = kmlStats?.substations ?? filtered.filter((a) => a.asset_type === 'substation').length
  const towers = kmlStats?.towers ?? filtered.filter((a) => a.asset_type === 'tower').length
  const lines = kmlStats?.lines ?? filtered.filter((a) => a.asset_type === 'line').length
  const transformers = filtered.reduce((sum, a) => {
    const n = a.metadata?.transformer_count
    return sum + (typeof n === 'number' ? n : a.asset_type === 'substation' ? 2 : 0)
  }, 0)
  const solar = filtered.filter((a) => (a.description || '').toLowerCase().includes('solar')).length
  const lineKm = kmlStats?.line_km != null
    ? Math.round(kmlStats.line_km)
    : filtered
      .filter((a) => a.asset_type === 'line')
      .reduce((sum, a) => sum + (typeof a.metadata?.length_km === 'number' ? a.metadata.length_km : 0), 0)

  const allCounted = kmlStats?.total ?? filtered.length
  const healthy = filtered.filter((a) => a.health_score === 'healthy').length
  const healthyPct = allCounted ? Math.round((healthy / Math.max(allCounted, 1)) * 100) : 100
  const monitored = filtered.filter((a) => a.status !== 'offline').length
  const coveragePct = allCounted ? Math.round((monitored / allCounted) * 1000) / 10 : 100

  return {
    placeLabel: place?.label ?? path[path.length - 1]?.label ?? 'India',
    placeId,
    totalAssets: allCounted,
    substations,
    towers,
    lines,
    transformers,
    solar,
    lineKm: typeof lineKm === 'number' ? Math.round(lineKm) : Math.round(lineKm),
    criticalAlerts: criticalAlerts.length,
    openAlerts: openAlerts.length,
    coveragePct,
    healthyPct,
  }
}

export function getPlaceBounds(
  placeId: string,
  assets: Asset[]
): [[number, number], [number, number]] | null {
  const node = getPlaceById(placeId)
  if (node?.bounds) return node.bounds

  const filtered = filterAssetsByPlace(assets, placeId)
  if (filtered.length === 0) return null
  const points = filtered.flatMap((a) => [[a.latitude, a.longitude] as [number, number]])
  const lats = points.map((p) => p[0])
  const lngs = points.map((p) => p[1])
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]
}
