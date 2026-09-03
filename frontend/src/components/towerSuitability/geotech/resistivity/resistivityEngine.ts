/**
 * Phase G — Resistivity engine orchestrator.
 */

import { fieldTestRequired, noData, provenance } from '../provenance'
import type { SoilLayerParameters } from '../types'
import { REPORT_DEPTH_INTERVALS } from '../types'
import { modelResistivityFromLayer } from './resistivityModel'
import { validateResistivityModel } from './resistivityValidation'
import type { ResistivityDepthRow, ResistivityEngineAnalysis } from './types'

const DEPTH_FACTORS = [1.0, 1.05, 1.1, 1.15]

function buildGroundingRecommendation(ohmM: number | null): import('./types').GroundingRecommendation {
  if (ohmM == null || !Number.isFinite(ohmM)) {
    return {
      category: 'MODERATE_RESISTIVITY',
      label: 'Moderate resistivity (estimate pending)',
      suitability: 'Preliminary earthing design requires field resistivity verification',
      needAdditionalElectrodes: true,
      needEnhancementMaterial: true,
      verificationRecommended: true,
      notes: ['Geospatial resistivity estimate unavailable — Wenner test recommended before earthing design'],
    }
  }
  if (ohmM < 50) {
    return {
      category: 'LOW_RESISTIVITY',
      label: 'Low resistivity',
      suitability: 'Generally favourable for earthing — verify seasonally',
      needAdditionalElectrodes: false,
      needEnhancementMaterial: false,
      verificationRecommended: true,
      notes: ['GIS estimate < 50 Ω·m — good preliminary indication; confirm by field test'],
    }
  }
  if (ohmM <= 500) {
    return {
      category: 'MODERATE_RESISTIVITY',
      label: 'Moderate resistivity',
      suitability: 'Standard earthing likely feasible with adequate electrode length',
      needAdditionalElectrodes: true,
      needEnhancementMaterial: false,
      verificationRecommended: true,
      notes: ['Typical for many Indian alluvial / mixed soils — verify before final design'],
    }
  }
  return {
    category: 'HIGH_RESISTIVITY',
    label: 'High resistivity',
    suitability: 'Enhanced earthing system likely required',
    needAdditionalElectrodes: true,
    needEnhancementMaterial: true,
    verificationRecommended: true,
    notes: ['Consider chemical earthing, deeper electrodes, or counterpoise — field verification essential'],
  }
}

