/**
 * Phase G — CBR correlation from shared soil layer parameters (Phase C).
 * Never labelled as laboratory soaked CBR.
 */

import type { SoilLayerParameters } from '../types'

export interface CbrCorrelationResult {
  midPct: number
  lowPct: number
  highPct: number
  method: string
  correlationReference: string
  confidence: number
  applicable: boolean
  reason?: string
}

/** Texture + PI engineering correlation for transmission access road screening. */
export function correlateCbrFromLayer(layer: SoilLayerParameters): CbrCorrelationResult {
  const sand = layer.sandPct.value
  const clay = layer.clayPct.value
  const silt = layer.siltPct.value
  const pi = layer.plasticityIndex.value
  const texture = layer.soilClassification.value ?? ''

  if (sand == null || clay == null || silt == null) {
    return {
      midPct: 0,
      lowPct: 0,
      highPct: 0,
      method: 'Unavailable — grain size incomplete',
      correlationReference: 'N/A',
      confidence: 0,
      applicable: false,
      reason: 'Grain size fractions required for defensible CBR correlation',
    }
  }

  let base = { low: 4, high: 10 }
  const t = texture.toLowerCase()
  if (t.includes('sand') && clay < 12) base = { low: 8, high: 18 }
  else if (t.includes('sandy') || t.includes('loamy sand')) base = { low: 6, high: 14 }
  else if (t.includes('loam') && clay < 20) base = { low: 5, high: 12 }
  else if (t.includes('silt')) base = { low: 3, high: 8 }
  else if (t.includes('clay') || clay >= 20) base = { low: 2, high: 7 }

  let piFactor = 1
  if (pi != null && Number.isFinite(pi) && layer.plasticityIndex.status !== 'FIELD_TEST_REQUIRED') {
    piFactor = Math.max(0.55, 1 - pi / 120)
  } else if (clay >= 20) {
    piFactor = 0.75
  }

  const mid = Math.round(((base.low + base.high) / 2) * piFactor)
  const low = Math.max(2, Math.round(base.low * piFactor))
  const high = Math.max(low + 1, Math.round(base.high * piFactor))

  return {
    midPct: mid,
    lowPct: low,
    highPct: high,
    method:
      'Engineering correlation: USDA texture class base CBR range adjusted by PI/clay (transmission access road screening)',
    correlationReference: 'TAMS texture-PI CBR screening (not IS soaked CBR lab test)',
    confidence: pi != null ? 42 : 36,
    applicable: true,
  }
}
