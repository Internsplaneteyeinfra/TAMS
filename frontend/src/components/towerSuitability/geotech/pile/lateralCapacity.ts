/**

 * Phase F — F7 Preliminary GIS-based lateral capacity (default tower load scenario).

 * Full p-y analysis requires structural loads — this provides screening capacity only.

 */



import { provenance } from '../provenance'

import type { PileCalculationStep, SoilConditionType } from './types'



const DEG = Math.PI / 180

/** Default screening lateral load for lattice transmission tower (preliminary). */

const DEFAULT_LATERAL_LOAD_T = 8

const FOS_LATERAL = 2.5



export function calculateLateralCapacity(opts: {

  diameterMm: number

  depthM: number

  soilCondition: SoilConditionType

  phiDeg: number | null

  cTm2?: number | null

  gammaTm3?: number | null

}): {

  method: string

  lateralMethodNote: string

  steps: PileCalculationStep[]

  safe: import('../types').ProvenanceValue<number | null>

} {

  const D = opts.diameterMm / 1000

  const L = opts.depthM

  const phi = opts.phiDeg

  const c = opts.cTm2 ?? null

  const gamma = opts.gammaTm3 ?? null



  if (phi == null || gamma == null || c == null || !Number.isFinite(phi) || !Number.isFinite(gamma)) {

    const note =

      'Preliminary lateral capacity requires resolved c, φ, γ from parameter resolution engine.'

    return {

      method: 'Preliminary GIS lateral — inputs incomplete',

      lateralMethodNote: note,

      steps: [],

      safe: provenance(null, {

        unit: 'T',

        source: 'Parameter resolution',

        method: note,

        confidence: null,

        status: 'INSUFFICIENT_DATA',

      }),

    }

  }



  let ultimateT: number

  let method: string

  let formula: string



  if (opts.soilCondition === 'COHESIVE') {

    ultimateT = 9 * c * D * L

    method = 'Broms short-pile cohesive screening (Hu = 9·c·D·L)'

    formula = 'Hu = 9 × c × D × L'

  } else if (opts.soilCondition === 'COHESIONLESS') {

    const Kp = Math.pow(Math.tan((45 + phi / 2) * DEG), 2)

    ultimateT = 0.5 * Kp * gamma * L * L * D

    method = 'Rankine passive wedge screening (cohesionless)'

    formula = 'Hu ≈ 0.5 × Kp × γ × L² × D'

  } else {

    const Kp = Math.pow(Math.tan((45 + phi / 2) * DEG), 2)

    const phiPart = 0.5 * Kp * gamma * L * L * D

    const cPart = 9 * c * D * L * 0.5

    ultimateT = phiPart + cPart

    method = 'Mixed c–φ preliminary lateral (cohesive + passive components)'

    formula = 'Hu ≈ passive wedge + 0.5 × cohesive Broms term'

  }



  const safeT = Number((ultimateT / FOS_LATERAL).toFixed(2))

  const note = `Preliminary GIS-based lateral capacity using default tower lateral load scenario (${DEFAULT_LATERAL_LOAD_T} T screening reference). Recalculate with actual tower shear/moment for final design.`



  return {

    method,

    lateralMethodNote: note,

    steps: [

      {

        step: 1,

        name: 'Preliminary lateral capacity',

        formula,

        inputs: { c_Tm2: c, phi_deg: phi, gamma_Tm3: gamma, D_m: D, L_m: L, soilCondition: opts.soilCondition },

        result: ultimateT,

        unit: 'T',

        notes: `Ultimate ≈ ${ultimateT.toFixed(2)} T; FOS ${FOS_LATERAL} → safe ≈ ${safeT} T`,

      },

    ],

    safe: provenance(safeT, {

      unit: 'T',

      source: 'GIS parameter resolution + default tower load scenario',

      method,

      confidence: 32,

      status: 'ENGINEERING_CORRELATED',

      engineeringLimitation: note,

      assumptions: [`Default lateral reference load ${DEFAULT_LATERAL_LOAD_T} T for screening only`],

    }),

  }

}


