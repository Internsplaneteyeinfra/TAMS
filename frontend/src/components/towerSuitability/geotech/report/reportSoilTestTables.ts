/**
 * Transmission-line style Soil Test Summary — matches reference Word report format.
 * Plain numbers (no status tags in cells), per-BH tables, reference-style GWT & remarks.
 */

import type { GeotechnicalIntelligence, ProvenanceValue, SoilProfileInterval, SoilTestSummaryRecord } from '../types'
import type { LayerEngineeringParameters } from '../parameterResolution/parameterTypes'
import { reportTableNumber, shortIsSoilClass } from './reportFormatting'
import { transmissionLineMaterialRemark } from './transmissionLineRemarks'

const DASH = '—'

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return Number(v.toFixed(digits)).toString()
}

function pickNum(
  provenance: ProvenanceValue<number | null> | undefined,
  resolved: { value: number } | undefined,
  fallback?: number | null,
  digits = 1
): string {
  if (provenance?.value != null && Number.isFinite(provenance.value)) {
    return fmtNum(provenance.value, digits)
  }
  if (resolved?.value != null && Number.isFinite(resolved.value)) {
    return fmtNum(resolved.value, digits)
  }
  if (fallback != null && Number.isFinite(fallback)) return fmtNum(fallback, digits)
  return DASH
}

function resolvedLayer(
  geo: GeotechnicalIntelligence,
  reportDepth: string
): LayerEngineeringParameters | undefined {
  return geo.resolvedParameterContext?.byLayer.find((l) => l.reportDepth === reportDepth)
}

/** Reference report GWT column — "Not encountered up to 2.0" unless field note exists. */
export function resolveGroundWaterTableDisplay(
  geo: GeotechnicalIntelligence,
  investigationDepthM = 2.0
): string {
  const measured = geo.soilTestSummary?.records.find(
    (r) => r.groundWaterTableM.status === 'MEASURED' && r.groundWaterTableM.value != null
  )
  if (measured?.groundWaterTableM.value != null) {
    return fmtNum(measured.groundWaterTableM.value, 1)
  }
  return `Not encountered up to ${investigationDepthM.toFixed(1)}`
}

/** Texture → indicative SBC/CBR mid (screening). */
export function indicativeFromUsda(texture: string | null | undefined): {
  sbcMid: number | null
  cbrMid: number | null
  sbcRange: string
  cbrRange: string
} {
  if (!texture) {
    return { sbcMid: null, cbrMid: null, sbcRange: DASH, cbrRange: DASH }
  }
  const t = texture.toLowerCase()
  let sbc = { low: 8, high: 15 }
  let cbr = { low: 3, high: 9 }
  if (t.includes('sand') && !t.includes('clay')) {
    sbc = { low: 12, high: 22 }
    cbr = { low: 8, high: 18 }
  } else if (t.includes('sandy loam') || t.includes('loamy sand')) {
    sbc = { low: 10, high: 18 }
    cbr = { low: 6, high: 14 }
  } else if (t.includes('loam') && !t.includes('clay')) {
    sbc = { low: 8, high: 16 }
    cbr = { low: 4, high: 10 }
  } else if (t.includes('silt')) {
    sbc = { low: 7, high: 14 }
    cbr = { low: 3, high: 8 }
  } else if (t.includes('clay')) {
    sbc = { low: 6, high: 14 }
    cbr = { low: 2, high: 7 }
  }
  return {
    sbcMid: Math.round((sbc.low + sbc.high) / 2),
    cbrMid: Math.round((cbr.low + cbr.high) / 2),
    sbcRange: `${sbc.low}–${sbc.high}`,
    cbrRange: `${cbr.low}–${cbr.high}`,
  }
}

