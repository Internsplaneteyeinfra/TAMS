/**
 * Suitability entry hub — cinematic 3D site-analysis intro (terrain → tower
 * placement → scan → analysis ready), then the Draw / Live / Upload cards
 * reveal over the settled 3D scene.
 *
 * First visit plays the full ~7.5s sequence; returning visits (localStorage
 * `towerSuitabilityIntroSeen`) and reduced-motion users get the final scene
 * with a short fade only. Card functionality is unchanged.
 */

import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Crosshair, Map, Navigation, Upload } from 'lucide-react'
import type { HubIntroEvent, HubIntroMode, HubTier } from './HubIntro3D'

const HubIntro3D = dynamic(() => import('./HubIntro3D'), { ssr: false })

export type SuitabilityEntryMode = 'draw' | 'live' | 'upload'

/**
 * Play the full intro on every fresh page entry; skip it only when the hub
 * remounts within the same page session (e.g. "Start over"). In-memory on
 * purpose — a persistent localStorage flag made the intro appear to load
 * only "sometimes".
 */
let introPlayedThisSession = false

/** Force-reveal the cards if the 3D scene never reports completion. */
const REVEAL_FALLBACK_FULL_MS = 12000
const REVEAL_FALLBACK_INSTANT_MS = 4000

/** Factor categories the module actually analyzes — labels only, no fabricated results. */
const HUD_FACTORS = ['TERRAIN', 'ROAD ACCESS', 'ENVIRONMENT', 'CLEARANCE']

