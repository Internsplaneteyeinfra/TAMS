/**
 * Phase F — Cohesive pile shaft contribution (per layer).
 */

export function cohesiveShaftFriction(
  shaftAreaM2: number,
  cTm2: number,
  alpha = 0.5
): number {
  return Number((shaftAreaM2 * alpha * cTm2).toFixed(3))
}
