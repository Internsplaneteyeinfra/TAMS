/**
 * GIS / texture / Atterberg-based engineering parameter prediction per depth layer.
 * All outputs are MODELLED / ENGINEERING_CORRELATED — never labelled as measured.
 */

import type { SoilLayerParameters, SoilProfileInterval } from '../types'
import { scoreConfidence } from './confidenceEngine'
import {
  calibrateCbrPct,
  calibrateCohesionKpa,
  calibrateMddGcc,
  calibrateOmcPct,
  calibratePhiDeg,
  calibrateResistivityOhmM,
  calibrateSptN,
  clamp,
} from './referenceCalibration'
import type { LayerEngineeringParameters, ResolvedParameter, ResolutionStatus } from './parameterTypes'

const PHI_TEXTURE: Array<{ match: (t: string) => boolean; mid: number; low: number; high: number }> = [
  { match: (t) => t.includes('sand') && !t.includes('clay') && !t.includes('loam'), mid: 33, low: 30, high: 36 },
  { match: (t) => t.includes('loamy sand') || t.includes('sandy loam'), mid: 31, low: 28, high: 34 },
  { match: (t) => t.includes('loam') && !t.includes('clay'), mid: 29, low: 26, high: 32 },
  { match: (t) => t.includes('silt'), mid: 27, low: 24, high: 30 },
  { match: (t) => t.includes('clay'), mid: 22, low: 18, high: 28 },
]

function rp(
  value: number,
  unit: string,
  status: ResolutionStatus,
  method: string,
  sourceChain: string[],
  confidence: number,
  uncertainty?: { low: number; high: number }
): ResolvedParameter {
  return { value, unit, status, method, sourceChain, confidence, uncertaintyRange: uncertainty ?? null }
}

function rpStr(
  value: string,
  unit: string,
  status: ResolutionStatus,
  method: string,
  sourceChain: string[],
  confidence: number
): ResolvedParameter<string> {
  return { value, unit, status, method, sourceChain, confidence, uncertaintyRange: null }
}

function texturePhi(texture: string, clayPct: number, sandPct: number): ResolvedParameter {
  const t = texture.toLowerCase()
  const row = PHI_TEXTURE.find((r) => r.match(t))
  let mid = row?.mid ?? 28 + sandPct * 0.05 - clayPct * 0.08
  mid = calibratePhiDeg(mid, sandPct, clayPct)
  const conf = scoreConfidence({
    status: 'ENGINEERING_CORRELATED',
    sourceCount: 2,
    agreementPct: row ? 80 : 65,
  })
  return rp(
    mid,
    '°',
    'ENGINEERING_CORRELATED',
    row
      ? `Texture-class φ mid-range (${row.low}–${row.high}°) — handbook screening`
      : 'Fraction-adjusted φ correlation from sand/clay %',
    ['ISRIC SoilGrids texture', 'Engineering handbook typical φ ranges'],
    conf,
    row ? { low: row.low, high: row.high } : { low: mid - 4, high: mid + 4 }
  )
}

function predictCohesionKpa(
  clayPct: number,
  pi: number,
  ll: number,
  depthM: number,
  sandPct: number
): ResolvedParameter {
  if (clayPct < 8 && sandPct >= 50) {
    const conf = scoreConfidence({ status: 'ENGINEERING_CORRELATED', sourceCount: 2 })
    return rp(
      0,
      'kPa',
      'ENGINEERING_CORRELATED',
      'Drained cohesionless screening — c′ ≈ 0 for sand-dominated GIS texture',
      ['SoilGrids texture', 'Drained sand assumption (IS 6403 screening)'],
      conf,
      { low: 0, high: 2 }
    )
  }
  const piUse = Math.max(pi, clayPct * 0.4)
  const depthFactor = 1 + depthM * 0.08
  const raw = calibrateCohesionKpa(0.22 * (piUse - 2) * depthFactor + clayPct * 0.12, clayPct, piUse)
  const conf = scoreConfidence({
    status: 'ENGINEERING_CORRELATED',
    sourceCount: 3,
    depthM,
    heterogeneity: clayPct >= 30 ? 'high' : 'medium',
  })
  return rp(
    Number(raw.toFixed(1)),
    'kPa',
    'ENGINEERING_CORRELATED',
    'Predicted engineering cohesion: Skempton-type PI–clay screening (undrained proxy, not lab triaxial)',
    ['ISRIC SoilGrids clay%', 'Correlated PI', 'Depth overburden factor'],
    conf,
    { low: Math.max(2, raw * 0.65), high: raw * 1.35 }
  )
}

