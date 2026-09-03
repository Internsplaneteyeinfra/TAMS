/**
 * Foundation type suitability for transmission-line report §2.2.
 * Rule-based assessment from present ground (lat/lon) geotechnical intelligence.
 */

import type { GeotechnicalIntelligence } from '../types'
import { recommendFoundation } from '../foundationRecommendation'
import { resolveGroundWaterTableDisplay } from './reportSoilTestTables'
import { shortIsSoilClass } from './reportFormatting'

export type FoundationSuitability =
  | 'Recommended'
  | 'Suitable with conditions'
  | 'Alternative'
  | 'Not recommended'

export interface FoundationSuitabilityRow {
  foundationType: string
  suitability: FoundationSuitability
  remarks: string
}

function pileSafeVerticalT(
  geo: GeotechnicalIntelligence,
  diameter: '450mm' | '600mm',
  depth: '1.0m' | '1.5m' | '2.0m'
): number | null {
  const cell = geo.pileAnalysis[diameter][depth]
  const v = cell.vertical.value
  return v != null && Number.isFinite(v) ? v : null
}

function dominantSoilClass(geo: GeotechnicalIntelligence): string {
  const fromLayer = geo.soilLayerParameters?.find((l) => l.depthFromM >= 1.0)?.soilClassification.value
  const fromRecord = geo.soilTestSummary?.records.find((r) => r.layerDepthLabel.includes('1.5'))?.soilClassification
    .value
  const raw = fromLayer ?? fromRecord ?? geo.soilProfile[2]?.usdaTexture.value ?? 'CH'
  return shortIsSoilClass(raw)
}

function adoptedSbcAtFoundationDepth(geo: GeotechnicalIntelligence, depthM = 1.5): number | null {
  const byDepth = geo.sbcAnalysis.byDepth?.find((d) => Math.abs(d.depthM - depthM) < 0.05)
    ?.netSafeBearingCapacityTm2?.value
  if (byDepth != null && Number.isFinite(byDepth)) return byDepth
  const engine = geo.sbcEngineAnalysis?.siteSummary.adoptedPreliminary?.value
  if (engine != null && Number.isFinite(engine)) return engine
  const adopted = geo.sbcAnalysis.adoptedPreliminary?.value
  return adopted != null && Number.isFinite(adopted) ? adopted : null
}

function maxClayPct(geo: GeotechnicalIntelligence): number {
  const fromLayers = (geo.soilLayerParameters ?? []).map((l) => l.clayPct.value ?? 0)
  const fromRecords = (geo.soilTestSummary?.records ?? []).map((r) => r.clayPct.value ?? 0)
  return Math.max(0, ...fromLayers, ...fromRecords)
}

