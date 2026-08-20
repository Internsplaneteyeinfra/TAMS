import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import {
  CELESTIAL_TRANSITION_MS,
  THEME_TRANSITION_MS,
  easeInOutCubic,
  landingThemeBlendCssVars,
  persistLandingAppearance,
  readLandingAppearance,
  type LandingAppearance,
} from '@/theme/landingTheme'
import {
  CELESTIAL_CENTER_U,
  arcPointFromU,
  getSettledCelestialLayout,
  getTransitionArcLayout,
} from '@/theme/celestialArc'

export interface CelestialVisualState {
  x: number
  y: number
  scale: number
  bodyOpacity: number
  sunOpacity: number
  moonOpacity: number
  /** 0 = left horizon, 1 = right horizon */
  arcU: number
}

interface LandingThemeContextValue {
  appearance: LandingAppearance
  displayAppearance: LandingAppearance
  isTransitioning: boolean
  themeBlendRef: MutableRefObject<number>
  transitionLockRef: MutableRefObject<boolean>
  /** Live arc position while dragging (null = use settled centre). */
  dragArcURef: MutableRefObject<number | null>
  celestial: CelestialVisualState | null
  registerLandingEl: (el: HTMLElement | null) => void
  requestAppearance: (next: LandingAppearance) => void
  toggleAppearance: () => void
  /** Sun rises from left mountains into centre on first load (light mode). */
  playIntroSunrise: () => void
}

const LandingThemeContext = createContext<LandingThemeContextValue | null>(null)

function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function computeCelestialFromU(
  u: number,
  width: number,
  height: number,
  bodyOpacity: number,
  sunOpacity: number,
  moonOpacity: number
): CelestialVisualState {
  const layout = getTransitionArcLayout(width, height)
  const { x, y } = arcPointFromU(u, layout)
  return { x, y, scale: layout.scale, bodyOpacity, sunOpacity, moonOpacity, arcU: u }
}

function computeCelestialSettled(
  width: number,
  height: number,
  bodyOpacity: number,
  sunOpacity: number,
  moonOpacity: number
): CelestialVisualState {
  const settled = getSettledCelestialLayout(width, height)
  return {
    x: settled.x,
    y: settled.y,
    scale: settled.scale,
    bodyOpacity,
    sunOpacity,
    moonOpacity,
    arcU: CELESTIAL_CENTER_U,
  }
}

function computeCelestial(
  progress: number,
  toLight: boolean,
  width: number,
  height: number
): CelestialVisualState {
  const travel = smoothstep(0.08, 0.92, progress)
  // Light→Dark: bottom-left → bottom-right. Dark→Light: reverse.
  const u = toLight ? 1 - travel : travel

  const fadeIn = smoothstep(0, 0.1, progress)
  const fadeOut = 1 - smoothstep(0.9, 1, progress)
  const bodyOpacity = fadeIn * fadeOut

  const morph = smoothstep(0.4, 0.68, progress)
  const sunOpacity = toLight ? morph : 1 - morph
  const moonOpacity = toLight ? 1 - morph : morph

  return computeCelestialFromU(u, width, height, bodyOpacity, sunOpacity, moonOpacity)
}

function applyBlendStyles(el: HTMLElement | null, blend: number) {
  if (!el) return
  const vars = landingThemeBlendCssVars(blend)
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value === 'string') el.style.setProperty(key, value)
  }
}

function clearBlendStyles(el: HTMLElement | null) {
  if (!el) return
  const vars = landingThemeBlendCssVars(0)
  for (const key of Object.keys(vars)) {
    el.style.removeProperty(key)
  }
}

