/**
 * Engineering parameter estimation (GEO-1 / G2).
 * Only published, defensible correlations — otherwise NO_DATA / FIELD_TEST_REQUIRED.
 * Does NOT invent SPT, LL, PL, UCS, GWT, or design-grade c/φ.
 */

import { fieldTestRequired, noData, provenance } from './provenance'
import type { EngineeringParameterSet, SoilProfileInterval } from './types'

/**
 * Typical φ ranges by USDA texture for preliminary screening only.
 * Sources: published geotechnical handbooks (e.g. Bowles / NAVFAC typical values tables).
 * Status = ESTIMATED, low confidence — not a lab shear test.
 */
const PHI_BY_TEXTURE: Array<{
  match: (t: string) => boolean
  low: number
  high: number
  mid: number
  validity: string
}> = [
  {
    match: (t) => t.includes('sand') && !t.includes('clay') && !t.includes('loam'),
    low: 30,
    high: 36,
    mid: 33,
    validity: 'Clean sand textures; drained conditions; no SPT calibration',
  },
  {
    match: (t) => t.includes('loamy sand') || t.includes('sandy loam'),
    low: 28,
    high: 34,
    mid: 31,
    validity: 'Sandy loam / loamy sand; drained; preliminary only',
  },
  {
    match: (t) => t.includes('loam') && !t.includes('clay') && !t.includes('silt'),
    low: 26,
    high: 32,
    mid: 29,
    validity: 'Loam textures; preliminary drained φ',
  },
  {
    match: (t) => t.includes('silt'),
    low: 24,
    high: 30,
    mid: 27,
    validity: 'Silt / silt loam; sensitive to plasticity — Atterberg tests required',
  },
  {
    match: (t) => t.includes('clay'),
    low: 18,
    high: 28,
    mid: 22,
    validity: 'Clayey textures; φ_effective highly uncertain without CU/CD tests',
  },
]

/**
 * Cohesion: for clayey soils undrained strength correlations without SPT/UCS are too weak.
 * Return FIELD_TEST_REQUIRED rather than inventing c.
 * For sandy textures, drained cohesion ≈ 0 is sometimes assumed — we still mark FIELD_TEST_REQUIRED
 * for foundation design and leave value null (never fabricate 0 as measured cohesion).
 */
export function estimateEngineeringParameters(
  profile: SoilProfileInterval[]
): EngineeringParameterSet {
  const notes: string[] = []
  // Prefer 1.0–1.5 m (typical shallow foundation zone) then 0.5–1.0 then 0–0.5
  const preferred =
    profile.find((p) => p.reportDepth === '1.0-1.5m') ||
    profile.find((p) => p.reportDepth === '0.5-1.0m') ||
    profile.find((p) => p.reportDepth === '0.0-0.5m') ||
    profile[0]

  const bdod = preferred?.bulkDensityGcc?.value ?? null
  const texture = (preferred?.usdaTexture?.value || '').toLowerCase()

  // γ (kN/m³) ≈ ρ (g/cm³) × 9.81 — SoilGrids bdod is oven-dry; bulk unit weight for moist soil differs.
  let gammaKnM3 = noData<number>('kN/m³', 'No bulk density available for unit weight estimate')
  if (bdod != null && Number.isFinite(bdod)) {
    if (bdod < 0.8 || bdod > 2.4) {
      gammaKnM3 = provenance(null, {
        unit: 'kN/m³',
        source: 'ISRIC SoilGrids bdod',
        method: 'γ = ρ_d × 9.81 (screening)',
        confidence: null,
        status: 'OUT_OF_RANGE',
        inputValues: { bdodGcc: bdod },
        validityRange: '0.8–2.4 g/cm³',
        engineeringLimitation: 'bdod outside plausible range for unit-weight correlation',
      })
      notes.push('Unit weight OUT_OF_RANGE for SoilGrids bdod')
    } else {
      const gamma = bdod * 9.81
      gammaKnM3 = provenance(Number(gamma.toFixed(1)), {
        unit: 'kN/m³',
        source: 'ISRIC SoilGrids bdod',
        method: 'γ_dry ≈ bdod × 9.81',
        formula: 'γ (kN/m³) = ρ_d (g/cm³) × 9.81',
        inputValues: { bdodGcc: bdod, reportDepth: preferred?.reportDepth ?? null },
        confidence: 40,
        status: 'ESTIMATED',
        assumptions: [
          'Uses oven-dry bulk density; moist bulk unit weight may be higher',
          'Not a field density measurement',
        ],
        validityRange: 'bdod 0.8–2.4 g/cm³',
        engineeringLimitation:
          'Preliminary dry unit weight from modelled density — verify with field density for design',
      })
    }
  }

  const dryDensityGcc =
    preferred?.dryDensityGcc ??
    noData<number>('g/cm³', 'Dry density unavailable')

  // φ from texture table
  let phiDeg = fieldTestRequired<number>(
    '°',
    'Friction angle requires direct shear / triaxial (or SPT-based correlation with measured N)'
  )
  if (texture) {
    const row = PHI_BY_TEXTURE.find((r) => r.match(texture))
    if (row) {
      phiDeg = provenance(row.mid, {
        unit: '°',
        source: 'Published typical φ ranges by USDA texture (handbook screening tables)',
        method: 'Texture-class mid-range φ for preliminary drained screening',
        formula: `φ_est ≈ mid(${row.low}–${row.high}°) for texture "${preferred?.usdaTexture?.value}"`,
        inputValues: {
          usdaTexture: preferred?.usdaTexture?.value ?? null,
          phiLow: row.low,
          phiHigh: row.high,
        },
        confidence: 30,
        status: 'ESTIMATED',
        assumptions: [
          'Drained conditions',
          'No SPT or relative density control',
          'Mid-range of published typical values',
        ],
        validityRange: row.validity,
        engineeringLimitation:
          `Report range ${row.low}–${row.high}°. Not for final foundation design without shear testing.`,
      })
      notes.push(`Preliminary φ from texture mid-range ${row.low}–${row.high}°`)
    }
  }

  // Cohesion: do not invent. Clayey soils need lab; sandy → often c=0 drained but we refuse to emit 0 as a value.
  const cohesionKpa = fieldTestRequired<number>(
    'kPa',
    texture.includes('clay')
      ? 'Cohesion / undrained strength requires UU/CU triaxial, vane, or SPT-based correlation with measured N'
      : 'Drained cohesion for sandy soils is often taken as ~0 in design, but this system will not fabricate c=0; laboratory or SPT-supported correlation required'
  )
  notes.push('Cohesion left FIELD_TEST_REQUIRED — no fabricated c values')

  return {
    gammaKnM3,
    dryDensityGcc,
    phiDeg,
    cohesionKpa,
    notes,
  }
}
