import { useEffect, useState } from 'react'
import { useLandingTheme } from '@/theme/LandingThemeContext'
import { getTransitionArcLayout } from '@/theme/celestialArc'

/** Faint bottom arc path during theme transition. */
export default function CelestialHorizon() {
  const { isTransitioning, celestial } = useLandingTheme()
  const [mounted, setMounted] = useState(false)
  const [viewport, setViewport] = useState({ w: 1200, h: 800 })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    onResize()
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!mounted || !isTransitioning || !celestial || celestial.bodyOpacity <= 0.02) return null

  const layout = getTransitionArcLayout(viewport.w, viewport.h)

  return (
    <div className="tams-celestial-horizon pointer-events-none fixed inset-0 z-[8] overflow-hidden" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <path
          d={`M ${layout.x0} ${layout.y0} Q ${layout.cx} ${layout.cy} ${layout.x1} ${layout.y1}`}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={layout.isMobile ? 1 : 1.4}
          strokeDasharray={layout.isMobile ? '4 9' : '5 11'}
          opacity={0.45 * celestial.bodyOpacity}
        />
      </svg>
    </div>
  )
}
