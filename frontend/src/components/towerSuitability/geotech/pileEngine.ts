/**
 * Legacy re-export — Phase F implementation in ./pile/
 */

export {
  runPileAnalysis,
  runPileEngineAnalysis,
  calculatePileCell,
  toLegacyPileAnalysis,
  toLegacyPileCell,
} from './pile/pileEngine'

export type {
  PileDepthKey,
  PileDiameterKey,
  PileCellAnalysis,
  BoreholePileAnalysis,
  PileEngineAnalysis,
  SoilConditionType,
} from './pile/types'

export type { PileCellResult, PileAnalysisResult, PileCalculationStep } from './pile/legacyTypes'
