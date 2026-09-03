/**
 * Phase H — conflict detection across Phase A–G modules.
 */

import type { GeotechnicalIntelligence } from '../types'
import type { ConflictRecord, DimensionVerdict } from './types'

export function detectConflicts(
  geo: GeotechnicalIntelligence,
  dimensions: {
    foundation: DimensionVerdict
    pile: DimensionVerdict
    accessRoad: DimensionVerdict
    earthing: DimensionVerdict
  }
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = []
  const layers = geo.soilLayerParameters ?? []
  const sbc = geo.sbcEngineAnalysis
  const cbr = geo.cbrEngineAnalysis
  const res = geo.resistivityEngineAnalysis

  const avgClay =
    layers.length > 0
      ? layers.reduce((s, l) => s + (l.clayPct.value ?? 0), 0) / layers.length
      : null
  const sbcVal = sbc?.siteSummary.adoptedPreliminary.value
  const cbrMin = cbr?.byDepth
    .filter((d) => d.correlatedCbrPct.value != null)
    .map((d) => d.correlatedCbrPct.value as number)
  const minCbr = cbrMin?.length ? Math.min(...cbrMin) : null

  if (avgClay != null && avgClay >= 25 && sbcVal != null && sbcVal > 15) {
    conflicts.push({
      id: 'CLAY_HIGH_SBC',
      severity: 'MEDIUM',
      affectedModules: ['Foundation (SBC)', 'Soil Classification'],
      explanation: `High average clay content (${avgClay.toFixed(0)}%) but correlated SBC (${sbcVal} T/m²) is unusually high without laboratory cohesion verification`,
      requiredResolution: 'Verify shear strength and cohesion by borehole testing before adopting SBC',
    })
  }

  if (avgClay != null && avgClay >= 20 && minCbr != null && minCbr > 12) {
    conflicts.push({
      id: 'CLAY_HIGH_CBR',
      severity: 'MEDIUM',
      affectedModules: ['CBR', 'Soil Classification'],
      explanation: `Clay-dominated profile (${avgClay.toFixed(0)}% clay) but correlated minimum CBR (${minCbr}%) is high for clay soils`,
      requiredResolution: 'Field soaked CBR test required to resolve texture-CBR inconsistency',
    })
  }

  if (
    dimensions.foundation.confidence === 'LOW' &&
    sbc?.calculationStatus === 'CALCULATED' &&
    (sbc.siteSummary.confidencePct ?? 0) > 60
  ) {
    conflicts.push({
      id: 'LOW_CONFIDENCE_HIGH_SBC',
      severity: 'LOW',
      affectedModules: ['Foundation', 'Soil Data Confidence'],
      explanation: 'Foundation module reports calculated SBC but overall soil data confidence is low — correlated inputs dominate',
      requiredResolution: 'Treat SBC as preliminary screening only until field verification',
    })
  }

  if (
    res?.measured.status === 'MEASURED' &&
    res.siteEstimateOhmM.value != null &&
    typeof res.measured.value === 'number'
  ) {
    const measured = res.measured.value
    const modelled = res.siteEstimateOhmM.value
    const pctDiff = Math.abs(measured - modelled) / measured
    if (pctDiff > 0.5) {
      conflicts.push({
        id: 'RESISTIVITY_MODEL_VS_MEASURED',
        severity: 'HIGH',
        affectedModules: ['Resistivity', 'Earthing'],
        explanation: `Modelled resistivity (≈${modelled} Ω·m) differs significantly from measured Wenner value (${measured} Ω·m)`,
        requiredResolution: 'Use measured Wenner data for earthing design; do not rely on geospatial model at this site',
      })
    }
  }

  const textures = new Set(layers.map((l) => l.soilClassification.value).filter(Boolean))
  if (textures.size > 2 && sbc?.calculationStatus === 'CALCULATED') {
    conflicts.push({
      id: 'CLASSIFICATION_VARIABILITY',
      severity: 'LOW',
      affectedModules: ['Soil Classification', 'Foundation'],
      explanation: `Multiple soil classifications across 0–2 m (${[...textures].join(', ')}) — layer-wise foundation design may be required`,
      requiredResolution: 'Confirm layer boundaries by borehole logging',
    })
  }

  return conflicts
}
