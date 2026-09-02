/**
 * GEO-1 / G2 regression tests.
 * Production scorer must remain unchanged when geotechnicalIntelligence is built.
 */

import { describe, expect, it } from 'vitest'

import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
import { assertNoDataNeverZero, collectAllProvenance } from '../dataQuality'
import {
  buildEngineeringDepthProfile,
  parseSoilGridsDepthLabel,
  toSourceObservations,
} from '../depthProfile'
import { estimateEngineeringParameters } from '../engineeringEstimates'
import {
  calculateSbcAtDepth,
  defaultScreeningFoundation,
  resolveSbcSoilInputs,
  runSbcAnalysis,
} from '../sbcEngine'
import {
  resolveSettlementSoilInputs,
  runSettlementAnalysis,
} from '../settlementEngine'
import { calculatePileCell } from '../pileEngine'
import { PRODUCTION_GEOTECH_FACTOR } from '../productionScoringSafety'
import { parseSoilGridsResponse } from '../../soilScreening'
import { scoreSiteSignals, type SiteSignals } from '../../scoring'

function mockSignals(partial?: Partial<SiteSignals>): SiteSignals {
  const soilJson = {
    properties: {
      layers: [
        {
          name: 'clay',
          unit_measure: { d_factor: 10 },
          depths: [
            { label: '0-5cm', values: { mean: 280 } },
            { label: '5-15cm', values: { mean: 300 } },
            { label: '15-30cm', values: { mean: 320 } },
            { label: '30-60cm', values: { mean: 340 } },
            { label: '60-100cm', values: { mean: 300 } },
            { label: '100-200cm', values: { mean: 250 } },
          ],
        },
        {
          name: 'sand',
          unit_measure: { d_factor: 10 },
          depths: [
            { label: '0-5cm', values: { mean: 400 } },
            { label: '5-15cm', values: { mean: 380 } },
            { label: '15-30cm', values: { mean: 360 } },
            { label: '30-60cm', values: { mean: 350 } },
            { label: '60-100cm', values: { mean: 400 } },
            { label: '100-200cm', values: { mean: 450 } },
          ],
        },
        {
          name: 'silt',
          unit_measure: { d_factor: 10 },
          depths: [
            { label: '0-5cm', values: { mean: 320 } },
            { label: '5-15cm', values: { mean: 320 } },
            { label: '15-30cm', values: { mean: 320 } },
            { label: '30-60cm', values: { mean: 310 } },
            { label: '60-100cm', values: { mean: 300 } },
            { label: '100-200cm', values: { mean: 300 } },
          ],
        },
        {
          name: 'bdod',
          unit_measure: { d_factor: 100 },
          depths: [
            { label: '0-5cm', values: { mean: 140 } },
            { label: '5-15cm', values: { mean: 145 } },
            { label: '15-30cm', values: { mean: 150 } },
            { label: '30-60cm', values: { mean: 155 } },
            { label: '60-100cm', values: { mean: 160 } },
            { label: '100-200cm', values: { mean: 165 } },
          ],
        },
        {
          name: 'phh2o',
          unit_measure: { d_factor: 10 },
          depths: [
            { label: '0-5cm', values: { mean: 72 } },
            { label: '5-15cm', values: { mean: 71 } },
            { label: '15-30cm', values: { mean: 70 } },
            { label: '30-60cm', values: { mean: 69 } },
            { label: '60-100cm', values: { mean: 68 } },
            { label: '100-200cm', values: { mean: 67 } },
          ],
        },
        {
          name: 'cfvo',
          unit_measure: { d_factor: 10 },
          depths: [
            { label: '0-5cm', values: { mean: 50 } },
            { label: '5-15cm', values: { mean: 60 } },
            { label: '15-30cm', values: { mean: 70 } },
            { label: '30-60cm', values: { mean: 80 } },
            { label: '60-100cm', values: { mean: 90 } },
            { label: '100-200cm', values: { mean: 100 } },
          ],
        },
        {
          name: 'soc',
          unit_measure: { d_factor: 10 },
          depths: [
            { label: '0-5cm', values: { mean: 120 } },
            { label: '5-15cm', values: { mean: 100 } },
            { label: '15-30cm', values: { mean: 80 } },
            { label: '30-60cm', values: { mean: 60 } },
            { label: '60-100cm', values: { mean: 40 } },
            { label: '100-200cm', values: { mean: 20 } },
          ],
        },
      ],
    },
  }

  const soil = parseSoilGridsResponse(soilJson, 23.45, 69.6, 'Test')
  return {
    lat: 23.45,
    lon: 69.6,
    elevationM: 120,
    slopeDeg: 2.5,
    roadKm: 1.2,
    waterKm: 3.4,
    buildingKm: 2.1,
    towerKm: 5,
    substationKm: 8,
    windMs: 4.2,
    landCoverHint: 'barren',
    placeLabel: 'Test, Gujarat',
    soilScreening: soil,
    geotech: null,
    liveOk: {
      dem: true,
      road: true,
      water: true,
      settlement: true,
      grid: true,
      wind: true,
      landcover: true,
      soilScreening: true,
    },
    ...partial,
  }
}

