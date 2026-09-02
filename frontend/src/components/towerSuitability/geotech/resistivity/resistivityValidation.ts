/**
 * Phase G — Resistivity validation gate.
 */

import type { ResistivityModelResult } from './resistivityModel'

export function validateResistivityModel(result: ResistivityModelResult): {
  passed: boolean
  status: 'CALCULATED' | 'FIELD_TEST_REQUIRED'
  message: string
} {
  if (!result.applicable) {
    return {
      passed: false,
      status: 'FIELD_TEST_REQUIRED',
      message: result.reason ?? 'Field Wenner / earth resistivity test required',
    }
  }
  if (result.midOhmM < 5 || result.midOhmM > 500) {
    return {
      passed: false,
      status: 'FIELD_TEST_REQUIRED',
      message: 'Modelled resistivity outside plausible screening range — field verification required',
    }
  }
  return {
    passed: true,
    status: 'CALCULATED',
    message: 'Geospatial model estimate within screening applicability',
  }
}
