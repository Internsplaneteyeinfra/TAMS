/**
 * Additive geotechnical intelligence types (GEO-1).
 * Does NOT feed production suitability scoring.
 */

export type GeoDataStatus =
  | 'MEASURED'
  | 'PROJECT_DATA'
  | 'REFERENCE_CALIBRATED'
  | 'MODELLED'
  | 'DERIVED'
  | 'CALCULATED'
  | 'ESTIMATED'
  | 'NO_DATA'
  | 'FIELD_TEST_REQUIRED'
  | 'OUT_OF_RANGE'
  | 'INSUFFICIENT_DATA'
  | 'GIS_DERIVED'
  | 'SATELLITE_DERIVED'
  | 'ENGINEERING_CORRELATED'
  | 'MODEL_PREDICTED'

export type ReportClassification =
  | 'GIS_BASED_PRELIMINARY_SCREENING'
  | 'FIELD_SUPPORTED_PRELIMINARY_ENGINEERING_ANALYSIS'
  | 'FIELD_VALIDATED_GEOTECHNICAL_REPORT'

export interface ProvenanceValue<T = number | string | null> {
  value: T
  unit: string
  source: string
  method: string
  confidence: number | null
  status: GeoDataStatus
  engineeringLimitation?: string
  formula?: string
  correlation?: string
  inputValues?: Record<string, number | string | null>
  assumptions?: string[]
  validityRange?: string
}

export const REPORT_DEPTH_INTERVALS = [
  { id: '0.0-0.5m', fromM: 0.0, toM: 0.5, label: '0.0–0.5 m' },
  { id: '0.5-1.0m', fromM: 0.5, toM: 1.0, label: '0.5–1.0 m' },
  { id: '1.0-1.5m', fromM: 1.0, toM: 1.5, label: '1.0–1.5 m' },
  { id: '1.5-2.0m', fromM: 1.5, toM: 2.0, label: '1.5–2.0 m' },
] as const

export type ReportDepthId = (typeof REPORT_DEPTH_INTERVALS)[number]['id']

/** SoilGrids v2 depth labels we request (source metadata preserved). */
export const SOILGRIDS_SOURCE_DEPTHS = [
  '0-5cm',
  '5-15cm',
  '15-30cm',
  '30-60cm',
  '60-100cm',
  '100-200cm',
] as const

export type SoilGridsSourceDepth = (typeof SOILGRIDS_SOURCE_DEPTHS)[number]

export interface SourceLayerObservation {
  sourceDepth: SoilGridsSourceDepth | string
  depthFromM: number
  depthToM: number
  sandPct: number | null
  siltPct: number | null
  clayPct: number | null
  bulkDensityGcc: number | null
  /** Oven-dry bulk density from SoilGrids bdod — NEVER soil depth. */
  bdodGcc: number | null
  organicCarbonGkg: number | null
  ph: number | null
  coarseFragPct: number | null
}

export interface SoilProfileInterval {
  reportDepth: ReportDepthId
  reportDepthLabel: string
  depthFromM: number
  depthToM: number
  sourceDepths: string[]
  aggregationMethod: string
  overlapCoveragePct: number
  sandPct: ProvenanceValue<number | null>
  siltPct: ProvenanceValue<number | null>
  clayPct: ProvenanceValue<number | null>
  gravelPct: ProvenanceValue<number | null>
  coarseFragPct: ProvenanceValue<number | null>
  bulkDensityGcc: ProvenanceValue<number | null>
  dryDensityGcc: ProvenanceValue<number | null>
  organicCarbonGkg: ProvenanceValue<number | null>
  ph: ProvenanceValue<number | null>
  usdaTexture: ProvenanceValue<string | null>
  isSoilClassification: ProvenanceValue<string | null>
  preliminaryMaterialDescription: ProvenanceValue<string | null>
}

export interface EngineeringParameterSet {
  gammaKnM3: ProvenanceValue<number | null>
  dryDensityGcc: ProvenanceValue<number | null>
  phiDeg: ProvenanceValue<number | null>
  cohesionKpa: ProvenanceValue<number | null>
  notes: string[]
}

