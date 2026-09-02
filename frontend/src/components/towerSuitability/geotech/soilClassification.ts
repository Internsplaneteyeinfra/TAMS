/**
 * USDA texture (preliminary) + IS classification gate.
 * IS classification requiring plasticity is NEVER fabricated.
 */

import { insufficientData, provenance } from './provenance'
import type { ProvenanceValue } from './types'

export function usdaTextureFromFractions(
  sand: number,
  silt: number,
  clay: number
): string {
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

export function preliminaryMaterialDescription(
  sand: number | null,
  silt: number | null,
  clay: number | null,
  texture: string | null
): ProvenanceValue<string | null> {
  if (sand == null || silt == null || clay == null || !texture) {
    return insufficientData('%', 'Grain-size fractions unavailable for material description')
  }
  const desc = `${texture} — modelled texture estimate (Sand ${sand.toFixed(0)}% · Silt ${silt.toFixed(0)}% · Clay ${clay.toFixed(0)}%)`
  return provenance(desc, {
    unit: 'text',
    source: 'ISRIC SoilGrids 2.0 grain fractions',
    method: 'USDA triangle + descriptive label',
    confidence: 45,
    status: 'DERIVED',
    engineeringLimitation:
      'Not a laboratory-confirmed IS soil classification. Plasticity and grading tests required for design class.',
    assumptions: ['Fractions are modelled map means, not borehole samples'],
  })
}

/**
 * IS 1498 classification from grain size + fines + LL + PI.
 * Reproducible from displayed inputs — uses correlated LL/PI when lab data absent.
 */
export function classifyIS1498FromInputs(
  gravelPct: number,
  sandPct: number,
  siltPct: number,
  clayPct: number,
  ll: number,
  pi: number
): ProvenanceValue<string | null> {
  const fines = siltPct + clayPct
  const aLinePi = 0.73 * (ll - 20)
  let group: string

  if (fines < 50) {
    if (fines < 5) {
      if (gravelPct >= 50) group = gravelPct > 70 ? 'GP' : 'GW'
      else group = sandPct > 85 ? 'SP' : 'SW'
    } else if (fines < 12) {
      group = gravelPct >= 50 ? 'GM' : 'SM'
    } else if (pi >= 7 && pi >= aLinePi) {
      group = gravelPct >= 50 ? 'GC' : 'SC'
    } else {
      group = gravelPct >= 50 ? 'GM' : 'SM'
    }
  } else {
    if (ll < 35) group = pi >= aLinePi ? 'CL' : 'ML'
    else if (ll < 50) group = pi >= aLinePi ? (pi > 17 ? 'CH' : 'CL') : 'ML'
    else group = pi >= aLinePi ? 'CH' : 'MH'
  }

  const desc = `${group} (IS 1498 preliminary — GIS-correlated LL/PI)`
  return provenance(desc, {
    unit: 'IS 1498',
    source: 'IS 1498 plasticity chart + coarse-grained rules',
    method:
      'Classification from normalized grain size (G/Sa/Si/Cl), fines %, correlated LL, and calculated PI = LL − PL',
    formula: fines < 50 ? 'Coarse-grained: fines % + PI vs A-line' : 'Fine-grained: LL + PI vs A-line (PI = 0.73(LL−20))',
    confidence: 42,
    status: 'DERIVED',
    inputValues: {
      gravelPct: Number(gravelPct.toFixed(1)),
      sandPct: Number(sandPct.toFixed(1)),
      siltPct: Number(siltPct.toFixed(1)),
      clayPct: Number(clayPct.toFixed(1)),
      finesPct: Number(fines.toFixed(1)),
      liquidLimit: ll,
      plasticityIndex: pi,
    },
    engineeringLimitation:
      'Preliminary IS class from GIS-correlated Atterberg limits — confirm by laboratory grading + Atterberg tests',
    assumptions: ['LL/PL are engineering-correlated unless field MEASURED values supplied'],
  })
}

/**
 * IS classification (IS 1498) needs LL and PI (and preferably sieve grading).
 * Without plasticity data → INSUFFICIENT_DATA (never invent CI/CL/etc.).
 */
export function isSoilClassificationFromPlasticity(
  ll: number | null | undefined,
  pi: number | null | undefined,
  measuredClass?: string | null
): ProvenanceValue<string | null> {
  if (measuredClass && measuredClass.trim()) {
    return provenance(measuredClass.trim(), {
      unit: 'IS 1498',
      source: 'Field geotechnical investigation',
      method: 'Laboratory classification',
      confidence: 90,
      status: 'MEASURED',
    })
  }
  if (ll == null || pi == null || !Number.isFinite(ll) || !Number.isFinite(pi)) {
    return insufficientData(
      'IS 1498',
      'IS soil classification requires liquid limit and plasticity index from laboratory Atterberg tests'
    )
  }
  // With LL+PI we could map A-line — still preliminary without full grading.
  // Keep INSUFFICIENT_DATA for gravel/sand fraction confirmation unless full IS logic is implemented later.
  return insufficientData(
    'IS 1498',
    'LL and PI present but full IS 1498 grading + plasticity chart classification not yet implemented in GEO-1'
  )
}

export function usdaTextureProvenance(
  sand: number | null,
  silt: number | null,
  clay: number | null
): ProvenanceValue<string | null> {
  if (sand == null || silt == null || clay == null) {
    return insufficientData('%', 'Missing sand/silt/clay for USDA texture')
  }
  const sum = sand + silt + clay
  if (sum <= 0) {
    return insufficientData('%', 'Non-positive grain-size sum')
  }
  const sa = (sand / sum) * 100
  const si = (silt / sum) * 100
  const cl = (clay / sum) * 100
  const texture = usdaTextureFromFractions(sa, si, cl)
  return provenance(texture, {
    unit: 'USDA',
    source: 'ISRIC SoilGrids 2.0',
    method: 'USDA textural triangle on thickness-weighted modelled fractions',
    confidence: 48,
    status: 'DERIVED',
    inputValues: { sandPct: Number(sa.toFixed(1)), siltPct: Number(si.toFixed(1)), clayPct: Number(cl.toFixed(1)) },
    engineeringLimitation: 'Modelled map texture — not a borehole particle-size analysis',
  })
}
