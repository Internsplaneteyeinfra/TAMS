/**
 * Phase E — E5 Size correction for reference 1.0 m × 1.0 m footing.
 */

import {
  calculateBearingCapacity,
  provenanceForShearSbc,
  type BearingCapacityResult,
} from './bearingCapacity'
import type { SbcCalculationStep, SbcFoundationInputs, SbcSoilInputs, SizeCorrectionResult } from './types'

export function calculateSizeCorrection(
  soil: SbcSoilInputs,
  foundation: SbcFoundationInputs,
  designDepthM: number,
  referenceWidthM = 1.0,
  referenceLengthM = 1.0
): SizeCorrectionResult {
  const refFoundation: SbcFoundationInputs = {
    ...foundation,
    widthM: referenceWidthM,
    lengthM: referenceLengthM,
    foundationType: `${referenceWidthM} m × ${referenceLengthM} m reference footing`,
  }

  const refBearing = calculateBearingCapacity(designDepthM, soil, refFoundation)
  const actualBearing = calculateBearingCapacity(designDepthM, soil, foundation)

  if (!refBearing || !actualBearing) {
    return {
      referenceFootingM: `${referenceWidthM} × ${referenceLengthM}`,
      referenceSbcTm2: refBearing?.qnetSafeTm2 ?? null,
      sizeCorrectionFactor: null,
      correctedSbcTm2: actualBearing?.qnetSafeTm2 ?? null,
      formula: 'qs(B) / qs(B_ref) — recalculated per IS 6403 shape & unit-weight terms',
      explanation: 'Size correction unavailable — insufficient bearing capacity inputs',
      steps: [
        {
          step: 1,
          name: 'Size correction',
          formula: 'Recalculate IS 6403 at reference vs design footing width',
          inputs: { B_ref: referenceWidthM, B_design: foundation.widthM },
          result: null,
          unit: '—',
          notes: 'INSUFFICIENT_DATA',
        },
      ],
    }
  }

  const factor = Number((actualBearing.qnetSafeTm2 / refBearing.qnetSafeTm2).toFixed(3))

  const steps: SbcCalculationStep[] = [
    {
      step: 1,
      name: 'Reference footing SBC',
      formula: `IS 6403 at B = L = ${referenceWidthM} m`,
      inputs: { B_ref_m: referenceWidthM, Df_m: designDepthM },
      result: refBearing.qnetSafeTm2,
      unit: 'T/m²',
    },
    {
      step: 2,
      name: 'Design footing SBC',
      formula: `IS 6403 at B = ${foundation.widthM} m, L = ${foundation.lengthM} m`,
      inputs: { B_m: foundation.widthM, L_m: foundation.lengthM, Df_m: designDepthM },
      result: actualBearing.qnetSafeTm2,
      unit: 'T/m²',
    },
    {
      step: 3,
      name: 'Size correction factor',
      formula: 'K_size = qs(design) / qs(reference)',
      inputs: {
        qs_design: actualBearing.qnetSafeTm2,
        qs_reference: refBearing.qnetSafeTm2,
      },
      result: factor,
      unit: '—',
      notes: 'Shape factor sc, sq, sγ and γ-term scale with footing dimensions — not a blind multiplier',
    },
  ]

  return {
    referenceFootingM: `${referenceWidthM} × ${referenceLengthM}`,
    referenceSbcTm2: refBearing.qnetSafeTm2,
    sizeCorrectionFactor: factor,
    correctedSbcTm2: actualBearing.qnetSafeTm2,
    formula: 'K_size = qs(B_design) / qs(B_ref=1.0 m)',
    explanation: `Reference ${referenceWidthM}×${referenceLengthM} m footing SBC = ${refBearing.qnetSafeTm2.toFixed(1)} T/m²; design ${foundation.widthM}×${foundation.lengthM} m → factor ${factor} via full IS 6403 recalculation (not hardcoded).`,
    steps,
  }
}

export function referenceBearingAtDepth(
  depthM: number,
  soil: SbcSoilInputs,
  foundation: SbcFoundationInputs
): BearingCapacityResult | null {
  return calculateBearingCapacity(depthM, soil, foundation)
}

export { provenanceForShearSbc }