/** Reference Word file column headers (one table per location / BH). */
export const SOIL_TEST_HEADERS = [
  'Depth (m)',
  'Gravel %',
  'Sand %',
  'Silt %',
  'Clay %',
  'LL (%)',
  'PL (%)',
  'PI (%)',
  'Soil Class',
  'MDD (g/cc)',
  'OMC (%)',
  'Dry Density (g/cc)',
  'FSI (%)',
  'Bulk Density (g/cc)',
  'UCS (kg/cm²)',
  'SG',
  'SBC (T/m²)',
  'CBR (%)',
  'Remarks',
  'Ground Water Table (m)',
] as const

export type SoilTestRow = string[]

function sbcCellForDepth(geo: GeotechnicalIntelligence, depthToM: number, texture: string | null): string {
  const match = geo.sbcAnalysis.byDepth?.find((d) => Math.abs(d.depthM - depthToM) < 0.05)
  const calc = match?.netSafeBearingCapacityTm2
  if (calc?.value != null && Number.isFinite(calc.value)) {
    return fmtNum(calc.value, 1)
  }
  const ind = indicativeFromUsda(texture)
  return ind.sbcMid != null ? String(ind.sbcMid) : DASH
}

function cbrCell(geo: GeotechnicalIntelligence, reportDepth: string, texture: string | null): string {
  const resolved = resolvedLayer(geo, reportDepth)
  if (resolved?.estimatedCbrPct.value != null) {
    return fmtNum(resolved.estimatedCbrPct.value, 1)
  }
  const meas = geo.cbrAnalysis.measuredByDepth.find((r) => r.reportDepth === reportDepth)
  if (meas?.measuredCBR.value != null && meas.measuredCBR.status === 'MEASURED') {
    return fmtNum(meas.measuredCBR.value, 1)
  }
  const est = geo.cbrAnalysis.estimatedByDepth.find((r) => r.reportDepth === reportDepth)
  if (est?.estimatedCBR.value) {
    const { low, high } = est.estimatedCBR.value
    return fmtNum((low + high) / 2, 1)
  }
  const ind = indicativeFromUsda(texture)
  return ind.cbrMid != null ? String(ind.cbrMid) : DASH
}

function numericValues(
  layerParams: import('../types').SoilLayerParameters | null | undefined,
  resolved: LayerEngineeringParameters | undefined,
  L: SoilProfileInterval
): {
  gravel: number | null
  sand: number | null
  silt: number | null
  clay: number | null
  ll: number | null
  pl: number | null
  pi: number | null
  mdd: number | null
  omc: number | null
  dry: number | null
  fsi: number | null
  bulk: number | null
  ucs: number | null
  sg: number | null
} {
  return {
    gravel: layerParams?.gravelPct.value ?? resolved?.gravelPct.value ?? L.gravelPct?.value ?? null,
    sand: layerParams?.sandPct.value ?? resolved?.sandPct.value ?? L.sandPct.value ?? null,
    silt: layerParams?.siltPct.value ?? resolved?.siltPct.value ?? L.siltPct.value ?? null,
    clay: layerParams?.clayPct.value ?? resolved?.clayPct.value ?? L.clayPct.value ?? null,
    ll: layerParams?.liquidLimit.value ?? resolved?.liquidLimit.value ?? null,
    pl: layerParams?.plasticLimit.value ?? resolved?.plasticLimit.value ?? null,
    pi: layerParams?.plasticityIndex.value ?? resolved?.plasticityIndex.value ?? null,
    mdd: resolved?.maximumDryDensityGcc.value ?? null,
    omc: resolved?.optimumMoistureContentPct.value ?? null,
    dry: resolved?.dryDensityGcc.value ?? L.dryDensityGcc.value ?? null,
    fsi: resolved?.freeSwellingIndexPct.value ?? null,
    bulk: resolved?.bulkDensityGcc.value ?? L.bulkDensityGcc.value ?? null,
    ucs: resolved?.ucsKgCm2.value ?? null,
    sg: resolved?.specificGravity.value ?? null,
  }
}

