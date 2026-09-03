/**
 * Phase B — Data provenance & derivation pipeline.
 * Tries sources in order; never fabricates when no defensible path exists.
 */

import { fieldTestRequired, provenance } from './provenance'
import type { GeoDataStatus, ProvenanceValue } from './types'

export type DerivationSourceTier =
  | 'DIRECT_GIS'
  | 'SATELLITE_DERIVED'
  | 'MODEL_PREDICTED'
  | 'ENGINEERING_CORRELATED'
  | 'FORMULA_CALCULATED'

export interface DerivationAttempt<T> {
  tier: DerivationSourceTier
  value: T | null
  method: string
  source: string
  confidence: number | null
  status: GeoDataStatus
  calculationReference?: string
  inputValues?: Record<string, number | string | null>
  limitation?: string
}

export interface DerivedParameter<T = number> extends ProvenanceValue<T | null> {
  provenanceStatus: GeoDataStatus
  calculationReference?: string
  derivationTier?: DerivationSourceTier
}

function tierToStatus(tier: DerivationSourceTier): GeoDataStatus {
  switch (tier) {
    case 'DIRECT_GIS':
      return 'GIS_DERIVED'
    case 'SATELLITE_DERIVED':
      return 'SATELLITE_DERIVED'
    case 'MODEL_PREDICTED':
      return 'MODELLED'
    case 'ENGINEERING_CORRELATED':
      return 'ENGINEERING_CORRELATED'
    case 'FORMULA_CALCULATED':
      return 'CALCULATED'
    default:
      return 'DERIVED'
  }
}

export function runDerivationPipeline<T>(
  unit: string,
  attempts: DerivationAttempt<T>[],
  fieldRequiredMessage: string
): DerivedParameter<T> {
  for (const a of attempts) {
    if (a.value == null) continue
    if (typeof a.value === 'number' && !Number.isFinite(a.value)) continue
    const status = a.status ?? tierToStatus(a.tier)
    const p = provenance(a.value, {
      unit,
      source: a.source,
      method: a.method,
      confidence: a.confidence,
      status,
      engineeringLimitation: a.limitation,
      inputValues: a.inputValues,
    })
    return {
      ...p,
      provenanceStatus: status,
      calculationReference: a.calculationReference,
      derivationTier: a.tier,
    }
  }
  const ftr = fieldTestRequired<T>(unit, fieldRequiredMessage)
  return {
    ...ftr,
    provenanceStatus: 'FIELD_TEST_REQUIRED',
  }
}

/** Display label for UI — never show raw FIELD_TEST_REQUIRED as a number. */
export function formatDerivedValue(p: DerivedParameter<number | string | null> | ProvenanceValue<number | string | null>): string {
  if (p.value != null && p.status !== 'FIELD_TEST_REQUIRED' && p.status !== 'NO_DATA' && p.status !== 'INSUFFICIENT_DATA') {
    return String(p.value)
  }
  if (p.status === 'FIELD_TEST_REQUIRED') {
    return 'Field verification required — no defensible remote estimate available'
  }
  if (p.status === 'INSUFFICIENT_DATA') {
    return 'Insufficient data for derivation'
  }
  return '—'
}

export function statusBadgeLabel(status: GeoDataStatus): string {
  const map: Record<GeoDataStatus, string> = {
    MEASURED: 'MEASURED',
    MODELLED: 'MODELLED',
    DERIVED: 'DERIVED',
    CALCULATED: 'CALCULATED',
    ESTIMATED: 'ESTIMATED',
    NO_DATA: 'NO DATA',
    FIELD_TEST_REQUIRED: 'FIELD TEST REQUIRED',
    OUT_OF_RANGE: 'OUT OF RANGE',
    INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
    GIS_DERIVED: 'GIS DERIVED',
    SATELLITE_DERIVED: 'SATELLITE DERIVED',
    ENGINEERING_CORRELATED: 'ENGINEERING CORRELATED',
    MODEL_PREDICTED: 'MODEL PREDICTED',
  }
  return map[status] ?? status
}
