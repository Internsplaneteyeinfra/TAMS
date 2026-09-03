/**
 * Phase G — Resistivity types.
 */

import type { GeoDataStatus, ProvenanceValue } from '../types'

export type ResistivityBasis = 'GEOSPATIAL_MODEL' | 'DEPTH_MODELLED_ESTIMATE' | 'MEASURED' | 'FIELD_TEST_REQUIRED'

export interface ResistivityDepthRow {
  depthFromM: number
  depthToM: number
  depthLabel: string
  estimatedResistivityOhmM: ProvenanceValue<number | null>
  estimatedRangeOhmM: ProvenanceValue<{ low: number; high: number } | null>
  basis: ResistivityBasis
  confidencePct: number | null
  steps: Array<{
    step: number
    name: string
    formula: string
    inputs: Record<string, number | string | null>
    result: number | string | null
    unit: string
  }>
}

export interface ResistivityEngineAnalysis {
  version: 'RES-G1'
  assessmentTitle: string
  calculationStatus: 'CALCULATED' | 'PARTIAL' | 'FIELD_TEST_REQUIRED'
  message: string
  measured: ProvenanceValue<number | string | null>
  siteEstimateOhmM: ProvenanceValue<number | null>
  siteEstimateRangeOhmM: ProvenanceValue<{ low: number; high: number } | null>
  confidencePct: number | null
  byDepth: ResistivityDepthRow[]
  fieldVerificationRequired: string[]
  validationNotes: string[]
  groundingRecommendation?: GroundingRecommendation
}

export type GroundingResistivityCategory = 'LOW_RESISTIVITY' | 'MODERATE_RESISTIVITY' | 'HIGH_RESISTIVITY'

export interface GroundingRecommendation {
  category: GroundingResistivityCategory
  label: string
  suitability: string
  needAdditionalElectrodes: boolean
  needEnhancementMaterial: boolean
  verificationRecommended: boolean
  notes: string[]
}