export function runResistivityEngineAnalysis(opts: {
  soilLayerParameters?: SoilLayerParameters[]
  measuredOhmM?: number | null
  measuredSource?: string
}): ResistivityEngineAnalysis {
  const layers = opts.soilLayerParameters ?? []

  const measured =
    opts.measuredOhmM != null && Number.isFinite(opts.measuredOhmM)
      ? provenance(opts.measuredOhmM, {
          unit: 'Ω·m',
          source: opts.measuredSource ?? 'Field geotechnical investigation',
          method: 'Field Wenner / earth resistivity (as recorded)',
          confidence: 85,
          status: 'MEASURED',
        })
      : noData('Ω·m', 'No field Wenner / earth resistivity measurement')

  const byDepth: ResistivityDepthRow[] = REPORT_DEPTH_INTERVALS.map((iv, idx) => {
    const layer = layers.find((l) => l.reportDepth === iv.id)
    const depthFactor = DEPTH_FACTORS[idx] ?? 1.1

    if (!layer) {
      return {
        depthFromM: iv.fromM,
        depthToM: iv.toM,
        depthLabel: iv.label,
        estimatedResistivityOhmM: fieldTestRequired('Ω·m', 'Insufficient soil profile for resistivity model'),
        estimatedRangeOhmM: fieldTestRequired('Ω·m', 'Insufficient soil profile'),
        basis: 'FIELD_TEST_REQUIRED' as const,
        confidencePct: null,
        steps: [],
      }
    }

    const model = modelResistivityFromLayer(layer, depthFactor)
    const validation = validateResistivityModel(model)

    const steps = [
      {
        step: 1,
        name: 'Input data sources',
        formula: 'Shared Phase C grain size fractions',
        inputs: { sand: layer.sandPct.value, silt: layer.siltPct.value, clay: layer.clayPct.value },
        result: null,
        unit: '—',
      },
      {
        step: 2,
        name: 'Resistivity model',
        formula: model.method,
        inputs: { depthFactor },
        result: `≈ ${model.midOhmM} Ω·m`,
        unit: 'Ω·m',
      },
      {
        step: 3,
        name: 'Depth modulation',
        formula: 'DEPTH MODELLED ESTIMATE — not independently measured per layer',
        inputs: { depthLabel: iv.label, factor: depthFactor },
        result: 'Applied',
        unit: '—',
      },
    ]

    if (!validation.passed) {
      return {
        depthFromM: iv.fromM,
        depthToM: iv.toM,
        depthLabel: iv.label,
        estimatedResistivityOhmM: fieldTestRequired('Ω·m', validation.message),
        estimatedRangeOhmM: fieldTestRequired('Ω·m', validation.message),
        basis: 'FIELD_TEST_REQUIRED',
        confidencePct: null,
        steps,
      }
    }

    return {
      depthFromM: iv.fromM,
      depthToM: iv.toM,
      depthLabel: iv.label,
      estimatedResistivityOhmM: provenance(model.midOhmM, {
        unit: 'Ω·m',
        source: 'Estimated Geospatial Soil Electrical Resistivity Assessment',
        method: model.method,
        confidence: model.confidence,
        status: 'MODEL_PREDICTED',
        engineeringLimitation: 'DEPTH MODELLED ESTIMATE — not field Wenner measurement',
      }),
      estimatedRangeOhmM: provenance(
        { low: model.lowOhmM, high: model.highOhmM },
        {
          unit: 'Ω·m',
          source: 'Geospatial resistivity model range',
          method: '±25% model uncertainty band',
          confidence: model.confidence,
          status: 'MODEL_PREDICTED',
        }
      ),
      basis: 'DEPTH_MODELLED_ESTIMATE',
      confidencePct: model.confidence,
      steps,
    }
  })

  const calculated = byDepth.filter((d) => d.estimatedResistivityOhmM.value != null)
  const surface = byDepth[0]
  const siteMid = surface?.estimatedResistivityOhmM.value ?? null
  const siteRange = surface?.estimatedRangeOhmM.value ?? null

  const calcStatus =
    calculated.length === 4 ? 'CALCULATED' : calculated.length > 0 ? 'PARTIAL' : 'FIELD_TEST_REQUIRED'

  const adoptedOhm = (measured.value as number | null) ?? siteMid

  return {
    version: 'RES-G1',
    assessmentTitle: 'Estimated Geospatial Soil Electrical Resistivity Assessment',
    calculationStatus: calcStatus,
    message:
      calculated.length > 0
        ? `Modelled resistivity for ${calculated.length}/4 depth layers. Not an earth resistivity test result.`
        : 'Field Wenner / resistivity test required — no defensible geospatial estimate',
    measured,
    siteEstimateOhmM:
      siteMid != null
        ? provenance(siteMid, {
            unit: 'Ω·m',
            source: 'Geospatial model (0–0.5 m representative)',
            method: 'Rounded model estimate — avoid false lab precision',
            confidence: surface?.confidencePct ?? 32,
            status: 'MODEL_PREDICTED',
          })
        : fieldTestRequired('Ω·m', 'No modelled site resistivity'),
    siteEstimateRangeOhmM:
      siteRange != null
        ? provenance(siteRange, {
            unit: 'Ω·m',
            source: 'Geospatial model uncertainty band',
            method: 'Low–high range for screening',
            confidence: surface?.confidencePct ?? 32,
            status: 'MODEL_PREDICTED',
          })
        : fieldTestRequired('Ω·m', 'No modelled range'),
    confidencePct: surface?.confidencePct ?? null,
    byDepth,
    groundingRecommendation: buildGroundingRecommendation(adoptedOhm),
    fieldVerificationRequired: [
      'Wenner four-electrode or equivalent field measurement recommended before earthing design.',
      'Model does not include moisture, salinity, or temperature — major resistivity controls.',
      'Depth-wise values are DEPTH MODELLED ESTIMATES from surface soil fractions — not measured profiles.',
    ],
    validationNotes: [
      'Never labelled as Earth Resistivity Test Result unless MEASURED field data uploaded.',
      'Values rounded to nearest 5 Ω·m to avoid false laboratory precision.',
      'Uses shared Phase C soil profile — no independent clay/sand derivation.',
    ],
  }
}

export function toLegacyResistivityAnalysis(engine: ResistivityEngineAnalysis) {
  return {
    measured: engine.measured,
    estimated: engine.siteEstimateOhmM,
    layers: engine.byDepth.map((d) => ({
      depthFromM: d.depthFromM,
      depthToM: d.depthToM,
      resistivity: d.estimatedResistivityOhmM,
    })),
  }
}
