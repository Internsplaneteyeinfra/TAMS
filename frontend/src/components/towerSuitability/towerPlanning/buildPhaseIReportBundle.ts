/**
 * Build Phase I report bundle from workspace state — no recalculation.
 */

import type { GeotechnicalIntelligence } from '../geotech'
import type { InvestigationGeometry } from '../geotech/boreholePlanning'
import type {
  PhaseIReportBundle,
  PowerInfrastructureSummary,
  TowerCandidate,
  TowerCandidateAnalysis,
} from './types'
import { attachPlanningGeometry, buildTowerPlanningContext } from './buildTowerPlanningContext'

export function buildPhaseIReportBundle(opts: {
  geo: GeotechnicalIntelligence
  investigationCenter: { lat: number; lon: number }
  investigationGeometry: InvestigationGeometry | null
  planningGeometry: InvestigationGeometry | null
  powerChecked: boolean
  powerSummary: PowerInfrastructureSummary | null
  towerCandidates: TowerCandidate[]
  selectedTowerAnalysis: TowerCandidateAnalysis | null
}): PhaseIReportBundle | null {
  const hasTower = opts.towerCandidates.length > 0 || opts.selectedTowerAnalysis != null
  const hasPlanning = Boolean(opts.planningGeometry)
  const hasPower = opts.powerChecked && opts.powerSummary != null
  if (!hasTower && !hasPlanning && !hasPower) return null

  let ctx = buildTowerPlanningContext(opts.geo, opts.investigationCenter, opts.investigationGeometry)
  ctx = attachPlanningGeometry(ctx, opts.planningGeometry)

  return {
    towerPlanningContext: ctx,
    powerInfrastructureSummary: hasPower ? opts.powerSummary : null,
    towerCandidates: opts.towerCandidates,
    selectedTowerAnalysis: opts.selectedTowerAnalysis,
  }
}
