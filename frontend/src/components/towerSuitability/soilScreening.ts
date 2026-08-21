/**
 * Open-source soil screening helpers (SoilGrids → texture → indicative ranges).
 * Not lab accuracy — suitability screening with explicit confidence %.
 */

export interface SoilDepthSlice {
  depthLabel: string
  clayPct: number | null
  sandPct: number | null
  siltPct: number | null
  bulkDensityGcc: number | null
  ph: number | null
  coarseFragPct: number | null
}

export interface SoilScreening {
  provider: string
  resolutionNote: string
  placeName?: string
  lat: number
  lon: number
  layers: SoilDepthSlice[]
  /** USDA-style texture class from 0–30 cm average */
  textureClass: string
  /** Indicative screening ranges — not design values */
  indicativeSbcTm2: { low: number; high: number }
  indicativeCbrPct: { low: number; high: number }
  confidencePct: number
  confidenceNote: string
  fetchedAt: string
  live: boolean
}

type SoilGridsLayer = {
  name: string
  unit_measure?: { d_factor?: number }
  depths?: Array<{
    label?: string
    values?: { mean?: number | null }
  }>
}

function usdaTexture(sand: number, silt: number, clay: number): string {
  if (clay >= 40) return 'Clay'
  if (clay >= 27 && sand <= 45 && silt < 40) return 'Clay loam'
  if (clay >= 27 && sand > 45) return 'Sandy clay'
  if (clay >= 20 && clay < 35 && silt >= 28 && sand <= 45) return 'Clay loam'
  if (silt >= 80 && clay < 12) return 'Silt'
  if (silt >= 50 && clay >= 12 && clay < 27) return 'Silt loam'
  if (sand >= 85 && clay < 10) return 'Sand'
  if (sand >= 70 && clay < 15) return 'Loamy sand'
  if (sand >= 45 && clay < 20 && silt < 28) return 'Sandy loam'
  if (sand >= 43 && clay >= 7 && clay < 20) return 'Sandy loam'
  if (clay < 27 && silt >= 28 && silt < 50 && sand < 52) return 'Loam'
  return 'Loam (mixed)'
}

function indicativeFromTexture(texture: string): {
  sbc: { low: number; high: number }
  cbr: { low: number; high: number }
  confidencePct: number
} {
  const t = texture.toLowerCase()
  if (t.includes('sand') && !t.includes('clay')) {
    return { sbc: { low: 12, high: 22 }, cbr: { low: 8, high: 18 }, confidencePct: 48 }
  }
  if (t.includes('sandy loam') || t.includes('loamy sand')) {
    return { sbc: { low: 10, high: 18 }, cbr: { low: 6, high: 14 }, confidencePct: 46 }
  }
  if (t.includes('loam') && !t.includes('clay')) {
    return { sbc: { low: 8, high: 16 }, cbr: { low: 4, high: 10 }, confidencePct: 44 }
  }
  if (t.includes('silt')) {
    return { sbc: { low: 7, high: 14 }, cbr: { low: 3, high: 8 }, confidencePct: 42 }
  }
  if (t.includes('clay')) {
    return { sbc: { low: 6, high: 14 }, cbr: { low: 2, high: 7 }, confidencePct: 40 }
  }
  return { sbc: { low: 8, high: 15 }, cbr: { low: 3, high: 9 }, confidencePct: 42 }
}

function readMean(
  layers: SoilGridsLayer[],
  prop: string,
  depthLabel: string
): number | null {
  const layer = layers.find((l) => l.name === prop)
  if (!layer) return null
  const d = layer.depths?.find((x) => (x.label || '') === depthLabel)
  const raw = d?.values?.mean
  if (raw == null || !Number.isFinite(raw)) return null
  const factor = layer.unit_measure?.d_factor || 1
  return raw / factor
}

export function parseSoilGridsResponse(
  json: unknown,
  lat: number,
  lon: number,
  placeName?: string
): SoilScreening | null {
  const root = json as {
    properties?: { layers?: SoilGridsLayer[] }
  }
  const layers = root?.properties?.layers
  if (!Array.isArray(layers) || !layers.length) return null

  const depthLabels = ['0-5cm', '5-15cm', '15-30cm', '30-60cm']
  const slices: SoilDepthSlice[] = depthLabels.map((depthLabel) => ({
    depthLabel,
    clayPct: readMean(layers, 'clay', depthLabel),
    sandPct: readMean(layers, 'sand', depthLabel),
    siltPct: readMean(layers, 'silt', depthLabel),
    bulkDensityGcc: (() => {
      const v = readMean(layers, 'bdod', depthLabel)
      // SoilGrids bdod target is kg/dm³ ≈ g/cm³ after d_factor
      return v
    })(),
    ph: readMean(layers, 'phh2o', depthLabel),
    coarseFragPct: readMean(layers, 'cfvo', depthLabel),
  }))

  const top = slices.slice(0, 3)
  const avg = (key: keyof SoilDepthSlice) => {
    const vals = top
      .map((s) => s[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  const clay = avg('clayPct')
  const sand = avg('sandPct')
  const silt = avg('siltPct')
  if (clay == null || sand == null || silt == null) return null

  // Normalize to 100% if needed
  const sum = clay + sand + silt
  const c = sum > 0 ? (clay / sum) * 100 : clay
  const sa = sum > 0 ? (sand / sum) * 100 : sand
  const si = sum > 0 ? (silt / sum) * 100 : silt

  const textureClass = usdaTexture(sa, si, c)
  const ind = indicativeFromTexture(textureClass)

  return {
    provider: 'ISRIC SoilGrids 2.0 (open global soil map)',
    resolutionNote: '~250 m pixel · modelled properties · not a borehole',
    placeName,
    lat,
    lon,
    layers: slices.map((s) => ({
      ...s,
      clayPct: s.clayPct != null ? Number(s.clayPct.toFixed(1)) : null,
      sandPct: s.sandPct != null ? Number(s.sandPct.toFixed(1)) : null,
      siltPct: s.siltPct != null ? Number(s.siltPct.toFixed(1)) : null,
      bulkDensityGcc: s.bulkDensityGcc != null ? Number(s.bulkDensityGcc.toFixed(2)) : null,
      ph: s.ph != null ? Number(s.ph.toFixed(1)) : null,
      coarseFragPct: s.coarseFragPct != null ? Number(s.coarseFragPct.toFixed(1)) : null,
    })),
    textureClass,
    indicativeSbcTm2: ind.sbc,
    indicativeCbrPct: ind.cbr,
    confidencePct: ind.confidencePct,
    confidenceNote:
      'Open satellite/GIS soil model for screening only. Lab / borehole data can raise confidence to ~85–95% for foundation design.',
    fetchedAt: new Date().toISOString(),
    live: true,
  }
}

export async function fetchSoilScreening(
  lat: number,
  lon: number,
  placeName?: string
): Promise<SoilScreening | null> {
  try {
    const res = await fetch(`/api/geo/soil?lat=${lat}&lon=${lon}`)
    if (!res.ok) return null
    const json = await res.json()
    return parseSoilGridsResponse(json, lat, lon, placeName)
  } catch {
    return null
  }
}
