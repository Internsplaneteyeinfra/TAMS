import type { GeoDataStatus, ProvenanceValue } from './types'

export function noData<T = null>(
  unit: string,
  reason: string,
  status: GeoDataStatus = 'NO_DATA'
): ProvenanceValue<T | null> {
  return {
    value: null,
    unit,
    source: 'none',
    method: 'none',
    confidence: null,
    status,
    engineeringLimitation: reason,
  }
}

export function fieldTestRequired<T = null>(
  unit: string,
  reason: string
): ProvenanceValue<T | null> {
  return noData(unit, reason, 'FIELD_TEST_REQUIRED')
}

export function insufficientData<T = null>(
  unit: string,
  reason: string
): ProvenanceValue<T | null> {
  return noData(unit, reason, 'INSUFFICIENT_DATA')
}

export function provenance<T>(
  value: T,
  opts: {
    unit: string
    source: string
    method: string
    confidence: number | null
    status: GeoDataStatus
    engineeringLimitation?: string
    formula?: string
    correlation?: string
    inputValues?: Record<string, number | string | null>
    assumptions?: string[]
    validityRange?: string
  }
): ProvenanceValue<T> {
  // Never coerce missing numeric nulls to 0 — callers must pass null explicitly.
  return {
    value,
    unit: opts.unit,
    source: opts.source,
    method: opts.method,
    confidence: opts.confidence,
    status: opts.status,
    engineeringLimitation: opts.engineeringLimitation,
    formula: opts.formula,
    correlation: opts.correlation,
    inputValues: opts.inputValues,
    assumptions: opts.assumptions,
    validityRange: opts.validityRange,
  }
}

/** True if a numeric provenance value is a real number (not null/NaN). Never treat 0 as missing. */
export function hasNumericValue(p: ProvenanceValue<number | null> | undefined): boolean {
  return p != null && p.value != null && Number.isFinite(p.value)
}

export function assertNotZeroFabrication(
  status: GeoDataStatus,
  value: number | null
): void {
  if ((status === 'NO_DATA' || status === 'FIELD_TEST_REQUIRED' || status === 'INSUFFICIENT_DATA') && value === 0) {
    throw new Error('Fabrication guard: NO_DATA/FIELD_TEST_REQUIRED/INSUFFICIENT_DATA must not use value 0')
  }
}