export interface FieldInvestigationMatch {
  matched: boolean
  investigationId: string | null
  siteCode: string | null
  distanceKm: number | null
  geologyCompatibility: 'unknown' | 'compatible' | 'incompatible' | 'not_assessed'
  depthCoverageM: number | null
  matchConfidence: number | null
  reason: string
  usedForMeasuredParams: boolean
}

export interface DataQualitySummary {
  overallConfidence: number
  measuredCoverage: number
  modelledCoverage: number
  estimatedCoverage: number
  derivedCoverage: number
  missingCriticalParameters: string[]
  fieldValidationRequired: boolean
}

export interface ReportReadiness {
  totalParameters: number
  availableParameters: number
  measuredParameters: number
  modelledParameters: number
  estimatedParameters: number
  derivedParameters: number
  calculatedParameters: number
  missingParameters: number
  fieldTestRequiredParameters: number
  completionPercentage: number
  missingCriticalData: string[]
}

export interface CbrAnalysis {
  measuredByDepth: Array<{
    reportDepth: ReportDepthId
    measuredCBR: ProvenanceValue<number | null>
  }>
  estimatedByDepth: Array<{
    reportDepth: ReportDepthId
    estimatedCBR: ProvenanceValue<{ low: number; high: number } | null>
  }>
}

export interface ResistivityAnalysis {
  measured: ProvenanceValue<number | string | null>
  estimated: ProvenanceValue<number | null>
  layers: Array<{
    depthFromM: number
    depthToM: number
    resistivity: ProvenanceValue<number | string | null>
  }>
}

export interface SbcAnalysisPlaceholder {
  calculationStatus: 'NOT_IMPLEMENTED' | 'INSUFFICIENT_DATA' | 'CALCULATED' | 'PARTIAL' | 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
  message: string
  codeReference?: string
  foundation?: {
    foundationType: string
    widthM: number
    lengthM: number
    assumedScreeningDefaults: boolean
    fosShear: number
  }
  soilInputs?: {
    cTm2: number | null
    phiDeg: number | null
    gammaTm3: number | null
    cStatus: GeoDataStatus
    phiStatus: GeoDataStatus
    gammaStatus: GeoDataStatus
    textureHint: string | null
  }
  byDepth: Array<{
    depthM: number
    calculationStatus?: string
    dataBasis?: 'PRIMARY_GEOSPATIAL_MODEL' | 'ENGINEERING_DEPTH_EXTRAPOLATION'
    sourceTypeLabel?: 'Calculated' | 'Engineering Depth Model'
    governingCondition?: 'Shear' | 'Settlement' | 'None'
    confidencePct?: number | null
    netSafeBearingCapacityTm2: ProvenanceValue<number | null>
    shearSafeCapacityTm2?: ProvenanceValue<number | null>
    settlementControlledCapacityTm2?: ProvenanceValue<number | null>
    depthCorrection?: {
      depthM: number
      baseSbcTm2: number | null
      depthFactor: number | null
      correctedSbcTm2: number | null
      dataBasis: string
      explanation: string
    }
    steps?: Array<{
      step: number
      name: string
      formula: string
      inputs: Record<string, number | string | null>
      result: number | string | null
      unit: string
      notes?: string
    }>
    factors?: Record<string, number | null>
    components?: Record<string, number | null>
    assumptions?: string[]
  }>
  adoptedPreliminary?: ProvenanceValue<number | null>
  settlementConsideration?: string
  sizeCorrection?: import('./sbc/types').SizeCorrectionResult
  validation?: import('./sbc/types').SbcValidationResult
  designParameters?: import('./sbc/types').SbcDesignParameters
}

