/**
 * Phase G — CBR validation.
 */

import type { CbrCorrelationResult } from './cbrCorrelation'

export function validateCbrCorrelation(result: CbrCorrelationResult): {
  passed: boolean
  status: 'CALCULATED' | 'FIELD_TEST_REQUIRED'
  message: string
} {
  if (!result.applicable) {
    return {
      passed: false,
      status: 'FIELD_TEST_REQUIRED',
      message: result.reason ?? 'No defensible CBR correlation — field soaked CBR test required',
    }
  }
  if (result.midPct < 1 || result.midPct > 30) {
    return {
      passed: false,
      status: 'FIELD_TEST_REQUIRED',
      message: 'Correlated CBR outside validation range — field verification required',
    }
  }
  return {
    passed: true,
    status: 'CALCULATED',
    message: 'Engineering-correlated CBR within screening validation range',
  }
}
