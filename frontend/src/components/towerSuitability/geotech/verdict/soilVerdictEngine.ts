/**
 * Phase H — Soil Verdict & Investigation Decision orchestrator.
 */

import type { GeotechnicalIntelligence } from '../types'
import { calculateOverallConfidence } from './calculateConfidence'
import { detectConflicts } from './detectConflicts'
import { evaluateEvidence } from './evaluateEvidence'
import { evaluateCbrVerdict } from './evaluateCbrVerdict'
import { evaluateFoundationVerdict } from './evaluateFoundationVerdict'
import { evaluatePileVerdict } from './evaluatePileVerdict'
import {
  evaluateGroundwaterVerdict,
  evaluateResistivityVerdict,
  evaluateSoilDataConfidenceVerdict,
} from './evaluateResistivityVerdict'
import { investigationUrgencyFrom, planInvestigations } from './investigationPlanner'
import {
  buildOverallInvestigationVerdict,
  computeDesignStageDecisions,
  computeOverallVerdict,
} from './overallVerdict'
import type { SoilVerdictAnalysis } from './types'
import { collectValidationGates } from './validation'

export function runSoilVerdictAnalysis(geo: GeotechnicalIntelligence): SoilVerdictAnalysis {
  const evidence = evaluateEvidence(geo)
  const gates = collectValidationGates(geo)

  const foundation = evaluateFoundationVerdict(geo)
  const pile = evaluatePileVerdict(geo)
  const accessRoad = evaluateCbrVerdict(geo)
  const earthing = evaluateResistivityVerdict(geo)
  const groundwater = evaluateGroundwaterVerdict(geo)
  const soilDataConfidence = evaluateSoilDataConfidenceVerdict(geo)

  const dimensions = {
    foundation,
    pile,
    accessRoad,
    earthing,
    groundwater,
    soilDataConfidence,
    overallInvestigation: {} as SoilVerdictAnalysis['dimensions']['overallInvestigation'],
  }

  const conflicts = detectConflicts(geo, { foundation, pile, accessRoad, earthing })
  const confidence = calculateOverallConfidence(
    evidence,
    [foundation, pile, accessRoad, earthing, groundwater, soilDataConfidence],
    conflicts,
    geo.dataQuality?.overallConfidence ?? 40
  )

  const investigationPriorities = planInvestigations(geo, dimensions, gates)
  const investigationUrgency = investigationUrgencyFrom(
    [foundation, pile, accessRoad, earthing, groundwater, soilDataConfidence],
    investigationPriorities
  )

  dimensions.overallInvestigation = buildOverallInvestigationVerdict(
    investigationUrgency,
    investigationPriorities
  )

  const overall = computeOverallVerdict(
    dimensions,
    gates,
    conflicts,
    confidence,
    evidence,
    investigationUrgency,
    investigationPriorities
  )

  const hasMeasuredField = geo.fieldInvestigationMatch.usedForMeasuredParams
  const designStageDecisions = computeDesignStageDecisions(overall, dimensions, hasMeasuredField)

  const whatWeKnow = {
    measured: evidence.measured.map((e) => `${e.parameter}: ${e.value ?? '—'} (${e.provenance})`),
    correlated: evidence.correlated.map((e) => `${e.parameter}: ${e.value ?? '—'} (${e.provenance})`),
    modelled: evidence.modelled.map((e) => `${e.parameter}: ${e.value ?? '—'} (${e.provenance})`),
  }

  const nextActions = [
    ...new Set([
      foundation.requiredNextAction,
      pile.requiredNextAction,
      accessRoad.requiredNextAction,
      earthing.requiredNextAction,
      groundwater.requiredNextAction,
      ...investigationPriorities.filter((p) => p.mandate === 'MANDATORY').map((p) => p.investigationType),
    ]),
  ]

  return {
    version: 'VERDICT-H1',
    generatedAt: new Date().toISOString(),
    overall,
    dimensions,
    evidenceSummary: evidence,
    whatWeKnow,
    whatWeDoNotKnow: [...evidence.missing, ...evidence.unknown],
    conflicts,
    validationGates: gates,
    investigationPriorities,
    designStageDecisions,
    nextActions,
    limitations: [
      'Phase H provides engineering decision support — not automated engineering certification.',
      'Verdicts preserve provenance hierarchy: measured ≠ correlated ≠ modelled.',
      'A positive preliminary verdict does not imply HIGH confidence or final design approval.',
      'Mandatory validation gate failures cannot be overridden by positive results in other modules.',
      'Construction suitability is NOT ASSESSABLE from geospatial screening alone.',
    ],
  }
}
