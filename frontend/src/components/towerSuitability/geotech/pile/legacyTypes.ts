import type { GeoDataStatus, ProvenanceValue } from '../types'

export interface PileCalculationStep {
  step: number
  name: string
  formula: string
  inputs: Record<string, number | string | null>
  result: number | string | null
  unit: string
  notes?: string
}

export interface PileCellResult {
  diameterMm: number
  depthM: number
  calculationStatus: 'INSUFFICIENT_DATA' | 'FIELD_TEST_REQUIRED' | 'CALCULATED' | 'PARTIAL'
  missingParameters: string[]
  inputs: {
    Ap_m2: number
    perimeter_m: number
    D_m: number
    L_m: number
    c_Tm2: number | null
    phi_deg: number | null
    gamma_Tm3: number | null
    PD_tip_Tm2: number | null
    Ki: number | null
    delta_deg: number | null
    Nq: number | null
    Ngamma: number | null
    fosCompression: number
    fosUplift: number
    cStatus: GeoDataStatus
    phiStatus: GeoDataStatus
  }
  layerProfile: Array<{
    depthFromM: number
    depthToM: number
    thicknessM: number
    midDepthM: number
    overburdenMidTm2: number | null
    soilCondition?: string
    shaftContribution_T?: number | null
  }>
  endBearing: { Qb_T: number | null; steps: PileCalculationStep[] }
  shaftFriction: { Qs_T: number | null; steps: PileCalculationStep[] }
  ultimateVertical_T: number | null
  safeVertical: ProvenanceValue<number | null>
  ultimateUplift_T: number | null
  safeUplift: ProvenanceValue<number | null>
  safeLateral: ProvenanceValue<number | null>
  vertical: ProvenanceValue<number | null>
  uplift: ProvenanceValue<number | null>
  lateral: ProvenanceValue<number | null>
  steps: PileCalculationStep[]
  assumptions: string[]
  soilCondition?: string
  confidencePct?: number | null
  validation?: unknown
}

export interface PileAnalysisResult {
  codeReference: string
  method: string
  soilInputs: import('../sbc/types').SbcSoilInputs | null
  message: string
  '450mm': Record<'1.0m' | '1.5m' | '2.0m', PileCellResult>
  '600mm': Record<'1.0m' | '1.5m' | '2.0m', PileCellResult>
}
