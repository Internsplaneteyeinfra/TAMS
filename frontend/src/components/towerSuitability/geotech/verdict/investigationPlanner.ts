/**
 * Phase H — investigation priority planner.
 */

import type { GeotechnicalIntelligence } from '../types'
import type { DimensionVerdict, InvestigationPriority, ValidationGate } from './types'

export function planInvestigations(
  geo: GeotechnicalIntelligence,
  dimensions: {
    foundation: DimensionVerdict
    pile: DimensionVerdict
    accessRoad: DimensionVerdict
    earthing: DimensionVerdict
    groundwater: DimensionVerdict
    soilDataConfidence: DimensionVerdict
  },
  gates: ValidationGate[]
): InvestigationPriority[] {
  const priorities: InvestigationPriority[] = []
  let p = 1

  if (!geo.fieldInvestigationMatch.usedForMeasuredParams) {
    priorities.push({
      priority: p++,
      investigationType: 'Borehole investigation',
      reason: 'Foundation parameters are based on engineering correlation or geospatial model only',
      affectedDecision: 'Foundation design, pile design, soil classification',
      currentEvidence: 'GIS-derived soil profile (SoilGrids)',
      missingEvidence: 'Site-specific borehole log and sampling',
      expectedUncertaintyReduction: 'High — enables measured soil parameters and groundwater observation',
      mandate: 'MANDATORY',
    })
  }

  const pileBlocked = geo.pileEngineAnalysis?.calculationStatus !== 'CALCULATED'
  if (pileBlocked) {
    priorities.push({
      priority: p++,
      investigationType: 'SPT or CPT',
      reason: 'Insufficient direct in-situ strength evidence for pile shaft friction',
      affectedDecision: 'Pile foundation vertical/uplift capacity',
      currentEvidence: geo.pileEngineAnalysis?.message ?? 'Correlated c–φ only',
      missingEvidence: 'SPT N or CPT profile — not fabricated',
      expectedUncertaintyReduction: 'Moderate to high for pile design',
      mandate: 'MANDATORY',
    })
  }

  const layers = geo.soilLayerParameters ?? []
  const labNeeded = layers.some((l) => l.plasticityIndex.status !== 'MEASURED')
  if (labNeeded) {
    priorities.push({
      priority: p++,
      investigationType: 'Laboratory grain size and Atterberg limits',
      reason: 'Soil classification and plasticity confidence is incomplete without laboratory testing',
      affectedDecision: 'IS classification, SBC cohesion inputs, CBR correlation',
      currentEvidence: 'Correlated LL/PL from texture (Phase C)',
      missingEvidence: 'Laboratory Atterberg limits and grain size analysis',
      expectedUncertaintyReduction: 'Moderate — improves classification and PI confidence',
      mandate: 'RECOMMENDED',
    })
  }

  const cbrGate = gates.find((g) => g.module.includes('CBR') && !g.passed)
  const cbrCorrelatedOnly = geo.cbrEngineAnalysis?.byDepth.every(
    (d) => d.correlatedCbrPct.status === 'ENGINEERING_CORRELATED'
  )
  if (cbrGate || cbrCorrelatedOnly) {
    priorities.push({
      priority: p++,
      investigationType: 'Soaked CBR test',
      reason: 'Current CBR is ENGINEERING_CORRELATED — not laboratory soaked CBR',
      affectedDecision: 'Transmission tower access and construction road design',
      currentEvidence: cbrCorrelatedOnly ? 'Texture-PI CBR correlation' : 'Partial or missing CBR',
      missingEvidence: 'Laboratory soaked CBR per depth interval',
      expectedUncertaintyReduction: 'High for pavement/access road design',
      mandate: cbrGate ? 'MANDATORY' : 'RECOMMENDED',
    })
  }

  const resModelOnly = geo.resistivityEngineAnalysis?.measured.status !== 'MEASURED'
  if (resModelOnly) {
    priorities.push({
      priority: p++,
      investigationType: 'Wenner soil resistivity survey',
      reason: 'Current resistivity is DEPTH_MODELLED_ESTIMATE from geospatial model',
      affectedDecision: 'Electrical earthing and grounding design',
      currentEvidence: 'Geospatial resistivity model (sand/silt/clay)',
      missingEvidence: 'Field Wenner four-electrode measurement',
      expectedUncertaintyReduction: 'High for earthing design',
      mandate: 'MANDATORY',
    })
  }

  if (dimensions.groundwater.status === 'INVESTIGATION_REQUIRED') {
    priorities.push({
      priority: p++,
      investigationType: 'Groundwater observation during boring',
      reason: 'Groundwater depth not available from remote data',
      affectedDecision: 'Foundation stability, uplift, excavation',
      currentEvidence: 'None — FIELD_TEST_REQUIRED',
      missingEvidence: 'Groundwater level observation during investigation',
      expectedUncertaintyReduction: 'Moderate for foundation and pile design',
      mandate: 'MANDATORY',
    })
  }

  return priorities
}

export function investigationUrgencyFrom(
  dimensions: DimensionVerdict[],
  priorities: InvestigationPriority[]
): import('./types').InvestigationUrgency {
  const mandatory = priorities.filter((p) => p.mandate === 'MANDATORY').length
  const hasConstraint = dimensions.some((d) => d.status === 'ENGINEERING_CONSTRAINT_IDENTIFIED')
  const hasInsufficient = dimensions.some((d) => d.status === 'INSUFFICIENT_DATA')

  if (hasInsufficient && mandatory >= 2) return 'URGENT_INVESTIGATION_REQUIRED'
  if (hasConstraint || mandatory >= 2) return 'FIELD_INVESTIGATION_REQUIRED'
  if (mandatory >= 1 || dimensions.some((d) => d.status === 'INVESTIGATION_REQUIRED'))
    return 'FIELD_INVESTIGATION_REQUIRED'
  if (priorities.some((p) => p.mandate === 'RECOMMENDED')) return 'LIMITED_FIELD_VERIFICATION_RECOMMENDED'
  return 'NO_IMMEDIATE_INVESTIGATION_INDICATED'
}
