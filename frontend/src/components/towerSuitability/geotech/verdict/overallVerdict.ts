/**
 * Phase H — conservative overall verdict logic.
 */

import type {
  ConflictRecord,
  DimensionVerdict,
  EngineeringDecision,
  InvestigationPriority,
  InvestigationUrgency,
  SoilVerdictAnalysis,
  VerdictStatus,
} from './types'
import { verdictToColor } from './adapters'
import type { ConfidenceLevel } from './types'
import type { EvidenceSummary, ValidationGate } from './types'
import { confidenceExplanation } from './calculateConfidence'

const STATUS_PRIORITY: Record<VerdictStatus, number> = {
  INSUFFICIENT_DATA: 5,
  ENGINEERING_CONSTRAINT_IDENTIFIED: 4,
  INVESTIGATION_REQUIRED: 3,
  CONDITIONALLY_SUPPORTIVE: 2,
  PRELIMINARILY_SUPPORTIVE: 1,
}

function worstStatus(statuses: VerdictStatus[]): VerdictStatus {
  return statuses.reduce((worst, s) => (STATUS_PRIORITY[s] > STATUS_PRIORITY[worst] ? s : worst))
}

export function computeOverallVerdict(
  dimensions: SoilVerdictAnalysis['dimensions'],
  gates: ValidationGate[],
  conflicts: ConflictRecord[],
  confidence: ConfidenceLevel,
  evidence: EvidenceSummary,
  investigationUrgency: InvestigationUrgency,
  priorities: InvestigationPriority[]
): SoilVerdictAnalysis['overall'] {
  const dimStatuses = [
    dimensions.foundation.status,
    dimensions.pile.status,
    dimensions.accessRoad.status,
    dimensions.earthing.status,
    dimensions.groundwater.status,
    dimensions.soilDataConfidence.status,
  ]

  let overallStatus = worstStatus(dimStatuses)

  const mandatoryFail = gates.some((g) => !g.passed && g.blocksFinalDesign)
  const cbrFieldRequired = dimensions.accessRoad.status === 'INVESTIGATION_REQUIRED'

  if (dimensions.soilDataConfidence.status === 'INSUFFICIENT_DATA' && evidence.measured.length === 0) {
    overallStatus = 'INSUFFICIENT_DATA'
  } else if (mandatoryFail && cbrFieldRequired) {
    overallStatus = worstStatus([overallStatus, 'CONDITIONALLY_SUPPORTIVE'])
    if (overallStatus === 'PRELIMINARILY_SUPPORTIVE') overallStatus = 'CONDITIONALLY_SUPPORTIVE'
  }

  if (conflicts.some((c) => c.severity === 'HIGH')) {
    overallStatus = worstStatus([overallStatus, 'CONDITIONALLY_SUPPORTIVE'])
  }

  const investigationRequired =
    investigationUrgency !== 'NO_IMMEDIATE_INVESTIGATION_INDICATED' || mandatoryFail

  const explanation = buildExplanation(overallStatus, confidence, evidence, dimensions, priorities)

  return {
    status: overallStatus,
    color: verdictToColor(overallStatus),
    confidence,
    investigationRequired,
    investigationUrgency,
    explanation,
  }
}

