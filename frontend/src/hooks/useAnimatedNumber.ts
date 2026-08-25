import { useEffect, useRef, useState } from 'react'

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Short ease-out count-up for KPI / region totals.
 * Skips animation when reduced-motion is preferred or value jumps huge.
 */
export function useAnimatedNumber(target: number, durationMs = 280): number {
  const reduced = usePrefersReducedMotion()
  const safeTarget = Number.isFinite(target) ? target : 0
  const [display, setDisplay] = useState(safeTarget)
  const fromRef = useRef(safeTarget)
  const rafRef = useRef(0)

  useEffect(() => {
    if (reduced || Math.abs(safeTarget - fromRef.current) < 0.5) {
      fromRef.current = safeTarget
      setDisplay(safeTarget)
      return
    }

    // Huge jumps (e.g. India totals) — snap to avoid long CPU work
    if (Math.abs(safeTarget - fromRef.current) > 50_000) {
      fromRef.current = safeTarget
      setDisplay(safeTarget)
      return
    }

    const from = fromRef.current
    const start = performance.now()
    const delta = safeTarget - from
    const duration = Math.min(Math.max(durationMs, 120), 320)

    const tick = (now: number) => {
      try {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        const next = from + delta * eased
        setDisplay(next)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          fromRef.current = safeTarget
          setDisplay(safeTarget)
        }
      } catch {
        fromRef.current = safeTarget
        setDisplay(safeTarget)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [safeTarget, durationMs, reduced])

  return display
}
