/**
 * Phase C — Soil parameter engine.
 * Normalizes grain size to 100%, correlates Atterberg limits, calculates PI = LL − PL,
 * and produces reproducible IS 1498 classification from displayed inputs.
 */

import { runDerivationPipeline } from './derivationPipeline'
import { fieldTestRequired, provenance } from './provenance'
import { classifyIS1498FromInputs } from './soilClassification'
import type { ProvenanceValue, ReportDepthId, SoilLayerParameters, SoilProfileInterval } from './types'

const SOURCE = 'ISRIC SoilGrids 2.0'

function round1(n: number): number {
  return Number(n.toFixed(1))
}

/** Normalize sand/silt/clay and allocate gravel so the four fractions sum to 100%. */
export function normalizeGrainSize(
  sand: number | null,
  silt: number | null,
  clay: number | null,
  coarseFragPct: number | null
): {
  gravel: number
  sand: number
  silt: number
  clay: number
  sum: number
} {
  const sa = sand ?? 0
  const si = silt ?? 0
  const cl = clay ?? 0
  const finesSum = sa + si + cl
  if (finesSum <= 0) {
    return { gravel: 0, sand: 0, silt: 0, clay: 0, sum: 0 }
  }

  let gravel =
    coarseFragPct != null && Number.isFinite(coarseFragPct) && coarseFragPct > 0
      ? Math.min(40, coarseFragPct * 0.65)
      : Math.min(15, sa * 0.12)

  let sandN = sa
  let siltN = si
  let clayN = cl
  const total = gravel + sandN + siltN + clayN
  if (total <= 0) return { gravel: 0, sand: 0, silt: 0, clay: 0, sum: 0 }

  const scale = 100 / total
  gravel = round1(gravel * scale)
  sandN = round1(sandN * scale)
  siltN = round1(siltN * scale)
  clayN = round1(100 - gravel - sandN - siltN)

  return { gravel, sand: sandN, silt: siltN, clay: clayN, sum: gravel + sandN + siltN + clayN }
}

function grainParam(
  value: number,
  label: string,
  method: string,
  status: 'MODELLED' | 'ENGINEERING_CORRELATED' | 'CALCULATED',
  confidence: number,
  inputs?: Record<string, number | string | null>
): ProvenanceValue<number | null> {
  return provenance(value, {
    unit: '%',
    source: SOURCE,
    method,
    confidence,
    status,
    inputValues: inputs,
    engineeringLimitation:
      status === 'ENGINEERING_CORRELATED'
        ? 'Correlated from GIS texture fractions — not laboratory sieve analysis'
        : 'Modelled GIS fraction — validate by field sieve test',
  })
}

function correlateLiquidLimit(clayPct: number, siltPct: number): ProvenanceValue<number | null> {
  const attempts = [
    {
      tier: 'ENGINEERING_CORRELATED' as const,
      value: round1(22 + clayPct * 0.85 + siltPct * 0.15),
      method: 'Engineering correlation: LL ≈ 22 + 0.85·clay% + 0.15·silt% (GIS texture screening)',
      source: SOURCE,
      confidence: 38,
      status: 'ENGINEERING_CORRELATED' as const,
      calculationReference: 'Wroth-type clay-activity screening (preliminary)',
      inputValues: { clayPct, siltPct },
      limitation: 'Not laboratory Casagrande LL — field Atterberg test required for design',
    },
  ]
  if (clayPct < 8) {
    return fieldTestRequired('%', 'Clay fraction too low for defensible remote LL correlation — field Atterberg test required')
  }
  return runDerivationPipeline('%', attempts, 'Liquid limit requires laboratory Atterberg test')
}

function correlatePlasticLimit(ll: number, clayPct: number): ProvenanceValue<number | null> {
  const pl = round1(Math.max(12, ll * 0.48 - 2 + clayPct * 0.05))
  return provenance(pl, {
    unit: '%',
    source: SOURCE,
    method: 'Engineering correlation: PL from correlated LL and clay% (screening)',
    correlation: 'PL ≈ max(12, 0.48·LL − 2 + 0.05·clay%)',
    confidence: 32,
    status: 'ENGINEERING_CORRELATED',
    inputValues: { liquidLimit: ll, clayPct },
    engineeringLimitation: 'Not laboratory rolling-thread PL — field verification required',
  })
}

