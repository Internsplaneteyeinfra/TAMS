/**
 * Phase F — Layer-aware pile soil profile (reuses Phase E resolveSoilAtDepth).
 */

import { resolveSoilAtDepth } from '../sbc/bearingCapacity'
import type { EngineeringParameterSet, SoilLayerParameters, SoilProfileInterval } from '../types'
import type { PileEngineeringParameter, PileLayerCalculation, SoilConditionType } from './types'
import { classifySoilCondition } from './pileValidation'

const DEG = Math.PI / 180

function param(
  value: number | null,
  unit: string,
  source: import('../types').GeoDataStatus,
  method: string,
  confidence: number | null,
  reference?: string
): PileEngineeringParameter {
  return { value, unit, source, method, confidence, reference }
}

const LAYER_BANDS = [
  { from: 0, to: 0.5, id: '0.0-0.5m' as const },
  { from: 0.5, to: 1.0, id: '0.5-1.0m' as const },
  { from: 1.0, to: 1.5, id: '1.0-1.5m' as const },
  { from: 1.5, to: 2.0, id: '1.5-2.0m' as const },
]

export function buildPileLayerProfile(
  pileDepthM: number,
  diameterM: number,
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayers?: SoilLayerParameters[],
  screeningTextureClass?: string | null
): PileLayerCalculation[] {
  const perimeter = Math.PI * diameterM
  const out: PileLayerCalculation[] = []

  for (const band of LAYER_BANDS) {
    if (band.from >= pileDepthM) break
    const depthTo = Math.min(band.to, pileDepthM)
    const thickness = depthTo - band.from
    if (thickness <= 0) continue

    const mid = (band.from + depthTo) / 2
    const soilLayer = soilLayers?.find((l) => l.reportDepth === band.id)
    const profLayer = profile.find((p) => p.reportDepth === band.id)
    const clayPct = soilLayer?.clayPct.value ?? profLayer?.clayPct.value ?? 20
    const sandPct = soilLayer?.sandPct.value ?? profLayer?.sandPct.value ?? 40
    const siltPct = soilLayer?.siltPct.value ?? profLayer?.siltPct.value ?? 40

    const soilAtMid = resolveSoilAtDepth(mid, engineering, profile, soilLayers, {
      screeningTextureClass,
    })
    const soilCondition = classifySoilCondition(clayPct, sandPct)

    const phi = soilAtMid.phiDeg
    const gamma = soilAtMid.gammaTm3
    const c = soilAtMid.cTm2
    const pdMid = gamma != null ? gamma * mid : null
    const ki = phi != null ? 1 - Math.sin(phi * DEG) : null
    const delta = phi != null ? 0.75 * phi : null

    let shaftContribution: number | null = null
    let method = '—'
    if (phi != null && gamma != null && c != null && pdMid != null && ki != null && delta != null) {
      const As = perimeter * thickness
      if (soilCondition === 'COHESIVE') {
        const alpha = 0.5
        shaftContribution = As * alpha * c
        method = `Cohesive: fs = α·c, α=${alpha} (IS 2911 screening)`
      } else if (soilCondition === 'COHESIONLESS') {
        shaftContribution = As * pdMid * ki * Math.tan(delta * DEG)
        method = `Cohesionless: fs = PD·Ki·tanδ`
      } else {
        const fsPhi = pdMid * ki * Math.tan(delta * DEG)
        const fsC = c > 0 ? 0.5 * c : 0
        shaftContribution = As * (fsPhi + fsC)
        method = `Mixed: fs = PD·Ki·tanδ + α·c`
      }
      shaftContribution = Number(shaftContribution.toFixed(3))
    }

    out.push({
      depthFromM: band.from,
      depthToM: depthTo,
      thicknessM: Number(thickness.toFixed(3)),
      midDepthM: Number(mid.toFixed(3)),
      soilCondition,
      cTm2: param(c, 'T/m²', soilAtMid.cStatus, soilAtMid.cSource, c != null ? 40 : null, 'IS 2911'),
      phiDeg: param(phi, '°', soilAtMid.phiStatus, soilAtMid.phiSource, phi != null ? 38 : null),
      gammaTm3: param(gamma, 'T/m³', soilAtMid.gammaStatus, soilAtMid.gammaSource, gamma != null ? 45 : null),
      overburdenMidTm2: param(pdMid, 'T/m²', 'CALCULATED', 'PD = γ · z_mid', pdMid != null ? 50 : null),
      Ki: param(ki, '—', 'CALCULATED', 'Ki = 1 − sinφ', ki != null ? 45 : null),
      deltaDeg: param(delta, '°', 'CALCULATED', 'δ = 0.75φ', delta != null ? 40 : null),
      shaftAreaM2: Number((perimeter * thickness).toFixed(4)),
      shaftFrictionContributionT: shaftContribution,
      method,
    })
  }

  return out
}

export function tipSoilAtDepth(
  pileDepthM: number,
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayers?: SoilLayerParameters[],
  screeningTextureClass?: string | null
) {
  return resolveSoilAtDepth(pileDepthM, engineering, profile, soilLayers, { screeningTextureClass })
}
