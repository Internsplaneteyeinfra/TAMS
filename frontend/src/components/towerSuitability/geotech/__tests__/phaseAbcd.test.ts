import { describe, expect, it } from 'vitest'

import { planBoreholeInvestigation, parseInvestigationGeometry } from '../boreholePlanning'
import { normalizeGrainSize, buildSoilLayerParameters } from '../soilParameterEngine'
import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
import type { SiteSignals } from '../../scoring'
import type { SoilProfileInterval } from '../types'

function mockSignals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    lat: 19.076,
    lon: 72.877,
    elevationM: 12,
    slopeDeg: 3,
    soilScreening: {
      provider: 'SoilGrids',
      textureClass: 'Loam',
      indicativeSbcTm2: { low: 8, high: 16 },
      indicativeCbrPct: { low: 4, high: 10 },
      confidencePct: 72,
      confidenceNote: 'test',
      layers: [
        {
          depthLabel: '0-5cm',
          clayPct: 18,
          sandPct: 42,
          siltPct: 40,
          bulkDensityGcc: 1.35,
          ph: 7.2,
          coarseFragPct: 5,
        },
        {
          depthLabel: '5-15cm',
          clayPct: 20,
          sandPct: 40,
          siltPct: 40,
          bulkDensityGcc: 1.38,
          ph: 7.1,
          coarseFragPct: 6,
        },
        {
          depthLabel: '15-30cm',
          clayPct: 22,
          sandPct: 38,
          siltPct: 40,
          bulkDensityGcc: 1.4,
          ph: 7.0,
          coarseFragPct: 7,
        },
        {
          depthLabel: '30-60cm',
          clayPct: 24,
          sandPct: 36,
          siltPct: 40,
          bulkDensityGcc: 1.42,
          ph: 6.9,
          coarseFragPct: 8,
        },
        {
          depthLabel: '60-100cm',
          clayPct: 26,
          sandPct: 34,
          siltPct: 40,
          bulkDensityGcc: 1.44,
          ph: 6.8,
          coarseFragPct: 9,
        },
        {
          depthLabel: '100-200cm',
          clayPct: 28,
          sandPct: 32,
          siltPct: 40,
          bulkDensityGcc: 1.46,
          ph: 6.7,
          coarseFragPct: 10,
        },
      ],
    },
    ...overrides,
  } as SiteSignals
}

describe('Phase A — borehole planning', () => {
  it('plans single point for point geometry', () => {
    const g = parseInvestigationGeometry({
      type: 'point',
      coordinates: [{ lat: 19.0, lon: 72.0 }],
    })
    const plan = planBoreholeInvestigation(g)
    expect(plan.totalPoints).toBe(1)
    expect(plan.points[0].boreholeId).toBe('BH-01')
    expect(plan.points[0].status).toBe('PROPOSED_GIS_INVESTIGATION_POINT')
    expect(plan.points[0].recommendedInvestigationDepthM).toBe(2.0)
  })

  it('plans multiple points along a line', () => {
    const g = parseInvestigationGeometry({
      type: 'line',
      coordinates: [
        { lat: 19.0, lon: 72.0 },
        { lat: 19.01, lon: 72.05 },
        { lat: 19.02, lon: 72.1 },
      ],
    })
    const plan = planBoreholeInvestigation(g)
    expect(plan.totalPoints).toBeGreaterThanOrEqual(2)
    expect(plan.points[0].boreholeId).toBe('BH-01')
    expect(plan.points.every((p) => p.status === 'PROPOSED_GIS_INVESTIGATION_POINT')).toBe(true)
  })
})

describe('Phase C — soil parameter engine', () => {
  it('normalizes grain size to ~100%', () => {
    const n = normalizeGrainSize(40, 35, 25, 8)
    expect(n.sum).toBeGreaterThanOrEqual(99)
    expect(n.sum).toBeLessThanOrEqual(101)
  })

  it('calculates PI as LL minus PL', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals())
    const layer = geo.soilLayerParameters?.[0]
    expect(layer).toBeDefined()
    if (!layer) return
    if (layer.liquidLimit.value != null && layer.plasticLimit.value != null) {
      expect(layer.plasticityIndex.status).toBe('CALCULATED')
      expect(layer.plasticityIndex.value).toBeCloseTo(
        layer.liquidLimit.value - layer.plasticLimit.value,
        0
      )
    }
  })
})

describe('Phase A–D integration', () => {
  it('builds borehole plan, soil layers, and soil test summary', () => {
    const geo = buildGeotechnicalIntelligence(mockSignals(), {
      investigationGeometry: parseInvestigationGeometry({
        type: 'polygon',
        coordinates: [
          { lat: 19.0, lon: 72.0 },
          { lat: 19.01, lon: 72.0 },
          { lat: 19.01, lon: 72.01 },
          { lat: 19.0, lon: 72.01 },
        ],
      }),
    })
    expect(geo.boreholeInvestigationPlan?.totalPoints).toBeGreaterThan(0)
    expect(geo.soilLayerParameters?.length).toBe(4)
    expect(geo.soilTestSummary?.totalRecords).toBe(
      (geo.boreholeInvestigationPlan?.totalPoints ?? 0) * 4
    )
    expect(geo.soilTestSummary?.validationNotes.some((n) => n.includes('Proposed GIS'))).toBe(true)
  })
})