export interface SettlementAnalysisPlaceholder {
  calculationStatus: 'TOWER_LOAD_REQUIRED' | 'INSUFFICIENT_DATA' | 'CALCULATED' | 'OUT_OF_RANGE'
  message: string
  codeReference?: string
  requiredInputs: string[]
  missingInputs?: string[]
  readiness?: {
    hasFoundationGeometry: boolean
    hasTowerLoad: boolean
    hasModulus: boolean
    hasPoisson: boolean
    hasInfluenceFactor: boolean
    canCalculate: boolean
  }
  towerLoadPlaceholder?: {
    verticalLoadT: number | null
    contactPressureTm2: number | null
    note: string
  }
  settlementMm?: ProvenanceValue<number | null>
  settlementStatus?: 'Safe' | 'Review' | 'NotAssessed' | null
  steps?: Array<{
    step: number
    name: string
    formula: string
    inputs: Record<string, number | string | null>
    result: number | string | null
    unit: string
    notes?: string
  }>
  assumptions?: string[]
}

export interface PileCellPlaceholder {
  diameterMm: number
  depthM: number
  calculationStatus: 'INSUFFICIENT_DATA' | 'FIELD_TEST_REQUIRED' | 'CALCULATED' | 'PARTIAL'
  missingParameters: string[]
  vertical: ProvenanceValue<number | null>
  uplift: ProvenanceValue<number | null>
  lateral: ProvenanceValue<number | null>
  inputs?: Record<string, number | string | null>
  layerProfile?: Array<{
    depthFromM: number
    depthToM: number
    thicknessM: number
    midDepthM: number
    overburdenMidTm2: number | null
  }>
  endBearing?: { Qb_T: number | null; steps?: unknown[] }
  shaftFriction?: { Qs_T: number | null; steps?: unknown[] }
  ultimateVertical_T?: number | null
  ultimateUplift_T?: number | null
  steps?: Array<{
    step: number
    name: string
    formula: string
    inputs: Record<string, number | string | null>
    result: number | string | null
    unit: string
    notes?: string
  }>
  assumptions?: string[]
}

export interface PileAnalysisPlaceholder {
  codeReference?: string
  method?: string
  message?: string
  '450mm': Record<'1.0m' | '1.5m' | '2.0m', PileCellPlaceholder>
  '600mm': Record<'1.0m' | '1.5m' | '2.0m', PileCellPlaceholder>
}

export interface SoilLayerParameters {
  reportDepth: ReportDepthId
  reportDepthLabel: string
  depthFromM: number
  depthToM: number
  layerThicknessM: number
  gravelPct: ProvenanceValue<number | null>
  sandPct: ProvenanceValue<number | null>
  siltPct: ProvenanceValue<number | null>
  clayPct: ProvenanceValue<number | null>
  grainSizeSumPct: ProvenanceValue<number | null>
  liquidLimit: ProvenanceValue<number | null>
  plasticLimit: ProvenanceValue<number | null>
  plasticityIndex: ProvenanceValue<number | null>
  soilClassification: ProvenanceValue<string | null>
  classificationMethod: string
}

export interface SoilTestSummaryRecord {
  serialNumber: number
  boreholeId: string
  latitude: number
  longitude: number
  startDate: string | null
  endDate: string | null
  time: string | null
  investigationDepthM: number
  layerDepthLabel: string
  layerThicknessM: number
  gravelPct: ProvenanceValue<number | null>
  sandPct: ProvenanceValue<number | null>
  siltPct: ProvenanceValue<number | null>
  clayPct: ProvenanceValue<number | null>
  liquidLimit: ProvenanceValue<number | null>
  plasticLimit: ProvenanceValue<number | null>
  plasticityIndex: ProvenanceValue<number | null>
  soilClassification: ProvenanceValue<string | null>
  maximumDryDensityGcc: ProvenanceValue<number | null>
  optimumMoistureContentPct: ProvenanceValue<number | null>
  dryDensityGcc: ProvenanceValue<number | null>
  freeSwellingIndexPct: ProvenanceValue<number | null>
  bulkDensityGcc: ProvenanceValue<number | null>
  ucsKgCm2: ProvenanceValue<number | null>
  specificGravity: ProvenanceValue<number | null>
  sbcTm2: ProvenanceValue<number | null>
  cbrPct: ProvenanceValue<number | null>
  soilClass: ProvenanceValue<string | null>
  remarks: string
  groundWaterTableM: ProvenanceValue<number | null>
}

