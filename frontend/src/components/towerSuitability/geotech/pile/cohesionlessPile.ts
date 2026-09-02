/**
 * Phase F — Cohesionless pile shaft contribution (per layer).
 */

const DEG = Math.PI / 180

export function cohesionlessShaftFriction(
  shaftAreaM2: number,
  pdMidTm2: number,
  ki: number,
  deltaDeg: number
): number {
  return Number((shaftAreaM2 * pdMidTm2 * ki * Math.tan(deltaDeg * DEG)).toFixed(3))
}

export function NqFromPhi(phiDeg: number): number {
  if (phiDeg <= 0) return 1
  const phi = phiDeg * DEG
  return Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2)
}

export function NgammaFromPhi(phiDeg: number): number {
  if (phiDeg <= 0) return 0
  return 2 * (NqFromPhi(phiDeg) + 1) * Math.tan(phiDeg * DEG)
}
