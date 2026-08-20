/** Screen-space celestial paths — settled high sky vs bottom transition arc. */

export interface CelestialTransitionArcLayout {
  x0: number
  y0: number
  cx: number
  cy: number
  x1: number
  y1: number
  horizonY: number
  scale: number
  isMobile: boolean
}

export interface SettledCelestialLayout {
  x: number
  y: number
  scale: number
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

/** Bottom horizon arc used during light ↔ dark transitions. */
export function getTransitionArcLayout(width: number, height: number): CelestialTransitionArcLayout {
  const isMobile = width < 640
  const isTablet = width < 1024
  const scale = isMobile ? 0.62 : isTablet ? 0.82 : 1
  const horizonY = height * (isMobile ? 0.88 : 0.86)
  return {
    x0: width * 0.06,
    y0: horizonY,
    cx: width * 0.5,
    cy: height * (isMobile ? 0.84 : 0.82),
    x1: width * 0.94,
    y1: horizonY,
    horizonY,
    scale,
    isMobile,
  }
}

/** Settled sun/moon — sky band just above the module kicker, below page top. */
export function getSettledCelestialLayout(width: number, height: number): SettledCelestialLayout {
  const isMobile = width < 640
  const isTablet = width < 1024
  const scale = isMobile ? 0.5 : isTablet ? 0.58 : 0.64
  return {
    x: width * 0.5,
    y: height * (isMobile ? 0.24 : 0.215),
    scale,
  }
}

export function arcPointFromU(u: number, layout: CelestialTransitionArcLayout) {
  const t = clamp01(u)
  const { x0, y0, cx, cy, x1, y1 } = layout
  const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1
  const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1
  return { x, y }
}

/** @deprecated use getTransitionArcLayout */
export function getCelestialArcLayout(width: number, height: number) {
  return getTransitionArcLayout(width, height)
}

export function horizonRiseClip(u: number, layout: CelestialTransitionArcLayout, bodySize: number) {
  if (u >= 0.42) return undefined
  const p = arcPointFromU(u, layout)
  const reveal = clamp01(u / 0.42)
  const hideBelow = layout.horizonY + bodySize * 0.06
  const clipPx = Math.max(0, hideBelow - p.y + bodySize * 0.38 * (1 - reveal))
  return `inset(0 0 ${clipPx}px 0)`
}

export function arcUFromClientX(clientX: number, width: number, height: number) {
  const layout = getTransitionArcLayout(width, height)
  let bestU = 0.5
  let bestDist = Infinity
  for (let i = 0; i <= 48; i++) {
    const u = i / 48
    const p = arcPointFromU(u, layout)
    const d = Math.abs(p.x - clientX)
    if (d < bestDist) {
      bestDist = d
      bestU = u
    }
  }
  return bestU
}

export const CELESTIAL_CENTER_U = 0.5
export const CELESTIAL_DARK_THRESHOLD_U = 0.68
export const CELESTIAL_LIGHT_THRESHOLD_U = 0.32
