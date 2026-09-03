/**
 * Phase E — E2 Bearing capacity (IS 6403) with full step trace.
 */

import { noData, provenance } from '../provenance'
import type { EngineeringParameterSet, SoilLayerParameters, SoilProfileInterval } from '../types'
import type {
  SbcCalculationStep,
  SbcDataBasis,
  SbcFoundationInputs,
  SbcSoilInputs,
  SbcSourceTypeLabel,
} from './types'

const DEG = Math.PI / 180

export function bearingCapacityFactors(phiDeg: number): { Nc: number; Nq: number; Ngamma: number } {
  if (phiDeg <= 0) return { Nc: 5.14, Nq: 1.0, Ngamma: 0 }
  const phi = phiDeg * DEG
  const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2)
  const Nc = (Nq - 1) / Math.tan(phi)
  const Ngamma = 2 * (Nq + 1) * Math.tan(phi)
  return { Nc, Nq, Ngamma }
}

export function shapeFactors(phiDeg: number, B: number, L: number) {
  const ratio = Math.min(1, B / Math.max(L, B))
  return {
    sc: 1 + 0.2 * ratio,
    sq: 1 + 0.2 * ratio * Math.tan(phiDeg * DEG),
    sgamma: Math.max(0.6, 1 - 0.4 * ratio),
  }
}

export function depthFactors(phiDeg: number, Df: number, B: number) {
  const rd = Df / Math.max(B, 1e-6)
  if (phiDeg < 10) {
    const d = 1 + 0.2 * rd
    return { dc: d, dq: d, dgamma: 1, composite: d }
  }
  const d = 1 + 0.2 * rd * Math.sqrt(Math.tan(phiDeg * DEG))
  return { dc: d, dq: d, dgamma: 1, composite: d }
}

/** Map foundation depth → engineering layer for soil parameter lookup. */
export function layerForDepth(depthM: number): string {
  if (depthM <= 0.5) return '0.0-0.5m'
  if (depthM <= 1.0) return '0.5-1.0m'
  if (depthM <= 1.5) return '1.0-1.5m'
  if (depthM <= 2.0) return '1.5-2.0m'
  return '1.5-2.0m'
}

export function resolveSoilAtDepth(
  depthM: number,
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayers?: SoilLayerParameters[],
  opts?: { screeningTextureClass?: string | null }
): SbcSoilInputs {
  const dataBasis: SbcDataBasis =
    depthM <= 2.0 ? 'PRIMARY_GEOSPATIAL_MODEL' : 'ENGINEERING_DEPTH_EXTRAPOLATION'
  const layerId = layerForDepth(depthM)
  const layer = soilLayers?.find((l) => l.reportDepth === layerId) ?? null
  const prof =
    profile.find((p) => p.reportDepth === layerId) ||
    profile.find((p) => p.reportDepth === '1.0-1.5m') ||
    profile[0]

  const texture = (prof?.usdaTexture?.value || '').toLowerCase()
  const screeningTex = (opts?.screeningTextureClass || '').toLowerCase()
  const clayPct = layer?.clayPct.value ?? prof?.clayPct.value ?? null
  const isClayey =
    texture.includes('clay') ||
    screeningTex.includes('clay') ||
    (clayPct != null && clayPct >= 15)
  const phiDeg = engineering.phiDeg.value
  const phiStatus = engineering.phiDeg.status
  const gammaKn = engineering.gammaKnM3.value
  const gammaTm3 =
    gammaKn != null && Number.isFinite(gammaKn) ? Number((gammaKn / 9.81).toFixed(3)) : null

  let cTm2: number | null = null
  let cStatus: import('../types').GeoDataStatus = 'FIELD_TEST_REQUIRED'
  let cSource = 'none'

  if (engineering.cohesionKpa.value != null && Number.isFinite(engineering.cohesionKpa.value)) {
    const st = engineering.cohesionKpa.status
    if (
      st === 'MEASURED' ||
      st === 'PROJECT_DATA' ||
      st === 'REFERENCE_CALIBRATED' ||
      st === 'GIS_DERIVED' ||
      st === 'ENGINEERING_CORRELATED' ||
      st === 'MODEL_PREDICTED' ||
      st === 'ESTIMATED' ||
      st === 'CALCULATED'
    ) {
      cTm2 = Number((engineering.cohesionKpa.value / 9.81).toFixed(3))
      cStatus = st
      cSource = `${engineering.cohesionKpa.source} — ${engineering.cohesionKpa.method}`
    }
  } else if (engineering.cohesionKpa.status === 'MEASURED' && engineering.cohesionKpa.value != null) {
    cTm2 = Number((engineering.cohesionKpa.value / 9.81).toFixed(3))
    cStatus = 'MEASURED'
    cSource = engineering.cohesionKpa.source
  } else {
    const drainedSand =
      !isClayey &&
      (texture.includes('sand') ||
        texture.includes('loamy sand') ||
        texture.includes('sandy loam') ||
        screeningTex.includes('sand'))
    if (drainedSand) {
      cTm2 = 0
      cStatus = 'ESTIMATED'
      cSource = 'Drained sand assumption (c′ ≈ 0) — preliminary IS 6403 screening'
    } else if (!isClayey && clayPct != null && clayPct < 15) {
      cTm2 = 0
      cStatus = 'ESTIMATED'
      cSource = 'Low-fines texture — drained c′ ≈ 0 screening assumption'
    }
  }

  let phiAdj = phiDeg
  let phiAdjStatus = phiStatus
  if (dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION' && phiDeg != null) {
    phiAdj = Math.min(45, Number((phiDeg + 0.5 * (depthM - 2.0)).toFixed(1)))
    phiAdjStatus = 'ENGINEERING_CORRELATED'
  }

  return {
    cTm2,
    phiDeg: phiAdj != null && Number.isFinite(phiAdj) ? phiAdj : null,
    gammaTm3,
    cStatus,
    phiStatus: phiAdjStatus,
    gammaStatus: engineering.gammaKnM3.status,
    cSource,
    phiSource:
      dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION'
        ? `${engineering.phiDeg.source} + depth extrapolation (+0.5°/0.5 m below 2.0 m)`
        : engineering.phiDeg.source,
    gammaSource: engineering.gammaKnM3.source,
    textureHint: prof?.usdaTexture?.value ?? null,
    dataBasis,
    layerLabel: prof?.reportDepthLabel ?? layerId,
  }
}

