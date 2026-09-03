/**
 * Phase H — validation gates from Phase A–G module outputs.
 */

import type { GeotechnicalIntelligence } from '../types'
import type { ValidationGate } from './types'

export function collectValidationGates(geo: GeotechnicalIntelligence): ValidationGate[] {
  const gates: ValidationGate[] = []

  const sbc = geo.sbcEngineAnalysis
  if (sbc) {
    gates.push({
      module: 'SBC (Phase E)',
      parameter: 'IS 6403 bearing capacity',
      status: sbc.calculationStatus,
      passed: sbc.calculationStatus === 'CALCULATED' || sbc.calculationStatus === 'PARTIAL',
      message: sbc.message,
      blocksFinalDesign: sbc.calculationStatus !== 'CALCULATED',
    })
  }

  const pile = geo.pileEngineAnalysis
  if (pile) {
    gates.push({
      module: 'Pile (Phase F)',
      parameter: 'Vertical pile capacity',
      status: pile.calculationStatus,
      passed: pile.calculationStatus === 'CALCULATED',
      message: pile.message,
      blocksFinalDesign: pile.calculationStatus !== 'CALCULATED',
    })
  }

  const cbr = geo.cbrEngineAnalysis
  if (cbr) {
    for (const row of cbr.byDepth) {
      if (row.correlatedCbrPct.status === 'FIELD_TEST_REQUIRED') {
        gates.push({
          module: 'CBR (Phase G)',
          parameter: `CBR ${row.reportDepthLabel}`,
          status: 'FIELD_TEST_REQUIRED',
          passed: false,
          message: row.validationNote,
          blocksFinalDesign: true,
        })
      }
    }
    gates.push({
      module: 'CBR (Phase G)',
      parameter: 'Recommended design CBR',
      status: cbr.recommendedDesignCbr.status,
      passed: cbr.recommendedDesignCbr.value != null,
      message: cbr.message,
      blocksFinalDesign: cbr.recommendedDesignCbr.value == null,
    })
  }

  const res = geo.resistivityEngineAnalysis
  if (res) {
    const modelOnly = res.measured.status !== 'MEASURED'
    gates.push({
      module: 'Resistivity (Phase G)',
      parameter: 'Earthing resistivity',
      status: modelOnly ? 'MODEL_PREDICTED' : 'MEASURED',
      passed: !modelOnly,
      message: modelOnly
        ? 'Indicative geospatial estimate only — site-specific Wenner test required before final earthing design'
        : 'Field Wenner measurement available',
      blocksFinalDesign: modelOnly,
    })
  }

  gates.push({
    module: 'Groundwater',
    parameter: 'Groundwater table',
    status: 'FIELD_TEST_REQUIRED',
    passed: false,
    message: 'Groundwater depth not available from remote sensing — field observation required',
    blocksFinalDesign: true,
  })

  return gates
}

export function hasMandatoryGateFailure(gates: ValidationGate[]): boolean {
  return gates.some((g) => !g.passed && g.blocksFinalDesign)
}