export default function SuitabilityHub({
  onChoose,
  onBack,
}: {
  onChoose: (mode: SuitabilityEntryMode) => void
  onBack?: () => void
}) {
  const [mode, setMode] = useState<HubIntroMode | null>(null)
  const [tier, setTier] = useState<HubTier>('desktop')
  // Default narration shows immediately while the 3D chunk/model loads
  const [status, setStatus] = useState<string | null>('INITIALIZING SITE ANALYSIS…')
  const [markerShown, setMarkerShown] = useState(false)
  const [hudShown, setHudShown] = useState(false)
  const [indicators, setIndicators] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [settled, setSettled] = useState(false)
  const skipRef = useRef(false)

  useEffect(() => {
    const w = window.innerWidth
    setTier(w < 768 ? 'mobile' : w < 1200 ? 'tablet' : 'desktop')
    try {
      // Stale flag from the previous localStorage-based behavior
      window.localStorage.removeItem('towerSuitabilityIntroSeen')
    } catch {
      /* ignore */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setMode(introPlayedThisSession || reduced ? 'instant' : 'full')
  }, [])

  // Safety net: never leave the page stuck on a dark screen if the 3D chunk,
  // model, or WebGL context fails to come up. Re-armed on every scene event,
  // so it only fires on a genuine stall.
  const fallbackRef = useRef<number | null>(null)
  const armFallback = (ms: number) => {
    if (fallbackRef.current != null) window.clearTimeout(fallbackRef.current)
    fallbackRef.current = window.setTimeout(() => {
      introPlayedThisSession = true
      setRevealed(true)
    }, ms)
  }
  useEffect(() => {
    if (!mode) return
    armFallback(mode === 'full' ? REVEAL_FALLBACK_FULL_MS : REVEAL_FALLBACK_INSTANT_MS)
    return () => {
      if (fallbackRef.current != null) window.clearTimeout(fallbackRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // After the reveal transition finishes, drop the long durations so card
  // hover states stay snappy.
  useEffect(() => {
    if (!revealed) return
    const id = window.setTimeout(() => setSettled(true), 1100)
    return () => window.clearTimeout(id)
  }, [revealed])

  const onEvent = (e: HubIntroEvent) => {
    if (e.kind === 'status') {
      setStatus(e.text)
      // Scene is alive — the remaining timeline is ≤ 8s, so keep a margin
      if (e.text) armFallback(10000)
    } else if (e.kind === 'marker') setMarkerShown(true)
    else if (e.kind === 'scanStart') setHudShown(true)
    else if (e.kind === 'indicators') setIndicators(true)
    else if (e.kind === 'done') {
      if (fallbackRef.current != null) window.clearTimeout(fallbackRef.current)
      introPlayedThisSession = true
      setRevealed(true)
    }
  }

  const cardClass = () =>
    settled
      ? 'transition-all opacity-100 translate-y-0 scale-100'
      : `transition-all duration-[600ms] ease-out ${revealed
        ? 'opacity-100 translate-y-0 scale-100'
        : 'pointer-events-none opacity-0 translate-y-[25px] scale-[0.98]'
      }`
  const cardDelay = (idx: number): React.CSSProperties =>
    settled || !revealed ? {} : { transitionDelay: `${idx * 100}ms` }

  return (
    <div className="fixed inset-0 z-[210] flex flex-col text-slate-100 overflow-hidden bg-[#060B17]">
      {/* Deep-navy atmospheric base */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% 20%, #0c1a2c 0%, #07111d 55%, #050d17 100%)',
        }}
      />

      {/* 3D site-analysis scene */}
      {mode && (
        <div className="absolute inset-0" aria-hidden>
          <HubIntro3D mode={mode} tier={tier} skipRef={skipRef} onEvent={onEvent} />
        </div>
      )}

      {/* Scene recedes into the background once the UI reveals (tower stays the hero) */}
      <div
        className={`absolute inset-0 pointer-events-none bg-[#060B17] transition-opacity duration-1000 ${revealed ? 'opacity-30' : 'opacity-0'
          }`}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 46%, rgba(34,211,238,0.07), transparent 70%)',
        }}
      />

      {/* Back */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute right-5 top-4 z-20 h-9 px-3 rounded-lg border border-white/15 bg-black/35 text-xs font-bold text-slate-200 hover:bg-black/55"
        >
          Back
        </button>
      )}

      {/* Title + narration / heading */}
      <div className="pointer-events-none absolute inset-x-0 top-[9%] z-10 text-center px-4">
        <p className="text-[10px] font-black tracking-[0.3em] text-[#7d94a8] uppercase">
          Tower Site Suitability
        </p>
        {!revealed && status && (
          <p
            key={status}
            className="ts-hub-in mt-2 text-[10px] font-bold tracking-[0.28em] text-cyan-300/85"
          >
            {status}
          </p>
        )}
        <p
          className={`mt-2 text-xl sm:text-2xl font-black text-[#F4F7FA] tracking-tight drop-shadow-[0_2px_12px_rgba(5,13,23,0.9)] ${settled
            ? 'transition-all'
            : `transition-all duration-[600ms] ease-out ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[25px]'
            }`
            }`}
        >
          How do you want to start?
        </p>
      </div>

      {/* Proposed-site label under the tower — stays as part of the digital twin */}
      {markerShown && (
        <div
          className={`pointer-events-none absolute left-1/2 top-[63%] z-10 -translate-x-1/2 transition-opacity duration-700 ${revealed ? 'opacity-55' : 'opacity-100'
            }`}
          aria-hidden
        >
          <p className="ts-hub-in text-[8.5px] font-bold tracking-[0.26em] text-cyan-200/80 drop-shadow-[0_1px_4px_rgba(5,13,23,0.9)]">
            PROPOSED SITE
          </p>
        </div>
      )}

      {/* Compact analysis HUD near the tower — categories only, no invented values */}
      {hudShown && !revealed && (
        <div
          className="ts-hub-in pointer-events-none absolute left-[58%] top-[30%] z-10 hidden sm:block rounded-lg border border-cyan-500/20 bg-[#081522]/70 px-3 py-2 backdrop-blur-sm"
          aria-hidden
        >
          <p className="text-[8.5px] font-black tracking-[0.24em] text-[#7d94a8]">SITE ANALYSIS</p>
          {!indicators ? (
            <p className="mt-1 text-[9px] font-bold tracking-[0.2em] text-cyan-300/85">SCANNING…</p>
          ) : (
            <div className="mt-1 space-y-0.5">
              {HUD_FACTORS.map((f, i) => (
                <p
                  key={f}
                  className="flex items-center gap-1.5 text-[8.5px] font-bold tracking-[0.18em] text-cyan-100/80"
                >
                  <span
                    className="ts-hub-in inline-block w-2.5 text-center text-cyan-300"
                    style={{ animationDelay: `${i * 140}ms` }}
                  >
                    ✓
                  </span>
                  {f}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing start cards — functionality unchanged */}
      <main className="relative z-10 flex-1 flex items-end justify-center px-4 pb-8 sm:pb-10 overflow-y-auto">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() => onChoose('draw')}
            style={cardDelay(0)}
            className={`group rounded-2xl border border-cyan-400/35 bg-slate-950/75 backdrop-blur-md px-5 py-6 md:py-8 text-left shadow-2xl hover:border-cyan-300 hover:-translate-y-0.5 ${cardClass()}`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10">
              <Map className="h-6 w-6 text-cyan-300" />
            </span>
            <h2 className="mt-5 text-xl font-black text-white">Draw KML on map</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Set a start with lat/lon or click the map, then draw a line or polygon. Save as KML or run
              analysis.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-cyan-300/90 flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5" />
              Lat/lon · click pin · draw
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('live')}
            style={cardDelay(1)}
            className={`group rounded-2xl border border-emerald-400/35 bg-slate-950/75 backdrop-blur-md px-5 py-6 md:py-8 text-left shadow-2xl hover:border-emerald-300 hover:-translate-y-0.5 ${cardClass()}`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10">
              <Navigation className="h-6 w-6 text-emerald-300" />
            </span>
            <h2 className="mt-5 text-xl font-black text-white">Live location</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Jump to your GPS position, draw line or polygon nearby, then download KML or continue to
              analysis.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
              Browser GPS · then draw
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('upload')}
            style={cardDelay(2)}
            className={`group rounded-2xl border border-amber-400/35 bg-slate-950/75 backdrop-blur-md px-5 py-6 md:py-8 text-left shadow-2xl hover:border-amber-300 hover:-translate-y-0.5 ${cardClass()}`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10">
              <Upload className="h-6 w-6 text-amber-300" />
            </span>
            <h2 className="mt-5 text-xl font-black text-white">Upload and get analysis</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Upload an existing KML and get the full suitability score, towers, voltage, and report.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
              KML · instant screening
            </p>
          </button>
        </div>
      </main>

      {/* Skip intro */}
      {mode === 'full' && !revealed && (
        <button
          type="button"
          onClick={() => {
            skipRef.current = true
          }}
          className="absolute bottom-5 right-5 z-20 text-[10px] font-bold tracking-[0.24em] text-slate-500 hover:text-cyan-300 transition-colors"
        >
          SKIP INTRO →
        </button>
      )}

      <style jsx global>{`
        @keyframes ts-hub-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .ts-hub-in {
          animation: ts-hub-in 0.45s ease-out both;
        }
      `}</style>
    </div>
  )
}