export interface BearingCapacityResult {
  quTm2: number
  qnetUltTm2: number
  qnetSafeTm2: number
  surchargeTm2: number
  factors: Record<string, number>
  components: Record<string, number>
  steps: SbcCalculationStep[]
  baseSbcBeforeDepthFactor: number | null
  depthFactorComposite: number | null
}

export function calculateBearingCapacity(
  depthM: number,
  soil: SbcSoilInputs,
  foundation: SbcFoundationInputs
): BearingCapacityResult | null {
  if (
    soil.phiDeg == null ||
    soil.gammaTm3 == null ||
    soil.cTm2 == null ||
    !Number.isFinite(soil.phiDeg) ||
    !Number.isFinite(soil.gammaTm3) ||
    !Number.isFinite(soil.cTm2)
  ) {
    return null
  }

  const B = foundation.widthM
  const L = foundation.lengthM
  const Df = depthM
  const c = soil.cTm2
  const phi = soil.phiDeg
  const gamma = soil.gammaTm3
  const fos = foundation.fosShear

  const { Nc, Nq, Ngamma } = bearingCapacityFactors(phi)
  const { sc, sq, sgamma } = shapeFactors(phi, B, L)
  const { dc, dq, dgamma, composite } = depthFactors(phi, Df, B)

  const q = gamma * Df
  const cohesionComp = c * Nc * sc * dc
  const surchargeComp = q * Nq * sq * dq
  const unitWeightComp = 0.5 * gamma * B * Ngamma * sgamma * dgamma

  const quNoDepth = c * Nc * sc + q * Nq * sq + unitWeightComp
  const qu = cohesionComp + surchargeComp + unitWeightComp
  const qnetUlt = qu - q
  const qnetSafe = qnetUlt / fos

  if (!Number.isFinite(qnetSafe) || qnetSafe < 0) return null

  const steps: SbcCalculationStep[] = [
    {
      step: 1,
      name: 'Input parameters',
      formula: 'c, φ, γ, B, L, Df, FoS',
      inputs: { c, phi_deg: phi, gamma, B_m: B, L_m: L, Df_m: Df, FoS: fos, dataBasis: soil.dataBasis },
      result: null,
      unit: '—',
    },
    {
      step: 2,
      name: 'Bearing capacity factors',
      formula: 'Nq = e^(π tanφ)·tan²(45+φ/2); Nc = (Nq−1)·cotφ; Nγ = 2(Nq+1)tanφ',
      inputs: { phi_deg: phi },
      result: `Nc=${Nc.toFixed(2)}, Nq=${Nq.toFixed(2)}, Nγ=${Ngamma.toFixed(2)}`,
      unit: '—',
    },
    {
      step: 3,
      name: 'Shape factors',
      formula: 'sc, sq, sγ per IS 6403',
      inputs: { B_m: B, L_m: L },
      result: `sc=${sc.toFixed(3)}, sq=${sq.toFixed(3)}, sγ=${sgamma.toFixed(3)}`,
      unit: '—',
    },
    {
      step: 4,
      name: 'Depth factors',
      formula: 'dc = dq = 1 + 0.2(Df/B)√tanφ (φ≥10°)',
      inputs: { Df_m: Df, B_m: B, phi_deg: phi },
      result: `dc=${dc.toFixed(3)}, dq=${dq.toFixed(3)}, composite=${composite.toFixed(3)}`,
      unit: '—',
    },
    {
      step: 5,
      name: 'Surcharge',
      formula: 'q = γ · Df',
      inputs: { gamma, Df_m: Df },
      result: Number(q.toFixed(3)),
      unit: 'T/m²',
    },
    {
      step: 6,
      name: 'Ultimate bearing capacity',
      formula: 'qu = c·Nc·sc·dc + q·Nq·sq·dq + 0.5·γ·B·Nγ·sγ·dγ',
      inputs: {
        cohesionComp: Number(cohesionComp.toFixed(3)),
        surchargeComp: Number(surchargeComp.toFixed(3)),
        unitWeightComp: Number(unitWeightComp.toFixed(3)),
      },
      result: Number(qu.toFixed(3)),
      unit: 'T/m²',
    },
    {
      step: 7,
      name: 'Net ultimate bearing capacity',
      formula: 'qnu = qu − q',
      inputs: { qu: Number(qu.toFixed(3)), q: Number(q.toFixed(3)) },
      result: Number(qnetUlt.toFixed(3)),
      unit: 'T/m²',
    },
    {
      step: 8,
      name: 'Factor of safety',
      formula: 'FoS (shear)',
      inputs: { FoS: fos },
      result: fos,
      unit: '—',
    },
    {
      step: 9,
      name: 'Net safe bearing capacity (shear)',
      formula: 'qns = qnu / FoS',
      inputs: { qnu: Number(qnetUlt.toFixed(3)), FoS: fos },
      result: Number(qnetSafe.toFixed(2)),
      unit: 'T/m²',
    },
  ]

  const qnetSafeNoDepth = (quNoDepth - q) / fos

  return {
    quTm2: qu,
    qnetUltTm2: qnetUlt,
    qnetSafeTm2: qnetSafe,
    surchargeTm2: q,
    factors: {
      Nc: Number(Nc.toFixed(3)),
      Nq: Number(Nq.toFixed(3)),
      Ngamma: Number(Ngamma.toFixed(3)),
      sc: Number(sc.toFixed(3)),
      sq: Number(sq.toFixed(3)),
      sgamma: Number(sgamma.toFixed(3)),
      dc: Number(dc.toFixed(3)),
      dq: Number(dq.toFixed(3)),
      dgamma,
    },
    components: {
      cohesionTm2: Number(cohesionComp.toFixed(3)),
      surchargeTm2: Number(surchargeComp.toFixed(3)),
      unitWeightTm2: Number(unitWeightComp.toFixed(3)),
      quTm2: Number(qu.toFixed(3)),
      qnetUltTm2: Number(qnetUlt.toFixed(3)),
      fos,
      qnetSafeTm2: Number(qnetSafe.toFixed(2)),
    },
    steps,
    baseSbcBeforeDepthFactor: Number(qnetSafeNoDepth.toFixed(2)),
    depthFactorComposite: Number(composite.toFixed(3)),
  }
}

