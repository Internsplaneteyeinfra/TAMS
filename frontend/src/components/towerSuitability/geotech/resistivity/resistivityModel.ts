/**
 * Phase G — Resistivity geospatial model from shared soil profile.
 * Estimated only — never field-measured unless uploaded.
 */

import type { SoilLayerParameters } from '../types'

export interface ResistivityModelResult {
  midOhmM: number
  lowOhmM: number
  highOhmM: number
  method: string
  confidence: number
  applicable: boolean
  reason?: string
}

/** Clay-dominated soils → lower ρ; sand-dominated → higher ρ. Depth factor applied separately. */
export function modelResistivityFromLayer(
  layer: SoilLayerParameters,
  depthFactor = 1
): ResistivityModelResult {
  const clay = layer.clayPct.value
  const sand = layer.sandPct.value
  const silt = layer.siltPct.value

  if (clay == null || sand == null || silt == null) {
    return {
      midOhmM: 0,
      lowOhmM: 0,
      highOhmM: 0,
      method: 'Unavailable',
      confidence: 0,
      applicable: false,
      reason: 'Grain size required for geospatial resistivity model',
    }
  }

  const baseMid = 25 + sand * 1.8 + silt * 0.8 - clay * 1.2
  const mid = Math.round(Math.max(15, Math.min(350, baseMid * depthFactor)) / 5) * 5
  const spread = Math.max(10, Math.round(mid * 0.25))
  const low = Math.max(10, mid - spread)
  const high = Math.min(500, mid + spread)

  return {
    midOhmM: mid,
    lowOhmM: low,
    highOhmM: high,
    method:
      'Geospatial soil electrical resistivity model: f(sand%, silt%, clay%) with depth modulation — NOT Wenner field test',
    confidence: 32,
    applicable: true,
  }
}