function predictEquivalentSptN(
  phiDeg: number,
  sandPct: number,
  clayPct: number,
  bulkDensity: number | null,
  depthM: number
): ResolvedParameter {
  const densityTerm = bulkDensity != null ? (bulkDensity - 1.4) * 12 : 0
  const raw = calibrateSptN(8 + sandPct * 0.25 - clayPct * 0.15 + depthM * 1.5 + densityTerm, clayPct)
  const conf = scoreConfidence({ status: 'MODEL_PREDICTED', sourceCount: 3, depthM })
  return rp(
    raw,
    '—',
    'MODEL_PREDICTED',
    'GIS-predicted equivalent SPT N from texture, density, depth compaction proxy — not field SPT',
    ['SoilGrids fractions', 'Bulk density', 'Depth compaction proxy'],
    conf,
    { low: Math.max(4, raw - 6), high: Math.min(50, raw + 6) }
  )
}

function predictMdd(clayPct: number, sandPct: number, bulkDensity: number | null): ResolvedParameter {
  const base = bulkDensity != null ? bulkDensity * 1.08 : 1.65 + sandPct * 0.003 - clayPct * 0.002
  const v = calibrateMddGcc(base)
  return rp(v, 'g/cc', 'MODEL_PREDICTED', 'MDD correlated from GIS bulk density and texture', ['SoilGrids bdod', 'Texture fractions'], scoreConfidence({ status: 'MODEL_PREDICTED', sourceCount: 2 }), { low: v - 0.08, high: v + 0.08 })
}

function predictOmc(clayPct: number, pi: number): ResolvedParameter {
  const v = calibrateOmcPct(8 + clayPct * 0.12 + pi * 0.08, clayPct)
  return rp(v, '%', 'MODEL_PREDICTED', 'OMC correlated from clay% and PI (Proctor proxy)', ['Clay fraction', 'Correlated PI'], scoreConfidence({ status: 'MODEL_PREDICTED', sourceCount: 2 }), { low: v - 2, high: v + 2 })
}

function predictUcs(cohesionKpa: number, clayPct: number): ResolvedParameter {
  const kgCm2 = clamp((cohesionKpa * 0.9 + clayPct * 0.15) / 98.1, 0.05, 4.5)
  return rp(
    Number(kgCm2.toFixed(2)),
    'kg/cm²',
    'ENGINEERING_CORRELATED',
    'UCS correlated from predicted cohesion and clay fraction (screening)',
    ['Predicted cohesion', 'Clay %'],
    scoreConfidence({ status: 'ENGINEERING_CORRELATED', sourceCount: 2 }),
    { low: kgCm2 * 0.6, high: kgCm2 * 1.4 }
  )
}

function predictSg(sandPct: number, clayPct: number): ResolvedParameter {
  const v = clamp(2.55 + sandPct * 0.001 - clayPct * 0.002, 2.5, 2.75)
  return rp(Number(v.toFixed(2)), '—', 'MODEL_PREDICTED', 'Specific gravity from mineralogical texture proxy', ['Sand/clay fraction'], scoreConfidence({ status: 'MODEL_PREDICTED', sourceCount: 1 }), { low: 2.5, high: 2.75 })
}

function predictFsi(clayPct: number, pi: number): ResolvedParameter {
  const v = clamp(clayPct * 0.35 + pi * 0.25, 0, 45)
  return rp(Number(v.toFixed(1)), '%', 'MODEL_PREDICTED', 'FSI swelling potential proxy from clay% and PI', ['Clay fraction', 'PI'], scoreConfidence({ status: 'MODEL_PREDICTED', sourceCount: 2 }), { low: 0, high: v * 1.5 })
}

function predictCbr(sandPct: number, clayPct: number, pi: number, sptN: number): ResolvedParameter {
  const raw = calibrateCbrPct(4 + sandPct * 0.22 - clayPct * 0.18 - pi * 0.06 + sptN * 0.35)
  return rp(raw, '%', 'ENGINEERING_CORRELATED', 'Estimated CBR from texture, PI, equivalent SPT N correlation', ['Grain fractions', 'PI', 'Equivalent SPT N'], scoreConfidence({ status: 'ENGINEERING_CORRELATED', sourceCount: 3 }), { low: Math.max(2, raw * 0.7), high: raw * 1.3 })
}

function predictResistivity(sandPct: number, clayPct: number, siltPct: number, bulkDensity: number | null): ResolvedParameter {
  let raw = 30 + sandPct * 2.2 - clayPct * 1.8 - siltPct * 0.4
  if (bulkDensity != null) raw += (bulkDensity - 1.5) * 40
  const v = calibrateResistivityOhmM(raw)
  return rp(v, 'Ω·m', 'MODEL_PREDICTED', 'GIS/engineering estimated earth resistivity from grain fractions and density', ['SoilGrids fractions', 'Bulk density'], scoreConfidence({ status: 'MODEL_PREDICTED', sourceCount: 2 }), { low: v * 0.6, high: v * 1.5 })
}