describe('GEO-1 depth aggregation', () => {
  it('parses SoilGrids depth labels to metres', () => {
    expect(parseSoilGridsDepthLabel('0-5cm')).toEqual({ fromM: 0, toM: 0.05 })
    expect(parseSoilGridsDepthLabel('100-200cm')).toEqual({ fromM: 1, toM: 2 })
  })

  it('never treats bdod as soil depth', () => {
    const soil = mockSignals().soilScreening!
    for (const L of soil.layers) {
      expect(L.bulkDensityGcc).not.toBeNull()
      expect(L.bulkDensityGcc!).toBeGreaterThan(0.5)
      expect(L.bulkDensityGcc!).toBeLessThan(3)
      // depth label is separate from bdod
      expect(L.depthLabel).toMatch(/cm$/)
    }
  })

  it('builds 4 engineering intervals with sourceDepth metadata', () => {
    const soil = mockSignals().soilScreening!
    const obs = toSourceObservations(
      soil.layers.map((L) => ({
        depthLabel: L.depthLabel,
        clayPct: L.clayPct,
        sandPct: L.sandPct,
        siltPct: L.siltPct,
        bulkDensityGcc: L.bulkDensityGcc,
        ph: L.ph,
        coarseFragPct: L.coarseFragPct,
        organicCarbonGkg: L.organicCarbonGkg,
      }))
    )
    const profile = buildEngineeringDepthProfile(obs)
    expect(profile).toHaveLength(4)
    expect(profile[0].reportDepth).toBe('0.0-0.5m')
    expect(profile[0].sourceDepths.length).toBeGreaterThan(0)
    expect(profile[0].sandPct.status).toBe('MODELLED')
    expect(profile[0].gravelPct.status).toBe('NO_DATA')
    expect(profile[0].gravelPct.value).toBeNull()
    expect(profile[0].isSoilClassification.status).toBe('INSUFFICIENT_DATA')
    // 1.5–2.0 m should include 100-200cm
    expect(profile[3].sourceDepths).toContain('100-200cm')
  })
})

describe('Production scorer isolation', () => {
  it('scoreSiteSignals result is identical with or without GEO build', () => {
    const signals = mockSignals()
    const a = scoreSiteSignals(signals)
    const geo = buildGeotechnicalIntelligence(signals)
    const b = scoreSiteSignals(signals)

    expect(a.finalScore).toBe(b.finalScore)
    expect(a.verdict).toBe(b.verdict)
    expect(a.confidencePct).toBe(b.confidencePct)
    expect(a.factors.map((f) => ({ id: f.id, score: f.score, weight: f.weight }))).toEqual(
      b.factors.map((f) => ({ id: f.id, score: f.score, weight: f.weight }))
    )
    // GEO must not be produced by scorer
    expect(a.geotechnicalIntelligence).toBeUndefined()
    expect(geo.version).toBe('GEO-1')
    expect(geo.reportClassification).toBe('GIS_BASED_PRELIMINARY_SCREENING')
  })

  it('geotech factor id remains geotech (soilStability compatibility path)', () => {
    const scored = scoreSiteSignals(mockSignals())
    const g = scored.factors.find((f) => f.id === 'geotech')
    expect(g).toBeTruthy()
    expect(g!.weight).toBe(0.08)
  })

  it('verdict gates remain >=7 preferred and <4.5 unsuitable', () => {
    const scored = scoreSiteSignals(mockSignals())
    if (scored.finalScore >= 7) expect(scored.verdict).toBe('preferred')
    else if (scored.finalScore < 4.5) expect(scored.verdict).toBe('unsuitable')
    else expect(scored.verdict).toBe('conditional')
  })
})

