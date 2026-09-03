import type { ProvenanceValue } from '../types'
import type { SbcCalculationStep, SbcFoundationInputs, SbcSoilInputs } from './types'

export interface SbcDepthResult {
  depthM: number
  calculationStatus: 'CALCULATED' | 'INSUFFICIENT_DATA' | 'OUT_OF_RANGE' | string
  netSafeBearingCapacityTm2: ProvenanceValue<number | null>
  steps: SbcCalculationStep[]
  factors: Record<string, number | null>
  components: Record<string, number | null>
  assumptions: string[]
}

export interface SbcAnalysisResult {
  calculationStatus: 'CALCULATED' | 'INSUFFICIENT_DATA' | 'PARTIAL'
  message: string
  codeReference: string
  foundation: SbcFoundationInputs
  soilInputs: SbcSoilInputs
  byDepth: SbcDepthResult[]
  adoptedPreliminary: ProvenanceValue<number | null>
  settlementConsideration: string
}
