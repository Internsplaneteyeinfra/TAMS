import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Layers,
  MapPinned,
  Mountain,
  Route,
  ShieldCheck,
  Sparkles,
  Wind,
} from 'lucide-react'

const ACTIONS = [
  {
    id: 'open',
    icon: MapPinned,
    label: 'Open tower suitability',
    hint: 'Full screening workspace — map, KML, score drawers',
    tone: 'text-cyan-400',
    href: '/tower-suitability',
  },
  {
    id: 'terrain',
    icon: Mountain,
    label: 'Terrain & slope',
    hint: 'DEM slope / elevation screening for the pad',
    tone: 'text-emerald-400',
    href: '/tower-suitability',
  },
  {
    id: 'clearance',
    icon: ShieldCheck,
    label: 'Clearance buffer',
    hint: 'Roads, water & settlement setbacks from OSM',
    tone: 'text-amber-400',
    href: '/tower-suitability',
  },
  {
    id: 'climate',
    icon: Wind,
    label: 'Climate exposure',
    hint: 'Wind + water proximity flood proxy',
    tone: 'text-sky-400',
    href: '/tower-suitability',
  },
  {
    id: 'overlay',
    icon: Layers,
    label: 'Corridor proximity',
    hint: 'Distance to TAMS / OSM towers & substations',
    tone: 'text-violet-400',
    href: '/tower-suitability',
  },
] as const

export default function SiteSuitabilityButton() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  const go = (href: string) => {
    setOpen(false)
    void router.push(href)
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onDoubleClick={() => go('/tower-suitability')}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Tower site suitability"
        className={`group inline-flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-lg border transition-all ${
          open
            ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
            : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-100'
        }`}
      >
        <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500/30 to-blue-600/40 border border-cyan-400/20">
          <MapPinned className="w-3 h-3 text-cyan-300" />
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
        </span>
        <span className="text-[10px] font-bold tracking-wide">Site Suitability</span>
        <Sparkles className="w-3 h-3 text-cyan-500/70 opacity-70 group-hover:opacity-100" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1.5 w-[300px] z-50 overflow-hidden rounded-xl border border-slate-700/90 bg-[#0e172a]/96 backdrop-blur-xl shadow-2xl shadow-black/40"
        >
          <div className="relative px-3.5 py-3 border-b border-slate-800/90 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_55%)]" />
            <div className="relative flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-400/25">
                <MapPinned className="w-4 h-4 text-cyan-300" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white tracking-wide">Tower Site Suitability</p>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  Satellite screening for transmission pads — DEM, OSM, wind, TAMS grid.
                </p>
              </div>
            </div>
          </div>

          <ul className="py-1.5">
            {ACTIONS.map(({ id, icon: Icon, label, hint, tone, href }) => (
              <li key={id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go(href)}
                  className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-800/70"
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/5 bg-slate-950/70 ${tone}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-100">{label}</span>
                      {id === 'open' ? (
                        <span className="text-[8px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/40 rounded px-1 py-0.5">
                          Open
                        </span>
                      ) : (
                        <Route className="w-3 h-3 text-slate-600" />
                      )}
                    </span>
                    <span className="block text-[9px] text-slate-500 leading-snug mt-0.5">{hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="px-3.5 py-2.5 border-t border-slate-800/90 bg-slate-950/40">
            <button
              type="button"
              onClick={() => go('/tower-suitability')}
              className="w-full h-8 rounded-lg bg-cyan-500 text-[10px] font-black text-slate-950 hover:bg-cyan-400"
            >
              Launch suitability workspace
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
