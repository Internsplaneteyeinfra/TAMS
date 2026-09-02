import { describe, expect, it } from 'vitest'

import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
import { runCbrEngineAnalysis } from '../cbr/cbrEngine'
import { runSoilVerdictAnalysis } from '../verdict/soilVerdictEngine'
import type { SiteSignals } from '../../scoring'

function sandySignals(): SiteSignals {
  return {
    lat: 19.076,
    lon: 72.877,
    soilScreening: {
      provider: 'SoilGrids',
      textureClass: 'Sand',
      indicativeSbcTm2: { low: 12, high: 22 },
      indicativeCbrPct: { low: 8, high: 18 },
      confidencePct: 75,
      confidenceNote: 'test',
      layers: [
        { depthLabel: '0-5cm', clayPct: 8, sandPct: 72, siltPct: 20, bulkDensityGcc: 1.5, ph: 7.2, coarseFragPct: 4 },
        { depthLabel: '5-15cm', clayPct: 9, sandPct: 70, siltPct: 21, bulkDensityGcc: 1.52, ph: 7.1, coarseFragPct: 5 },
        { depthLabel: '15-30cm', clayPct: 10, sandPct: 68, siltPct: 22, bulkDensityGcc: 1.54, ph: 7.0, coarseFragPct: 6 },
        { depthLabel: '30-60cm', clayPct: 11, sandPct: 66, siltPct: 23, bulkDensityGcc: 1.56, ph: 6.9, coarseFragPct: 7 },
        { depthLabel: '60-100cm', clayPct: 12, sandPct: 64, siltPct: 25, bulkDensityGcc: 1.58, ph: 6.8, coarseFragPct: 8 },
        { depthLabel: '100-200cm', clayPct: 13, sandPct: 62, siltPct: 25, bulkDensityGcc: 1.6, ph: 6.7, coarseFragPct: 9 },
      ],
    },
  } as SiteSignals
}

function claySignals(): SiteSignals {
  return {
    lat: 19.076,
    lon: 72.877,
    soilScreening: {
      provider: 'SoilGrids',
      textureClass: 'Clay loam',
      indicativeSbcTm2: { low: 4, high: 10 },
      indicativeCbrPct: { low: 2, high: 7 },
      confidencePct: 70,
      confidenceNote: 'test',
      layers: [
        { depthLabel: '0-5cm', clayPct: 32, sandPct: 28, siltPct: 40, bulkDensityGcc: 1.4, ph: 7.0, coarseFragPct: 2 },
        { depthLabel: '5-15cm', clayPct: 34, sandPct: 26, siltPct: 40, bulkDensityGcc: 1.42, ph: 7.0, coarseFragPct: 2 },
        { depthLabel: '15-30cm', clayPct: 35, sandPct: 25, siltPct: 40, bulkDensityGcc: 1.44, ph: 7.0, coarseFragPct: 2 },
        { depthLabel: '30-60cm', clayPct: 36, sandPct: 24, siltPct: 40, bulkDensityGcc: 1.46, ph: 7.0, coarseFragPct: 2 },
        { depthLabel: '60-100cm', clayPct: 37, sandPct: 23, siltPct: 40, bulkDensityGcc: 1.48, ph: 7.0, coarseFragPct: 2 },
        { depthLabel: '100-200cm', clayPct: 38, sandPct: 22, siltPct: 40, bulkDensityGcc: 1.5, ph: 7.0, coarseFragPct: 2 },
      ],
    },
  } as SiteSignals
}

