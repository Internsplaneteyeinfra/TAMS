/**
 * Phase H — provenance-aware language adapters.
 */

import type { GeoDataStatus } from '../types'
import type { ConfidenceLevel, EvidenceLevel, VerdictColor, VerdictStatus } from './types'

export function statusToEvidenceLevel(status: GeoDataStatus | string): EvidenceLevel {
  switch (status) {
    case 'MEASURED':
      return 'LEVEL_1_MEASURED'
    case 'ENGINEERING_CORRELATED':
    case 'CALCULATED':
    case 'DERIVED':
      return 'LEVEL_2_ENGINEERING_CORRELATION'
    case 'MODEL_PREDICTED':
    case 'MODELLED':
    case 'ESTIMATED':
    case 'GIS_DERIVED':
    case 'SATELLITE_DERIVED':
      return 'LEVEL_3_MODELLED_GEOSPATIAL'
    default:
      return 'LEVEL_4_ASSUMED_UNKNOWN'
  }
}

export function provenancePhrase(status: GeoDataStatus | string): string {
  switch (status) {
    case 'MEASURED':
      return 'Measured field data indicates'
    case 'ENGINEERING_CORRELATED':
      return 'Engineering correlation indicates'
    case 'MODEL_PREDICTED':
    case 'MODELLED':
      return 'Geospatial modelling provides an indicative estimate that'
    case 'ESTIMATED':
      return 'Preliminary screening estimate suggests'
    case 'FIELD_TEST_REQUIRED':
      return 'No site-specific measurement is currently available; field test required before'
    case 'NO_DATA':
    case 'INSUFFICIENT_DATA':
      return 'No site-specific measurement is currently available for'
    default:
      return 'Available evidence suggests'
  }
}

export function verdictToColor(status: VerdictStatus): VerdictColor {
  switch (status) {
    case 'PRELIMINARILY_SUPPORTIVE':
      return 'GREEN'
    case 'CONDITIONALLY_SUPPORTIVE':
      return 'YELLOW'
    case 'INVESTIGATION_REQUIRED':
      return 'ORANGE'
    case 'ENGINEERING_CONSTRAINT_IDENTIFIED':
      return 'RED'
    case 'INSUFFICIENT_DATA':
      return 'GREY'
  }
}

export function formatVerdictLabel(status: VerdictStatus): string {
  return status.replace(/_/g, ' ')
}

export function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= 75) return 'HIGH'
  if (score >= 55) return 'MODERATE'
  if (score >= 35) return 'LOW'
  return 'VERY_LOW'
}

export function neverClaimsMeasured(status: GeoDataStatus | string): boolean {
  return status !== 'MEASURED'
}
