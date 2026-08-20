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
      window.localStorage.removeItem('towerSuitabilityIntroSeen')
    } catch {
      /* ignore */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setMode(introPlayedThisSession || reduced ? 'instant' : 'full')
  }, [])

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

  useEffect(() => {
    if (!revealed) return
    const id = window.setTimeout(() => setSettled(true), 1100)
    return () => window.clearTimeout(id)
  }, [revealed])

  const onEvent = (e: HubIntroEvent) => {
    if (e.kind === 'status') {
      setStatus(e.text)
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
    <div className="ts-suit-hub fixed inset-0 z-[210] flex flex-col overflow-hidden bg-[#F3F7FA] text-[#0B1726]">
      {/* Soft daylight atmospheric base */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 70% at 50% 18%, #E8F2F8 0%, #F3F7FA 48%, #E7EFF4 100%)',
        }}
      />

      {/* 3D site-analysis scene */}
      {mode && (
        <div className="absolute inset-0" aria-hidden>
          <HubIntro3D mode={mode} tier={tier} skipRef={skipRef} onEvent={onEvent} appearance="light" />
        </div>
      )}

      {/* Soft veil so cards stay readable once revealed */}
      <div
        className={`pointer-events-none absolute inset-0 bg-[#F3F7FA] transition-opacity duration-1000 ${revealed ? 'opacity-25' : 'opacity-0'
          }`}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 46%, rgba(8,145,178,0.05), transparent 70%)',
        }}
      />

      {/* Back */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute right-5 top-4 z-20 h-9 rounded-lg border border-[#C9D6DF] bg-white/85 px-3 text-xs font-bold text-[#526579] shadow-sm backdrop-blur-sm hover:bg-white hover:text-[#0B1726]"
        >
          Back
        </button>
      )}

      {/* Title + narration / heading */}
      <div className="pointer-events-none absolute inset-x-0 top-[9%] z-10 px-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#60788A]">
          Tower Site Suitability
        </p>
        {!revealed && status && (
          <p
            key={status}
            className="ts-hub-in mt-2 text-[10px] font-bold tracking-[0.28em] text-[#0891B2]"
          >
            {status}
          </p>
        )}
        <p
          className={`mt-2 text-xl font-black tracking-tight text-[#0B1726] drop-shadow-[0_1px_8px_rgba(255,255,255,0.85)] sm:text-2xl ${settled
              ? 'transition-all'
              : `transition-all duration-[600ms] ease-out ${revealed ? 'translate-y-0 opacity-100' : 'translate-y-[25px] opacity-0'
              }`
            }`}
        >
          How do you want to start?
        </p>
      </div>

      {/* Proposed-site label under the tower */}
      {markerShown && (
        <div
          className={`pointer-events-none absolute left-1/2 top-[63%] z-10 -translate-x-1/2 transition-opacity duration-700 ${revealed ? 'opacity-50' : 'opacity-100'
            }`}
          aria-hidden
        >
          <p className="ts-hub-in text-[8.5px] font-bold tracking-[0.26em] text-[#0891B2] drop-shadow-[0_1px_4px_rgba(255,255,255,0.9)]">
            PROPOSED SITE
          </p>
        </div>
      )}

      {/* Compact analysis HUD near the tower */}
      {hudShown && !revealed && (
        <div
          className="ts-hub-in pointer-events-none absolute left-[58%] top-[30%] z-10 hidden rounded-lg border border-[#8BC9D7] bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm sm:block"
          aria-hidden
        >
          <p className="text-[8.5px] font-black tracking-[0.24em] text-[#60788A]">SITE ANALYSIS</p>
          {!indicators ? (
            <p className="mt-1 text-[9px] font-bold tracking-[0.2em] text-[#0891B2]">SCANNING…</p>
          ) : (
            <div className="mt-1 space-y-0.5">
              {HUD_FACTORS.map((f, i) => (
                <p
                  key={f}
                  className="flex items-center gap-1.5 text-[8.5px] font-bold tracking-[0.18em] text-[#365467]"
                >
                  <span
                    className="ts-hub-in inline-block w-2.5 text-center text-[#0891B2]"
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

      {/* Start cards — same actions, light surfaces */}
      <main className="relative z-10 flex flex-1 items-end justify-center overflow-y-auto px-4 pb-8 sm:pb-10">
        <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          <button
            type="button"
            onClick={() => onChoose('draw')}
            style={cardDelay(0)}
            className={`group rounded-2xl border border-[#8BC9D7] bg-white/90 px-5 py-6 text-left shadow-[0_12px_32px_rgba(30,60,80,0.08)] backdrop-blur-md hover:-translate-y-0.5 hover:border-[#0891B2] hover:shadow-[0_16px_36px_rgba(30,60,80,0.12)] md:py-8 ${cardClass()}`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#8BC9D7] bg-[#E2F5F8]">
              <Map className="h-6 w-6 text-[#0891B2]" />
            </span>
            <h2 className="mt-5 text-xl font-black text-[#0B1726]">Draw KML on map</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#526579]">
              Set a start with lat/lon or click the map, then draw a line or polygon. Save as KML or run
              analysis.
            </p>
            <p className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0891B2]">
              <Crosshair className="h-3.5 w-3.5" />
              Lat/lon · click pin · draw
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('live')}
            style={cardDelay(1)}
            className={`group rounded-2xl border border-[#91D4C1] bg-white/90 px-5 py-6 text-left shadow-[0_12px_32px_rgba(30,60,80,0.08)] backdrop-blur-md hover:-translate-y-0.5 hover:border-[#059669] hover:shadow-[0_16px_36px_rgba(30,60,80,0.12)] md:py-8 ${cardClass()}`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#91D4C1] bg-[#E3F7F0]">
              <Navigation className="h-6 w-6 text-[#059669]" />
            </span>
            <h2 className="mt-5 text-xl font-black text-[#0B1726]">Live location</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#526579]">
              Jump to your GPS position, draw line or polygon nearby, then download KML or continue to
              analysis.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#059669]">
              Browser GPS · then draw
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('upload')}
            style={cardDelay(2)}
            className={`group rounded-2xl border border-[#E7C77B] bg-[#FFFAF1]/95 px-5 py-6 text-left shadow-[0_12px_32px_rgba(30,60,80,0.08)] backdrop-blur-md hover:-translate-y-0.5 hover:border-[#D97706] hover:shadow-[0_16px_36px_rgba(30,60,80,0.12)] md:py-8 ${cardClass()}`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#E7C77B] bg-[#FFF3D9]">
              <Upload className="h-6 w-6 text-[#D97706]" />
            </span>
            <h2 className="mt-5 text-xl font-black text-[#0B1726]">Upload and get analysis</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#526579]">
              Upload an existing KML and get the full suitability score, towers, voltage, and report.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
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
          className="absolute bottom-5 right-5 z-20 text-[10px] font-bold tracking-[0.24em] text-[#718396] transition-colors hover:text-[#0891B2]"
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