/** One Transmission-line soil-test row — plain numbers, reference format. */
export function soilTestRowFromInterval(
  geo: GeotechnicalIntelligence,
  L: SoilProfileInterval,
  gwtNote?: string,
  layerParams?: import('../types').SoilLayerParameters | null
): SoilTestRow {
  const texture = L.usdaTexture.value
  const resolved = resolvedLayer(geo, L.reportDepth)
  const gwt = gwtNote ?? resolveGroundWaterTableDisplay(geo)
  const nums = numericValues(layerParams, resolved, L)

  const soilClassRaw =
    layerParams?.soilClassification.value ??
    resolved?.isClassification.value ??
    L.isSoilClassification.value ??
    null

  const remark = transmissionLineMaterialRemark({
    sand: nums.sand,
    silt: nums.silt,
    clay: nums.clay,
    dryDensityGcc: nums.dry,
    soilClass: soilClassRaw,
    depthToM: L.depthToM,
    gravel: nums.gravel,
  })

  return [
    `${L.depthFromM.toFixed(1)}–${L.depthToM.toFixed(1)}`,
    pickNum(layerParams?.gravelPct, resolved?.gravelPct, nums.gravel, 1),
    pickNum(layerParams?.sandPct, resolved?.sandPct, nums.sand, 1),
    pickNum(layerParams?.siltPct, resolved?.siltPct, nums.silt, 1),
    pickNum(layerParams?.clayPct, resolved?.clayPct, nums.clay, 1),
    pickNum(layerParams?.liquidLimit, resolved?.liquidLimit, nums.ll, 0),
    pickNum(layerParams?.plasticLimit, resolved?.plasticLimit, nums.pl, 0),
    pickNum(layerParams?.plasticityIndex, resolved?.plasticityIndex, nums.pi, 0),
    shortIsSoilClass(soilClassRaw),
    fmtNum(nums.mdd, 2),
    fmtNum(nums.omc, 1),
    fmtNum(nums.dry, 2),
    fmtNum(nums.fsi, 1),
    fmtNum(nums.bulk, 2),
    fmtNum(nums.ucs, 2),
    fmtNum(nums.sg, 2),
    sbcCellForDepth(geo, L.depthToM, texture),
    cbrCell(geo, L.reportDepth, texture),
    remark.length > 52 ? `${remark.slice(0, 49)}…` : remark,
    gwt,
  ]
}

/** Row from Phase D record — plain numbers for per-BH table. */
export function transmissionLineRowFromRecord(r: SoilTestSummaryRecord, gwt: string): SoilTestRow {
  const remark = transmissionLineMaterialRemark({
    sand: r.sandPct.value,
    silt: r.siltPct.value,
    clay: r.clayPct.value,
    dryDensityGcc: r.dryDensityGcc.value,
    soilClass: r.soilClassification.value,
    depthToM: parseFloat(r.layerDepthLabel.split('–')[1] || '0.5'),
    gravel: r.gravelPct.value,
  })
  return [
    r.layerDepthLabel,
    reportTableNumber(r.gravelPct, 1),
    reportTableNumber(r.sandPct, 1),
    reportTableNumber(r.siltPct, 1),
    reportTableNumber(r.clayPct, 1),
    reportTableNumber(r.liquidLimit, 0),
    reportTableNumber(r.plasticLimit, 0),
    reportTableNumber(r.plasticityIndex, 0),
    shortIsSoilClass(r.soilClassification.value),
    reportTableNumber(r.maximumDryDensityGcc, 2),
    reportTableNumber(r.optimumMoistureContentPct, 1),
    reportTableNumber(r.dryDensityGcc, 2),
    reportTableNumber(r.freeSwellingIndexPct, 1),
    reportTableNumber(r.bulkDensityGcc, 2),
    reportTableNumber(r.ucsKgCm2, 2),
    reportTableNumber(r.specificGravity, 2),
    reportTableNumber(r.sbcTm2, 1),
    reportTableNumber(r.cbrPct, 1),
    remark.length > 52 ? `${remark.slice(0, 49)}…` : remark,
    gwt,
  ]
}

