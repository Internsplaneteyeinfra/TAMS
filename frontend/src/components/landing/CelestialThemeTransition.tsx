import { useLandingTheme } from '@/theme/LandingThemeContext'
import CelestialBodySvg from './CelestialBodySvg'

/** Sun / moon travel overlay synchronized with the theme blend. */
export default function CelestialThemeTransition() {
  const { celestial, isTransitioning } = useLandingTheme()
  if (!isTransitioning || !celestial || celestial.bodyOpacity <= 0.01) return null

  const { x, y, scale, bodyOpacity, sunOpacity, moonOpacity } = celestial
  const size = 56 * scale

  return (
    <div
      className="tams-celestial-layer pointer-events-none fixed inset-0 z-[15] overflow-hidden"
      aria-hidden
    >
      <div
        className="tams-celestial-body absolute will-change-transform"
        style={{
          left: 0,
          top: 0,
          width: size,
          height: size,
          opacity: bodyOpacity,
          transform: `translate(${x - size / 2}px, ${y - size / 2}px)`,
        }}
      >
        <CelestialBodySvg sunOpacity={sunOpacity} moonOpacity={moonOpacity} />
      </div>
    </div>
  )
}
