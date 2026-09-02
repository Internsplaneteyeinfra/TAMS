/**
 * Phase E — E3 Settlement-controlled capacity per depth.
 * Governing SBC = min(shear, settlement) when settlement capacity is defensible.
 */

import { noData, provenance } from '../provenance'
import type { SbcCalculationStep, SbcFoundationInputs } from './types'

export interface SettlementCapacityResult {
  settlementControlledCapacityTm2: import('../types').ProvenanceValue<number | null>
  steps: SbcCalculationStep[]
  canAssess: boolean
}

/**
 * Settlement-controlled allowable pressure:
 * q_settle = Si_allow · Es / (B · (1−ν²) · If)   [inverse of Si = q·B·(1−ν²)/Es·If]
 * Requires Es — never invented from texture alone.
 */
export function settlementControlledCapacity(
  foundation: SbcFoundationInputs,
  depthM: number,
  opts?: {
    esTm2?: number | null
    esStatus?: import('../types').GeoDataStatus
    poissonRatio?: number
    influenceFactor?: number
  }
): SettlementCapacityResult {
  const allowable = foundation.allowableSettlementMm ?? 25
  const B = foundation.widthM
  const nu = opts?.poissonRatio ?? 0.3
  const If = opts?.influenceFactor ?? 0.82
  const Es = opts?.esTm2 ?? null

  const baseSteps: SbcCalculationStep[] = [
    {
      step: 1,
      name: 'Settlement input check',
      formula: 'Require Es (plate load / SPT / lab) — not invented from SoilGrids',
      inputs: { Es_Tm2: Es, allowable_mm: allowable, B_m: B, Df_m: depthM },
      result: Es != null ? 'Es available' : 'Es missing',
      unit: '—',
    },
  ]

  if (Es == null || !Number.isFinite(Es) || Es <= 0) {
    return {
      settlementControlledCapacityTm2: noData(
        'T/m²',
        'Settlement-controlled capacity requires verified soil modulus Es — FIELD_TEST_REQUIRED',
        'FIELD_TEST_REQUIRED'
      ),
      steps: baseSteps,
      canAssess: false,
    }
  }

  const Si_allow_m = allowable / 1000
  const qSettle = (Si_allow_m * Es) / (B * (1 - nu * nu) * If)

  if (!Number.isFinite(qSettle) || qSettle <= 0) {
    return {
      settlementControlledCapacityTm2: noData('T/m²', 'Settlement-controlled capacity non-finite'),
      steps: baseSteps,
      canAssess: false,
    }
  }

  const steps: SbcCalculationStep[] = [
    ...baseSteps,
    {
      step: 2,
      name: 'Allowable settlement',
      formula: 'Si_allow',
      inputs: { Si_allow_mm: allowable },
      result: allowable,
      unit: 'mm',
    },
    {
      step: 3,
      name: 'Settlement-controlled pressure',
      formula: 'q_settle = Si_allow · Es / (B · (1−ν²) · If)',
      inputs: {
        Si_allow_m,
        Es_Tm2: Es,
        B_m: B,
        nu,
        If,
      },
      result: Number(qSettle.toFixed(2)),
      unit: 'T/m²',
      notes: 'Maximum contact pressure for elastic settlement at allowable limit',
    },
    {
      step: 4,
      name: 'Settlement verdict',
      formula: 'Compare governing SBC = min(shear, settlement)',
      inputs: { q_settle: Number(qSettle.toFixed(2)) },
      result: 'Used in governing minimum',
      unit: '—',
    },
  ]

  return {
    settlementControlledCapacityTm2: provenance(Number(qSettle.toFixed(1)), {
      unit: 'T/m²',
      source: 'Elastic settlement screening (inverse)',
      method: 'q_settle = Si_allow · Es / (B · (1−ν²) · If)',
      formula: 'Inverse of Si = q·B·(1−ν²)/Es·If',
      confidence: opts?.esStatus === 'MEASURED' ? 65 : 40,
      status: 'CALCULATED',
      engineeringLimitation:
        'Settlement-controlled capacity — requires verified Es; not consolidation analysis',
    }),
    steps,
    canAssess: true,
  }
}

export function governingSbc(
  shearSafe: number | null,
  settlementSafe: number | null
): { value: number | null; governing: 'Shear' | 'Settlement' | 'None' } {
  if (shearSafe == null && settlementSafe == null) return { value: null, governing: 'None' }
  if (shearSafe != null && settlementSafe == null) return { value: shearSafe, governing: 'Shear' }
  if (shearSafe == null && settlementSafe != null) {
    return { value: settlementSafe, governing: 'Settlement' }
  }
  const s = shearSafe as number
  const t = settlementSafe as number
  if (s <= t) return { value: s, governing: 'Shear' }
  return { value: t, governing: 'Settlement' }
}
