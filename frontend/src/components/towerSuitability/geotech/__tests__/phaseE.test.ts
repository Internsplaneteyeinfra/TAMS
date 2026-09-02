import { describe, expect, it } from 'vitest'

import { runSbcEngineAnalysis, defaultScreeningFoundation } from '../sbc/sbcEngine'
import { validateSbcInputs } from '../sbc/sbcValidation'
import { governingSbc } from '../sbc/settlementAnalysis'
import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
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
        { depthLabel: '60-100cm', clayPct: 12, sandPct: 64, siltPct: 24, bulkDensityGcc: 1.58, ph: 6.8, coarseFragPct: 8 },
        { depthLabel: '100-200cm', clayPct: 13, sandPct: 62, siltPct: 25, bulkDensityGcc: 1.6, ph: 6.7, coarseFragPct: 9 },
      ],
    },
  } as SiteSignals
}

describe('Phase E — SBC engineering engine', () => {
  it('produces 8 depth rows (0.5–4.0 m)', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    expect(geo.sbcEngineAnalysis?.byBorehole[0].byDepth.length).toBe(8)
    expect(geo.sbcEngineAnalysis?.byBorehole[0].byDepth[0].depthM).toBe(0.5)
    expect(geo.sbcEngineAnalysis?.byBorehole[0].byDepth[7].depthM).toBe(4.0)
  })

  it('distinguishes primary GIS model from extrapolation', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const depths = geo.sbcEngineAnalysis!.byBorehole[0].byDepth
    expect(depths.filter((d) => d.dataBasis === 'PRIMARY_GEOSPATIAL_MODEL').length).toBe(4)
    expect(depths.filter((d) => d.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION').length).toBe(4)
    expect(depths[3].sourceTypeLabel).toBe('Calculated')
    expect(depths[4].sourceTypeLabel).toBe('Engineering Depth Model')
  })

  it('calculates SBC for sand-like drained soil', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const bh = geo.sbcEngineAnalysis!.byBorehole[0]
    const calculated = bh.byDepth.filter((d) => d.calculationStatus === 'CALCULATED')
    expect(calculated.length).toBeGreaterThan(0)
    expect(bh.netSafeBearingCapacityTm2.value).toBeGreaterThan(0)
  })

  it('calculates SBC for clay using predicted engineering cohesion (PR-1)', () => {
    const claySignals = {
      ...sandySignals(),
      soilScreening: {
        ...sandySignals().soilScreening!,
        textureClass: 'Clay',
      },
    } as SiteSignals
    const geo = buildGeotechnicalIntelligence(claySignals)
    expect(['CALCULATED', 'PARTIAL']).toContain(geo.sbcAnalysis.calculationStatus)
    expect(geo.sbcAnalysis.byDepth.some((d) => d.netSafeBearingCapacityTm2.value != null)).toBe(true)
    expect(geo.resolvedParameterContext?.site.cohesionKpa.status).toBe('ENGINEERING_CORRELATED')
  })

  it('governing SBC uses minimum of shear and settlement', () => {
    const gov = governingSbc(50, 30)
    expect(gov.value).toBe(30)
    expect(gov.governing).toBe('Settlement')
    const gov2 = governingSbc(20, 40)
    expect(gov2.governing).toBe('Shear')
  })

  it('validation gate rejects missing parameters', () => {
    const v = validateSbcInputs({
      cTm2: null,
      phiDeg: 30,
      gammaTm3: 1.8,
      cStatus: 'FIELD_TEST_REQUIRED',
      phiStatus: 'ESTIMATED',
      gammaStatus: 'MODELLED',
      cSource: 'none',
      phiSource: 'test',
      gammaSource: 'test',
      textureHint: 'Clay',
      dataBasis: 'PRIMARY_GEOSPATIAL_MODEL',
      layerLabel: '1.0-1.5m',
    })
    expect(v.passed).toBe(false)
    expect(v.status).toBe('REQUIRES_ADDITIONAL_VERIFIED_INPUT')
  })
})