export function LandingThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<LandingAppearance>('dark')
  const [displayAppearance, setDisplayAppearance] = useState<LandingAppearance>('dark')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [celestial, setCelestial] = useState<CelestialVisualState | null>(null)

  const themeBlendRef = useRef(0)
  const transitionLockRef = useRef(false)
  const dragArcURef = useRef<number | null>(null)
  const landingElRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef(0)
  const introSunriseDoneRef = useRef(false)

  const registerLandingEl = useCallback((el: HTMLElement | null) => {
    landingElRef.current = el
  }, [])

  useEffect(() => {
    const saved = readLandingAppearance()
    setAppearanceState(saved)
    setDisplayAppearance(saved)
    themeBlendRef.current = saved === 'light' ? 1 : 0
  }, [])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  const runTransition = useCallback(
    (next: LandingAppearance, from: number, to: number) => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const duration = reducedMotion ? THEME_TRANSITION_MS : CELESTIAL_TRANSITION_MS
      const toLight = to > from

      transitionLockRef.current = true
      dragArcURef.current = null
      setIsTransitioning(true)
      setDisplayAppearance(next)

      const start = performance.now()
      let lastCelestialFrame = 0

      const finish = (target: LandingAppearance, blend: number) => {
        transitionLockRef.current = false
        setIsTransitioning(false)
        setCelestial(null)
        setAppearanceState(target)
        setDisplayAppearance(target)
        themeBlendRef.current = blend
        clearBlendStyles(landingElRef.current)
        persistLandingAppearance(target)
      }

      const tick = (now: number) => {
        const raw = Math.min(1, (now - start) / duration)
        const eased = easeInOutCubic(raw)
        const blend = from + (to - from) * eased
        themeBlendRef.current = blend
        applyBlendStyles(landingElRef.current, blend)

        if (!reducedMotion && now - lastCelestialFrame > 32) {
          lastCelestialFrame = now
          setCelestial(computeCelestial(raw, toLight, window.innerWidth, window.innerHeight))
        }

        if (raw < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          finish(next, to)
        }
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    },
    []
  )

  const requestAppearance = useCallback(
    (next: LandingAppearance) => {
      if (next === appearance || transitionLockRef.current) return
      const from = themeBlendRef.current
      const to = next === 'light' ? 1 : 0
      runTransition(next, from, to)
    },
    [appearance, runTransition]
  )

  const playIntroSunrise = useCallback(() => {
    if (introSunriseDoneRef.current || transitionLockRef.current) return
    if (themeBlendRef.current < 0.5) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      introSunriseDoneRef.current = true
      return
    }

    introSunriseDoneRef.current = true
    transitionLockRef.current = true
    setIsTransitioning(true)

    const duration = 3200
    const start = performance.now()

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration)
      const eased = easeInOutCubic(raw)
      const w = window.innerWidth
      const h = window.innerHeight
      const from = arcPointFromU(0, getTransitionArcLayout(w, h))
      const to = getSettledCelestialLayout(w, h)
      setCelestial({
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        scale: to.scale * (0.85 + eased * 0.15),
        bodyOpacity: smoothstep(0, 0.18, raw),
        sunOpacity: 1,
        moonOpacity: 0,
        arcU: eased * CELESTIAL_CENTER_U,
      })

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        transitionLockRef.current = false
        setIsTransitioning(false)
        setCelestial(null)
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const toggleAppearance = useCallback(() => {
    requestAppearance(displayAppearance === 'dark' ? 'light' : 'dark')
  }, [displayAppearance, requestAppearance])

  const value = useMemo(
    () => ({
      appearance,
      displayAppearance,
      isTransitioning,
      themeBlendRef,
      transitionLockRef,
      dragArcURef,
      celestial,
      registerLandingEl,
      requestAppearance,
      toggleAppearance,
      playIntroSunrise,
    }),
    [
      appearance,
      displayAppearance,
      isTransitioning,
      celestial,
      registerLandingEl,
      requestAppearance,
      toggleAppearance,
      playIntroSunrise,
    ]
  )

  return <LandingThemeContext.Provider value={value}>{children}</LandingThemeContext.Provider>
}

export function useLandingTheme() {
  const ctx = useContext(LandingThemeContext)
  if (!ctx) throw new Error('useLandingTheme must be used within LandingThemeProvider')
  return ctx
}

export { computeCelestialFromU, computeCelestialSettled, applyBlendStyles, clearBlendStyles }
