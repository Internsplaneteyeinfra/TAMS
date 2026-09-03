/**
 * Phase H — Soil Verdict & Investigation Decision types.
 */

import type { GeoDataStatus } from '../types'

export type VerdictStatus =
  | 'PRELIMINARILY_SUPPORTIVE'
  | 'CONDITIONALLY_SUPPORTIVE'
  | 'INVESTIGATION_REQUIRED'
  | 'ENGINEERING_CONSTRAINT_IDENTIFIED'
  | 'INSUFFICIENT_DATA'

export type VerdictColor = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'GREY'

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW'

export type EvidenceLevel =
  | 'LEVEL_1_MEASURED'
  | 'LEVEL_2_ENGINEERING_CORRELATION'
  | 'LEVEL_3_MODELLED_GEOSPATIAL'
  | 'LEVEL_4_ASSUMED_UNKNOWN'

export type InvestigationUrgency =
  | 'NO_IMMEDIATE_INVESTIGATION_INDICATED'
  | 'LIMITED_FIELD_VERIFICATION_RECOMMENDED'
  | 'FIELD_INVESTIGATION_REQUIRED'
  | 'URGENT_INVESTIGATION_REQUIRED'

export type DesignStageDecision = 'GO' | 'CONDITIONAL_GO' | 'STOP' | 'NOT_ASSESSABLE' | 'REQUIRES_DESIGN_VALIDATION'

export type InvestigationMandate = 'MANDATORY' | 'RECOMMENDED' | 'OPTIONAL'

export interface EvidenceProvenance {
  phase: string
  parameter: string
  value: string | number | null
  provenance: GeoDataStatus | string
  evidenceLevel: EvidenceLevel
  validationResult: 'PASS' | 'FAIL' | 'NOT_APPLICABLE'
  confidenceContribution: ConfidenceLevel
  decisionImpact: string
}

export interface EvidenceSummary {
  measured: EvidenceProvenance[]
  correlated: EvidenceProvenance[]
  modelled: EvidenceProvenance[]
  missing: string[]
  unknown: string[]
}

export interface ValidationGate {
  module: string
  parameter: string
  status: GeoDataStatus | string
  passed: boolean
  message: string
  blocksFinalDesign: boolean
}

export interface ConflictRecord {
  id: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  affectedModules: string[]
  explanation: string
  requiredResolution: string
}

export interface DimensionVerdict {
  dimension:
    | 'FOUNDATION'
    | 'PILE_FOUNDATION'
    | 'ACCESS_ROAD'
    | 'ELECTRICAL_EARTHING'
    | 'GROUNDWATER'
    | 'SOIL_DATA_CONFIDENCE'
    | 'OVERALL_INVESTIGATION'
  status: VerdictStatus
  color: VerdictColor
  evidenceStrength: EvidenceLevel
  confidence: ConfidenceLevel
  supportingEvidence: string[]
  uncertainties: string[]
  requiredNextAction: string
  evidenceTrace: EvidenceProvenance[]
}

export interface InvestigationPriority {
  priority: number
  investigationType: string
  reason: string
  affectedDecision: string
  currentEvidence: string
  missingEvidence: string
  expectedUncertaintyReduction: string
  mandate: InvestigationMandate
}

export interface EngineeringDecision {
  stage: 'PRELIMINARY_PLANNING' | 'PRELIMINARY_ENGINEERING' | 'FINAL_DESIGN' | 'CONSTRUCTION'
  decision: DesignStageDecision
  explanation: string
}

export interface SoilVerdictAnalysis {
  version: 'VERDICT-H1'
  generatedAt: string
  overall: {
    status: VerdictStatus
    color: VerdictColor
    confidence: ConfidenceLevel
    investigationRequired: boolean
    investigationUrgency: InvestigationUrgency
    explanation: string
  }
  dimensions: {
    foundation: DimensionVerdict
    pile: DimensionVerdict
    accessRoad: DimensionVerdict
    earthing: DimensionVerdict
    groundwater: DimensionVerdict
    soilDataConfidence: DimensionVerdict
    overallInvestigation: DimensionVerdict
  }
  evidenceSummary: EvidenceSummary
  whatWeKnow: {
    measured: string[]
    correlated: string[]
    modelled: string[]
  }
  whatWeDoNotKnow: string[]
  conflicts: ConflictRecord[]
  validationGates: ValidationGate[]
  investigationPriorities: InvestigationPriority[]
  designStageDecisions: EngineeringDecision[]
  nextActions: string[]
  limitations: string[]
}
