interface CelestialBodySvgProps {
  sunOpacity: number
  moonOpacity: number
}

/** Realistic sun / moon — soft corona, no cartoon rays. */
export default function CelestialBodySvg({ sunOpacity, moonOpacity }: CelestialBodySvgProps) {
  return (
    <>
      <div
        className="tams-celestial-sun absolute inset-0"
        style={{ opacity: sunOpacity, transition: 'opacity 0.25s ease' }}
      >
        <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
          <defs>
            <radialGradient id="tamsSunCorona" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFDF8" stopOpacity="0" />
              <stop offset="55%" stopColor="#FFE8A8" stopOpacity="0.22" />
              <stop offset="78%" stopColor="#FFB84A" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#FF9800" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="tamsSunHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#FFF4C8" stopOpacity="0.85" />
              <stop offset="62%" stopColor="#FFD070" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F5A020" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="tamsSunCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#FFF8E8" />
              <stop offset="100%" stopColor="#FFE082" stopOpacity="0.9" />
            </radialGradient>
            <filter id="tamsSunBloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="40" cy="40" r="38" fill="url(#tamsSunCorona)" />
          <circle cx="40" cy="40" r="22" fill="url(#tamsSunHalo)" filter="url(#tamsSunBloom)" />
          <circle cx="40" cy="40" r="11" fill="url(#tamsSunCore)" />
        </svg>
      </div>

      <div
        className="tams-celestial-moon absolute inset-0"
        style={{ opacity: moonOpacity, transition: 'opacity 0.25s ease' }}
      >
        <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
          <defs>
            <radialGradient id="tamsMoonCore" cx="42%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#F4F7FA" />
              <stop offset="70%" stopColor="#C8D4DE" />
              <stop offset="100%" stopColor="#9AABB8" />
            </radialGradient>
            <radialGradient id="tamsMoonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#B8C8D4" stopOpacity="0" />
              <stop offset="100%" stopColor="#8AA4B8" stopOpacity="0.28" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="28" fill="url(#tamsMoonGlow)" />
          <circle cx="32" cy="32" r="13" fill="url(#tamsMoonCore)" />
          <circle cx="26" cy="28" r="2.2" fill="#A8B6C2" opacity="0.45" />
          <circle cx="36" cy="34" r="1.6" fill="#A8B6C2" opacity="0.35" />
          <circle cx="30" cy="36" r="1.2" fill="#A8B6C2" opacity="0.3" />
        </svg>
      </div>
    </>
  )
}