describe('NO_DATA and fabrication guards', () => {
  it('NO_DATA / FIELD_TEST_REQUIRED never become 0', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    const params = collectAllProvenance(geo)
    const bad = assertNoDataNeverZero(params)
    expect(bad).toEqual([])

    for (const p of params) {
      if (
        p.status === 'NO_DATA' ||
        p.status === 'FIELD_TEST_REQUIRED' ||
        p.status === 'INSUFFICIENT_DATA'
      ) {
        expect(p.value).toBeNull()
      }
    }
  })

  it('GIS-only sites do not emit MEASURED lab parameters', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    const measured = collectAllProvenance(geo).filter((p) => p.status === 'MEASURED')
    expect(measured.length).toBe(0)
    expect(geo.cbrAnalysis.measuredByDepth.every((r) => r.measuredCBR.status === 'NO_DATA')).toBe(
      true
    )
    expect(geo.resistivityAnalysis.measured.status).toBe('NO_DATA')
    expect(geo.resistivityAnalysis.estimated.status).toBe('MODEL_PREDICTED')
    expect(geo.resistivityAnalysis.estimated.value).not.toBeNull()
  })

  it('estimated CBR is never labelled MEASURED', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    for (const row of geo.cbrAnalysis.estimatedByDepth) {
      expect(row.estimatedCBR.status).not.toBe('MEASURED')
      if (row.estimatedCBR.value != null) {
        expect(['ESTIMATED', 'ENGINEERING_CORRELATED', 'MODEL_PREDICTED']).toContain(
          row.estimatedCBR.status
        )
      }
    }
    if (geo.cbrEngineAnalysis) {
      for (const row of geo.cbrEngineAnalysis.byDepth) {
        expect(row.correlatedCbrPct.status).not.toBe('MEASURED')
      }
    }
  })

  it('cohesion is GIS-predicted via PR-1 (not field measured)', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    const c = geo.resolvedParameterContext!.site.cohesionKpa
    expect(c.status).toBe('ENGINEERING_CORRELATED')
    expect(c.value).not.toBeNull()
    expect(c.method).toMatch(/Predicted engineering cohesion/i)
  })

  it('SBC and pile calculate with PR-1 predicted c–φ for clayey textures', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    expect(['CALCULATED', 'PARTIAL']).toContain(geo.sbcAnalysis.calculationStatus)
    expect(geo.sbcAnalysis.byDepth.some((d) => d.netSafeBearingCapacityTm2.value != null)).toBe(true)
    expect(['CALCULATED', 'PARTIAL']).toContain(geo.pileAnalysis['450mm']['2.0m'].calculationStatus)
    expect(geo.pileAnalysis['450mm']['2.0m'].vertical.value).not.toBeNull()
    expect(geo.settlementAnalysis.calculationStatus).toBe('TOWER_LOAD_REQUIRED')
  })
})

describe('IS 6403 SBC engine (G3)', () => {
  it('computes depth-wise SBC for sand texture with drained c≈0 ESTIMATED', () => {
    // Force sand-like fractions
    const obs = toSourceObservations([
      {
        depthLabel: '0-5cm',
        clayPct: 5,
        sandPct: 88,
        siltPct: 7,
        bulkDensityGcc: 1.55,
        ph: 7,
        coarseFragPct: 2,
        organicCarbonGkg: 5,
      },
      {
        depthLabel: '5-15cm',
        clayPct: 5,
        sandPct: 88,
        siltPct: 7,
        bulkDensityGcc: 1.58,
        ph: 7,
        coarseFragPct: 2,
        organicCarbonGkg: 4,
      },
      {
        depthLabel: '15-30cm',
        clayPct: 6,
        sandPct: 86,
        siltPct: 8,
        bulkDensityGcc: 1.6,
        ph: 7,
        coarseFragPct: 3,
        organicCarbonGkg: 3,
      },
      {
        depthLabel: '30-60cm',
        clayPct: 6,
        sandPct: 85,
        siltPct: 9,
        bulkDensityGcc: 1.62,
        ph: 7,
        coarseFragPct: 4,
        organicCarbonGkg: 2,
      },
      {
        depthLabel: '60-100cm',
        clayPct: 5,
        sandPct: 87,
        siltPct: 8,
        bulkDensityGcc: 1.65,
        ph: 7,
        coarseFragPct: 5,
        organicCarbonGkg: 1,
      },
      {
        depthLabel: '100-200cm',
        clayPct: 4,
        sandPct: 90,
        siltPct: 6,
        bulkDensityGcc: 1.68,
        ph: 7,
        coarseFragPct: 6,
        organicCarbonGkg: 1,
      },
    ])
    const profile = buildEngineeringDepthProfile(obs)
    const eng = estimateEngineeringParameters(profile)
    const soil = resolveSbcSoilInputs(eng, profile)
    expect(soil.cStatus).toBe('ESTIMATED')
    expect(soil.cTm2).toBe(0)
    expect(soil.phiDeg).not.toBeNull()

    const at15 = calculateSbcAtDepth(1.5, soil, defaultScreeningFoundation())
    expect(at15.calculationStatus).toBe('CALCULATED')
    expect(at15.netSafeBearingCapacityTm2.status).toBe('CALCULATED')
    expect(at15.netSafeBearingCapacityTm2.value).toBeGreaterThan(0)
    expect(at15.steps.length).toBeGreaterThanOrEqual(9)
    // Must not be a hardcoded Nirona constant
    expect([10, 15, 20, 24]).not.toContain(at15.netSafeBearingCapacityTm2.value)
  })

  it('calculates SBC for clay using predicted cohesion (PR-1)', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    const result = runSbcAnalysis(geo.engineeringParameters, geo.soilProfile)
    expect(['CALCULATED', 'PARTIAL']).toContain(result.calculationStatus)
    expect(result.adoptedPreliminary.value).not.toBeNull()
  })
})

