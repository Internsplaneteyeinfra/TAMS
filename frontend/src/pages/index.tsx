/**
 * TAMS entry landing — 3D transmission network intro (towers → lines →
 * transformer → energy → scan) → centered module cards over the live network.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { Activity, ArrowLeft, MapPinned, RadioTower, X } from 'lucide-react'
import type { LandingModuleId, NetworkMode } from '@/components/TransmissionNetwork'
import { LandingThemeProvider, useLandingTheme } from '@/theme/LandingThemeContext'
import { landingLightCssVars } from '@/theme/landingTheme'
import LandingThemeToggle from '@/components/landing/LandingThemeToggle'
import CelestialHorizon from '@/components/landing/CelestialHorizon'
import CelestialDragControl from '@/components/landing/CelestialDragControl'

const TransmissionNetwork = dynamic(() => import('@/components/TransmissionNetwork'), {
  ssr: false,
  // Feedback while the 3D chunk itself downloads/evaluates
  loading: () => (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <p className="absolute left-1/2 top-[10%] -translate-x-1/2 text-[10px] font-bold tracking-[0.3em] text-cyan-400/70">
        INITIALIZING NETWORK...
      </p>
    </div>
  ),
})

const INTRO_SEEN_KEY = 'tamsIntroSeen'

const MODULES = [
  {
    id: 'suitability' as const,
    title: 'Tower Suitability',
    subtitle: 'Upload KML · score site fit',
    href: '/tower-suitability',
    icon: MapPinned,
    accent:
      'from-cyan-400/[0.17] to-transparent border-cyan-300/30 hover:border-cyan-300/65 hover:shadow-[0_22px_48px_-20px_rgba(34,211,238,0.35)]',
    iconClass: 'text-cyan-300',
  },
  {
    id: 'analyzer' as const,
    title: 'Tower Analyzer',
    subtitle: 'TAMS Grid Command',
    href: '/analyzer',
    icon: RadioTower,
    accent:
      'from-emerald-400/[0.16] to-transparent border-emerald-300/30 hover:border-emerald-300/65 hover:shadow-[0_22px_48px_-20px_rgba(52,211,153,0.32)]',
    iconClass: 'text-emerald-300',
  },
  {
    id: 'performance' as const,
    title: 'Tower Performance',
    subtitle: 'Coming soon',
    href: null as string | null,
    icon: Activity,
    accent:
      'from-amber-400/[0.15] to-transparent border-amber-300/30 hover:border-amber-300/65 hover:shadow-[0_22px_48px_-20px_rgba(251,191,36,0.28)]',
    iconClass: 'text-amber-300',
  },
]

/** Module-click transition: network reacts and the camera pushes in, then route. */
const DEPART_MS = 420

export default function LandingPage() {
  return (
    <LandingThemeProvider>
      <LandingPageInner />
    </LandingThemeProvider>
  )
}