function buildExplanation(
  status: VerdictStatus,
  confidence: ConfidenceLevel,
  evidence: EvidenceSummary,
  dimensions: SoilVerdictAnalysis['dimensions'],
  priorities: InvestigationPriority[]
): string {
  const parts: string[] = []

  if (status === 'INSUFFICIENT_DATA') {
    parts.push(
      'The system cannot generate a meaningful engineering verdict. Critical inputs are missing: ' +
        evidence.missing.slice(0, 4).join('; ') +
        (evidence.missing.length > 4 ? '; …' : '') +
        '.'
    )
  } else if (status === 'PRELIMINARILY_SUPPORTIVE') {
    parts.push(
      'Available soil classification and correlated foundation parameters provide preliminary support for planning.'
    )
  } else if (status === 'CONDITIONALLY_SUPPORTIVE') {
    parts.push(
      'Available evidence supports preliminary planning with important uncertainty remaining.'
    )
  } else if (status === 'INVESTIGATION_REQUIRED') {
    parts.push('Current data is insufficient for reliable engineering decision-making.')
  } else if (status === 'ENGINEERING_CONSTRAINT_IDENTIFIED') {
    parts.push(
      'Available evidence indicates a potentially significant engineering constraint — field verification required before design.'
    )
  }

  parts.push(confidenceExplanation(confidence, evidence))

  if (!evidence.measured.length) {
    parts.push(
      'No site-specific borehole or in-situ strength measurements are currently available. Final foundation design should not proceed without field investigation.'
    )
  }

  if (dimensions.accessRoad.status === 'INVESTIGATION_REQUIRED') {
    parts.push('Access road CBR requires field soaked test — do not proceed with final road design.')
  }

  if (dimensions.earthing.status === 'INVESTIGATION_REQUIRED') {
    parts.push(
      'Indicative geospatial resistivity estimate only. Site-specific field resistivity testing is required before final earthing design.'
    )
  }

  if (priorities.filter((p) => p.mandate === 'MANDATORY').length > 0) {
    parts.push(
      `${priorities.filter((p) => p.mandate === 'MANDATORY').length} mandatory investigation(s) identified.`
    )
  }

  return parts.join(' ')
}

export function computeDesignStageDecisions(
  overall: SoilVerdictAnalysis['overall'],
  dimensions: SoilVerdictAnalysis['dimensions'],
  hasMeasuredField: boolean
): EngineeringDecision[] {
  const insuff = overall.status === 'INSUFFICIENT_DATA'
  const invReq = overall.investigationRequired

  return [
    {
      stage: 'PRELIMINARY_PLANNING',
      decision: insuff ? 'STOP' : invReq ? 'CONDITIONAL_GO' : 'GO',
      explanation: insuff
        ? 'Insufficient soil data — do not proceed with route/tower placement decisions without basic investigation'
        : 'GIS screening supports preliminary corridor and pad screening with documented limitations',
    },
    {
      stage: 'PRELIMINARY_ENGINEERING',
      decision: insuff ? 'STOP' : hasMeasuredField ? 'CONDITIONAL_GO' : 'CONDITIONAL_GO',
      explanation:
        'Preliminary engineering may use correlated/modelled parameters with explicit uncertainty — not for sealed design',
    },
    {
      stage: 'FINAL_DESIGN',
      decision: hasMeasuredField && !invReq ? 'CONDITIONAL_GO' : 'STOP',
      explanation:
        hasMeasuredField && !invReq
          ? 'Some field data available — final design may proceed with engineer review of remaining gaps'
          : 'STOP — field data required. Do not proceed with final foundation, pile, road, or earthing design on geospatial data alone',
    },
    {
      stage: 'CONSTRUCTION',
      decision: 'NOT_ASSESSABLE',
      explanation:
        'Construction suitability cannot be assessed from geospatial screening alone — requires design validation and field verification',
    },
  ]
}

export function buildOverallInvestigationVerdict(
  investigationUrgency: InvestigationUrgency,
  priorities: InvestigationPriority[]
): DimensionVerdict {
  let status: VerdictStatus = 'CONDITIONALLY_SUPPORTIVE'
  if (investigationUrgency === 'URGENT_INVESTIGATION_REQUIRED') status = 'INVESTIGATION_REQUIRED'
  else if (investigationUrgency === 'FIELD_INVESTIGATION_REQUIRED') status = 'INVESTIGATION_REQUIRED'
  else if (investigationUrgency === 'NO_IMMEDIATE_INVESTIGATION_INDICATED') status = 'PRELIMINARILY_SUPPORTIVE'

  return {
    dimension: 'OVERALL_INVESTIGATION',
    status,
    color: verdictToColor(status),
    evidenceStrength: 'LEVEL_2_ENGINEERING_CORRELATION',
    confidence: priorities.some((p) => p.mandate === 'MANDATORY') ? 'LOW' : 'MODERATE',
    supportingEvidence: priorities.map((p) => `P${p.priority}: ${p.investigationType}`),
    uncertainties: ['Investigation scope depends on design stage and risk tolerance'],
    requiredNextAction:
      investigationUrgency === 'NO_IMMEDIATE_INVESTIGATION_INDICATED'
        ? 'Monitor — limited verification may still be prudent'
        : 'Execute ranked investigation plan before final design decisions',
    evidenceTrace: [],
  }
}
