import React from 'react'
import {
  Activity,
  Camera,
  Crosshair,
  Layers,
  Ruler,
  Zap,
} from 'lucide-react'

export interface MapToolbarLayers {
  heatmap: boolean
  riskOverlay: boolean
  satellite: boolean
  terrain: boolean
  corridors: boolean
  weather?: boolean
  flood?: boolean
  wildfire?: boolean
  labels?: boolean
}

interface FloatingMapToolbarProps {
  layers: MapToolbarLayers
  onToggle: (key: keyof MapToolbarLayers) => void
  onLocate?: () => void
  onFullscreen?: () => void
  embedded?: boolean
}

function QuickBtn({
  active,
  title,
  label,
  onClick,
  children,
}: {
  active?: boolean
  title: string
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
            className={`tams-tool-btn flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl border ${
        active
          ? 'tams-tool-btn-active border-blue-500/50 bg-blue-600/30 text-blue-200'
          : 'border-slate-700/60 bg-slate-950/50 text-slate-400 hover:border-slate-500 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {children}
      <span className="text-[7px] font-bold uppercase leading-none tracking-wide">{label}</span>
    </button>
  )
}

export default function FloatingMapToolbar({
  layers,
  onToggle,
  onLocate,
  embedded = false,
}: FloatingMapToolbarProps) {
  return (
    <div
      className={`flex select-none flex-col items-center gap-1.5 ${
        embedded ? 'relative z-0 w-full' : 'absolute top-4 right-4 z-[2000] items-end'
      }`}
    >
      <div
        className={`flex flex-col gap-1 ${
          embedded
            ? 'items-center'
            : 'rounded-2xl border border-white/10 bg-[#0e172a]/90 p-1.5 shadow-2xl backdrop-blur-xl'
        }`}
      >
        <QuickBtn title="Locate me" label="Locate" onClick={() => onLocate?.()}>
          <Crosshair className="h-4 w-4" />
        </QuickBtn>
        <QuickBtn active={layers.corridors} title="Live corridors feed" label="Feeds" onClick={() => onToggle('corridors')}>
          <Zap className="h-4 w-4" />
        </QuickBtn>
        <QuickBtn active={layers.riskOverlay} title="AI detection" label="AI" onClick={() => onToggle('riskOverlay')}>
          <Camera className="h-4 w-4" />
        </QuickBtn>
        <QuickBtn title="Measure distance" label="Measure" onClick={() => {}}>
          <Ruler className="h-4 w-4" />
        </QuickBtn>
        <QuickBtn active={layers.heatmap} title="Layer stack" label="Layers" onClick={() => onToggle('heatmap')}>
          <Layers className="h-4 w-4" />
        </QuickBtn>
        <QuickBtn active={!!layers.weather} title="Weather overlay" label="Weather" onClick={() => onToggle('weather')}>
          <Activity className="h-4 w-4" />
        </QuickBtn>
      </div>
    </div>
  )
}
