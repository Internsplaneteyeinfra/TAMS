/**
 * Phase I — build planning context from existing Phase A–H outputs (no recalculation).
 */

import type { GeotechnicalIntelligence } from '../geotech'
import type { InvestigationGeometry } from '../geotech/boreholePlanning'
import { formatVerdictLabel } from '../geotech/verdict'
import type { TowerPlanningContext } from './types'

export function buildTowerPlanningContext(
  geo: GeotechnicalIntelligence,
  investigationCenter: { lat: number; lon: number },
  investigationGeometry: InvestigationGeometry | null
): TowerPlanningContext {
  const verdict = geo.soilVerdictAnalysis ?? null
  const sbc = geo.sbcEngineAnalysis
  const pile = geo.pileEngineAnalysis
  const cbr = geo.cbrEngineAnalysis
  const res = geo.resistivityEngineAnalysis

  const mandatory =
    verdict?.investigationPriorities.filter((p) => p.mandate === 'MANDATORY').map((p) => p.investigationType) ??
    []

  return {
    investigationCenter,
    investigationGeometry,
    planningGeometry: null,
    soilVerdict: verdict,
    boreholePlanSummary: geo.boreholeInvestigationPlan
      ? `${geo.boreholeInvestigationPlan.totalPoints} proposed GIS investigation point(s)`
      : null,
    sbcSummary: sbc
      ? `${sbc.calculationStatus} — ${sbc.siteSummary.adoptedPreliminary.value ?? '—'} T/m²`
      : null,
    pileSummary: pile ? `${pile.calculationStatus} — ${pile.message}` : null,
    cbrSummary: cbr
      ? `${cbr.calculationStatus} — design CBR ${cbr.recommendedDesignCbr.value ?? 'FIELD TEST REQUIRED'}%`
      : null,
    resistivitySummary: res
      ? `${res.assessmentTitle} — ≈ ${res.siteEstimateOhmM.value ?? '—'} Ω·m`
      : null,
    mandatoryInvestigations: mandatory,
    preliminaryPlanningOnly: verdict?.overall.investigationRequired ?? true,
  }
}

export function attachPlanningGeometry(
  ctx: TowerPlanningContext,
  planningGeometry: InvestigationGeometry | null
): TowerPlanningContext {
  return { ...ctx, planningGeometry }
}

export function soilVerdictLabelForCandidate(geo: GeotechnicalIntelligence): string {
  const v = geo.soilVerdictAnalysis
  if (!v) return 'NOT_ASSESSABLE'
  return formatVerdictLabel(v.overall.status)
}
