/**
 * Regional reference calibration — constrains correlation outputs to defensible ranges.
 * Does NOT copy values from reference locations to other coordinates.
 */

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

export function calibrateCohesionKpa(raw: number, clayPct: number, pi: number): number {
  const base = clamp(raw, 2, 120)
  if (clayPct < 8) return clamp(base, 0, 15)
  if (pi > 35) return clamp(base, 8, 80)
  return base
}

export function calibratePhiDeg(raw: number, sandPct: number, clayPct: number): number {
  let v = clamp(raw, 14, 42)
  if (sandPct >= 70 && clayPct < 10) v = clamp(v, 28, 38)
  if (clayPct >= 35) v = clamp(v, 14, 26)
  return Number(v.toFixed(1))
}

export function calibrateSptN(raw: number, clayPct: number): number {
  return clamp(Math.round(raw), 4, 50)
}

export function calibrateCbrPct(raw: number): number {
  return clamp(Number(raw.toFixed(1)), 2, 45)
}

export function calibrateResistivityOhmM(raw: number): number {
  return clamp(raw, 8, 800)
}

export function calibrateMddGcc(raw: number): number {
  return clamp(Number(raw.toFixed(2)), 1.45, 2.15)
}

export function calibrateOmcPct(raw: number, clayPct: number): number {
  const v = clamp(Number(raw.toFixed(1)), 6, 28)
  return clayPct >= 25 ? clamp(v, 12, 28) : v
}
