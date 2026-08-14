import { useEffect, useRef, useState } from 'react'
import NetworkScene from './NetworkScene'
import type { LandingModuleId, NetworkEvent, NetworkMode, ViewportTier } from './types'

export type { LandingModuleId, NetworkMode }

interface TransmissionNetworkProps {
  activeModule: LandingModuleId | null
  mode: NetworkMode
  skipRequested: boolean
  /** true while a module click transition runs — camera pushes into the network */
  departing?: boolean
  onInitialized?: () => void
}

function getViewportTier(width: number): ViewportTier {
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

const PHASE_MESSAGES: Partial<Record<NetworkEvent, string>> = {
  mapping: 'MAPPING TRANSMISSION ASSETS...',
  connecting: 'ESTABLISHING GRID CONNECTION...',
  energizing: 'ENERGIZING NETWORK...',
  scanDone: '✓ NETWORK INITIALIZED',
}

/**
 * Contextual hover labels. `atSubstation` labels are pinned to the substation's
 * projected position instead of a fixed percentage, so they always read as
 * belonging to it.
 */
const HOVER_HINTS: Record<
  LandingModuleId,
  { label: string; className?: string; atSubstation?: boolean }
> = {
  suitability: { label: 'SITE ANALYSIS', className: 'left-[15%] top-[38%]' },
  analyzer: { label: 'NETWORK ANALYSIS', className: 'left-1/2 top-[26%] -translate-x-1/2' },
  performance: { label: 'POWER FLOW', atSubstation: true },
}

/** Single status line while the model loads — replaced by phase messages afterward. */
function LoadingStatus({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <p className="tams-status-in text-[10px] font-bold tracking-[0.3em] text-cyan-400/70">
      INITIALIZING NETWORK...
    </p>
  )
}

export default function TransmissionNetwork({
  activeModule,
  mode,
  skipRequested,
  departing = false,
  onInitialized,
}: TransmissionNetworkProps) {
  const [viewport, setViewport] = useState<ViewportTier>('desktop')
  const [enableParallax, setEnableParallax] = useState(false)
  const [substationActive, setSubstationActive] = useState(false)
  const [uiActive, setUiActive] = useState(false)
  const [started, setStarted] = useState(false)
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [substationAnchor, setSubstationAnchor] = useState<{ x: number; y: number } | null>(null)
  // `active` stays false until the pointer actually moves, so nothing in the
  // scene reacts to the default centre position on load
  const mouseRef = useRef({ x: 0, y: 0, active: false })
  const skipRef = useRef(false)
  const substationRef = useRef<{ x: number; y: number } | null>(null)

  skipRef.current = skipRequested

  useEffect(() => {
    const update = () => {
      const tier = getViewportTier(window.innerWidth)
      setViewport(tier)
      setEnableParallax(tier === 'desktop' && !window.matchMedia('(pointer: coarse)').matches)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (!enableParallax) {
      mouseRef.current.x = 0
      mouseRef.current.y = 0
      mouseRef.current.active = false
      return
    }
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
      mouseRef.current.active = true
    }
    const onLeave = () => {
      mouseRef.current.active = false
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('blur', onLeave)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [enableParallax])

  /**
   * The scene writes the substation's screen position into a ref every frame;
   * mirror it into state only when it meaningfully changes, so the anchored
   * status labels never trigger per-frame React renders.
   */
  useEffect(() => {
    let raf = 0
    let lastAnchor: { x: number; y: number } | null = null
    const tick = () => {
      const anchor = substationRef.current
      const moved =
        !!anchor !== !!lastAnchor ||
        (anchor &&
          lastAnchor &&
          (Math.abs(anchor.x - lastAnchor.x) > 0.004 || Math.abs(anchor.y - lastAnchor.y) > 0.004))
      if (moved) {
        lastAnchor = anchor ? { x: anchor.x, y: anchor.y } : null
        setSubstationAnchor(lastAnchor)
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const handleEvent = (event: NetworkEvent) => {
    setStarted(true)
    if (event === 'pulse') setSubstationActive(true)
    if (event === 'initialized') {
      setUiActive(true)
      onInitialized?.()
    }
    if (event === 'verified') {
      setVerifying(true)
      window.setTimeout(() => setVerifying(false), 1600)
    }
    // Phase status line (full intro only — fast/instant modes skip the narration)
    if (mode === 'full') {
      const msg = PHASE_MESSAGES[event]
      if (msg) {
        setPhaseMessage(msg)
        if (event === 'scanDone') {
          window.setTimeout(() => setPhaseMessage(null), 1800)
        }
      }
    }
  }

  const hint = uiActive && viewport === 'desktop' && activeModule ? HOVER_HINTS[activeModule] : null

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0">
        <NetworkScene
          viewport={viewport}
          mode={mode}
          activeModule={activeModule}
          departing={departing}
          skipRef={skipRef}
          mouseRef={mouseRef}
          substationRef={substationRef}
          enableParallax={enableParallax}
          onEvent={handleEvent}
        />
      </div>

      {/* Status narration — one line at a time, top-center */}
      <div className="absolute left-1/2 top-[10%] -translate-x-1/2 text-center">
        <LoadingStatus show={mode === 'full' && !started && phaseMessage === null} />
        {phaseMessage && (
          <p
            key={phaseMessage}
            className={`tams-status-in text-[10px] font-bold tracking-[0.3em] ${phaseMessage.startsWith('✓') ? 'text-cyan-300/95' : 'text-cyan-400/70'
              }`}
          >
            {phaseMessage}
          </p>
        )}

      </div>

      {/* Persistent grid status once the network is live (UI state only — no
          operational metrics are fabricated). Sits above the heading on
          desktop; on smaller screens it moves below the cards. */}
      {uiActive && !phaseMessage && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 ${viewport === 'desktop' ? 'top-[10%]' : 'bottom-6'
            }`}
        >
          {/* The entrance animation owns `transform`, so it must live on an inner
              element or it would cancel the positioning translate above */}
          <div
            key={verifying ? 'verified' : 'online'}
            className="tams-status-in flex items-center gap-1.5 opacity-90"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400/90" />
            </span>
            <p className="whitespace-nowrap text-[9px] font-bold tracking-[0.28em] text-cyan-200/75 drop-shadow-[0_1px_6px_rgba(5,13,23,0.95)]">
              {verifying ? 'NETWORK VERIFIED' : 'GRID ONLINE'}
            </p>
          </div>
        </div>
      )}

      {/* Substation status — pinned to the substation's own screen position so
          the status unmistakably belongs to it (desktop only) */}
      {substationActive && viewport === 'desktop' && substationAnchor && (
        <div
          className="absolute -translate-x-full -translate-y-1/2 pr-3"
          style={{ left: `${substationAnchor.x * 100}%`, top: `${substationAnchor.y * 100}%` }}
        >
          <div className="tams-status-in flex items-center gap-1.5 opacity-85">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400/90" />
            </span>
            <p className="whitespace-nowrap text-[9px] font-bold tracking-[0.22em] text-cyan-200/80 drop-shadow-[0_1px_4px_rgba(5,13,23,0.9)]">
              SUBSTATION ACTIVE
            </p>
          </div>
        </div>
      )}

      {/* Contextual module-hover hint, anchored to the relevant network region */}
      {hint && (!hint.atSubstation || substationAnchor) && (
        <div
          className={
            hint.atSubstation
              ? 'absolute -translate-x-full -translate-y-1/2 pr-3'
              : `absolute ${hint.className}`
          }
          style={
            hint.atSubstation && substationAnchor
              ? {
                left: `${substationAnchor.x * 100}%`,
                top: `${substationAnchor.y * 100}%`,
                // Stacks just above the substation's own status line
                marginTop: -18,
              }
              : undefined
          }
        >
          <p className="tams-status-in whitespace-nowrap text-[9px] font-bold tracking-[0.24em] text-cyan-200/70 drop-shadow-[0_1px_4px_rgba(5,13,23,0.9)]">
            {hint.label}
          </p>
        </div>
      )}

      {/* Readability gradients — header top, card region center-bottom */}
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#081522]/50 to-transparent" />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background:
            'radial-gradient(ellipse 62% 85% at 50% 92%, rgba(5,13,23,0.85) 30%, rgba(5,13,23,0.4) 60%, transparent 100%)',
        }}
      />

      <style jsx global>{`
        @keyframes tamsStatusIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .tams-status-in {
          animation: tamsStatusIn 0.45s ease-out both;
        }
      `}</style>
    </div>
  )
}
