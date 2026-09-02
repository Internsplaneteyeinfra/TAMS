/**
 * J3 — Central handoff object for geotechnical → tower workflow.
 */

import type { NearbyPowerSupply } from './nearbyPowerSupply'
import type {
  BoreholeInvestigationPlan,
  GeotechnicalIntelligence,
  InvestigationGeometry,
} from './geotech'
import type { ResolvedParameterContext } from './geotech/parameterResolution/parameterTypes'
import type { FoundationRecommendation } from './geotech/foundationRecommendation'
import type { ParameterCompletenessResult } from './geotech/parameterResolution/completenessEngine'
import type { TowerCandidate, TowerCandidateAnalysis, PowerInfrastructureSummary } from './towerPlanning'

export interface ProjectAnalysisContext {
  projectId: string | null
  generatedAt: string
  investigationGeometry: InvestigationGeometry | null
  selectedCoordinate: { lat: number; lon: number }
  siteSignals: import('../scoring').SiteSignals | null
  boreholePlan: BoreholeInvestigationPlan | null
  geotechnicalIntelligence: GeotechnicalIntelligence
  resolvedParameterContext: ResolvedParameterContext | null
  parameterCompleteness: ParameterCompletenessResult | null
  foundationRecommendation: FoundationRecommendation | null
  powerInfrastructure: {
    checked: boolean
    raw: NearbyPowerSupply | null
    summary: PowerInfrastructureSummary | null
  }
  towerCandidates: TowerCandidate[]
  selectedTowerCandidate: TowerCandidate | null
  towerAnalysis: TowerCandidateAnalysis | null
}

export function buildProjectAnalysisContext(opts: {
  geo: GeotechnicalIntelligence
  lat: number
  lon: number
  investigationGeometry?: InvestigationGeometry | null
  projectId?: string | null
  parameterCompleteness?: ParameterCompletenessResult | null
  foundationRecommendation?: FoundationRecommendation | null
  powerChecked?: boolean
  powerRaw?: NearbyPowerSupply | null
  powerSummary?: PowerInfrastructureSummary | null
  towerCandidates?: TowerCandidate[]
  selectedTowerCandidate?: TowerCandidate | null
  towerAnalysis?: TowerCandidateAnalysis | null
  siteSignals?: import('./scoring').SiteSignals | null
}): ProjectAnalysisContext {
  return {
    projectId: opts.projectId ?? null,
    generatedAt: new Date().toISOString(),
    investigationGeometry: opts.investigationGeometry ?? null,
    selectedCoordinate: { lat: opts.lat, lon: opts.lon },
    siteSignals: opts.siteSignals ?? null,
    boreholePlan: opts.geo.boreholeInvestigationPlan ?? null,
    geotechnicalIntelligence: opts.geo,
    resolvedParameterContext: opts.geo.resolvedParameterContext ?? null,
    parameterCompleteness: opts.parameterCompleteness ?? null,
    foundationRecommendation: opts.foundationRecommendation ?? null,
    powerInfrastructure: {
      checked: opts.powerChecked ?? false,
      raw: opts.powerRaw ?? null,
      summary: opts.powerSummary ?? null,
    },
    towerCandidates: opts.towerCandidates ?? [],
    selectedTowerCandidate: opts.selectedTowerCandidate ?? null,
    towerAnalysis: opts.towerAnalysis ?? null,
  }
}
