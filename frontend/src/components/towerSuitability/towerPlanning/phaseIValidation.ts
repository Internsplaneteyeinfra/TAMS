/**
 * Phase I — workflow validation gates.
 */

import type { KmlFeature } from '../fetchSiteSignals'
import type { PowerInfrastructureSummary, TowerCandidate } from './types'

export function canCreatePlanningGeometry(hasVerdict: boolean): boolean {
  return hasVerdict
}

export function canCheckPowerInfrastructure(planningKmlFeatures: KmlFeature[]): boolean {
  return planningKmlFeatures.length > 0
}

export function canGenerateTowerSuggestions(
  planningKmlFeatures: KmlFeature[],
  powerInfrastructureChecked: boolean
): boolean {
  return planningKmlFeatures.length > 0 && powerInfrastructureChecked
}

export function canRunTowerAnalysis(candidate: TowerCandidate | null): boolean {
  return candidate != null
}

export function isApprovedForConstruction(recommendation: string): boolean {
  return /APPROVED\s+FOR\s+CONSTRUCTION/i.test(recommendation)
}

export function validatePhaseIWorkflow(state: {
  planningKmlFeatures: KmlFeature[]
  powerInfrastructureChecked: boolean
  powerResult: PowerInfrastructureSummary | null
}): string[] {
  const errors: string[] = []
  if (!state.planningKmlFeatures.length) {
    errors.push('Planning geometry required before tower suggestions')
  }
  if (!state.powerInfrastructureChecked) {
    errors.push('Power infrastructure must be checked explicitly before tower suggestions')
  }
  return errors
}
