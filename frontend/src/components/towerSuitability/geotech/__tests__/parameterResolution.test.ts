import { describe, expect, it } from 'vitest'

import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
import { buildSoilLayerParameters } from '../soilParameterEngine'
import { buildEngineeringDepthProfile, toSourceObservations } from '../depthProfile'
import { buildResolvedParameterContext, toEngineeringParameterSet } from '../parameterResolution'
import { validateResolvedContext } from '../geotechValidation'
import type { SiteSignals } from '../../scoring'

function sandySignals(): SiteSignals {
  return {
    lat: 25.6,
    lon: 85.1,
    elevationM: 55,
    slopeDeg: 2,
    soilScreening: {
      provider: 'ISRIC SoilGrids 2.0',
      resolutionNote: '250 m',
      lat: 25.6,
      lon: 85.1,
      textureClass: 'Sandy loam',
      indicativeSbcTm2: { low: 12, high: 18 },
      indicativeCbrPct: { low: 8, high: 15 },
      confidencePct: 62,
      confidenceNote: 'Modelled',
      fetchedAt: new Date().toISOString(),
      live: true,
      layers: [
        {
          depthLabel: '0-30cm',
          sandPct: 52,
          siltPct: 28,
          clayPct: 12,
          bulkDensityGcc: 1.42,
          ph: 7.1,
          coarseFragPct: 4,
        },
        {
          depthLabel: '30-60cm',
          sandPct: 50,
          siltPct: 30,
          clayPct: 14,
          bulkDensityGcc: 1.45,
          ph: 7.0,
          coarseFragPct: 3,
        },
        {
          depthLabel: '60-100cm',
          sandPct: 48,
          siltPct: 32,
          clayPct: 15,
          bulkDensityGcc: 1.48,
          ph: 6.9,
          coarseFragPct: 2,
        },
        {
          depthLabel: '100-200cm',
          sandPct: 46,
          siltPct: 34,
          clayPct: 16,
          bulkDensityGcc: 1.5,
          ph: 6.8,
          coarseFragPct: 2,
        },
      ],
    },
  } as SiteSignals
}

describe('Parameter resolution PR-1', () => {
  it('resolves cohesion, phi, gamma for sandy GIS profile', () => {
    const soil = sandySignals().soilScreening!
    const obs = toSourceObservations(
      soil.layers.map((L) => ({
        depthLabel: L.depthLabel,
        sandPct: L.sandPct,
        siltPct: L.siltPct,
        clayPct: L.clayPct,
        bulkDensityGcc: L.bulkDensityGcc,
        ph: L.ph,
        coarseFragPct: L.coarseFragPct,
      }))
    )
    const profile = buildEngineeringDepthProfile(obs)
    const layers = buildSoilLayerParameters(profile)
    const ctx = buildResolvedParameterContext({
      profile,
      soilLayers: layers,
      screeningTextureClass: soil.textureClass,
    })
    const eng = toEngineeringParameterSet(ctx)
    expect(eng.cohesionKpa.value).not.toBeNull()
    expect(eng.phiDeg.value).not.toBeNull()
    expect(eng.gammaKnM3.value).not.toBeNull()
    expect(eng.cohesionKpa.status).not.toBe('FIELD_TEST_REQUIRED')
  })

  it('grain fractions sum to approximately 100%', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const layer = geo.resolvedParameterContext!.byLayer[0]
    const sum =
      layer.gravelPct.value + layer.sandPct.value + layer.siltPct.value + layer.clayPct.value
    expect(sum).toBeGreaterThanOrEqual(98)
    expect(sum).toBeLessThanOrEqual(102)
  })

  it('PI equals LL minus PL when both correlated', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const layer = geo.resolvedParameterContext!.byLayer.find((l) => l.plasticityIndex.value > 0)
    if (!layer) return
    expect(Math.abs(layer.plasticityIndex.value - (layer.liquidLimit.value - layer.plasticLimit.value))).toBeLessThan(
      1
    )
  })

  it('SBC engine returns values at 8 depths for sandy site', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const bh = geo.sbcEngineAnalysis!.byBorehole[0]
    expect(bh.byDepth.length).toBe(8)
    const calculated = bh.byDepth.filter((d) => d.netSafeBearingCapacityTm2.value != null)
    expect(calculated.length).toBeGreaterThan(0)
  })

  it('pile matrix returns vertical capacities for 6 combinations', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const bh = geo.pileEngineAnalysis!.byBorehole[0]
    expect(bh.matrix.length).toBe(6)
    const withVertical = bh.matrix.filter((c) => c.verticalCapacity.safe_T.value != null)
    expect(withVertical.length).toBeGreaterThan(0)
  })

  it('CBR returns values for 4 depth layers', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    expect(geo.cbrEngineAnalysis!.byDepth.length).toBe(4)
    const withCbr = geo.cbrEngineAnalysis!.byDepth.filter((d) => d.correlatedCbrPct.value != null)
    expect(withCbr.length).toBe(4)
  })

  it('resistivity returns adopted estimate', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    expect(geo.resistivityEngineAnalysis!.siteEstimateOhmM.value).not.toBeNull()
  })

  it('validation passes for normal GIS profile', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const issues = validateResolvedContext(geo.resolvedParameterContext!)
    const errors = issues.filter((i) => i.severity === 'error')
    expect(errors.length).toBe(0)
  })
})
