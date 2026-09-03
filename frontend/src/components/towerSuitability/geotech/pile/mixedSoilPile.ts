/**
 * Phase F — Mixed soil pile — sums layer-wise contributions.
 */

import type { PileLayerCalculation } from './types'

export function totalShaftFromLayers(layers: PileLayerCalculation[]): number | null {
  const vals = layers
    .map((l) => l.shaftFrictionContributionT)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!vals.length) return null
  return Number(vals.reduce((a, b) => a + b, 0).toFixed(3))
}
