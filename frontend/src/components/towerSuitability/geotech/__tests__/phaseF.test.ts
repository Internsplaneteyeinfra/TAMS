import { describe, expect, it } from 'vitest'

import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
import { runPileEngineAnalysis } from '../pile/pileEngine'
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

describe('Phase F — pile foundation matrix', () => {
  it('generates 6 combinations per borehole', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const bh = geo.pileEngineAnalysis?.byBorehole[0]
    expect(bh?.matrix.length).toBe(6)
    expect(bh?.byDiameter['450mm']['1.5m']).toBeDefined()
    expect(bh?.byDiameter['600mm']['2.0m']).toBeDefined()
  })

  it('calculates vertical and uplift for sand', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const cell = geo.pileEngineAnalysis!.byBorehole[0].byDiameter['600mm']['1.5m']
    expect(cell.verticalCapacity.safe_T.value).toBeGreaterThan(0)
    expect(cell.upliftCapacity.safe_T.value).toBeGreaterThan(0)
    expect(cell.layerCalculations.length).toBeGreaterThan(0)
  })

  it('calculates pile capacity for clay using predicted cohesion (PR-1)', () => {
    const clay = {
      ...sandySignals(),
      soilScreening: { ...sandySignals().soilScreening!, textureClass: 'Clay' },
    } as SiteSignals
    const geo = buildGeotechnicalIntelligence(clay)
    const cell = geo.pileEngineAnalysis!.byBorehole[0].matrix[0]
    expect(cell.verticalCapacity.safe_T.value).not.toBeNull()
    expect(cell.validation.passed).toBe(true)
  })

  it('detects mixed soil condition across layers', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const layers = geo.pileEngineAnalysis!.byBorehole[0].matrix[0].layerCalculations
    expect(layers.some((l) => l.soilCondition)).toBe(true)
  })

  it('lateral uses preliminary GIS estimate when c–φ resolved', () => {
    const geo = buildGeotechnicalIntelligence(sandySignals())
    const cell = geo.pileEngineAnalysis!.byBorehole[0].matrix[0]
    expect(cell.lateralCapacity.safe_T.status).toBe('ENGINEERING_CORRELATED')
    expect(cell.lateralCapacity.safe_T.value).not.toBeNull()
  })
})
