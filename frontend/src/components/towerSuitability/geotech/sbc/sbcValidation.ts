/**
 * Phase E — Input validation gate. Never fabricate SBC without defensible inputs.
 */

import type { SbcCalculationStatus, SbcSoilInputs, SbcValidationResult } from './types'

export function validateSbcInputs(soil: SbcSoilInputs): SbcValidationResult {
  const missing: string[] = []

  if (soil.phiDeg == null || !Number.isFinite(soil.phiDeg)) {
    missing.push('Friction angle (φ)')
  }
  if (soil.gammaTm3 == null || !Number.isFinite(soil.gammaTm3) || soil.gammaTm3 <= 0) {
    missing.push('Unit weight (γ)')
  }
  if (soil.cTm2 == null || !Number.isFinite(soil.cTm2)) {
    missing.push('Cohesion (c)')
  }

  if (missing.length > 0) {
    return {
      passed: false,
      status: 'REQUIRES_ADDITIONAL_VERIFIED_INPUT',
      missingParameters: missing,
      message: `SBC CALCULATION STATUS: REQUIRES ADDITIONAL VERIFIED INPUT — ${missing.join(', ')}`,
      provenanceSummary:
        'GIS → validated correlation → engineering-correlated parameter chain incomplete. No random SBC generated.',
    }
  }

  if (soil.phiDeg! < 0 || soil.phiDeg! > 45) {
    return {
      passed: false,
      status: 'OUT_OF_RANGE',
      missingParameters: ['Friction angle (φ) outside 0–45° screening range'],
      message: 'φ outside valid IS 6403 screening range',
      provenanceSummary: `φ = ${soil.phiDeg}° — OUT_OF_RANGE for preliminary IS 6403`,
    }
  }

  const confParts = [soil.phiStatus, soil.cStatus, soil.gammaStatus]
  const provenanceSummary = `φ: ${soil.phiStatus} · c: ${soil.cStatus} · γ: ${soil.gammaStatus} · basis: ${soil.dataBasis}`

  return {
    passed: true,
    status: 'CALCULATED',
    missingParameters: [],
    message: 'All required shear parameters available for IS 6403 calculation',
    provenanceSummary,
  }
}

export function aggregateCalculationStatus(
  statuses: SbcCalculationStatus[]
): SbcCalculationStatus {
  if (statuses.every((s) => s === 'CALCULATED')) return 'CALCULATED'
  if (statuses.some((s) => s === 'CALCULATED' || s === 'PARTIAL')) return 'PARTIAL'
  if (statuses.some((s) => s === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT')) {
    return 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
  }
  if (statuses.some((s) => s === 'OUT_OF_RANGE')) return 'OUT_OF_RANGE'
  return 'INSUFFICIENT_DATA'
}
