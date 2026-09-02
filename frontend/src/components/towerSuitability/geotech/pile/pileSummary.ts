/**
 * Phase F — Per-borehole pile matrix summary.
 */

import type { BoreholePileAnalysis, PileCellAnalysis, PileDepthKey, PileDiameterKey } from './types'
import { pileDepthKey, pileDiameterKey } from './types'

export function buildBoreholePileMatrix(cells: PileCellAnalysis[]): BoreholePileAnalysis['byDiameter'] {
  const out = {
    '450mm': {} as Record<PileDepthKey, PileCellAnalysis>,
    '600mm': {} as Record<PileDepthKey, PileCellAnalysis>,
  }
  for (const c of cells) {
    out[pileDiameterKey(c.diameterMm)][pileDepthKey(c.depthM)] = c
  }
  return out
}

export function matrixRows(bh: BoreholePileAnalysis) {
  return bh.matrix.map((c) => ({
    diameter: `${c.diameterMm} mm`,
    depth: `${c.depthM.toFixed(1)} m`,
    vertical: c.verticalCapacity.safe_T.value,
    uplift: c.upliftCapacity.safe_T.value,
    lateral: c.lateralCapacity.safe_T.value,
    confidence: c.confidencePct,
    status: c.calculationStatus,
    soilCondition: c.soilCondition,
  }))
}
