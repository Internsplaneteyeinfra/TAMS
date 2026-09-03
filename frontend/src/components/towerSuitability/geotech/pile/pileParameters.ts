/**
 * Phase F — Pile geometry and displayed parameters with provenance.
 */

import type { PileEngineeringParameter } from './types'

export function pileGeometryParameters(diameterMm: number, depthM: number) {
  const D = diameterMm / 1000
  const L = depthM
  const Ap = (Math.PI * D * D) / 4
  const perimeter = Math.PI * D
  const As = perimeter * L

  const mk = (value: number, unit: string, method: string): PileEngineeringParameter => ({
    value,
    unit,
    source: 'CALCULATED',
    method,
    confidence: 95,
    reference: 'Geometry',
  })

  return {
    Ap_m2: mk(Number(Ap.toFixed(4)), 'm²', 'Ap = π D² / 4'),
    As_m2: mk(Number(As.toFixed(3)), 'm²', 'As = π D L (total shaft area)'),
    D_m: mk(Number(D.toFixed(3)), 'm', 'Pile diameter'),
    L_m: mk(L, 'm', 'Pile embedment depth'),
    perimeter_m: mk(Number(perimeter.toFixed(4)), 'm', 'π D'),
  }
}
