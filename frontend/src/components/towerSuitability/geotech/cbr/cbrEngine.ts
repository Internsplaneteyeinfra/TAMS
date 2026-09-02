/**
 * Phase G — CBR engine orchestrator.
 */

import { fieldTestRequired, noData, provenance } from '../provenance'
import type { ReportDepthId, SoilLayerParameters, SoilProfileInterval } from '../types'
import { REPORT_DEPTH_INTERVALS } from '../types'
import { correlateCbrFromLayer } from './cbrCorrelation'
import { validateCbrCorrelation } from './cbrValidation'
import type { CbrCalculationStep, CbrDepthRow, CbrEngineAnalysis } from './types'

function buildSteps(layer: SoilLayerParameters, corr: ReturnType<typeof correlateCbrFromLayer>): CbrCalculationStep[] {
  return [
    {
      step: 1,
      name: 'Soil classification',
      formula: 'IS 1498 preliminary from Phase C inputs',
      inputs: { classification: layer.soilClassification.value },
      result: layer.soilClassification.value,
      unit: '—',
    },
    {
      step: 2,
      name: 'Grain size parameters',
      formula: 'G + Sa + Si + Cl from shared soil profile',
      inputs: {
        gravel: layer.gravelPct.value,
        sand: layer.sandPct.value,
        silt: layer.siltPct.value,
        clay: layer.clayPct.value,
      },
      result: null,
      unit: '%',
    },
    {
      step: 3,
      name: 'Plasticity parameters',
      formula: 'PI = LL − PL (Phase C calculated)',
      inputs: { LL: layer.liquidLimit.value, PL: layer.plasticLimit.value, PI: layer.plasticityIndex.value },
      result: layer.plasticityIndex.value,
      unit: '%',
    },
    {
      step: 4,
      name: 'Applicable correlation',
      formula: corr.method,
      inputs: { correlationReference: corr.correlationReference },
      result: `${corr.lowPct}–${corr.highPct}%`,
      unit: '%',
    },
    {
      step: 5,
      name: 'Calculated CBR (mid)',
      formula: 'Texture base × PI/clay adjustment factor',
      inputs: { midPct: corr.midPct },
      result: corr.midPct,
      unit: '%',
    },
    {
      step: 6,
      name: 'Validation range',
      formula: 'Screening range 2–30% for access road correlation',
      inputs: { low: corr.lowPct, high: corr.highPct },
      result: 'PASS',
      unit: '—',
    },
  ]
}

