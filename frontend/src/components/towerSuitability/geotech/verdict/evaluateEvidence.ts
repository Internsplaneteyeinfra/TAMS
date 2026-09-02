/**
 * Phase H — collect evidence from Phases A–G without recalculating.
 */

import type { GeotechnicalIntelligence } from '../types'
import { statusToEvidenceLevel } from './adapters'
import type { EvidenceProvenance, EvidenceSummary } from './types'

function trace(
  phase: string,
  parameter: string,
  value: string | number | null,
  provenance: string,
  validation: 'PASS' | 'FAIL' | 'NOT_APPLICABLE',
  impact: string
): EvidenceProvenance {
  const level = statusToEvidenceLevel(provenance)
  const conf =
    level === 'LEVEL_1_MEASURED'
      ? 'HIGH'
      : level === 'LEVEL_2_ENGINEERING_CORRELATION'
        ? 'MODERATE'
        : level === 'LEVEL_3_MODELLED_GEOSPATIAL'
          ? 'LOW'
          : 'VERY_LOW'
  return {
    phase,
    parameter,
    value,
    provenance,
    evidenceLevel: level,
    validationResult: validation,
    confidenceContribution: conf,
    decisionImpact: impact,
  }
}

export function evaluateEvidence(geo: GeotechnicalIntelligence): EvidenceSummary {
  const measured: EvidenceProvenance[] = []
  const correlated: EvidenceProvenance[] = []
  const modelled: EvidenceProvenance[] = []
  const missing: string[] = []
  const unknown: string[] = []

  const layers = geo.soilLayerParameters ?? []
  if (layers.length === 0) {
    missing.push('Soil layer parameters (Phase C)')
  } else {
    for (const l of layers) {
      const cls = l.soilClassification.value
      const item = trace('Phase C', `Classification ${l.reportDepth}`, cls, l.soilClassification.status, 'PASS', 'Soil classification')
      if (l.soilClassification.status === 'MEASURED') measured.push(item)
      else if (l.soilClassification.status === 'ENGINEERING_CORRELATED' || l.soilClassification.status === 'CALCULATED')
        correlated.push(item)
      else modelled.push(item)
    }
  }

  const sbc = geo.sbcEngineAnalysis
  if (sbc) {
    const adopted = sbc.siteSummary.adoptedPreliminary
    const t = trace('Phase E', 'SBC', adopted.value, adopted.status, sbc.calculationStatus === 'CALCULATED' ? 'PASS' : 'FAIL', 'Foundation')
    if (adopted.status === 'MEASURED') measured.push(t)
    else if (adopted.status === 'CALCULATED' || adopted.status === 'ENGINEERING_CORRELATED') correlated.push(t)
    else if (adopted.value == null) missing.push('Net safe bearing capacity (IS 6403)')
    else modelled.push(t)
  } else {
    missing.push('SBC engineering analysis (Phase E)')
  }

  const pile = geo.pileEngineAnalysis
  if (pile) {
    const cell = pile.siteSummary.matrix[0]
    if (cell) {
      const t = trace('Phase F', 'Pile vertical capacity', cell.verticalCapacity.safe_T.value, cell.verticalCapacity.safe_T.status, cell.calculationStatus === 'CALCULATED' ? 'PASS' : 'FAIL', 'Pile foundation')
      if (cell.verticalCapacity.safe_T.status === 'MEASURED') measured.push(t)
      else if (cell.calculationStatus === 'CALCULATED') correlated.push(t)
      else missing.push('Pile vertical capacity (c–φ inputs incomplete)')
    }
  }

  const cbr = geo.cbrEngineAnalysis
  if (cbr) {
    for (const row of cbr.byDepth) {
      const t = trace('Phase G', `CBR ${row.reportDepthLabel}`, row.correlatedCbrPct.value, row.correlatedCbrPct.status, row.correlatedCbrPct.value != null ? 'PASS' : 'FAIL', 'Access road')
      if (row.correlatedCbrPct.status === 'MEASURED') measured.push(t)
      else if (row.correlatedCbrPct.status === 'ENGINEERING_CORRELATED') correlated.push(t)
      else if (row.correlatedCbrPct.status === 'FIELD_TEST_REQUIRED') missing.push(`Soaked CBR at ${row.reportDepthLabel}`)
      else modelled.push(t)
    }
  }

  const res = geo.resistivityEngineAnalysis
  if (res) {
    if (res.measured.status === 'MEASURED') {
      measured.push(trace('Phase G', 'Resistivity (Wenner)', res.measured.value, 'MEASURED', 'PASS', 'Earthing'))
    }
    const est = res.siteEstimateOhmM
    const t = trace('Phase G', 'Resistivity estimate', est.value, est.status, est.value != null ? 'PASS' : 'FAIL', 'Earthing')
    if (est.status === 'MODEL_PREDICTED') modelled.push(t)
    else if (est.status === 'FIELD_TEST_REQUIRED') missing.push('Field Wenner resistivity')
    else correlated.push(t)
  }

  if (!geo.fieldInvestigationMatch.usedForMeasuredParams) {
    unknown.push('Site-specific borehole / in-situ strength measurements')
    missing.push('Borehole investigation at proposed GIS points')
  }

  missing.push('Groundwater table depth (field observation)')
  unknown.push('Groundwater level during boring')

  return { measured, correlated, modelled, missing: [...new Set(missing)], unknown: [...new Set(unknown)] }
}
