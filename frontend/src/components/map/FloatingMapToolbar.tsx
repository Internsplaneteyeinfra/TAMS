import React from 'react'
import {
  Activity,
  Camera,
  Crosshair,
  Layers,
  Map as MapIcon,
  Mountain,
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
      className={`w-11 h-11 flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-all duration-200 ${active
        ? 'bg-blue-600/30 border-blue-500/50 text-blue-200 shadow-lg shadow-blue-500/20'
        : 'bg-slate-950/50 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-500'
        }`}
    >
      {children}
      <span className="text-[7px] font-bold uppercase tracking-wide leading-none">{label}</span>
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
    <div className={`flex flex-col items-end gap-1.5 select-none ${embedded ? '' : 'absolute top-4 right-4 z-[2000]'}`}>
      <div className={`flex flex-col gap-1 ${embedded ? '' : 'p-1.5 rounded-2xl bg-[#0e172a]/90 backdrop-blur-xl border border-white/10 shadow-2xl'}`}>
        <QuickBtn title="Locate me" label="Locate" onClick={() => onLocate?.()}>
          <Crosshair className="w-4 h-4" />
        </QuickBtn>
        <QuickBtn active={layers.terrain} title="Terrain basemap" label="Terrain" onClick={() => onToggle('terrain')}>
          <Mountain className="w-4 h-4" />
        </QuickBtn>
        <QuickBtn active={layers.corridors} title="Live corridors feed" label="Feeds" onClick={() => onToggle('corridors')}>
          <Zap className="w-4 h-4" />
        </QuickBtn>
        <QuickBtn active={layers.riskOverlay} title="AI detection" label="AI" onClick={() => onToggle('riskOverlay')}>
          <Camera className="w-4 h-4" />
        </QuickBtn>
        <QuickBtn title="Measure distance" label="Measure" onClick={() => { }}>
          <Ruler className="w-4 h-4" />
        </QuickBtn>
        <QuickBtn active={layers.heatmap} title="Layer stack" label="Layers" onClick={() => onToggle('heatmap')}>
          <Layers className="w-4 h-4" />
        </QuickBtn>
        <QuickBtn active={!!layers.weather} title="Weather overlay" label="Weather" onClick={() => onToggle('weather')}>
          <Activity className="w-4 h-4" />
        </QuickBtn>
        <QuickBtn title="Map style" label="Map" onClick={() => onToggle('terrain')}>
          <MapIcon className="w-4 h-4" />
        </QuickBtn>
      </div>
    </div>
  )
}
