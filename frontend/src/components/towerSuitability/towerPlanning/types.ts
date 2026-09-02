/**
 * Phase I — Tower Intelligence & Soil-to-Tower Handoff types.
 */

import type { InvestigationGeometry } from '../geotech/boreholePlanning'
import type { GeotechnicalIntelligence } from '../geotech'
import type { SoilVerdictAnalysis } from '../geotech/verdict/types'
import type { KmlFeature } from '../fetchSiteSignals'
import type { NearbyPowerSupply } from '../nearbyPowerSupply'
import type { SuitabilityResult } from '../scoring'
import type { PlacementVerdict } from '../corridorPlacementAdvice'

export type PowerInfrastructureStatus = 'GIS_DETECTED' | 'MODELLED' | 'VERIFICATION_REQUIRED' | 'NOT_DETECTED'

export interface PowerInfrastructureSummary {
  nearestLabel: string
  infrastructureType: string
  distanceKm: number | null
  direction: string | null
  source: string
  method: string
  confidence: 'HIGH' | 'MODERATE' | 'LOW'
  status: PowerInfrastructureStatus
  message: string
  raw: NearbyPowerSupply | null
}

export interface TowerPlanningContext {
  investigationCenter: { lat: number; lon: number }
  investigationGeometry: InvestigationGeometry | null
  planningGeometry: InvestigationGeometry | null
  soilVerdict: SoilVerdictAnalysis | null
  boreholePlanSummary: string | null
  sbcSummary: string | null
  pileSummary: string | null
  cbrSummary: string | null
  resistivitySummary: string | null
  mandatoryInvestigations: string[]
  preliminaryPlanningOnly: boolean
}

export type TowerCandidateRecommendation =
  | 'RECOMMENDED_FOR_PRELIMINARY_ASSESSMENT'
  | 'CONDITIONALLY_SUITABLE'
  | 'REQUIRES_REVIEW'
  | 'NOT_RECOMMENDED'

export interface TowerCandidate {
  id: string
  index: number
  latitude: number
  longitude: number
  suitabilityScore: number
  soilVerdictStatus: string
  terrainScore: number | null
  slopeScore: number | null
  accessibilityScore: number | null
  powerInfrastructureStatus: PowerInfrastructureStatus
  distanceToInfrastructureKm: number | null
  placementVerdict: PlacementVerdict | null
  constraints: string[]
  recommendation: TowerCandidateRecommendation
  dataConfidence: 'HIGH' | 'MODERATE' | 'LOW'
  provenance: {
    scoringStatus: 'PRELIMINARY_ASSESSMENT'
    source: string
  }
  /** Rainbow map marker color */
  colorHex?: string
  colorLabel?: string
  recommendedKv?: number | null
  recommendedTowerType?: string | null
  recommendedFoundation?: string | null
}

export interface TowerCandidateAnalysis {
  candidate: TowerCandidate
  suitability: SuitabilityResult
  geotechnicalContext: GeotechnicalIntelligence
  finalStatus: 'PRELIMINARY_RECOMMENDATION'
  mandatoryInvestigations: string[]
  analyzedAt: string
}

export interface PhaseIReportBundle {
  towerPlanningContext: TowerPlanningContext
  powerInfrastructureSummary: PowerInfrastructureSummary | null
  towerCandidates: TowerCandidate[]
  selectedTowerAnalysis: TowerCandidateAnalysis | null
}

export interface PhaseIPlanningState {
  investigationKmlFeatures: KmlFeature[]
  planningKmlFeatures: KmlFeature[]
  powerInfrastructureChecked: boolean
  powerInfrastructureResult: PowerInfrastructureSummary | null
  towerCandidates: TowerCandidate[]
  selectedTowerCandidateId: string | null
  towerAnalysisResult: TowerCandidateAnalysis | null
  towerAnalysisLoading: boolean
}
