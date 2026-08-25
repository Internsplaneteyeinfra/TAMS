import React from 'react'
import { Box, Globe, Map as MapIcon, Mountain, Satellite } from 'lucide-react'

export type MapBasemap = '3d' | '2d' | 'street' | 'satellite' | 'terrain'

const MODES: { id: MapBasemap; label: string; icon: React.ElementType }[] = [
  { id: '3d', label: '3D', icon: Box },
  { id: '2d', label: '2D', icon: MapIcon },
  { id: 'street', label: 'Street', icon: Globe },
  { id: 'satellite', label: 'Satellite', icon: Satellite },
  { id: 'terrain', label: 'Terrain', icon: Mountain },
]

interface MapViewModeBarProps {
  mode: MapBasemap
  onChange: (mode: MapBasemap) => void
  variant?: 'floating' | 'inline' | 'rail'
}

export default function MapViewModeBar({ mode, onChange, variant = 'floating' }: MapViewModeBarProps) {
  const isRail = variant === 'rail'
  const isInline = variant === 'inline'

  return (
    <div
      className={
        isRail
          ? 'flex w-11 shrink-0 flex-col gap-0.5 rounded-lg bg-slate-900/60 p-0.5'
          : isInline
            ? 'relative z-0 flex shrink-0 gap-0.5 rounded-lg border border-slate-700/80 bg-[#0a1020]/95 p-0.5 shadow-lg'
            : 'absolute top-3 right-14 z-[2001] flex shrink-0 gap-0.5 rounded-lg border border-slate-700/80 bg-[#0a1020]/95 p-0.5 shadow-xl backdrop-blur-xl'
      }
      role="group"
      aria-label="Map view mode"
    >
      {MODES.map((m) => {
        const Icon = m.icon
        return (
          <button
            key={m.id}
            type="button"
            title={m.label}
            onClick={() => onChange(m.id)}
            className={`${
              isRail
                ? 'flex h-8 w-full items-center justify-center rounded-md'
                : isInline
                  ? 'px-1.5 py-1.5'
                  : 'px-2 py-1.5'
            } tams-tool-btn flex items-center justify-center gap-1 text-[9px] font-extrabold uppercase tracking-wider ${
              mode === m.id
                ? 'tams-tool-btn-active tams-mode-flash bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!isRail && !isInline && <span className="hidden sm:inline">{m.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
