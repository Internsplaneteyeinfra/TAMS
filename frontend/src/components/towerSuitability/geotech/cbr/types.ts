/**
 * Phase G — CBR types (transmission tower access/construction roads).
 */

import type { GeoDataStatus, ProvenanceValue, ReportDepthId } from '../types'

export type CbrProvenanceStatus =
  | 'ENGINEERING_CORRELATED'
  | 'MODEL_PREDICTED'
  | 'FIELD_TEST_REQUIRED'
  | 'MEASURED'
  | 'NO_DATA'

export interface CbrDerivedParameter<T = number> {
  value: T | null
  unit: string
  source: GeoDataStatus
  method: string
  confidence: number | null
  provenanceStatus: CbrProvenanceStatus
  reference?: string
}

export interface CbrCalculationStep {
  step: number
  name: string
  formula: string
  inputs: Record<string, number | string | null>
  result: number | string | null
  unit: string
  notes?: string
}

export interface CbrDepthRow {
  reportDepth: ReportDepthId
  reportDepthLabel: string
  depthFromM: number
  depthToM: number
  soilClassification: string | null
  pi: number | null
  correlatedCbrPct: ProvenanceValue<number | null>
  cbrRangePct: ProvenanceValue<{ low: number; high: number } | null>
  method: string
  correlationReference: string
  confidencePct: number | null
  steps: CbrCalculationStep[]
  validationNote: string
}

export interface CbrEngineAnalysis {
  version: 'CBR-G1'
  purpose: string
  calculationStatus: 'CALCULATED' | 'PARTIAL' | 'FIELD_TEST_REQUIRED' | 'INSUFFICIENT_DATA'
  message: string
  recommendedDesignCbr: ProvenanceValue<number | null>
  recommendedDesignBasis: string
  byDepth: CbrDepthRow[]
  measuredByDepth: Array<{
    reportDepth: ReportDepthId
    measuredCBR: ProvenanceValue<number | null>
  }>
  validationNotes: string[]
}
