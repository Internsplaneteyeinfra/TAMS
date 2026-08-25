/**
 * Theme tokens for the TAMS main module-selection page.
 * Dark values match the approved cinematic landing. Light is a separate
 * engineering / digital-twin treatment — not an invert of dark.
 */

import type { CSSProperties } from 'react'

export type LandingAppearance = 'dark' | 'light'

export const LANDING_THEME_KEY = 'tams-theme'
export const THEME_TRANSITION_MS = 350
/** Full day/night celestial theme transition (ms). */
export const CELESTIAL_TRANSITION_MS = 2000

const landingDarkUi = {
  bg: '#07111D',
  text: '#F4F7FA',
  textSecondary: '#94a3b8',
  kicker: '#7d94a8',
  headerBg: 'rgba(8, 21, 34, 0.4)',
  headerBorder: 'rgba(143, 179, 201, 0.1)',
  headerBrand: '#7d94a8',
  headerTitle: '#F4F7FA',
  cardBg: 'rgba(5, 20, 35, 0.78)',
  cardBorder: 'rgba(255, 255, 255, 0.12)',
  status: '#a5f3fc',
} as const

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerpHex(a: string, b: string, t: number): string {
  const ta = clamp01(t)
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const r = Math.round(ar + (br - ar) * ta)
  const g = Math.round(ag + (bg - ag) * ta)
  const bl = Math.round(ab + (bb - ab) * ta)
  return `rgb(${r}, ${g}, ${bl})`
}

function lerpRgba(a: string, b: string, t: number): string {
  const ta = clamp01(t)
  const parse = (s: string) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
    if (!m) return [0, 0, 0, 1]
    return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1]
  }
  const [ar, ag, ab, aa] = parse(a)
  const [br, bg, bb, ba] = parse(b)
  return `rgba(${ar + (br - ar) * ta}, ${ag + (bg - ag) * ta}, ${ab + (bb - ab) * ta}, ${aa + (ba - aa) * ta})`
}

function lerpStr(a: string, b: string, t: number) {
  return a.startsWith('rgba') || b.startsWith('rgba') ? lerpRgba(a, b, t) : lerpHex(a, b, t)
}

/** Interpolated CSS variables for smooth UI during theme transition. */
export function landingThemeBlendCssVars(blend: number): CSSProperties {
  const t = landingTokens
  const d = landingDarkUi
  const u = clamp01(blend)
  return {
    '--tams-theme-blend': String(u),
    '--tams-bg': lerpHex(d.bg, t.bg, u),
    '--tams-text': lerpHex(d.text, t.text, u),
    '--tams-text-secondary': lerpHex(d.textSecondary, t.textSecondary, u),
    '--tams-kicker': lerpHex(d.kicker, t.headingKicker, u),
    '--tams-header-bg': lerpRgba(d.headerBg, t.headerBg, u),
    '--tams-header-border': lerpStr(d.headerBorder, t.headerBorder, u),
    '--tams-header-brand': lerpHex(d.headerBrand, t.headerBrand, u),
    '--tams-header-title': lerpHex(d.headerTitle, t.headerTitle, u),
    '--tams-card-bg': lerpRgba(d.cardBg, t.cardBg, u),
    '--tams-card-border': lerpStr(d.cardBorder, t.cardBorder, u),
    '--tams-status': lerpHex(d.status, t.statusText, u),
    '--tams-border': lerpHex('rgba(255,255,255,0.1)', t.border, u),
    '--tams-cyan': t.cyan,
    '--tams-cyan-soft': t.cyanSoft,
    '--tams-green': t.green,
    '--tams-green-soft': t.greenSoft,
    '--tams-amber': t.amber,
    '--tams-amber-soft': t.amberSoft,
    '--tams-suit-bg': lerpHex('#051423', t.suitabilityBg, u),
    '--tams-suit-border': lerpHex('#67e8f9', t.suitabilityBorder, u),
    '--tams-an-bg': lerpHex('#051423', t.analyzerBg, u),
    '--tams-an-border': lerpHex('#6ee7b7', t.analyzerBorder, u),
    '--tams-perf-bg': lerpHex('#051423', t.performanceBg, u),
    '--tams-perf-border': lerpHex('#fcd34d', t.performanceBorder, u),
  } as CSSProperties
}