/** Foundation recommendation table driven by site soil, SBC, slope, and pile screening. */
export function buildFoundationSuitabilityTable(geo: GeotechnicalIntelligence): FoundationSuitabilityRow[] {
  const rec = geo.foundationRecommendation ?? recommendFoundation(geo)
  const sbc = adoptedSbcAtFoundationDepth(geo, 1.5)
  const slope = geo.location.slopeDeg.value ?? 0
  const clay = maxClayPct(geo)
  const soilClass = dominantSoilClass(geo)
  const gwt = resolveGroundWaterTableDisplay(geo)
  const pile450 = pileSafeVerticalT(geo, '450mm', '2.0m')
  const pile600 = pileSafeVerticalT(geo, '600mm', '2.0m')
  const cbrEst = geo.cbrAnalysis.estimatedByDepth[0]?.estimatedCBR.value
  const cbr =
    geo.cbrEngineAnalysis?.recommendedDesignCbr.value ??
    (cbrEst && typeof cbrEst === 'object' && 'low' in cbrEst
      ? Math.round((cbrEst.low + cbrEst.high) / 2)
      : geo.soilTestSummary?.records[0]?.cbrPct.value)

  const clayNote =
    clay >= 30
      ? `CH/clay-dominated profile (${clay.toFixed(0)}% clay, class ${soilClass}); settlement and volume-change risk.`
      : `Soil class ${soilClass} at investigation depth.`

  const rows: FoundationSuitabilityRow[] = []

  // — Isolated shallow footing
  let shallow: FoundationSuitability = 'Suitable with conditions'
  let shallowRemarks = ''
  if (slope > 12) {
    shallow = 'Not recommended'
    shallowRemarks = `Slope ${slope.toFixed(1)}° exceeds comfort for isolated footings on sloping ground.`
  } else if (sbc != null && sbc >= 15 && clay < 35 && slope <= 8) {
    shallow = rec.category === 'SHALLOW_FOUNDATION' ? 'Recommended' : 'Suitable with conditions'
    shallowRemarks = `Preliminary net SBC ≈ ${sbc.toFixed(1)} T/m² at Df 1.5 m. ${clayNote} GWT: ${gwt}.`
  } else if (sbc != null && sbc >= 10) {
    shallow =
      rec.category === 'SHALLOW_FOUNDATION' || rec.category === 'RAFT_FOUNDATION'
        ? 'Suitable with conditions'
        : 'Alternative'
    shallowRemarks = `Moderate SBC ≈ ${sbc.toFixed(1)} T/m². ${clayNote} Confirm drained shear parameters before structural design.`
  } else {
    shallow = sbc != null && sbc < 10 ? 'Not recommended' : 'Suitable with conditions'
    shallowRemarks =
      sbc != null
        ? `Low preliminary SBC ≈ ${sbc.toFixed(1)} T/m² — shallow footing capacity marginal for transmission loads. ${clayNote}`
        : `SBC screening incomplete — field investigation required. ${clayNote}`
  }
  rows.push({
    foundationType: '1.0 m × 1.0 m square isolated stub footing',
    suitability: shallow,
    remarks: shallowRemarks,
  })

  // — Raft
  let raft: FoundationSuitability = 'Alternative'
  let raftRemarks = `Distributes load over wider contact area; useful where pad spacing is tight. ${clayNote}`
  if (sbc != null && sbc >= 12 && slope <= 10 && clay < 40) {
    raft = rec.category === 'RAFT_FOUNDATION' ? 'Recommended' : 'Suitable with conditions'
    raftRemarks = `SBC ≈ ${sbc.toFixed(1)} T/m² supports raft screening at Df 1.5 m. ${clayNote}`
  } else if (slope > 12 || (sbc != null && sbc < 8)) {
    raft = 'Not recommended'
    raftRemarks = `Slope ${slope.toFixed(1)}° or low SBC limits raft efficiency without platform works.`
  }
  rows.push({
    foundationType: 'Raft / combined footing (screening)',
    suitability: raft,
    remarks: raftRemarks,
  })

  // — Pile 450 mm @ 2.0 m
  const pile450Ok = pile450 != null && pile450 >= 5
  let p450: FoundationSuitability = pile450Ok ? 'Recommended' : 'Suitable with conditions'
  let p450Remarks =
    pile450 != null
      ? `Preliminary safe vertical capacity ≈ ${pile450.toFixed(1)} T (450 mm, 2.0 m, IS 2911 screening).`
      : 'Pile capacity not fully resolved — field SPT / static load test required.'
  if (rec.category === 'PILE_FOUNDATION' && pile450Ok) {
    p450 = 'Recommended'
    p450Remarks += ` Preferred for ${soilClass} profile with transmission tower uplift/compression screening.`
  } else if (clay >= 35 && pile450Ok) {
    p450 = 'Recommended'
    p450Remarks += ` Bypasses weak upper clay (${clay.toFixed(0)}%).`
  } else if (!pile450Ok && clay >= 35) {
    p450 = 'Suitable with conditions'
    p450Remarks += ` Clay-heavy site — verify end bearing and shaft friction with borehole logs.`
  }
  rows.push({
    foundationType: 'Cast-in-situ RCC pile — 450 mm dia @ 2.0 m depth',
    suitability: p450,
    remarks: p450Remarks,
  })

  // — Pile 600 mm @ 2.0 m
  const pile600Ok = pile600 != null && pile600 >= 8
  let p600: FoundationSuitability = pile600Ok ? 'Recommended' : 'Alternative'
  let p600Remarks =
    pile600 != null
      ? `Preliminary safe vertical capacity ≈ ${pile600.toFixed(1)} T (600 mm, 2.0 m). Higher capacity for heavy angle / dead-end towers.`
      : 'Capacity pending — requires field validation.'
  if (pile600Ok && (rec.category === 'PILE_FOUNDATION' || clay >= 35)) {
    p600 = 'Recommended'
  }
  rows.push({
    foundationType: 'Cast-in-situ RCC pile — 600 mm dia @ 2.0 m depth',
    suitability: p600,
    remarks: p600Remarks,
  })

  // — Ground improvement
  let gi: FoundationSuitability = 'Alternative'
  let giRemarks =
    'Soil replacement, preloading, or stone columns if shallow foundation is mandatory on weak clay.'
  if (rec.category === 'GROUND_IMPROVEMENT') {
    gi = 'Recommended'
    giRemarks = rec.whyRecommended
  } else if (clay >= 35 && sbc != null && sbc < 12) {
    gi = 'Suitable with conditions'
    giRemarks = `Weak ${soilClass} stratum (SBC ≈ ${sbc.toFixed(1)} T/m²) — consider 1.0–1.5 m engineered fill + compaction before shallow footings.`
  }
  rows.push({
    foundationType: 'Ground improvement (replacement / preloading / surcharging)',
    suitability: gi,
    remarks: giRemarks,
  })

  // — Access / haul road note when CBR low
  if (cbr != null && cbr < 5) {
    rows.push({
      foundationType: 'Construction access — haul road (CBR-based)',
      suitability: 'Suitable with conditions',
      remarks: `Design CBR ≈ ${cbr}% — geotextile / granular sub-base recommended for plant access during foundation works.`,
    })
  }

  // — Overall screening verdict row
  rows.push({
    foundationType: `Primary screening recommendation (${rec.label})`,
    suitability:
      rec.category === 'SITE_NOT_RECOMMENDED'
        ? 'Not recommended'
        : rec.confidence === 'HIGH'
          ? 'Recommended'
          : 'Suitable with conditions',
    remarks: `${rec.whyRecommended} Confidence: ${rec.confidence}. ${rec.alternativeFoundation ? `Alternative: ${rec.alternativeFoundation}.` : ''}`,
  })

  return rows
}
