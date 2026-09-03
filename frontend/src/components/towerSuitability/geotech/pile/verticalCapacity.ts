/**
 * Phase F — F3 Vertical capacity (end bearing + shaft).
 */

import { fieldTestRequired, provenance } from '../provenance'
import { NqFromPhi, NgammaFromPhi } from './cohesionlessPile'
import { totalShaftFromLayers } from './mixedSoilPile'
import type { PileCalculationStep, PileEngineeringParameter, PileLayerCalculation } from './types'
import { FOS_PILE_COMPRESSION } from './types'

function param(
  value: number | null,
  unit: string,
  source: import('../types').GeoDataStatus,
  method: string,
  confidence: number | null
): PileEngineeringParameter {
  return { value, unit, source, method, confidence, reference: 'IS 2911' }
}

export function calculateVerticalCapacity(opts: {
  Ap_m2: number
  tipPhi: number
  tipC: number
  tipGamma: number
  pileDepthM: number
  layers: PileLayerCalculation[]
  confidence: number
}): {
  endBearing_T: number | null
  shaftFriction_T: number | null
  ultimateVertical_T: number | null
  safeVertical_T: number | null
  Nq: number
  Ngamma: number
  PD_tip: number
  steps: PileCalculationStep[]
  safe: import('../types').ProvenanceValue<number | null>
} {
  const { Ap_m2, tipPhi, tipC, tipGamma, pileDepthM, layers, confidence } = opts
  const PD_tip = tipGamma * pileDepthM
  const Nq = NqFromPhi(tipPhi)
  const Ngamma = NgammaFromPhi(tipPhi)
  const Nc = tipC > 0 ? 9 : 0
  const Qb_phi = Ap_m2 * PD_tip * Nq
  const Qb_c = tipC > 0 ? Ap_m2 * tipC * Nc : 0
  const Qb = Qb_phi + Qb_c
  const Qs = totalShaftFromLayers(layers)

  if (Qs == null) {
    return {
      endBearing_T: null,
      shaftFriction_T: null,
      ultimateVertical_T: null,
      safeVertical_T: null,
      Nq,
      Ngamma,
      PD_tip,
      steps: [],
      safe: fieldTestRequired('T', 'Shaft friction unavailable — layer inputs incomplete'),
    }
  }

  const Qu = Qb + Qs
  const Qsafe = Qu / FOS_PILE_COMPRESSION

  const steps: PileCalculationStep[] = [
    {
      step: 1,
      name: 'End bearing Qb',
      formula: tipC > 0 ? 'Qb = Ap·PD·Nq + Ap·c·Nc' : 'Qb = Ap·PD·Nq',
      inputs: { Ap_m2, PD_tip: Number(PD_tip.toFixed(3)), Nq: Number(Nq.toFixed(3)), c: tipC, Nc },
      result: Number(Qb.toFixed(3)),
      unit: 'T',
    },
    {
      step: 2,
      name: 'Shaft friction Qs',
      formula: 'Qs = Σ layer shaft contributions',
      inputs: { layers: layers.length, layerQs: layers.map((l) => l.shaftFrictionContributionT) },
      result: Qs,
      unit: 'T',
    },
    ...layers.map((l, i) => ({
      step: 3 + i,
      name: `Layer ${l.depthFromM}–${l.depthToM} m (${l.soilCondition})`,
      formula: l.method,
      inputs: {
        thickness_m: l.thicknessM,
        contribution_T: l.shaftFrictionContributionT,
      },
      result: l.shaftFrictionContributionT,
      unit: 'T',
    })),
    {
      step: 3 + layers.length,
      name: 'Ultimate vertical Qu',
      formula: 'Qu = Qb + Qs',
      inputs: { Qb: Number(Qb.toFixed(3)), Qs },
      result: Number(Qu.toFixed(3)),
      unit: 'T',
    },
    {
      step: 4 + layers.length,
      name: 'Safe vertical Qsafe',
      formula: `Qsafe = Qu / ${FOS_PILE_COMPRESSION}`,
      inputs: { Qu: Number(Qu.toFixed(3)), FoS: FOS_PILE_COMPRESSION },
      result: Number(Qsafe.toFixed(2)),
      unit: 'T',
    },
  ]

  return {
    endBearing_T: Number(Qb.toFixed(3)),
    shaftFriction_T: Qs,
    ultimateVertical_T: Number(Qu.toFixed(3)),
    safeVertical_T: Number(Qsafe.toFixed(2)),
    Nq,
    Ngamma,
    PD_tip,
    steps,
    safe: provenance(Number(Qsafe.toFixed(1)), {
      unit: 'T',
      source: 'IS 2911-aligned layer-wise static c–φ screening',
      method: 'Qsafe = (Qb + ΣQs) / FoS',
      formula: 'Qu = Qb + Qs',
      confidence,
      status: 'CALCULATED',
      engineeringLimitation: 'Layer-wise mixed soil — preliminary only',
    }),
  }
}

export { param as pileParam }
