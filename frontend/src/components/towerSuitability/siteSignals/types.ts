import type { SignalResult } from './signalResolver'

export type TerrainClass = 'FLAT' | 'GENTLE' | 'MODERATE' | 'STEEP' | 'RUGGED'

export interface TerrainAnalysisResult {
  elevationM: number | null
  slopeDeg: number | null
  aspectDeg: number | null
  aspectLabel: string
  terrainClass: TerrainClass
  drainageDirection: string
  relativeDepressionM: number | null
  confidence: number
  source: string
  method: string
}

export type WaterBodyType = 'river' | 'stream' | 'canal' | 'lake' | 'reservoir' | 'wetland' | 'water' | 'unknown'

export type WaterRiskLevel = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'

export interface WaterAnalysisResult {
  nearestDistanceM: number | null
  waterType: WaterBodyType
  waterRisk: WaterRiskLevel
  drainageDirection: string
  sources: string[]
  confidence: number
  signal: SignalResult<number>
}

export type FloodRiskLevel = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'

export interface FloodAnalysisResult {
  score: number
  risk: FloodRiskLevel
  liveForecastAvailable: boolean
  liveForecastStatus: string
  historicalExposure: string
  riverDistanceM: number | null
  terrainDrainageRisk: string
  relativeElevationRisk: string
  reasoning: string
  confidence: number
  sources: string[]
  lastUpdated: string
}

export interface SettlementAnalysisResult {
  nearestSettlementM: number | null
  buildingDensity: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH'
  residentialConflict: 'LOW' | 'MODERATE' | 'HIGH'
  towerImpact: 'GOOD' | 'FAIR' | 'CONSTRAINED'
  confidence: number
  sources: string[]
}

export type LandCoverClass =
  | 'barren'
  | 'agriculture'
  | 'forest'
  | 'urban'
  | 'water'
  | 'scrubland'
  | 'rocky'
  | 'wetland'
  | 'unknown'

export interface LandCoverAnalysisResult {
  dominant: LandCoverClass
  hint: 'barren' | 'vegetation' | 'built' | 'water' | 'unknown'
  constraintLevel: 'LOW' | 'MODERATE' | 'HIGH'
  towerSuitabilityImpact: string
  confidence: number
  source: string
}

export interface SiteSignalsEnrichment {
  terrain: TerrainAnalysisResult | null
  water: WaterAnalysisResult | null
  flood: FloodAnalysisResult | null
  settlement: SettlementAnalysisResult | null
  landCover: LandCoverAnalysisResult | null
}