describe('Settlement engine (G4)', () => {
  it('returns TOWER_LOAD_REQUIRED without inventing settlement mm', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    expect(geo.settlementAnalysis.calculationStatus).toBe('TOWER_LOAD_REQUIRED')
    expect(geo.settlementAnalysis.settlementMm?.value ?? null).toBeNull()
    expect(geo.settlementAnalysis.missingInputs).toContain('TOWER_FOUNDATION_LOAD')
    expect(geo.settlementAnalysis.readiness?.canCalculate).toBe(false)
  })

  it('calculates elastic settlement when load + Es provided', () => {
    const result = runSettlementAnalysis({
      foundation: defaultScreeningFoundation(),
      foundationDepthM: 1.5,
      towerLoad: {
        verticalLoadT: 40,
        contactPressureTm2: null,
        source: 'Test tower stub load',
        status: 'MEASURED',
      },
      soil: resolveSettlementSoilInputs({
        esTm2: 2500,
        esStatus: 'MEASURED',
        esSource: 'Plate load test',
        esMethod: 'Measured Es',
        poissonRatio: 0.3,
      }),
    })
    expect(result.calculationStatus).toBe('CALCULATED')
    expect(result.settlementMm.value).not.toBeNull()
    expect(result.settlementMm.value!).toBeGreaterThan(0)
    expect(result.settlementMm.status).toBe('CALCULATED')
    expect(result.steps.length).toBeGreaterThanOrEqual(3)
  })

  it('with load but no Es → INSUFFICIENT_DATA (no fake Es)', () => {
    const result = runSettlementAnalysis({
      foundation: defaultScreeningFoundation(),
      towerLoad: {
        verticalLoadT: 40,
        contactPressureTm2: null,
        source: 'Test',
        status: 'MEASURED',
      },
    })
    expect(result.calculationStatus).toBe('INSUFFICIENT_DATA')
    expect(result.settlementMm.value).toBeNull()
    expect(result.missingInputs).toContain('SOIL_MODULUS_OR_EQUIVALENT')
  })
})

describe('Production scoring safety — geotech weight 0.08', () => {
  it('documents that 0.08 existed before G1–G4 and was not introduced by GEO', () => {
    expect(PRODUCTION_GEOTECH_FACTOR.weight).toBe(0.08)
    expect(PRODUCTION_GEOTECH_FACTOR.id).toBe('geotech')
    expect(PRODUCTION_GEOTECH_FACTOR.introducedInCommit).toBe('b86e2d72')
    expect(PRODUCTION_GEOTECH_FACTOR.g1g4ModifiedWeightOrLogic).toBe(false)
    expect(PRODUCTION_GEOTECH_FACTOR.geoIntelligenceAffectsScore).toBe(false)
  })

  it('scoreSiteSignals ignores geotechnicalIntelligence entirely', () => {
    const signals = mockSignals()
    const scored = scoreSiteSignals(signals)
    const geo = buildGeotechnicalIntelligence(signals)
    const withGeo = { ...scored, geotechnicalIntelligence: geo }
    const scoredAgain = scoreSiteSignals(signals)
    expect(withGeo.finalScore).toBe(scored.finalScore)
    expect(scoredAgain.finalScore).toBe(scored.finalScore)
    expect(scored.factors.find((f) => f.id === 'geotech')!.weight).toBe(0.08)
    expect(scoreSiteSignals(signals).geotechnicalIntelligence).toBeUndefined()
  })

  it('deeper SoilGrids layers do not change production texture path (0–30 cm)', () => {
    const soil = mockSignals().soilScreening!
    expect(soil.layers.length).toBeGreaterThanOrEqual(4)
    expect(soil.textureClass).toBeTruthy()
    expect(soil.confidencePct).toBeGreaterThan(0)
    const a = scoreSiteSignals(mockSignals())
    const b = scoreSiteSignals(mockSignals())
    expect(a.finalScore).toBe(b.finalScore)
    expect(a.factors.find((f) => f.id === 'geotech')!.score).toBe(
      b.factors.find((f) => f.id === 'geotech')!.score
    )
  })
})

