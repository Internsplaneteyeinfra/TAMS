/**
 * Phase I — KML features → investigation geometry (reuses Phase A parser).
 */

import type { KmlFeature } from '../fetchSiteSignals'
import { parseInvestigationGeometry, type InvestigationGeometry } from '../geotech/boreholePlanning'

export function kmlFeaturesToInvestigationGeometry(
  features: KmlFeature[],
  fallbackCenter?: { lat: number; lon: number }
): InvestigationGeometry | null {
  const poly = features.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
  const line = features.find((f) => f.type === 'LineString' && f.latlngs.length >= 2)
  const point = features.find((f) => f.type === 'Point' && f.latlngs.length >= 1)

  if (poly) {
    return parseInvestigationGeometry({
      type: 'polygon',
      coordinates: poly.latlngs.map(([la, lo]) => ({ lat: la, lon: lo })),
    })
  }
  if (line) {
    return parseInvestigationGeometry({
      type: 'line',
      coordinates: line.latlngs.map(([la, lo]) => ({ lat: la, lon: lo })),
    })
  }
  if (point) {
    const [la, lo] = point.latlngs[0]
    return parseInvestigationGeometry({ type: 'point', coordinates: [{ lat: la, lon: lo }] })
  }
  if (fallbackCenter) {
    return parseInvestigationGeometry({
      type: 'point',
      coordinates: [fallbackCenter],
    })
  }
  return null
}

export function planningCorridorFromKml(features: KmlFeature[]): Array<{ lat: number; lon: number }> | undefined {
  const pathFeat =
    features.find((f) => f.type === 'LineString' && f.latlngs.length >= 2) ||
    features.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
  if (!pathFeat) return undefined
  return pathFeat.latlngs.map(([la, lo]) => ({ lat: la, lon: lo }))
}