export function aggregateSoilTestRow(
  geo: GeotechnicalIntelligence,
  layers: SoilProfileInterval[],
  depthLabel: string,
  depthToM: number,
  gwtNote?: string
): SoilTestRow {
  if (!layers.length) {
    return [
      depthLabel,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      DASH,
      'No overlapping modelled layers',
      gwtNote ?? resolveGroundWaterTableDisplay(geo),
    ]
  }
  const fakeInterval = {
    ...layers[0],
    depthFromM: layers[0].depthFromM,
    depthToM: layers[layers.length - 1].depthToM,
    reportDepthLabel: depthLabel,
  } as SoilProfileInterval
  const row = soilTestRowFromInterval(geo, fakeInterval, gwtNote)
  row[0] = depthLabel
  row[16] = sbcCellForDepth(geo, depthToM, layers[layers.length - 1]?.usdaTexture.value ?? null)
  return row
}

export function buildHalfMetreSoilRows(geo: GeotechnicalIntelligence): SoilTestRow[] {
  const gwt = resolveGroundWaterTableDisplay(geo)
  return geo.soilProfile.map((L) => {
    const layerParams = geo.soilLayerParameters?.find((p) => p.reportDepth === L.reportDepth)
    return soilTestRowFromInterval(geo, L, gwt, layerParams)
  })
}

export function buildOneMetreSoilRows(geo: GeotechnicalIntelligence): SoilTestRow[] {
  const gwt = resolveGroundWaterTableDisplay(geo)
  const p = geo.soilProfile
  const top = p.filter((L) => L.depthToM <= 1.0 + 1e-6)
  const bot = p.filter((L) => L.depthFromM >= 1.0 - 1e-6)
  return [
    aggregateSoilTestRow(geo, top, '0–1', 1.0, gwt),
    aggregateSoilTestRow(geo, bot, '1–2', 2.0, gwt),
  ]
}

/** Per-BH tables matching reference Word structure. */
export function buildPerBoreholeSoilTables(geo: GeotechnicalIntelligence): Array<{
  locationIndex: number
  boreholeId: string
  latitude: number
  longitude: number
  rows: SoilTestRow[]
}> {
  const gwt = resolveGroundWaterTableDisplay(geo)
  const records = geo.soilTestSummary?.records ?? []
  const points = geo.boreholeInvestigationPlan?.points ?? []

  if (records.length && points.length) {
    return points.map((pt, idx) => ({
      locationIndex: idx + 1,
      boreholeId: pt.boreholeId,
      latitude: pt.latitude,
      longitude: pt.longitude,
      rows: records
        .filter((r) => r.boreholeId === pt.boreholeId)
        .map((r) => transmissionLineRowFromRecord(r, gwt)),
    }))
  }

  const gwtRows = buildHalfMetreSoilRows(geo)
  if (points.length) {
    return points.map((pt, idx) => ({
      locationIndex: idx + 1,
      boreholeId: pt.boreholeId,
      latitude: pt.latitude,
      longitude: pt.longitude,
      rows: gwtRows,
    }))
  }

  return [
    {
      locationIndex: 1,
      boreholeId: 'BH-01',
      latitude: geo.location.lat,
      longitude: geo.location.lon,
      rows: gwtRows,
    },
  ]
}

export const SOIL_TEST_FOOTNOTES = [
  'Values are from ISRIC SoilGrids / PR-1 engineering resolution for the entered coordinates.',
  'Ground Water Table: screening convention when field observation is not available — verify during borehole.',
  'Soil Class: IS 1498 preliminary from grain size and correlated Atterberg limits.',
  'SBC: IS 6403 net safe bearing capacity when c, φ, γ inputs are complete; otherwise texture screening mid-value.',
]