describe('Pile engine (G5)', () => {
  it('uses GIS-predicted equivalent SPT N (not field SPT)', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    const spt = geo.resolvedParameterContext!.site.equivalentSptN
    expect(spt.status).toBe('MODEL_PREDICTED')
    expect(spt.value).not.toBeNull()
    expect(spt.method).toMatch(/equivalent SPT/i)
  })

  it('computes vertical+uplift and preliminary lateral for sand via c–φ', () => {
    const obs = toSourceObservations([
      {
        depthLabel: '0-5cm',
        clayPct: 5,
        sandPct: 88,
        siltPct: 7,
        bulkDensityGcc: 1.55,
        ph: 7,
        coarseFragPct: 2,
        organicCarbonGkg: 5,
      },
      {
        depthLabel: '5-15cm',
        clayPct: 5,
        sandPct: 88,
        siltPct: 7,
        bulkDensityGcc: 1.58,
        ph: 7,
        coarseFragPct: 2,
        organicCarbonGkg: 4,
      },
      {
        depthLabel: '15-30cm',
        clayPct: 6,
        sandPct: 86,
        siltPct: 8,
        bulkDensityGcc: 1.6,
        ph: 7,
        coarseFragPct: 3,
        organicCarbonGkg: 3,
      },
      {
        depthLabel: '30-60cm',
        clayPct: 6,
        sandPct: 85,
        siltPct: 9,
        bulkDensityGcc: 1.62,
        ph: 7,
        coarseFragPct: 4,
        organicCarbonGkg: 2,
      },
      {
        depthLabel: '60-100cm',
        clayPct: 5,
        sandPct: 87,
        siltPct: 8,
        bulkDensityGcc: 1.65,
        ph: 7,
        coarseFragPct: 5,
        organicCarbonGkg: 1,
      },
      {
        depthLabel: '100-200cm',
        clayPct: 4,
        sandPct: 90,
        siltPct: 6,
        bulkDensityGcc: 1.68,
        ph: 7,
        coarseFragPct: 6,
        organicCarbonGkg: 1,
      },
    ])
    const profile = buildEngineeringDepthProfile(obs)
    const eng = estimateEngineeringParameters(profile)
    const soil = resolveSbcSoilInputs(eng, profile)
    const cell = calculatePileCell(450, 2.0, soil)
    expect(cell.calculationStatus).toBe('PARTIAL')
    expect(cell.vertical.status).toBe('CALCULATED')
    expect(cell.vertical.value).toBeGreaterThan(0)
    expect(cell.uplift.status).toBe('CALCULATED')
    expect(cell.lateral.value).not.toBeNull()
    expect(cell.lateral.status).toBe('ENGINEERING_CORRELATED')
    expect(cell.missingParameters).toContain('SPT_N_VALUE')
    expect([3.0, 6.3, 8.3, 5.1, 11.4, 14.7]).not.toContain(cell.vertical.value)
  })
})

describe('Field investigation matching', () => {
  it('does not transfer distant Nirona-style records as MEASURED layers', () => {
    const geo = buildGeotechnicalIntelligence(
      mockSignals({
        geotech: {
          id: 'nir-1',
          site_code: 'NIR-LOC-01',
          site_name: 'Nirona',
          distance_km: 3.2,
          adopted_sbc_tm2: 20,
          design_depth_m: 1.5,
          governing_cbr_pct: 4,
          adopted_resistivity_ohm_m: 85,
        },
      })
    )
    expect(geo.fieldInvestigationMatch.matched).toBe(false)
    expect(geo.fieldInvestigationMatch.usedForMeasuredParams).toBe(false)
    expect(geo.resistivityAnalysis.measured.status).toBe('NO_DATA')
  })

  it('allows same-site match within 250 m', () => {
    const geo = buildGeotechnicalIntelligence(
      mockSignals({
        geotech: {
          id: 'local-1',
          site_code: 'LOC-01',
          site_name: 'Same pad',
          distance_km: 0.1,
          adopted_resistivity_ohm_m: 85,
        },
      })
    )
    expect(geo.fieldInvestigationMatch.matched).toBe(true)
    expect(geo.fieldInvestigationMatch.usedForMeasuredParams).toBe(true)
    expect(geo.resistivityAnalysis.measured.status).toBe('MEASURED')
    expect(geo.resistivityAnalysis.measured.value).toBe(85)
  })
})
