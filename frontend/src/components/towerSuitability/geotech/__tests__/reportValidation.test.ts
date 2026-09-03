/**
 * Report Validation & Formatting Phase — dedicated tests.
 */

import { describe, expect, it } from 'vitest'

import { buildGeotechnicalIntelligence } from '../buildGeotechnicalIntelligence'
import { buildGeotechReportData, validateGeotechReportData } from '../report/buildGeotechReportData'
import { defaultGeotechDocxInput } from '../geotechReportCache'
import { ALL_SBC_DEPTHS_M } from '../sbc/types'
import { buildGeotechInvestigationDocx } from '../report/buildGeotechInvestigationDocx'
import { buildPhaseIReportBundle } from '../../towerPlanning/buildPhaseIReportBundle'
import type { SiteSignals } from '../../scoring'
import type { GeotechnicalIntelligence } from '../types'

function mockSignals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    lat: 19.076,
    lon: 72.877,
    elevationM: 12,
    slopeDeg: 3,
    placeLabel: 'Mumbai, Maharashtra',
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

function buildSampleGeo(overrides: Partial<SiteSignals> = {}): GeotechnicalIntelligence {
  return buildGeotechnicalIntelligence(mockSignals(overrides))
}

describe('Report Validation Phase', () => {
  it('1. report location is dynamic from coordinates', () => {
    const geo = buildSampleGeo({ lat: 12.97, lon: 77.59, placeLabel: 'Bengaluru, Karnataka' })
    const data = buildGeotechReportData({ geo, skipValidation: true })
    expect(data.location.latitude).toBeCloseTo(12.97, 4)
    expect(data.location.longitude).toBeCloseTo(77.59, 4)
    expect(data.metadata.reportTitle).toBe('Geotechnical Investigation Report')
    expect(data.metadata.projectName).toBe('Transmission line')
  })

  it('2. no Nirona/Bhuj/Gujarat hardcoding in default metadata', async () => {
    const geo = buildSampleGeo({ lat: 23.02, lon: 72.57, placeLabel: 'Ahmedabad, Gujarat' })
    const input = defaultGeotechDocxInput(geo)
    expect(input.projectName).not.toMatch(/Nirona|Bhuj/)
    const data = buildGeotechReportData({ ...input, skipValidation: true })
    const blob = await buildGeotechInvestigationDocx({ ...input, skipValidation: true })
    expect(blob).toBeTruthy()
    expect(JSON.stringify(data.textSamplesForLocationScan)).not.toMatch(/Nirona|Bhuj/)
  })

  it('3. PI equals LL − PL for soil layer parameters', () => {
    const geo = buildSampleGeo()
    for (const L of geo.soilLayerParameters ?? []) {
      const ll = L.liquidLimit.value
      const pl = L.plasticLimit.value
      const pi = L.plasticityIndex.value
      if (ll != null && pl != null && pi != null) {
        expect(Math.abs(pi - (ll - pl))).toBeLessThanOrEqual(0.6)
      }
    }
  })

  it('4. grain size consistency validation runs', () => {
    const geo = buildSampleGeo()
    const data = buildGeotechReportData({ geo, skipValidation: true })
    const result = validateGeotechReportData(data)
    expect(result.summary.grainSize).toBeDefined()
  })

  it('5. IS soil classification from authoritative engine', () => {
    const geo = buildSampleGeo()
    expect(geo.soilLayerParameters?.[0]?.classificationMethod).toBeTruthy()
    expect(geo.soilLayerParameters?.[0]?.soilClassification.source).toBeTruthy()
  })

  it('6. all required SBC depths appear in analysis', () => {
    const geo = buildSampleGeo()
    const depths = (geo.sbcAnalysis.byDepth ?? []).map((d) => d.depthM)
    for (const d of ALL_SBC_DEPTHS_M) {
      expect(depths).toContain(d)
    }
  })

  it('7. 2.0–4.0 m SBC rows labelled as extrapolation', () => {
    const geo = buildSampleGeo()
    const deep = (geo.sbcAnalysis.byDepth ?? []).filter((d) => d.depthM > 2.0)
    expect(deep.length).toBeGreaterThan(0)
    for (const row of deep) {
      expect(row.dataBasis).toBe('ENGINEERING_DEPTH_EXTRAPOLATION')
    }
  })

  it('8. six pile combinations exist', () => {
    const geo = buildSampleGeo()
    for (const dia of ['450mm', '600mm'] as const) {
      for (const dep of ['1.0m', '1.5m', '2.0m'] as const) {
        expect(geo.pileAnalysis[dia][dep]).toBeDefined()
      }
    }
  })

  it('9. 450 mm piles are used', () => {
    const geo = buildSampleGeo()
    expect(geo.pileAnalysis['450mm']).toBeDefined()
  })

  it('10. 600 mm piles are used', () => {
    const geo = buildSampleGeo()
    expect(geo.pileAnalysis['600mm']).toBeDefined()
  })

  it('11. lateral pile capacity uses preliminary GIS estimate when c–φ resolved', () => {
    const geo = buildSampleGeo()
    const cell = geo.pileAnalysis['450mm']['2.0m'].lateral
    expect(cell.status).toBe('ENGINEERING_CORRELATED')
    expect(cell.value).not.toBeNull()
  })

  it('12. modelled engineering values retain structured status in report data', () => {
    const geo = buildSampleGeo()
    const rec = geo.soilTestSummary?.records?.[0]
    expect(rec?.maximumDryDensityGcc.status).toBe('MODEL_PREDICTED')
    expect(rec?.maximumDryDensityGcc.value).not.toBeNull()
  })

  it('13. MODELLED does not become MEASURED in validation', () => {
    const geo = buildSampleGeo()
    const data = buildGeotechReportData({ geo, skipValidation: true })
    const result = validateGeotechReportData(data)
    expect(result.issues.filter((i) => i.code === 'PROVENANCE_MEASURED')).toHaveLength(0)
  })

  it('14. no fake construction approval in GIS-only verdict', () => {
    const geo = buildSampleGeo()
    const data = buildGeotechReportData({ geo, skipValidation: true })
    const result = validateGeotechReportData(data)
    expect(result.issues.filter((i) => i.code === 'CONSTRUCTION_CLAIM')).toHaveLength(0)
  })

  it('15. power section only when Phase I power check was run', () => {
    const geo = buildSampleGeo()
    const without = buildGeotechReportData({ geo, skipValidation: true })
    expect(without.sections.includePowerInfrastructure).toBe(false)
    const phaseI = buildPhaseIReportBundle({
      geo,
      investigationCenter: { lat: geo.location.lat, lon: geo.location.lon },
      investigationGeometry: null,
      planningGeometry: null,
      powerChecked: true,
      powerSummary: {
        nearestLabel: 'Substation X',
        infrastructureType: 'substation',
        distanceKm: 2.5,
        direction: 'NE',
        source: 'OSM',
        method: 'GIS query',
        confidence: 'MODERATE',
        status: 'GIS_DETECTED',
        message: 'Detected within search radius',
        raw: null,
      },
      towerCandidates: [],
      selectedTowerAnalysis: null,
    })
    const withPower = buildGeotechReportData({ geo, phaseI, skipValidation: true })
    expect(withPower.sections.includePowerInfrastructure).toBe(true)
  })

  it('16. tower section only when Phase I workflow executed', () => {
    const geo = buildSampleGeo()
    const base = buildGeotechReportData({ geo, skipValidation: true })
    expect(base.sections.includeTowerPlanning).toBe(false)
  })

  it('17. validation passes for complete sample geo', () => {
    const geo = buildSampleGeo()
    const data = buildGeotechReportData({ geo })
    expect(data.validation.passed).toBe(true)
  })

  it('18. PI inconsistency fails validation', () => {
    const geo = buildSampleGeo()
    if (!geo.soilLayerParameters?.length) return
    const broken = structuredClone(geo)
    broken.soilLayerParameters![0].plasticityIndex = {
      ...broken.soilLayerParameters![0].plasticityIndex,
      value: 99,
    }
    expect(() => buildGeotechReportData({ geo: broken })).toThrow(/validation failed/i)
  })

  it('19. BH coordinates consistent across sections', () => {
    const geo = buildSampleGeo()
    const plan = geo.boreholeInvestigationPlan?.points?.[0]
    const rec = geo.soilTestSummary?.records?.[0]
    if (plan && rec) {
      expect(rec.latitude).toBeCloseTo(plan.latitude, 5)
      expect(rec.longitude).toBeCloseTo(plan.longitude, 5)
    }
  })

  it('20. DOCX buffer generates for validated sample', async () => {
    const geo = buildSampleGeo()
    const buf = await buildGeotechInvestigationDocx(defaultGeotechDocxInput(geo))
    expect(buf).toBeTruthy()
    if (buf instanceof Blob) {
      expect(buf.size).toBeGreaterThan(5000)
    } else {
      expect((buf as Buffer).length).toBeGreaterThan(5000)
    }
  })
})
