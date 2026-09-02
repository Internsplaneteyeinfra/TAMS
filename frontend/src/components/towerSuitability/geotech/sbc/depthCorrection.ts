/**
 * Phase E — E4 Depth correction table rows.
 */

import type { BearingCapacityResult } from './bearingCapacity'
import type { DepthCorrectionRow, SbcDataBasis } from './types'

export function buildDepthCorrectionRow(
  depthM: number,
  dataBasis: SbcDataBasis,
  bearing: BearingCapacityResult | null
): DepthCorrectionRow {
  if (!bearing) {
    return {
      depthM,
      baseSbcTm2: null,
      depthFactor: null,
      correctedSbcTm2: null,
      dataBasis,
      explanation:
        dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION'
          ? `${depthM} m: extrapolation — insufficient inputs for depth correction`
          : `${depthM} m: insufficient inputs — no depth correction applied`,
    }
  }

  const explanation =
    dataBasis === 'PRIMARY_GEOSPATIAL_MODEL'
      ? `${depthM} m: IS 6403 depth factors (dc, dq) increase bearing capacity with foundation depth using GIS-modelled soil at ${depthM} m.`
      : `${depthM} m: Engineering depth extrapolation below 2.0 m GIS model — φ adjusted + depth factors applied. Not field-observed.`

  return {
    depthM,
    baseSbcTm2: bearing.baseSbcBeforeDepthFactor,
    depthFactor: bearing.depthFactorComposite,
    correctedSbcTm2: bearing.qnetSafeTm2,
    dataBasis,
    explanation,
  }
}