function calculatePlasticityIndex(ll: number, pl: number): ProvenanceValue<number | null> {
  const pi = round1(ll - pl)
  return provenance(pi, {
    unit: '%',
    source: 'Derived from correlated Atterberg limits',
    method: 'PI = LL − PL (formula calculation)',
    formula: 'PI = LL − PL',
    confidence: pi > 0 ? 45 : 20,
    status: 'CALCULATED',
    inputValues: { liquidLimit: ll, plasticLimit: pl },
    engineeringLimitation: 'PI depends on correlated LL/PL — not measured plasticity',
  })
}

export function buildSoilLayerParameters(profile: SoilProfileInterval[]): SoilLayerParameters[] {
  return profile.map((layer) => {
    const sand = layer.sandPct.value
    const silt = layer.siltPct.value
    const clay = layer.clayPct.value
    const cfvo = layer.coarseFragPct.value

    const normalized = normalizeGrainSize(sand, silt, clay, cfvo)
    const hasGrain =
      sand != null && silt != null && clay != null && normalized.sum >= 99 && normalized.sum <= 101

    const gravelP = hasGrain
      ? grainParam(
          normalized.gravel,
          'gravel',
          cfvo != null
            ? 'Gravel allocated from SoilGrids cfvo coarse-fragment proxy (engineering correlation)'
            : 'Gravel estimated from sand fraction (engineering correlation) then normalized to 100%',
          cfvo != null ? 'ENGINEERING_CORRELATED' : 'ENGINEERING_CORRELATED',
          cfvo != null ? 35 : 28,
          { sandPct: sand, siltPct: silt, clayPct: clay, coarseFragPct: cfvo }
        )
      : fieldTestRequired('%', 'Grain-size fractions unavailable — cannot normalize gravel/sand/silt/clay')

    const sandP = hasGrain
      ? grainParam(normalized.sand, 'sand', 'Normalized modelled sand % (GIS)', 'MODELLED', 48, {
          rawSandPct: sand,
        })
      : layer.sandPct

    const siltP = hasGrain
      ? grainParam(normalized.silt, 'silt', 'Normalized modelled silt % (GIS)', 'MODELLED', 48, {
          rawSiltPct: silt,
        })
      : layer.siltPct

    const clayP = hasGrain
      ? grainParam(normalized.clay, 'clay', 'Normalized modelled clay % (GIS)', 'MODELLED', 48, {
          rawClayPct: clay,
        })
      : layer.clayPct

    const sumP = hasGrain
      ? provenance(round1(normalized.sum), {
          unit: '%',
          source: SOURCE,
          method: 'Gravel + Sand + Silt + Clay normalization check',
          formula: 'G + Sa + Si + Cl = 100%',
          confidence: 50,
          status: 'CALCULATED',
          inputValues: {
            gravel: normalized.gravel,
            sand: normalized.sand,
            silt: normalized.silt,
            clay: normalized.clay,
          },
        })
      : fieldTestRequired('%', 'Cannot validate grain-size sum without modelled fractions')

    const llP =
      hasGrain && normalized.clay >= 8
        ? correlateLiquidLimit(normalized.clay, normalized.silt)
        : fieldTestRequired('%', 'Liquid limit requires laboratory Atterberg test or sufficient clay for correlation')

    const plP =
      llP.value != null && hasGrain
        ? correlatePlasticLimit(llP.value, normalized.clay)
        : fieldTestRequired('%', 'Plastic limit requires laboratory Atterberg test')

    const piP =
      llP.value != null && plP.value != null
        ? calculatePlasticityIndex(llP.value, plP.value)
        : fieldTestRequired('%', 'Plasticity index requires LL and PL — PI = LL − PL')

    const isClass =
      hasGrain && llP.value != null && piP.value != null
        ? classifyIS1498FromInputs(
            normalized.gravel,
            normalized.sand,
            normalized.silt,
            normalized.clay,
            llP.value,
            piP.value
          )
        : fieldTestRequired('IS 1498', 'IS classification requires complete grain size and Atterberg inputs')

    return {
      reportDepth: layer.reportDepth as ReportDepthId,
      reportDepthLabel: layer.reportDepthLabel,
      depthFromM: layer.depthFromM,
      depthToM: layer.depthToM,
      layerThicknessM: round1(layer.depthToM - layer.depthFromM),
      gravelPct: gravelP,
      sandPct: sandP,
      siltPct: siltP,
      clayPct: clayP,
      grainSizeSumPct: sumP,
      liquidLimit: llP,
      plasticLimit: plP,
      plasticityIndex: piP,
      soilClassification: isClass,
      classificationMethod: 'IS 1498 — grain size + fines + LL + PI (reproducible from displayed inputs)',
    }
  })
}
