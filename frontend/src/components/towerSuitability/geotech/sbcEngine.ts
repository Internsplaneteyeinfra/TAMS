/**
 * Legacy re-export surface — Phase E implementation lives in ./sbc/
 */

export {
  runSbcAnalysis,
  runSbcEngineAnalysis,
  calculateSbcAtDepth,
  defaultScreeningFoundation,
  toLegacySbcAnalysis,
} from './sbc/sbcEngine'

export type {
  SbcFoundationInputs,
  SbcSoilInputs,
  SbcCalculationStep,
  SbcEngineAnalysis,
  BoreholeSbcAnalysis,
  SbcDepthMatrixRow,
  SbcEngineAnalysis as SbcEngineAnalysisType,
} from './sbc/types'

export type { SbcAnalysisResult, SbcDepthResult } from './sbc/legacyTypes'

import { resolveSoilAtDepth } from './sbc/bearingCapacity'
import type { EngineeringParameterSet, SoilLayerParameters, SoilProfileInterval } from './types'
import type { SbcSoilInputs } from './sbc/types'

/** Legacy 2-arg resolver — uses Df = 1.5 m representative layer. */
export function resolveSbcSoilInputs(
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayers?: SoilLayerParameters[]
): SbcSoilInputs {
  return resolveSoilAtDepth(1.5, engineering, profile, soilLayers)
}
