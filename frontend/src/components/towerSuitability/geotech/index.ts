export type {
  GeotechnicalIntelligence,
  GeoDataStatus,
  ReportClassification,
  ProvenanceValue,
} from './types'
export { REPORT_DEPTH_INTERVALS, SOILGRIDS_SOURCE_DEPTHS } from './types'
export { buildGeotechnicalIntelligence } from './buildGeotechnicalIntelligence'
export type { BuildGeotechOptions } from './buildGeotechnicalIntelligence'
export {
  planBoreholeInvestigation,
  parseInvestigationGeometry,
  geometryFromPath,
} from './boreholePlanning'
export type {
  BoreholeInvestigationPlan,
  RecommendedInvestigationPoint,
  InvestigationGeometry,
} from './boreholePlanning'
export { buildSoilLayerParameters, normalizeGrainSize } from './soilParameterEngine'
export { buildSoilTestSummary } from './soilTestSummary'
export {
  buildResolvedParameterContext,
  toEngineeringParameterSet,
  resolveLayerAtDepth,
  mergeResolvedParameters,
  validateParameterCompleteness,
} from './parameterResolution'
export { recommendFoundation } from './foundationRecommendation'
export type { FoundationRecommendation, FoundationCategory } from './foundationRecommendation'
export { buildReportDataModel } from './report/reportDataModel'
export { validateResolvedContext } from './geotechValidation'
export { runDerivationPipeline, formatDerivedValue, statusBadgeLabel } from './derivationPipeline'
export { assertNoDataNeverZero, collectAllProvenance } from './dataQuality'
export {
  parseSoilGridsDepthLabel,
  buildEngineeringDepthProfile,
  toSourceObservations,
} from './depthProfile'
export {
  runSbcAnalysis,
  runSbcEngineAnalysis,
  toLegacySbcAnalysis,
  calculateSbcAtDepth,
  defaultScreeningFoundation,
  resolveSbcSoilInputs,
} from './sbcEngine'
export {
  runSettlementAnalysis,
  resolveSettlementSoilInputs,
  emptyTowerLoad,
} from './settlementEngine'
export {
  runPileAnalysis,
  runPileEngineAnalysis,
  calculatePileCell,
} from './pileEngine'
export { PRODUCTION_GEOTECH_FACTOR } from './productionScoringSafety'
export {
  buildGeotechInvestigationDocx,
  downloadGeotechInvestigationDocx,
  geotechDocxFileName,
} from './report/buildGeotechInvestigationDocx'
export {
  buildTransmissionLineReportHtml,
  downloadTransmissionLineReport,
} from './report/buildTransmissionLineReportHtml'
export { buildFoundationSuitabilityTable } from './report/foundationSuitabilityTable'
export type { FoundationSuitabilityRow, FoundationSuitability } from './report/foundationSuitabilityTable'
export type { GeotechDocxInput } from './report/buildGeotechReportData'
export {
  buildGeotechReportData,
  validateGeotechReportData,
  ReportValidationError,
} from './report/buildGeotechReportData'
export type {
  ValidatedGeotechnicalReportData,
  ReportLocationInfo,
  ReportSectionFlags,
} from './report/buildGeotechReportData'
export type { ReportValidationResult } from './report/reportValidation/types'
export {
  prebuildGeotechDocx,
  downloadCachedGeotechDocx,
  isGeotechDocxCached,
  defaultGeotechDocxInput,
  invalidateGeotechDocxCache,
  subscribeGeotechDocxCache,
  isGeotechDocxInflight,
  warmGeotechDocxModules,
  ReportValidationError as GeotechReportValidationError,
} from './geotechReportCache'
