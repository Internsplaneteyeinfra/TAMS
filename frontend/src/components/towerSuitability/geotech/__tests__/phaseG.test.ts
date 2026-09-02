import { describe, expect, it } from 'vitest'

import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
import { getDesignCbr, getRepresentativeCbr } from '../cbr/cbrEngine'
import { mergeResolvedParameters } from '../parameterResolution/projectDataFusion'
import { validateParameterCompleteness } from '../parameterResolution/completenessEngine'
import { recommendFoundation } from '../foundationRecommendation'
import { buildEngineeringDepthProfile, toSourceObservations } from '../depthProfile'
import { buildSoilLayerParameters } from '../soilParameterEngine'
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

describe('Phase G — data fusion & completeness', () => {
  it('project measured cohesion overrides GIS prediction', () => {
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
    const ctx = mergeResolvedParameters({
      profile,
      soilLayers: layers,
      screeningTextureClass: soil.textureClass,
      projectData: {
        siteCode: 'TEST-01',
        distanceKm: 0.1,
        usedForMeasured: true,
        investigation: {
          id: '1',
          site_code: 'TEST-01',
          site_name: 'Test',
          latitude: 25.6,
          longitude: 85.1,
          investigation_depth_m: 2,
          design_params: { c_tm2: 2.0, phi_deg: 28, gamma_tm3: 1.85 },
        },
      },
    })
    expect(ctx.site.cohesionKpa.status).toBe('PROJECT_DATA')
    expect(ctx.site.frictionAngleDeg.value).toBe(28)
  })

  it('validateParameterCompleteness returns high completion for sandy GIS site', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    expect(geo.parameterCompleteness).toBeDefined()
    expect(geo.parameterCompleteness!.completionPct).toBeGreaterThan(50)
    expect(geo.parameterCompleteness!.completeParameters.length).toBeGreaterThan(10)
  })

  it('CBR representative and design helpers return values', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const rep = getRepresentativeCbr(geo.cbrEngineAnalysis!)
    const design = getDesignCbr(geo.cbrEngineAnalysis!)
    expect(rep).not.toBeNull()
    expect(design.value).not.toBeNull()
  })

  it('resistivity includes grounding recommendation', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    expect(geo.resistivityEngineAnalysis?.groundingRecommendation).toBeDefined()
    expect(geo.resistivityEngineAnalysis!.groundingRecommendation!.category).toMatch(/RESISTIVITY/)
  })

  it('foundation recommendation is generated', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    expect(geo.foundationRecommendation).toBeDefined()
    expect(geo.foundationRecommendation!.category).toBeTruthy()
    const direct = recommendFoundation(geo)
    expect(direct.whyRecommended.length).toBeGreaterThan(10)
  })
})

describe('Power infrastructure gate', () => {
  it('collectSiteSignals does not include power by default', async () => {
    const { collectSiteSignals } = await import('../../fetchSiteSignals')
    const signals = await collectSiteSignals(28.61, 77.21, undefined, {
      includePowerInfrastructure: false,
    })
    expect(signals.nearbyPower).toBeUndefined()
    expect(signals.towerKm).toBeNull()
  })
})
