/**
 * Phase H — Earthing / resistivity verdict (consumes Phase G resistivity output).
 */

import type { GeotechnicalIntelligence } from '../types'
import { provenancePhrase, verdictToColor, confidenceFromScore } from './adapters'
import type { DimensionVerdict } from './types'

export function evaluateResistivityVerdict(geo: GeotechnicalIntelligence): DimensionVerdict {
  const res = geo.resistivityEngineAnalysis
  const trace = [] as DimensionVerdict['evidenceTrace']

  if (!res) {
    return {
      dimension: 'ELECTRICAL_EARTHING',
      status: 'INSUFFICIENT_DATA',
      color: 'GREY',
      evidenceStrength: 'LEVEL_4_ASSUMED_UNKNOWN',
      confidence: 'VERY_LOW',
      supportingEvidence: [],
      uncertainties: ['Resistivity assessment not available'],
      requiredNextAction: 'Complete soil profile for geospatial resistivity model',
      evidenceTrace: trace,
    }
  }

  const hasMeasured = res.measured.status === 'MEASURED'
  const modelledOnly = !hasMeasured && res.siteEstimateOhmM.status === 'MODEL_PREDICTED'
  const modelled = res.byDepth.filter((d) => d.basis === 'DEPTH_MODELLED_ESTIMATE')
  const highUncertainty = res.confidencePct != null && res.confidencePct < 40

  let verdictStatus: DimensionVerdict['status'] = 'INSUFFICIENT_DATA'
  if (hasMeasured && geo.fieldInvestigationMatch.usedForMeasuredParams)
    verdictStatus = 'PRELIMINARILY_SUPPORTIVE'
  else if (modelledOnly) verdictStatus = 'INVESTIGATION_REQUIRED'
  else if (highUncertainty) verdictStatus = 'INVESTIGATION_REQUIRED'
  else verdictStatus = 'CONDITIONALLY_SUPPORTIVE'

  const range = res.siteEstimateRangeOhmM.value
  const rangeStr =
    range && typeof range === 'object' ? `${range.low}–${range.high} Ω·m` : null

  return {
    dimension: 'ELECTRICAL_EARTHING',
    status: verdictStatus,
    color: verdictToColor(verdictStatus),
    evidenceStrength: hasMeasured ? 'LEVEL_1_MEASURED' : modelled.length ? 'LEVEL_3_MODELLED_GEOSPATIAL' : 'LEVEL_4_ASSUMED_UNKNOWN',
    confidence: confidenceFromScore(hasMeasured ? 82 : res.confidencePct ?? 30),
    supportingEvidence: [
      hasMeasured
        ? `Measured Wenner resistivity: ${res.measured.value} Ω·m (${geo.fieldInvestigationMatch.siteCode ?? 'field data'})`
        : res.siteEstimateOhmM.value != null
          ? `Indicative geospatial estimate only: ≈ ${res.siteEstimateOhmM.value} Ω·m${rangeStr ? ` (range ${rangeStr})` : ''}`
          : '',
    ].filter(Boolean),
    uncertainties: [
      modelledOnly
        ? 'DEPTH MODELLED ESTIMATE — not independently measured per layer'
        : '',
      'Model does not include moisture, salinity, or temperature',
      !geo.fieldInvestigationMatch.usedForMeasuredParams && hasMeasured
        ? 'Nearest measured resistivity is too distant to transfer to this site'
        : '',
    ].filter(Boolean),
    requiredNextAction: modelledOnly
      ? 'Site-specific field resistivity testing is required before final earthing design'
      : hasMeasured
        ? 'Verify earthing design against measured resistivity and seasonal variation'
        : provenancePhrase('FIELD_TEST_REQUIRED') + ' final earthing design',
    evidenceTrace: trace,
  }
}

export function evaluateGroundwaterVerdict(geo: GeotechnicalIntelligence): DimensionVerdict {
  const gwtMeasured = geo.soilTestSummary?.records.some(
    (r) => r.groundWaterTableM.status === 'MEASURED' && r.groundWaterTableM.value != null
  )
  const note = geo.fieldInvestigationMatch.usedForMeasuredParams

  let verdictStatus: DimensionVerdict['status'] = 'INVESTIGATION_REQUIRED'
  if (gwtMeasured) verdictStatus = 'CONDITIONALLY_SUPPORTIVE'

  return {
    dimension: 'GROUNDWATER',
    status: verdictStatus,
    color: verdictToColor(verdictStatus),
    evidenceStrength: gwtMeasured ? 'LEVEL_1_MEASURED' : 'LEVEL_4_ASSUMED_UNKNOWN',
    confidence: gwtMeasured ? 'MODERATE' : 'VERY_LOW',
    supportingEvidence: gwtMeasured ? ['Groundwater table recorded from field investigation'] : [],
    uncertainties: [
      'Groundwater depth cannot be measured remotely',
      note ? '' : 'No same-site field groundwater observation',
    ].filter(Boolean),
    requiredNextAction: 'Observe groundwater level during borehole investigation',
    evidenceTrace: [],
  }
}

export function evaluateSoilDataConfidenceVerdict(geo: GeotechnicalIntelligence): DimensionVerdict {
  const layers = geo.soilLayerParameters ?? []
  const hasProfile = geo.soilProfile.length >= 4
  const hasGrain = layers.every(
    (l) => l.sandPct.value != null && l.clayPct.value != null && l.siltPct.value != null
  )
  const hasClass = layers.every((l) => l.soilClassification.value != null)
  const fieldMatch = geo.fieldInvestigationMatch.usedForMeasuredParams

  let verdictStatus: DimensionVerdict['status'] = 'INSUFFICIENT_DATA'
  if (!hasProfile || layers.length === 0) verdictStatus = 'INSUFFICIENT_DATA'
  else if (fieldMatch && hasGrain && hasClass) verdictStatus = 'PRELIMINARILY_SUPPORTIVE'
  else if (hasGrain && hasClass) verdictStatus = 'CONDITIONALLY_SUPPORTIVE'
  else verdictStatus = 'INVESTIGATION_REQUIRED'

  const completeness = [hasProfile, hasGrain, hasClass, fieldMatch].filter(Boolean).length
  const score = (completeness / 4) * 100

  return {
    dimension: 'SOIL_DATA_CONFIDENCE',
    status: verdictStatus,
    color: verdictToColor(verdictStatus),
    evidenceStrength: fieldMatch ? 'LEVEL_1_MEASURED' : hasGrain ? 'LEVEL_3_MODELLED_GEOSPATIAL' : 'LEVEL_4_ASSUMED_UNKNOWN',
    confidence: confidenceFromScore(score),
    supportingEvidence: [
      hasProfile ? `Soil profile to 2.0 m (${geo.soilProfile.length} intervals)` : '',
      hasGrain ? 'Grain size fractions normalised from SoilGrids' : '',
      hasClass ? 'IS 1498 preliminary classification from Phase C' : '',
      fieldMatch ? `Same-site field investigation matched (${geo.fieldInvestigationMatch.siteCode})` : '',
    ].filter(Boolean),
    uncertainties: [
      !fieldMatch ? 'No same-site borehole or laboratory test data' : '',
      'Atterberg limits are correlated — not laboratory tested',
      'Remote sensing cannot replace field soil investigation',
    ].filter(Boolean),
    requiredNextAction: fieldMatch
      ? 'Supplement with additional laboratory tests as needed'
      : 'Commission borehole investigation at proposed GIS investigation points',
    evidenceTrace: [],
  }
}
