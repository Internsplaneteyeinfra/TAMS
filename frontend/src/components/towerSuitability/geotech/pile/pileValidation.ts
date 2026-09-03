/**
 * Phase F — Pile validation gate.
 */

import type { PileCalculationStatus } from './types'

export interface PileValidationResult {
  passed: boolean
  status: PileCalculationStatus
  missingParameters: string[]
  message: string
  provenanceSummary: string
}

export function validatePileGeometry(diameterMm: number, depthM: number): PileValidationResult {
  if (diameterMm <= 0 || depthM <= 0) {
    return {
      passed: false,
      status: 'INSUFFICIENT_DATA',
      missingParameters: ['PILE_GEOMETRY'],
      message: 'Invalid pile diameter or depth',
      provenanceSummary: 'Geometry validation failed',
    }
  }
  return {
    passed: true,
    status: 'CALCULATED',
    missingParameters: [],
    message: 'Pile geometry valid',
    provenanceSummary: `D = ${diameterMm} mm, L = ${depthM} m`,
  }
}

export function validateLayerSoilInputs(
  phi: number | null,
  gamma: number | null,
  c: number | null
): PileValidationResult {
  const missing: string[] = []
  if (phi == null || !Number.isFinite(phi)) missing.push('φ')
  if (gamma == null || !Number.isFinite(gamma) || gamma <= 0) missing.push('γ')
  if (c == null || !Number.isFinite(c)) missing.push('c')

  if (missing.length) {
    return {
      passed: false,
      status: 'REQUIRES_ADDITIONAL_VERIFIED_INPUT',
      missingParameters: missing,
      message: `PILE CALCULATION STATUS: REQUIRES ADDITIONAL VERIFIED INPUT — ${missing.join(', ')}`,
      provenanceSummary: 'Shared Phase E parameter chain incomplete — no random substitution',
    }
  }
  return {
    passed: true,
    status: 'CALCULATED',
    missingParameters: ['SPT_N_VALUE'],
    message: 'c, φ, γ available for static c–φ pile method (SPT N not used)',
    provenanceSummary: 'Validated via shared engineering parameter layer',
  }
}

export function aggregatePileStatus(statuses: PileCalculationStatus[]): PileCalculationStatus {
  if (statuses.every((s) => s === 'CALCULATED')) return 'CALCULATED'
  if (statuses.some((s) => s === 'CALCULATED' || s === 'PARTIAL')) return 'PARTIAL'
  if (statuses.some((s) => s === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT')) {
    return 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
  }
  return 'INSUFFICIENT_DATA'
}

export function classifySoilCondition(clayPct: number, sandPct: number): import('./types').SoilConditionType {
  const fines = clayPct + (100 - clayPct - sandPct)
  if (clayPct >= 15 || fines >= 35) return 'COHESIVE'
  if (sandPct >= 55 && clayPct < 12) return 'COHESIONLESS'
  return 'MIXED'
}

export function overallSoilCondition(layers: import('./types').SoilConditionType[]): import('./types').SoilConditionType {
  const hasC = layers.some((l) => l === 'COHESIVE')
  const hasS = layers.some((l) => l === 'COHESIONLESS')
  if (hasC && hasS) return 'MIXED'
  if (hasC) return 'COHESIVE'
  if (hasS) return 'COHESIONLESS'
  return 'MIXED'
}