export interface SoilTestSummaryBundle {
  generatedAt: string
  totalRecords: number
  validationNotes: string[]
  records: SoilTestSummaryRecord[]
}

export type { BoreholeInvestigationPlan, RecommendedInvestigationPoint } from './boreholePlanning'

export interface GeotechnicalIntelligence {
  version: 'GEO-1'
  reportClassification: ReportClassification
  location: {
    lat: number
    lon: number
    elevationM: ProvenanceValue<number | null>
    slopeDeg: ProvenanceValue<number | null>
    landCover: ProvenanceValue<string | null>
    placeLabel: ProvenanceValue<string | null>
  }
  /** Texture-based screening ranges from SoilGrids (not IS 6403 calculated). */
  soilScreeningSummary?: {
    textureClass: ProvenanceValue<string | null>
    indicativeSbcTm2: ProvenanceValue<{ low: number; high: number } | null>
    indicativeCbrPct: ProvenanceValue<{ low: number; high: number } | null>
    confidencePct: ProvenanceValue<number | null>
    confidenceNote: ProvenanceValue<string | null>
    provider: string
  }
  /** Live site signals used in screening (road, water, wind, etc.). */
  siteContext?: {
    roadKm: ProvenanceValue<number | null>
    waterKm: ProvenanceValue<number | null>
    buildingKm: ProvenanceValue<number | null>
    windMs: ProvenanceValue<number | null>
  }
  soilProfile: SoilProfileInterval[]
  /** Phase C — depth-wise grain size, Atterberg limits, IS classification. */
  soilLayerParameters?: SoilLayerParameters[]
  /** Phase A — recommended GIS investigation points (not field-completed boreholes). */
  boreholeInvestigationPlan?: import('./boreholePlanning').BoreholeInvestigationPlan
  /** Phase D — reference-format soil test summary rows. */
  soilTestSummary?: SoilTestSummaryBundle
  sourceObservations: SourceLayerObservation[]
  engineeringParameters: EngineeringParameterSet
  engineeringParameterEstimation: EngineeringParameterSet
  sbcAnalysis: SbcAnalysisPlaceholder
  /** Phase E — full SBC engineering engine (per-BH depth matrix 0.5–4.0 m). */
  sbcEngineAnalysis?: import('./sbc/types').SbcEngineAnalysis
  settlementAnalysis: SettlementAnalysisPlaceholder
  pileAnalysis: PileAnalysisPlaceholder
  /** Phase F — per-BH pile matrix (450/600 mm × 1.0/1.5/2.0 m) with layer-wise capacity. */
  pileEngineAnalysis?: import('./pile/types').PileEngineAnalysis
  cbrAnalysis: CbrAnalysis
  /** Phase G — transmission access road CBR correlation (0–2 m). */
  cbrEngineAnalysis?: import('./cbr/types').CbrEngineAnalysis
  resistivityAnalysis: ResistivityAnalysis
  /** Phase G — estimated geospatial soil electrical resistivity. */
  resistivityEngineAnalysis?: import('./resistivity/types').ResistivityEngineAnalysis
  /** Phase H — soil verdict & investigation decision engine. */
  soilVerdictAnalysis?: import('./verdict/types').SoilVerdictAnalysis
  /** Central PR-1 resolved parameters — single context for all engines. */
  resolvedParameterContext?: import('./parameterResolution/parameterTypes').ResolvedParameterContext
  /** G2 — parameter completeness audit. */
  parameterCompleteness?: import('./parameterResolution/completenessEngine').ParameterCompletenessResult
  /** H2 — preliminary foundation recommendation. */
  foundationRecommendation?: import('./foundationRecommendation').FoundationRecommendation
  fieldInvestigationMatch: FieldInvestigationMatch
  dataQuality: DataQualitySummary
  limitations: string[]
  reportReadiness: ReportReadiness
  generatedAt: string
}