export function easeInOutCubic(x: number) {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export const landingTokens = {
  bg: '#F3F7FA',
  bgSecondary: '#E7EFF4',
  bgTop: '#F7FAFC',
  bgMid: '#EFF6F9',
  bgBottom: '#E7EFF4',
  surface: '#FFFFFF',
  surfaceSecondary: '#F7FAFC',
  text: '#0B1726',
  textSecondary: '#526579',
  textMuted: '#718396',
  headingKicker: '#60788A',
  border: '#C9D6DF',
  grid: '#D7E1E7',
  gridLine: 'rgba(70, 105, 125, 0.055)',
  cyan: '#0891B2',
  cyanSoft: '#D9F1F6',
  green: '#059669',
  greenSoft: '#DDF5ED',
  amber: '#D97706',
  amberSoft: '#FFF1D6',
  statusText: '#426879',
  statusTextAlt: '#477084',
  substationText: '#365467',
  headerBg: 'rgba(255,255,255,0.18)',
  headerBorder: '#D7E1E7',
  headerBrand: '#3d5568',
  headerTitle: '#0B1726',
  cardBg: 'rgba(255,255,255,0.87)',
  cardBorder: '#CBD8E2',
  cardShadow: '0 12px 32px rgba(30,60,80,0.08)',
  cardShadowHover: '0 16px 36px rgba(30,60,80,0.12)',
  suitabilityBg: '#F5FBFD',
  suitabilityBorder: '#8BC9D7',
  suitabilityIconBg: '#E2F5F8',
  analyzerBg: '#F4FBF8',
  analyzerBorder: '#91D4C1',
  analyzerIconBg: '#E3F7F0',
  performanceBg: '#FFFAF1',
  performanceBorder: '#E7C77B',
  performanceIconBg: '#FFF3D9',
} as const

/** CSS custom properties applied only when the landing page is in light mode. */
export function landingLightCssVars(): CSSProperties {
  const t = landingTokens
  return {
    '--tams-bg': t.bg,
    '--tams-bg-top': t.bgTop,
    '--tams-bg-mid': t.bgMid,
    '--tams-bg-bottom': t.bgBottom,
    '--tams-surface': t.surface,
    '--tams-text': t.text,
    '--tams-text-secondary': t.textSecondary,
    '--tams-text-muted': t.textMuted,
    '--tams-kicker': t.headingKicker,
    '--tams-border': t.border,
    '--tams-grid': t.grid,
    '--tams-grid-line': t.gridLine,
    '--tams-cyan': t.cyan,
    '--tams-cyan-soft': t.cyanSoft,
    '--tams-green': t.green,
    '--tams-green-soft': t.greenSoft,
    '--tams-amber': t.amber,
    '--tams-amber-soft': t.amberSoft,
    '--tams-status': t.statusText,
    '--tams-status-alt': t.statusTextAlt,
    '--tams-substation': t.substationText,
    '--tams-header-bg': t.headerBg,
    '--tams-header-border': t.headerBorder,
    '--tams-header-brand': t.headerBrand,
    '--tams-header-title': t.headerTitle,
    '--tams-card-bg': t.cardBg,
    '--tams-card-border': t.cardBorder,
    '--tams-card-shadow': t.cardShadow,
    '--tams-card-shadow-hover': t.cardShadowHover,
    '--tams-suit-bg': t.suitabilityBg,
    '--tams-suit-border': t.suitabilityBorder,
    '--tams-suit-icon': t.suitabilityIconBg,
    '--tams-an-bg': t.analyzerBg,
    '--tams-an-border': t.analyzerBorder,
    '--tams-an-icon': t.analyzerIconBg,
    '--tams-perf-bg': t.performanceBg,
    '--tams-perf-border': t.performanceBorder,
    '--tams-perf-icon': t.performanceIconBg,
  } as CSSProperties
}

/** 3D appearance — dark numbers are the live approved scene; do not restyle them. */
export const sceneAppearance = {
  dark: {
    fogColor: '#050D17',
    fogNear: 18,
    fogFar: 62,
    exposure: 1.15,
    ambient: { intensity: 0.5, color: '#ffffff' },
    key: { intensity: 1.1, color: '#e2e8f0' },
    rim: { intensity: 0.65, color: '#67e8f9' },
    accent: { intensity: 0.55, color: '#22d3ee' },
    fill: { intensity: 0, color: '#b8d4e3' },
    ground: { color: '#0a1626', opacity: 0.55 },
    tower: {
      color: '#8a96a8',
      metalness: 0.68,
      roughness: 0.42,
      emissiveIdle: '#1a7894',
      emissiveScan: '#22d3ee',
      emissiveBase: 0.38,
      opacity: 0.94,
    },
    line: { color: '#67e8f9', additive: true },
    energy: { color: '#7dd3fc' },
    scan: { color: '#22d3ee' },
    transformer: {
      steel: '#5b6470',
      darkSteel: '#3d4451',
      bushing: '#8b95a3',
      emissive: '#134e6a',
      indicator: '#67e8f9',
      localLight: 0.5,
    },
  },
  light: {
    fogColor: '#8EB8D4',
    fogNear: 20,
    fogFar: 78,
    exposure: 1.08,
    ambient: { intensity: 0.62, color: '#eef4f8' },
    key: { intensity: 1.05, color: '#fff8ee' },
    rim: { intensity: 0.2, color: '#98b8c8' },
    accent: { intensity: 0.12, color: '#688898' },
    fill: { intensity: 0.28, color: '#d0e4f0' },
    ground: { color: '#C5D3DC', opacity: 0.5 },
    tower: {
      color: '#5E7180',
      metalness: 0.4,
      roughness: 0.5,
      emissiveIdle: '#5a6e7c',
      emissiveScan: '#4a7a88',
      emissiveBase: 0.035,
      opacity: 0.97,
    },
    line: { color: '#6E8494', additive: false },
    energy: { color: '#00A8C7' },
    scan: { color: '#0891B2' },
    transformer: {
      steel: '#5E7180',
      darkSteel: '#465966',
      bushing: '#738795',
      emissive: '#4a5f6c',
      indicator: '#0891B2',
      localLight: 0.22,
    },
  },
} as const

export function readLandingAppearance(): LandingAppearance {
  if (typeof window === 'undefined') return 'dark'
  try {
    const saved = window.localStorage.getItem(LANDING_THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function persistLandingAppearance(value: LandingAppearance) {
  try {
    window.localStorage.setItem(LANDING_THEME_KEY, value)
  } catch {
    /* storage unavailable */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tams-theme-change'))
  }
}