function LandingPageInner() {
  const { appearance, isTransitioning, registerLandingEl, playIntroSunrise } = useLandingTheme()
  const router = useRouter()
  const [performanceOpen, setPerformanceOpen] = useState(false)
  const [activeModule, setActiveModule] = useState<LandingModuleId | null>(null)
  const [departing, setDeparting] = useState(false)

  // Intro flow: mode decided on mount → network builds → 'initialized' reveals cards
  const [mode, setMode] = useState<NetworkMode | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [skipRequested, setSkipRequested] = useState(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // ?intro=1 forces a full replay of the network build-up (demo / preview)
    const forceIntro = new URLSearchParams(window.location.search).get('intro') === '1'
    let introSeen = false
    try {
      introSeen = window.localStorage.getItem(INTRO_SEEN_KEY) === '1'
    } catch {
      introSeen = true
    }

    if (reducedMotion) setMode('instant')
    else if (forceIntro) setMode('full')
    else if (introSeen) setMode('fast')
    else setMode('full')
  }, [])

  const handleInitialized = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      /* storage unavailable — intro will replay next visit */
    }
    setRevealed(true)
  }, [])

  const handleSkip = useCallback(() => setSkipRequested(true), [])

  /**
   * Hold the selected module highlighted while the camera pushes into the
   * network, then navigate. Kept short so it never feels like a delay.
   */
  const handleSelect = useCallback(
    (id: LandingModuleId, href: string | null) => {
      if (departing) return
      setActiveModule(id)
      if (!href) {
        setPerformanceOpen(true)
        return
      }
      setDeparting(true)
      window.setTimeout(() => void router.push(href), DEPART_MS)
    },
    [departing, router]
  )

  // Clear stagger delays once the reveal finishes so hover transitions stay instant
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!revealed) return
    const t = window.setTimeout(() => setSettled(true), 1400)
    return () => window.clearTimeout(t)
  }, [revealed])

  useEffect(() => {
    if (!revealed || appearance !== 'light') return
    const t = window.setTimeout(() => playIntroSunrise(), 500)
    return () => window.clearTimeout(t)
  }, [revealed, appearance, playIntroSunrise])

  const revealClass = () =>
    `${settled ? 'transition-all' : 'transition-all duration-700 ease-out'} ${revealed ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none'
    }`

  const revealDelay = (delayMs: number): React.CSSProperties =>
    settled ? {} : { transitionDelay: `${delayMs}ms` }

  // Cards: fade + rise from below (24px), scale 0.98 → 1, staggered 0 / 100 / 200 ms
  const cardClass = () =>
    settled
      ? 'transition-all duration-300 ease-out opacity-100 translate-y-0 scale-100'
      : `transition-all duration-[650ms] ease-out ${revealed
        ? 'opacity-100 translate-y-0 scale-100'
        : 'pointer-events-none opacity-0 translate-y-6 scale-[0.98]'
      }`

  const cardDelay = (idx: number): React.CSSProperties =>
    settled ? {} : { transitionDelay: `${200 + idx * 100}ms` }

  return (
    <>
      <Head>
        <title>TAMS · Choose module</title>
      </Head>
      <div
        ref={registerLandingEl}
        className={`tams-landing min-h-full flex flex-col text-slate-200 relative overflow-hidden bg-[#07111D] ${isTransitioning ? 'tams-landing--theme-blend' : ''}`}
        data-tams-theme={appearance}
        style={appearance === 'light' && !isTransitioning ? landingLightCssVars() : undefined}
        suppressHydrationWarning
      >
        {/* Layer 1 — deep-navy atmospheric base */}
        <div
          className="tams-landing-base pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(0,110,150,0.10) 0%, rgba(0,60,100,0.05) 30%, transparent 60%), linear-gradient(180deg, #081522 0%, #07111D 45%, #050D17 100%)',
          }}
        />

        {/* Layer 2 — atmospheric glow behind the network (reaches into the upper sky) */}
        <div
          className="tams-landing-glow pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 62% 50% at 50% 28%, rgba(46,150,190,0.11), transparent 74%), radial-gradient(ellipse 42% 34% at 74% 46%, rgba(34,211,238,0.05), transparent 70%)',
          }}
        />

        {/* Layer 2 — engineering grid (fine + coarse) */}
        <div
          className="tams-landing-grid pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(90,150,180,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(90,150,180,0.03) 1px, transparent 1px), linear-gradient(rgba(90,150,180,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(90,150,180,0.045) 1px, transparent 1px)',
            backgroundSize: '48px 48px, 48px 48px, 240px 240px, 240px 240px',
            // Fades out behind the centered heading/cards so the grid never competes with text
            maskImage:
              'radial-gradient(ellipse 75% 65% at 50% 42%, black 30%, transparent 100%), radial-gradient(ellipse 34% 30% at 50% 46%, transparent 30%, black 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 75% 65% at 50% 42%, black 30%, transparent 100%), radial-gradient(ellipse 34% 30% at 50% 46%, transparent 30%, black 100%)',
            maskComposite: 'intersect',
            WebkitMaskComposite: 'source-in',
          }}
        />

        {/* Vignette — corners recede gently; kept off the upper sky region */}
        <div
          className="tams-landing-vignette pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 95% 92% at 50% 40%, transparent 58%, rgba(4,9,16,0.38) 100%)',
          }}
        />

        {/* 3D transmission network — full-viewport ambient background */}
        {mode && (
          <TransmissionNetwork
            activeModule={activeModule}
            mode={mode}
            skipRequested={skipRequested}
            departing={departing}
            appearance={appearance}
            onInitialized={handleInitialized}
          />
        )}

        <CelestialHorizon />
        <CelestialDragControl />

        <header className="tams-landing-header relative z-10 shrink-0 h-14 flex items-center gap-3 px-6 border-b border-[#8fb3c9]/10 bg-[#081522]/40">
          <div className="min-w-0">
            <p className="tams-landing-brand text-[10px] font-bold tracking-[0.28em] text-[#7d94a8] uppercase">PlanetEye · TAMS</p>
            <h1 className="tams-landing-title text-sm font-black tracking-widest text-[#F4F7FA]">Transmission Asset Intelligence</h1>
          </div>
          <LandingThemeToggle />
        </header>

        {/* Centered composition: the network sits behind, cards in the middle (lifted slightly) */}
        {/* Content sits above the corridor silhouette: the heading lands in clear
            sky and the cards cover the mid-span wires, leaving a quiet centre */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-6 pb-24 sm:pb-32">
          <div className="relative w-full max-w-4xl flex flex-col items-center">
            {/* Subtle glow connecting the card group with the network behind */}
            <div
              className="tams-landing-card-glow pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[110%] -translate-x-1/2 -translate-y-1/2"
              style={{
                background:
                  'radial-gradient(ellipse 60% 55% at 50% 55%, rgba(46,170,210,0.06), transparent 75%)',
              }}
            />
            <div className="relative mb-10 flex w-full flex-col items-center px-6 py-12 sm:py-14">
              <div className="tams-heading-quiet pointer-events-none absolute inset-[-8px]" aria-hidden />
              <p
                className={`tams-landing-kicker relative text-[11px] font-bold uppercase tracking-[0.4em] text-[#7d94a8] mb-3 text-center drop-shadow-[0_1px_8px_rgba(5,13,23,0.9)] ${revealClass()}`}
                style={revealDelay(80)}
              >
                Select a module
              </p>
              <h2
                className={`tams-landing-heading relative text-2xl sm:text-3xl font-black text-[#F4F7FA] text-center tracking-tight drop-shadow-[0_2px_14px_rgba(5,13,23,0.95)] ${revealClass()}`}
                style={revealDelay(160)}
              >
                Where do you want to work?
              </h2>
            </div>

            <div
              className={`grid w-full grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 justify-items-center ${settled ? 'tams-module-cards-offset' : ''
                }`}
            >
              {MODULES.map((mod, idx) => {
                const Icon = mod.icon
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onMouseEnter={() => !departing && setActiveModule(mod.id)}
                    onMouseLeave={() => !departing && setActiveModule(null)}
                    onFocus={() => !departing && setActiveModule(mod.id)}
                    onBlur={() => !departing && setActiveModule(null)}
                    onClick={() => handleSelect(mod.id, mod.href)}
                    className={`tams-mod-card tams-mod-${mod.id} group flex w-full flex-col items-center text-center rounded-2xl border bg-[#051423]/[0.78] bg-gradient-to-b ${mod.accent} px-5 py-8 shadow-[0_18px_40px_-18px_rgba(3,10,20,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md hover:-translate-y-1 hover:scale-[1.015] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${cardClass()}`}
                    style={cardDelay(idx)}
                  >
                    <span className="tams-mod-icon mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#081522]/70">
                      <Icon className={`tams-mod-icon-svg h-7 w-7 ${mod.iconClass}`} />
                    </span>
                    <span className="tams-mod-title text-lg font-black text-[#F4F7FA] tracking-tight">{mod.title}</span>
                    <span className="tams-mod-sub mt-1.5 text-xs font-semibold text-slate-300/80">{mod.subtitle}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </main>

        {/* Skip intro — visible while the network is still building */}
        {!revealed && mode === 'full' && (
          <button
            type="button"
            onClick={handleSkip}
            className="tams-skip fixed bottom-6 right-6 z-20 rounded-lg border border-white/10 bg-[#0e172a]/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 backdrop-blur-sm transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
          >
            Skip intro →
          </button>
        )}

        {performanceOpen && (
          <div
            className="tams-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="performance-soon-title"
          >
            <div className="tams-modal w-full max-w-md rounded-2xl border border-amber-400/40 bg-[#0e172a] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">Tower Performance</p>
                  <h3 id="performance-soon-title" className="mt-1 text-xl font-black text-white">
                    Coming soon
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPerformanceOpen(false)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Performance analytics for towers is under development. Check back later for KPIs, trends, and health
                insights.
              </p>
              <button
                type="button"
                onClick={() => setPerformanceOpen(false)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 h-11 rounded-xl border border-amber-400/50 bg-amber-500/15 text-sm font-bold text-amber-100 hover:bg-amber-500/25 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to modules
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
