/**
 * Phase F — F6 Uplift capacity.
 */

import { fieldTestRequired, provenance } from '../provenance'
import type { PileCalculationStep } from './types'
import { FOS_PILE_UPLIFT, GAMMA_CONCRETE_TM3 } from './types'

export function calculateUpliftCapacity(opts: {
  Ap_m2: number
  pileDepthM: number
  shaftFriction_T: number | null
  confidence: number
}): {
  selfWeight_T: number | null
  ultimateUplift_T: number | null
  safeUplift_T: number | null
  steps: PileCalculationStep[]
  safe: import('../types').ProvenanceValue<number | null>
} {
  const { Ap_m2, pileDepthM, shaftFriction_T, confidence } = opts

  if (shaftFriction_T == null) {
    return {
      selfWeight_T: null,
      ultimateUplift_T: null,
      safeUplift_T: null,
      steps: [],
      safe: fieldTestRequired('T', 'Uplift requires shaft friction from layer profile'),
    }
  }

  const W = Ap_m2 * pileDepthM * GAMMA_CONCRETE_TM3
  const Qu_up = W + shaftFriction_T
  const Qsafe = Qu_up / FOS_PILE_UPLIFT

  const steps: PileCalculationStep[] = [
    {
      step: 1,
      name: 'Pile self-weight',
      formula: 'W = Ap · L · γ_concrete',
      inputs: { Ap_m2, L_m: pileDepthM, gamma_concrete: GAMMA_CONCRETE_TM3 },
      result: Number(W.toFixed(3)),
      unit: 'T',
    },
    {
      step: 2,
      name: 'Shaft resistance (uplift)',
      formula: 'Qs (same as compression shaft)',
      inputs: { Qs_T: shaftFriction_T },
      result: shaftFriction_T,
      unit: 'T',
    },
    {
      step: 3,
      name: 'Ultimate uplift',
      formula: 'Qu_up = W + Qs',
      inputs: { W: Number(W.toFixed(3)), Qs: shaftFriction_T },
      result: Number(Qu_up.toFixed(3)),
      unit: 'T',
    },
    {
      step: 4,
      name: 'Safe uplift',
      formula: `Qsafe_up = Qu_up / ${FOS_PILE_UPLIFT}`,
      inputs: { Qu_up: Number(Qu_up.toFixed(3)), FoS: FOS_PILE_UPLIFT },
      result: Number(Qsafe.toFixed(2)),
      unit: 'T',
    },
  ]

  return {
    selfWeight_T: Number(W.toFixed(3)),
    ultimateUplift_T: Number(Qu_up.toFixed(3)),
    safeUplift_T: Number(Qsafe.toFixed(2)),
    steps,
    safe: provenance(Number(Qsafe.toFixed(1)), {
      unit: 'T',
      source: 'IS 2911-aligned uplift screening',
      method: 'Qsafe_up = (W + Qs) / FoS',
      confidence,
      status: 'CALCULATED',
      engineeringLimitation: 'Ignores suction; GWT unknown',
    }),
  }
}
