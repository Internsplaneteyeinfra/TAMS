import { describe, expect, it } from 'vitest'

import { buildGeotechnicalIntelligence } from '../geotech/buildGeotechnicalIntelligence'
import { scoreSiteSignals } from '../scoring'
import type { SiteSignals } from '../scoring'
import {
  analyzeTowerCandidate,
  buildTowerPlanningContext,
  canCheckPowerInfrastructure,
  canGenerateTowerSuggestions,
  generateTowerCandidates,
  isApprovedForConstruction,
  kmlFeaturesToInvestigationGeometry,
  summarizePowerInfrastructure,
  validatePhaseIWorkflow,
} from '../towerPlanning'
import type { KmlFeature } from '../fetchSiteSignals'

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

const lineFeature: KmlFeature = {
  type: 'LineString',
  latlngs: [
    [19.076, 72.877],
    [19.08, 72.885],
    [19.085, 72.892],
  ],
  name: 'Planning line',
}

describe('Phase I — Tower Intelligence & Soil Handoff', () => {
  it('soil verdict creates tower planning context without recalculating A–H', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const ctx = buildTowerPlanningContext(geo, { lat: 19.076, lon: 72.877 }, null)
    expect(ctx.soilVerdict).toBeDefined()
    expect(ctx.sbcSummary).toContain('T/m²')
    expect(ctx.preliminaryPlanningOnly).toBe(true)
    expect(ctx.mandatoryInvestigations.length).toBeGreaterThan(0)
  })

  it('investigation geometry preserved separately from planning geometry', () => {
    const inv: KmlFeature[] = [
      {
        type: 'Polygon',
        latlngs: [
          [19.07, 72.87],
          [19.08, 72.87],
          [19.08, 72.88],
          [19.07, 72.88],
        ],
        name: 'Investigation',
      },
    ]
    const invGeom = kmlFeaturesToInvestigationGeometry(inv)
    const planGeom = kmlFeaturesToInvestigationGeometry([lineFeature])
    expect(invGeom?.type).toBe('polygon')
    expect(planGeom?.type).toBe('line')
  })

  it('power infrastructure cannot generate towers before planning geometry', () => {
    expect(canCheckPowerInfrastructure([])).toBe(false)
    expect(canGenerateTowerSuggestions([], true)).toBe(false)
    expect(validatePhaseIWorkflow({ planningKmlFeatures: [], powerInfrastructureChecked: false, powerResult: null }).length).toBeGreaterThan(0)
  })

  it('power infrastructure cannot generate towers before explicit check', () => {
    expect(canGenerateTowerSuggestions([lineFeature], false)).toBe(false)
    expect(canGenerateTowerSuggestions([lineFeature], true)).toBe(true)
  })

  it('summarizePowerInfrastructure handles no detection without claiming site is clear', () => {
    const summary = summarizePowerInfrastructure(null, 19.076, 72.877, 10)
    expect(summary.status).toBe('NOT_DETECTED')
    expect(summary.message).toMatch(/does not mean no infrastructure exists/i)
  })

  it('generates tower candidates with valid coordinates', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const powerSummary = summarizePowerInfrastructure(null, 19.076, 72.877, 10)
    const candidates = generateTowerCandidates({
      planningKmlFeatures: [lineFeature],
      geo,
      power: null,
      powerSummary,
      searchRadiusKm: 10,
      baseSuitability: scoreSiteSignals({ lat: 19.076, lon: 72.877, elevationM: 100, slopeDeg: 5, roadKm: 2, waterKm: 3, buildingKm: 4, towerKm: 5, substationKm: 6, windMs: 4, landCoverHint: 'barren' }),
    })
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0].id).toBe('T-01')
    expect(Number.isFinite(candidates[0].latitude)).toBe(true)
    expect(Number.isFinite(candidates[0].longitude)).toBe(true)
    expect(candidates[0].recommendation).not.toMatch(/APPROVED_FOR_CONSTRUCTION/)
  })

  it('analyzeTowerCandidate preserves geotechnical context (no A–H recalculation)', async () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const candidate = {
      id: 'T-01',
      index: 1,
      latitude: 19.076,
      longitude: 72.877,
      suitabilityScore: 70,
      soilVerdictStatus: 'INVESTIGATION REQUIRED',
      terrainScore: null,
      slopeScore: null,
      accessibilityScore: null,
      powerInfrastructureStatus: 'NOT_DETECTED' as const,
      distanceToInfrastructureKm: null,
      placementVerdict: null,
      constraints: [],
      recommendation: 'CONDITIONALLY_SUITABLE' as const,
      dataConfidence: 'LOW' as const,
      provenance: { scoringStatus: 'PRELIMINARY_ASSESSMENT' as const, source: 'test' },
    }

    const analysis = await analyzeTowerCandidate({
      candidate,
      geotechnicalIntelligence: geo,
      searchRadiusKm: 10,
    })
    expect(analysis.candidate.latitude).toBe(19.076)
    expect(analysis.candidate.longitude).toBe(72.877)
    expect(analysis.geotechnicalContext).toBe(geo)
    expect(analysis.geotechnicalContext.soilVerdictAnalysis).toBe(geo.soilVerdictAnalysis)
    expect(analysis.finalStatus).toBe('PRELIMINARY_RECOMMENDATION')
  }, 60000)

  it('GIS-only analysis cannot return APPROVED_FOR_CONSTRUCTION', () => {
    expect(isApprovedForConstruction('RECOMMENDED_FOR_PRELIMINARY_ASSESSMENT')).toBe(false)
    expect(isApprovedForConstruction('APPROVED FOR CONSTRUCTION')).toBe(true)
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const powerSummary = summarizePowerInfrastructure(null, 19.076, 72.877, 10)
    const candidates = generateTowerCandidates({
      planningKmlFeatures: [lineFeature],
      geo,
      power: null,
      powerSummary,
      searchRadiusKm: 10,
    })
    for (const c of candidates) {
      expect(isApprovedForConstruction(c.recommendation)).toBe(false)
    }
  })

  it('mandatory investigation status remains in planning context', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const ctx = buildTowerPlanningContext(geo, { lat: 19.076, lon: 72.877 }, null)
    expect(ctx.mandatoryInvestigations.some((m) => /borehole|CBR|Wenner|groundwater/i.test(m))).toBe(true)
  })
})
