import React, { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'tams-map-earth-intro-v1'

type Phase = 'space' | 'spin' | 'lock' | 'dive' | 'done'

interface MapEarthIntroProps {
  onComplete: () => void
  /** Force play even if already seen this session. */
  force?: boolean
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * One-shot cinematic: starfield → spinning Earth → lock on India → dive into map.
 * Lightweight CSS only — no Cesium / WebGL dependency.
 */
export default function MapEarthIntro({ onComplete, force = false }: MapEarthIntroProps) {
  const [phase, setPhase] = useState<Phase>('space')
  const [visible, setVisible] = useState(true)
  const [active, setActive] = useState(false)

  const stars = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const seed = (i * 47) % 97
        return {
          id: i,
          left: `${(seed * 13) % 100}%`,
          top: `${(seed * 29) % 100}%`,
          size: 1 + (seed % 3),
          delay: `${(seed % 20) * 0.08}s`,
          opacity: 0.35 + (seed % 5) * 0.1,
        }
      }),
    []
  )

  useEffect(() => {
    if (!force && (alreadySeen() || prefersReducedMotion())) {
      onComplete()
      return
    }
    setActive(true)
  }, [force, onComplete])

  useEffect(() => {
    if (!active) return

    const timers: number[] = []
    try {
      timers.push(window.setTimeout(() => setPhase('spin'), 350))
      timers.push(window.setTimeout(() => setPhase('lock'), 1600))
      timers.push(window.setTimeout(() => setPhase('dive'), 2600))
      timers.push(
        window.setTimeout(() => {
          setPhase('done')
          setVisible(false)
          markSeen()
          window.setTimeout(() => onComplete(), 280)
        }, 3400)
      )
    } catch {
      markSeen()
      onComplete()
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [active, onComplete])

  const skip = () => {
    try {
      markSeen()
      setVisible(false)
      setPhase('done')
      onComplete()
    } catch {
      onComplete()
    }
  }

  if (!active || phase === 'done') return null

  return (
    <div
      className={`absolute inset-0 z-[2200] overflow-hidden select-none ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #0b1630 0%, #030712 55%, #000 100%)',
        transition: 'opacity 280ms ease-out',
      }}
      aria-label="Earth intro animation"
      role="dialog"
      aria-live="polite"
    >
      {/* Stars */}
      <div className="absolute inset-0" aria-hidden>
        {stars.map((s) => (
          <span
            key={s.id}
            className="tams-earth-star absolute rounded-full bg-white"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              animationDelay: s.delay,
            }}
          />
        ))}
      </div>

      {/* Soft nebula */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(56,189,248,0.12), transparent 40%), radial-gradient(circle at 70% 70%, rgba(99,102,241,0.1), transparent 45%)',
        }}
      />

      {/* Globe stage */}
      <div
        className={`absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out ${
          phase === 'dive' ? 'scale-[2.4] opacity-0' : phase === 'lock' ? 'scale-110' : 'scale-100'
        }`}
        style={{ perspective: '900px' }}
      >
        <div
          className={`tams-earth-globe relative h-[min(42vh,280px)] w-[min(42vh,280px)] rounded-full ${
            phase === 'spin' || phase === 'lock' || phase === 'dive' ? 'tams-earth-spinning' : ''
          } ${phase === 'lock' || phase === 'dive' ? 'tams-earth-lock' : ''}`}
        >
          {/* Atmosphere glow */}
          <div className="pointer-events-none absolute -inset-3 rounded-full bg-sky-400/10 blur-md" />

          {/* Continents silhouette (simplified India-centric band) */}
          <div className="tams-earth-surface absolute inset-0 overflow-hidden rounded-full">
            <div className="tams-earth-land absolute inset-0" />
            {/* India highlight pin */}
            <div
              className={`tams-india-pin absolute ${
                phase === 'lock' || phase === 'dive' ? 'tams-india-pin-hot' : ''
              }`}
              title="India"
            >
              <span className="tams-india-ring" />
              <span className="tams-india-dot" />
            </div>
          </div>

          {/* Specular / night terminator */}
          <div className="pointer-events-none absolute inset-0 rounded-full tams-earth-shade" />
        </div>
      </div>

      {/* Caption */}
      <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-1 px-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">
          {phase === 'space' && 'Entering orbit'}
          {phase === 'spin' && 'Scanning Earth'}
          {phase === 'lock' && 'Target locked · India'}
          {phase === 'dive' && 'Descending to grid'}
        </p>
        <p className="text-sm font-semibold text-slate-200">
          {phase === 'lock' || phase === 'dive'
            ? 'TAMS · Transmission Asset Intelligence'
            : 'PlanetEye · TAMS Grid Command'}
        </p>
      </div>

      <button
        type="button"
        onClick={skip}
        className="absolute right-4 top-4 z-10 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-sm transition hover:border-cyan-400/40 hover:text-white"
      >
        Skip
      </button>
    </div>
  )
}
