/**
 * Phase E — SBC engineering types.
 */

import type { GeoDataStatus, ProvenanceValue } from '../types'

export type SbcDataBasis = 'PRIMARY_GEOSPATIAL_MODEL' | 'ENGINEERING_DEPTH_EXTRAPOLATION'

export type SbcSourceTypeLabel = 'Calculated' | 'Engineering Depth Model'

export type SbcGoverningCondition = 'Shear' | 'Settlement' | 'None'

export type SbcCalculationStatus =
  | 'CALCULATED'
  | 'PARTIAL'
  | 'INSUFFICIENT_DATA'
  | 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
  | 'OUT_OF_RANGE'

export interface EngineeringParameter<T = number> {
  value: T | null
  unit: string
  source: GeoDataStatus
  method: string
  confidence: number | null
  reference?: string
}

export interface SbcCalculationStep {
  step: number
  name: string
  formula: string
  inputs: Record<string, number | string | null>
  result: number | string | null
  unit: string
  notes?: string
}

export interface SbcFoundationInputs {
  foundationType: string
  widthM: number
  lengthM: number
  assumedScreeningDefaults: boolean
  fosShear: number
  allowableSettlementMm: number | null
  groundwater: 'below_influence' | 'at_foundation' | 'unknown'
}

export interface SbcSoilInputs {
  cTm2: number | null
  phiDeg: number | null
  gammaTm3: number | null
  cStatus: GeoDataStatus
  phiStatus: GeoDataStatus
  gammaStatus: GeoDataStatus
  cSource: string
  phiSource: string
  gammaSource: string
  textureHint: string | null
  dataBasis: SbcDataBasis
  layerLabel: string | null
}

export interface DepthCorrectionRow {
  depthM: number
  baseSbcTm2: number | null
  depthFactor: number | null
  correctedSbcTm2: number | null
  dataBasis: SbcDataBasis
  explanation: string
}

export interface SizeCorrectionResult {
  referenceFootingM: string
  referenceSbcTm2: number | null
  sizeCorrectionFactor: number | null
  correctedSbcTm2: number | null
  formula: string
  explanation: string
  steps: SbcCalculationStep[]
}

export interface SbcDepthMatrixRow {
  depthM: number
  dataBasis: SbcDataBasis
  sourceTypeLabel: SbcSourceTypeLabel
  calculationStatus: SbcCalculationStatus
  shearSafeCapacityTm2: ProvenanceValue<number | null>
  settlementControlledCapacityTm2: ProvenanceValue<number | null>
  netSafeBearingCapacityTm2: ProvenanceValue<number | null>
  governingCondition: SbcGoverningCondition
  confidencePct: number | null
  depthCorrection: DepthCorrectionRow
  steps: SbcCalculationStep[]
  factors: Record<string, number | null>
  components: Record<string, number | null>
  assumptions: string[]
}

export interface SbcDesignParameters {
  foundationType: EngineeringParameter<string>
  footingWidthM: EngineeringParameter<number>
  footingLengthM: EngineeringParameter<number>
  foundationDepthM: EngineeringParameter<number>
  factorOfSafety: EngineeringParameter<number>
  allowableSettlementMm: EngineeringParameter<number>
  unitWeightGammaTm3: EngineeringParameter<number>
  cohesionCTm2: EngineeringParameter<number>
  frictionAnglePhiDeg: EngineeringParameter<number>
}

export interface SbcValidationResult {
  passed: boolean
  status: SbcCalculationStatus
  missingParameters: string[]
  message: string
  provenanceSummary: string
}

export interface BoreholeSbcAnalysis {
  boreholeId: string
  latitude: number
  longitude: number
  recommendedFoundationDepthM: number | null
  netSafeBearingCapacityTm2: ProvenanceValue<number | null>
  governingCondition: SbcGoverningCondition
  confidencePct: number | null
  dataBasisSummary: string
  calculationStatus: SbcCalculationStatus
  message: string
  designParameters: SbcDesignParameters
  soilInputs: SbcSoilInputs
  byDepth: SbcDepthMatrixRow[]
  sizeCorrection: SizeCorrectionResult
  validation: SbcValidationResult
  settlementSteps: SbcCalculationStep[]
}

export interface SbcEngineAnalysis {
  version: 'SBC-E1'
  codeReference: string
  calculationStatus: SbcCalculationStatus
  message: string
  foundation: SbcFoundationInputs
  /** Per recommended investigation point */
  byBorehole: BoreholeSbcAnalysis[]
  /** Site-level summary (first borehole or centroid) — backward compatible flat view */
  siteSummary: {
    boreholeId: string
    adoptedPreliminary: ProvenanceValue<number | null>
    recommendedFoundationDepthM: number | null
    governingCondition: SbcGoverningCondition
    confidencePct: number | null
    byDepth: SbcDepthMatrixRow[]
    settlementConsideration: string
  }
}

/** Legacy-compatible depth result shape */
export interface SbcDepthResultLegacy {
  depthM: number
  calculationStatus: string
  dataBasis?: SbcDataBasis
  sourceTypeLabel?: SbcSourceTypeLabel
  netSafeBearingCapacityTm2: ProvenanceValue<number | null>
  governingCondition?: SbcGoverningCondition
  confidencePct?: number | null
  steps?: SbcCalculationStep[]
  factors?: Record<string, number | null>
  components?: Record<string, number | null>
  assumptions?: string[]
}

export const PRIMARY_SBC_DEPTHS_M = [0.5, 1.0, 1.5, 2.0] as const
export const EXTRAPOLATION_SBC_DEPTHS_M = [2.5, 3.0, 3.5, 4.0] as const
export const ALL_SBC_DEPTHS_M = [...PRIMARY_SBC_DEPTHS_M, ...EXTRAPOLATION_SBC_DEPTHS_M] as const
