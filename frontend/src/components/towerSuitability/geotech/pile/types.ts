/**
 * Phase F — Pile foundation types.
 */

import type { GeoDataStatus, ProvenanceValue } from '../types'

export type PileDepthKey = '1.0m' | '1.5m' | '2.0m'
export type PileDiameterKey = '450mm' | '600mm'
export type SoilConditionType = 'COHESIVE' | 'COHESIONLESS' | 'MIXED'

export type PileCalculationStatus =
  | 'CALCULATED'
  | 'PARTIAL'
  | 'INSUFFICIENT_DATA'
  | 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
  | 'FIELD_TEST_REQUIRED'

export interface PileEngineeringParameter<T = number> {
  value: T | null
  unit: string
  source: GeoDataStatus
  method: string
  confidence: number | null
  reference?: string
}

export interface PileCalculationStep {
  step: number
  name: string
  formula: string
  inputs: Record<string, number | string | null>
  result: number | string | null
  unit: string
  notes?: string
}

export interface PileLayerCalculation {
  depthFromM: number
  depthToM: number
  thicknessM: number
  midDepthM: number
  soilCondition: SoilConditionType
  cTm2: PileEngineeringParameter
  phiDeg: PileEngineeringParameter
  gammaTm3: PileEngineeringParameter
  overburdenMidTm2: PileEngineeringParameter
  Ki: PileEngineeringParameter
  deltaDeg: PileEngineeringParameter
  shaftAreaM2: number
  shaftFrictionContributionT: number | null
  method: string
}

export interface PileCapacityResult {
  ultimate_T: number | null
  safe_T: ProvenanceValue<number | null>
  steps: PileCalculationStep[]
}

export interface PileCellAnalysis {
  diameterMm: number
  depthM: number
  soilCondition: SoilConditionType
  calculationStatus: PileCalculationStatus
  missingParameters: string[]
  confidencePct: number | null
  parameters: {
    Ap_m2: PileEngineeringParameter
    As_m2: PileEngineeringParameter
    D_m: PileEngineeringParameter
    L_m: PileEngineeringParameter
    Nq: PileEngineeringParameter
    Ngamma: PileEngineeringParameter
    PD_tip_Tm2: PileEngineeringParameter
    sptN: PileEngineeringParameter
  }
  layerCalculations: PileLayerCalculation[]
  verticalCapacity: PileCapacityResult & {
    endBearing_T: number | null
    shaftFriction_T: number | null
    ultimateVertical_T: number | null
  }
  upliftCapacity: PileCapacityResult & {
    selfWeight_T: number | null
    shaftResistance_T: number | null
    ultimateUplift_T: number | null
  }
  lateralCapacity: PileCapacityResult & {
    method: string
    lateralMethodNote: string
  }
  validation: {
    passed: boolean
    status: PileCalculationStatus
    message: string
    provenanceSummary: string
    missingParameters: string[]
  }
  steps: PileCalculationStep[]
  assumptions: string[]
}

export interface BoreholePileAnalysis {
  boreholeId: string
  latitude: number
  longitude: number
  soilCondition: SoilConditionType
  calculationStatus: PileCalculationStatus
  message: string
  matrix: PileCellAnalysis[]
  byDiameter: Record<PileDiameterKey, Record<PileDepthKey, PileCellAnalysis>>
}

export interface PileEngineAnalysis {
  version: 'PILE-F1'
  codeReference: string
  method: string
  calculationStatus: PileCalculationStatus
  message: string
  byBorehole: BoreholePileAnalysis[]
  /** Site-level legacy matrix (first borehole) */
  siteSummary: BoreholePileAnalysis
}

export const PILE_DIAMETERS_MM = [450, 600] as const
export const PILE_DEPTHS_M = [1.0, 1.5, 2.0] as const
export const FOS_PILE_COMPRESSION = 2.5
export const FOS_PILE_UPLIFT = 3.0
export const GAMMA_CONCRETE_TM3 = 2.5

export function pileDepthKey(d: number): PileDepthKey {
  return `${d.toFixed(1)}m` as PileDepthKey
}

export function pileDiameterKey(mm: number): PileDiameterKey {
  return `${mm}mm` as PileDiameterKey
}
