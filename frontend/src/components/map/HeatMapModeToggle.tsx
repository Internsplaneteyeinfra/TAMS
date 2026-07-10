import React from 'react'

export type HeatMapMode =
  | 'normal'
  | 'heatmap'
  | 'ai-risk'
  | 'vegetation'
  | 'flood'
  | 'wind'
  | 'lightning'

const MODES: { id: HeatMapMode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'heatmap', label: 'Heat Map' },
  { id: 'ai-risk', label: 'AI Risk' },
  { id: 'vegetation', label: 'Vegetation' },
  { id: 'flood', label: 'Flood' },
  { id: 'wind', label: 'Wind' },
  { id: 'lightning', label: 'Lightning' },
]

interface HeatMapModeToggleProps {
  mode: HeatMapMode
  onChange: (mode: HeatMapMode) => void
  embedded?: boolean
}

export default function HeatMapModeToggle({ mode, onChange, embedded = false }: HeatMapModeToggleProps) {
  return (
    <div
      className={`flex flex-wrap gap-0.5 bg-[#0a1020]/95 rounded-lg p-0.5 border border-slate-700/80 shadow-lg ${embedded ? 'max-w-[220px]' : 'absolute top-[4.25rem] right-[4.5rem] z-[997] max-w-[280px]'
        }`}
    >
      <p className="w-full px-2 pt-1 text-[8px] font-bold text-slate-500 uppercase tracking-wider">Layer Mode</p>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded-md transition whitespace-nowrap ${mode === m.id
            ? 'bg-blue-600 text-white'
            : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
