import { Moon, Sun } from 'lucide-react'
import { useLandingTheme } from '@/theme/LandingThemeContext'

/** Compact light/dark control for the landing header. */
export default function LandingThemeToggle() {
  const { displayAppearance, isTransitioning, requestAppearance } = useLandingTheme()
  const isLight = displayAppearance === 'light'

  return (
    <div
      className="tams-theme-toggle pointer-events-auto ml-auto flex shrink-0 items-center rounded-lg border border-white/10 bg-[#0e172a]/70 p-0.5 shadow-[0_4px_12px_rgba(3,10,20,0.35)]"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        disabled={isTransitioning}
        onClick={() => requestAppearance('light')}
        className={`tams-theme-sun tams-theme-btn inline-flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:opacity-60 ${isLight
            ? 'bg-white text-[#0891B2] shadow-sm ring-1 ring-cyan-500/25'
            : 'text-slate-400 hover:scale-105 hover:text-slate-200'
          }`}
        aria-label="Switch to light theme"
        aria-pressed={isLight}
      >
        <Sun className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        disabled={isTransitioning}
        onClick={() => requestAppearance('dark')}
        className={`tams-theme-btn inline-flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:opacity-60 ${!isLight
            ? 'bg-white/10 text-cyan-200 shadow-sm ring-1 ring-cyan-400/20'
            : 'text-[#718396] hover:scale-105 hover:text-[#0B1726]'
          }`}
        aria-label="Switch to dark theme"
        aria-pressed={!isLight}
      >
        <Moon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  )
}