function unitWeight(bulkDensity: number | null, dryDensity: number | null): { kn: ResolvedParameter; tm3: ResolvedParameter } {
  const bd = bulkDensity ?? dryDensity ?? 1.65
  const gammaKn = Number((bd * 9.81).toFixed(1))
  const gammaTm3 = Number((gammaKn / 9.81).toFixed(3))
  const conf = scoreConfidence({ status: bulkDensity != null ? 'GIS_DERIVED' : 'ESTIMATED', sourceCount: 1 })
  const status: ResolutionStatus = bulkDensity != null ? 'GIS_DERIVED' : 'ESTIMATED'
  return {
    kn: rp(gammaKn, 'kN/m³', status, 'γ = ρ_bulk × 9.81 (SoilGrids screening)', ['ISRIC SoilGrids bdod'], conf),
    tm3: rp(gammaTm3, 'T/m³', status, 'γ (T/m³) = ρ_bulk', ['ISRIC SoilGrids bdod'], conf),
  }
}

export function predictLayerParameters(
  layer: SoilLayerParameters,
  profileRow: SoilProfileInterval | undefined,
  screeningTexture: string | null,
  depthMidM: number
): LayerEngineeringParameters {
  const gravel = layer.gravelPct.value ?? 0
  const sand = layer.sandPct.value ?? profileRow?.sandPct.value ?? 40
  const silt = layer.siltPct.value ?? profileRow?.siltPct.value ?? 30
  const clay = layer.clayPct.value ?? profileRow?.clayPct.value ?? 20
  const texture = profileRow?.usdaTexture.value ?? screeningTexture ?? 'Loam'
  const ll = layer.liquidLimit.value ?? Math.max(20, 22 + clay * 0.85 + silt * 0.15)
  const pl = layer.plasticLimit.value ?? Math.max(12, ll * 0.48 - 2 + clay * 0.05)
  const pi = layer.plasticityIndex.value ?? Math.max(0, ll - pl)
  const bulk = profileRow?.bulkDensityGcc.value ?? null
  const dry = profileRow?.dryDensityGcc.value ?? bulk

  const phi = texturePhi(texture, clay, sand)
  const cohesion = predictCohesionKpa(clay, pi, ll, depthMidM, sand)
  const weights = unitWeight(bulk, dry)
  const sptN = predictEquivalentSptN(phi.value, sand, clay, bulk, depthMidM)
  const mdd = predictMdd(clay, sand, bulk)
  const omc = predictOmc(clay, pi)
  const ucs = predictUcs(cohesion.value, clay)
  const sg = predictSg(sand, clay)
  const fsi = predictFsi(clay, pi)
  const cbr = predictCbr(sand, clay, pi, sptN.value)
  const rho = predictResistivity(sand, clay, silt, bulk)

  const num = (v: number | null, u: string, st: ResolutionStatus, m: string, sc: string[]) =>
    v != null ? rp(v, u, st, m, sc, scoreConfidence({ status: st, sourceCount: 1 })) : rp(0, u, st, m, sc, 20)

  return {
    reportDepth: layer.reportDepth,
    reportDepthLabel: layer.reportDepthLabel,
    depthMidM,
    gravelPct: num(gravel, '%', 'MODELLED', 'Normalized gravel %', ['SoilGrids']),
    sandPct: num(sand, '%', 'MODELLED', 'Normalized sand %', ['SoilGrids']),
    siltPct: num(silt, '%', 'MODELLED', 'Normalized silt %', ['SoilGrids']),
    clayPct: num(clay, '%', 'MODELLED', 'Normalized clay %', ['SoilGrids']),
    liquidLimit: num(ll, '%', 'ENGINEERING_CORRELATED', 'Correlated LL', ['Clay/silt fractions']),
    plasticLimit: num(pl, '%', 'ENGINEERING_CORRELATED', 'Correlated PL', ['LL', 'Clay%']),
    plasticityIndex: num(pi, '%', 'CALCULATED', 'PI = LL − PL', ['LL', 'PL']),
    isClassification: rpStr(
      String(layer.soilClassification.value ?? '—'),
      'IS 1498',
      'CALCULATED',
      'IS 1498 from grain size + Atterberg inputs',
      ['Grain size', 'LL', 'PI']
    ),
    maximumDryDensityGcc: mdd,
    optimumMoistureContentPct: omc,
    dryDensityGcc: dry != null ? rp(dry, 'g/cc', 'GIS_DERIVED', 'SoilGrids dry bulk density', ['SoilGrids bdod'], scoreConfidence({ status: 'GIS_DERIVED', sourceCount: 1 })) : rp(1.55, 'g/cc', 'ESTIMATED', 'Estimated dry density from texture', ['Texture'], 32),
    bulkDensityGcc: bulk != null ? rp(bulk, 'g/cc', 'GIS_DERIVED', 'SoilGrids bulk density', ['SoilGrids'], scoreConfidence({ status: 'GIS_DERIVED', sourceCount: 1 })) : rp(1.65, 'g/cc', 'ESTIMATED', 'Estimated bulk density', ['Texture'], 30),
    freeSwellingIndexPct: fsi,
    ucsKgCm2: ucs,
    specificGravity: sg,
    cohesionKpa: cohesion,
    frictionAngleDeg: phi,
    unitWeightKnM3: weights.kn,
    unitWeightTm3: weights.tm3,
    equivalentSptN: sptN,
    estimatedCbrPct: cbr,
    estimatedResistivityOhmM: rho,
  }
}
