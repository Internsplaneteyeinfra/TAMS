export { runSoilVerdictAnalysis } from './soilVerdictEngine'
export type {
  SoilVerdictAnalysis,
  VerdictStatus,
  VerdictColor,
  ConfidenceLevel,
  DimensionVerdict,
  InvestigationPriority,
  ConflictRecord,
  EngineeringDecision,
} from './types'
export { formatVerdictLabel, provenancePhrase } from './adapters'