export function runCbrEngineAnalysis(opts: {
  soilProfile: SoilProfileInterval[]
  soilLayerParameters?: SoilLayerParameters[]
  measuredByDepth?: Partial<Record<ReportDepthId, number>>
}): CbrEngineAnalysis {
  const layers = opts.soilLayerParameters ?? []
  const byDepth: CbrDepthRow[] = REPORT_DEPTH_INTERVALS.map((iv) => {
    const layer = layers.find((l) => l.reportDepth === iv.id)
    const prof = opts.soilProfile.find((p) => p.reportDepth === iv.id)

    if (!layer) {
      return {
        reportDepth: iv.id,
        reportDepthLabel: iv.label,
        depthFromM: iv.fromM,
        depthToM: iv.toM,
        soilClassification: prof?.usdaTexture.value ?? null,
        pi: null,
        correlatedCbrPct: fieldTestRequired('%', 'No Phase C layer parameters for CBR correlation'),
        cbrRangePct: noData('%', 'Layer parameters unavailable'),
        method: '—',
        correlationReference: '—',
        confidencePct: null,
        steps: [],
        validationNote: 'FIELD_TEST_REQUIRED — insufficient shared soil profile',
      }
    }

    const corr = correlateCbrFromLayer(layer)
    const validation = validateCbrCorrelation(corr)
    const steps = buildSteps(layer, corr)

    if (!validation.passed) {
      return {
        reportDepth: iv.id,
        reportDepthLabel: iv.label,
        depthFromM: iv.fromM,
        depthToM: iv.toM,
        soilClassification: layer.soilClassification.value,
        pi: layer.plasticityIndex.value,
        correlatedCbrPct: fieldTestRequired('%', validation.message),
        cbrRangePct: fieldTestRequired('%', validation.message),
        method: corr.method,
        correlationReference: corr.correlationReference,
        confidencePct: null,
        steps,
        validationNote: validation.message,
      }
    }

    return {
      reportDepth: iv.id,
      reportDepthLabel: iv.label,
      depthFromM: iv.fromM,
      depthToM: iv.toM,
      soilClassification: layer.soilClassification.value,
      pi: layer.plasticityIndex.value,
      correlatedCbrPct: provenance(corr.midPct, {
        unit: '%',
        source: 'Shared soil profile (Phase C)',
        method: corr.method,
        correlation: corr.correlationReference,
        confidence: corr.confidence,
        status: 'ENGINEERING_CORRELATED',
        engineeringLimitation: 'NOT laboratory soaked CBR — transmission access road screening only',
      }),
      cbrRangePct: provenance(
        { low: corr.lowPct, high: corr.highPct },
        {
          unit: '%',
          source: 'Shared soil profile (Phase C)',
          method: corr.method,
          confidence: corr.confidence,
          status: 'ENGINEERING_CORRELATED',
          engineeringLimitation: 'Estimated range — field soaked CBR recommended for final design',
        }
      ),
      method: corr.method,
      correlationReference: corr.correlationReference,
      confidencePct: corr.confidence,
      steps,
      validationNote: validation.message,
    }
  })

  const calculated = byDepth.filter((d) => d.correlatedCbrPct.value != null)
  const conservative = calculated.length
    ? calculated.reduce((min, d) =>
        (d.correlatedCbrPct.value as number) < (min.correlatedCbrPct.value as number) ? d : min
      )
    : null

  const recommendedDesignCbr = conservative
    ? provenance(conservative.correlatedCbrPct.value as number, {
        unit: '%',
        source: 'Conservative layer from depth-wise correlation',
        method: 'Minimum correlated mid-CBR across 0–2 m (transmission access road screening)',
        confidence: conservative.confidencePct,
        status: 'ENGINEERING_CORRELATED',
        engineeringLimitation: 'Not soaked lab CBR — verify by field test before final pavement design',
      })
    : fieldTestRequired('%', 'No defensible correlated CBR for recommended design value')

  const measuredByDepth = REPORT_DEPTH_INTERVALS.map((iv) => {
    const v = opts.measuredByDepth?.[iv.id]
    return {
      reportDepth: iv.id,
      measuredCBR:
        v != null && Number.isFinite(v)
          ? provenance(v, {
              unit: '%',
              source: 'Field geotechnical investigation',
              method: 'Laboratory soaked CBR (as recorded)',
              confidence: 90,
              status: 'MEASURED',
            })
          : noData('%', 'No laboratory soaked CBR for this depth', 'NO_DATA'),
    }
  })

  const calcStatus =
    calculated.length === 4
      ? 'CALCULATED'
      : calculated.length > 0
        ? 'PARTIAL'
        : 'FIELD_TEST_REQUIRED'

  return {
    version: 'CBR-G1',
    purpose: 'Transmission tower access and construction road assessment (not solar roads)',
    calculationStatus: calcStatus,
    message:
      calculated.length > 0
        ? `Engineering-correlated CBR for ${calculated.length}/4 depth layers. Never labelled as laboratory soaked CBR.`
        : 'CBR requires field soaked test — no defensible correlation available',
    recommendedDesignCbr,
    recommendedDesignBasis: 'Conservative minimum of correlated layer mids (0–2 m)',
    byDepth,
    measuredByDepth,
    validationNotes: [
      'CBR values are ENGINEERING_CORRELATED or MODEL_PREDICTED — not laboratory soaked CBR.',
      'Uses shared Phase C grain size, classification, and PI — no independent soil derivation.',
      'Recommended design CBR only when correlation passes validation gate.',
    ],
  }
}

/** Representative CBR — minimum correlated mid across 0–2 m (conservative for access roads). */
export function getRepresentativeCbr(engine: CbrEngineAnalysis): number | null {
  const vals = engine.byDepth
    .map((d) => d.correlatedCbrPct.value)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!vals.length) return null
  return Math.min(...vals)
}

/** Design CBR — conservative selection documented for transmission access. */
export function getDesignCbr(engine: CbrEngineAnalysis): {
  value: number | null
  method: string
  basis: string
} {
  const rep = getRepresentativeCbr(engine)
  return {
    value: engine.recommendedDesignCbr.value ?? rep,
    method: 'Conservative minimum of geospatial engineering CBR estimates (0–2 m)',
    basis: engine.recommendedDesignBasis,
  }
}

/** Legacy CbrAnalysis shape */
export function toLegacyCbrAnalysis(engine: CbrEngineAnalysis) {
  return {
    measuredByDepth: engine.measuredByDepth,
    estimatedByDepth: engine.byDepth.map((d) => ({
      reportDepth: d.reportDepth,
      estimatedCBR: d.cbrRangePct,
    })),
  }
}