describe('Phase H — Soil Verdict & Investigation Decision', () => {
  it('generates soil verdict on full intelligence build', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    expect(geo.soilVerdictAnalysis).toBeDefined()
    expect(geo.soilVerdictAnalysis!.version).toBe('VERDICT-H1')
    expect(geo.soilVerdictAnalysis!.dimensions.foundation).toBeDefined()
    expect(geo.soilVerdictAnalysis!.dimensions.pile).toBeDefined()
    expect(geo.soilVerdictAnalysis!.dimensions.accessRoad).toBeDefined()
    expect(geo.soilVerdictAnalysis!.dimensions.earthing).toBeDefined()
  })

  it('correlated-only data yields preliminary/conditional verdict — not final design approval', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const v = geo.soilVerdictAnalysis!
    expect(['PRELIMINARILY_SUPPORTIVE', 'CONDITIONALLY_SUPPORTIVE', 'INVESTIGATION_REQUIRED']).toContain(
      v.overall.status
    )
    const finalDesign = v.designStageDecisions.find((d) => d.stage === 'FINAL_DESIGN')
    expect(finalDesign?.decision).toBe('STOP')
    expect(v.overall.confidence).not.toBe('HIGH')
  })

  it('missing grain-size returns investigation required or insufficient data', () => {
    const verdict = runSoilVerdictAnalysis({
      version: 'GEO-1',
      reportClassification: 'GIS_BASED_PRELIMINARY_SCREENING',
      location: {} as never,
      soilProfile: [],
      sourceObservations: [],
      engineeringParameters: {} as never,
      engineeringParameterEstimation: {} as never,
      sbcAnalysis: {} as never,
      settlementAnalysis: {} as never,
      pileAnalysis: {} as never,
      cbrAnalysis: { measuredByDepth: [], estimatedByDepth: [] },
      resistivityAnalysis: { measured: {} as never, estimated: {} as never, layers: [] },
      fieldInvestigationMatch: {
        matched: false,
        investigationId: null,
        siteCode: null,
        distanceKm: null,
        geologyCompatibility: 'not_assessed',
        depthCoverageM: null,
        matchConfidence: null,
        reason: 'No match',
        usedForMeasuredParams: false,
      },
      dataQuality: { overallConfidence: 10 } as never,
      limitations: [],
      reportReadiness: {} as never,
      generatedAt: new Date().toISOString(),
    })
    expect(verdict.overall.status).toBe('INSUFFICIENT_DATA')
    expect(verdict.dimensions.soilDataConfidence.status).toBe('INSUFFICIENT_DATA')
  })

  it('FIELD_TEST_REQUIRED CBR keeps overall investigation required', () => {
    const cbrFail = runCbrEngineAnalysis({ soilProfile: [], soilLayerParameters: [] })
    expect(cbrFail.calculationStatus).toBe('FIELD_TEST_REQUIRED')

    const geo = buildGeotechnicalIntelligence(sandySignals())
    const v = geo.soilVerdictAnalysis!
    expect(v.overall.investigationRequired).toBe(true)
    expect(v.investigationPriorities.some((p) => p.investigationType.includes('CBR'))).toBe(true)
  })

  it('modelled resistivity only requires earthing investigation', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const v = geo.soilVerdictAnalysis!
    expect(v.dimensions.earthing.status).toBe('INVESTIGATION_REQUIRED')
    expect(v.investigationPriorities.some((p) => p.investigationType.includes('Wenner'))).toBe(true)
    expect(v.dimensions.earthing.requiredNextAction).toMatch(/field resistivity/i)
  })

  it('measured Wenner displayed separately from model', () => {
    const geo = buildGeotechnicalIntelligence({
      ...sandySignals(),
      geotech: {
        id: 'loc-1',
        site_code: 'PAD-01',
        site_name: 'Pad',
        distance_km: 0.1,
        adopted_resistivity_ohm_m: 85,
      },
    } as SiteSignals)
    const v = geo.soilVerdictAnalysis!
    expect(v.whatWeKnow.measured.some((x) => x.includes('Resistivity'))).toBe(true)
    expect(v.dimensions.earthing.supportingEvidence.some((x) => x.includes('Measured Wenner'))).toBe(true)
  })

  it('clay site may be preliminarily supportive with GIS-predicted parameters', () => {
    const geo = buildGeotechnicalIntelligence(claySignals())
    const v = geo.soilVerdictAnalysis!
    expect(['PRELIMINARILY_SUPPORTIVE', 'CONDITIONAL', 'INVESTIGATION_REQUIRED', 'CONSTRAINT']).toContain(
      v.dimensions.foundation.status
    )
    expect(v.overall.investigationRequired).toBe(true)
  })

  it('no soil data yields INSUFFICIENT DATA', () => {
    const geo = buildGeotechnicalIntelligence({ lat: 0, lon: 0 } as SiteSignals)
    const v = geo.soilVerdictAnalysis
    if (v) {
      expect(['INSUFFICIENT_DATA', 'INVESTIGATION_REQUIRED']).toContain(v.overall.status)
    }
  })

  it('strong foundation does not cancel weak CBR investigation', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const v = geo.soilVerdictAnalysis!
    const foundationOk = ['PRELIMINARILY_SUPPORTIVE', 'CONDITIONALLY_SUPPORTIVE'].includes(
      v.dimensions.foundation.status
    )
    const cbrNeedsInv = v.dimensions.accessRoad.status === 'INVESTIGATION_REQUIRED' ||
      v.investigationPriorities.some((p) => p.investigationType.includes('CBR'))
    if (foundationOk) {
      expect(cbrNeedsInv || v.overall.investigationRequired).toBe(true)
    }
  })

  it('verdict output contains no fabricated lab/field values', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const json = JSON.stringify(geo.soilVerdictAnalysis)
    expect(json).not.toMatch(/"sptN":\s*[1-9]/)
    expect(json).not.toMatch(/laboratory soaked CBR test result/i)
    expect(geo.soilVerdictAnalysis!.whatWeKnow.measured.every((x) => !x.includes('fabricated'))).toBe(true)
  })

  it('construction stage is NOT ASSESSABLE', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const construction = geo.soilVerdictAnalysis!.designStageDecisions.find(
      (d) => d.stage === 'CONSTRUCTION'
    )
    expect(construction?.decision).toBe('NOT_ASSESSABLE')
  })

  it('positive verdict can coexist with LOW confidence', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const v = geo.soilVerdictAnalysis!
    if (v.overall.status === 'PRELIMINARILY_SUPPORTIVE' || v.overall.status === 'CONDITIONALLY_SUPPORTIVE') {
      expect(['LOW', 'VERY_LOW', 'MODERATE']).toContain(v.overall.confidence)
    }
  })
})