export function provenanceForShearSbc(
  value: number,
  soil: SbcSoilInputs,
  foundation: SbcFoundationInputs,
  depthM: number,
  sourceLabel: SbcSourceTypeLabel
) {
  const conf =
    soil.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION'
      ? 28
      : soil.phiStatus === 'MEASURED' && soil.cStatus === 'MEASURED'
        ? 75
        : soil.phiStatus === 'ESTIMATED'
          ? 35
          : 42

  return provenance(Number(value.toFixed(1)), {
    unit: 'T/m²',
    source: 'IS 6403:1981 preliminary calculation',
    method: `${sourceLabel} — general shear with shape & depth factors (${soil.dataBasis})`,
    formula: 'qns = (c Nc sc dc + q Nq sq dq + 0.5 γ B Nγ sγ dγ − q) / FoS',
    confidence: conf,
    status: soil.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION' ? 'MODEL_PREDICTED' : 'CALCULATED',
    engineeringLimitation:
      soil.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION'
        ? '2.0–4.0 m: ENGINEERING DEPTH EXTRAPOLATION — not directly observed soil model'
        : '0–2.0 m: PRIMARY GEOSPATIAL SOIL MODEL — preliminary only',
  })
}

export function insufficientShearProvenance(reason: string) {
  return noData<number>('T/m²', reason, 'INSUFFICIENT_DATA')
}
