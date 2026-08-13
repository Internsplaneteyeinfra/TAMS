import React from 'react'
import { Cloud, CloudRain, Thermometer, Wind, Zap } from 'lucide-react'

export type WeatherOverlay = 'rain' | 'temperature' | 'wind' | 'lightning' | 'clouds'

const LAYERS: { id: WeatherOverlay; label: string; icon: React.ElementType }[] = [
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'temperature', label: 'Temperature', icon: Thermometer },
  { id: 'wind', label: 'Wind', icon: Wind },
  { id: 'lightning', label: 'Lightning', icon: Zap },
  { id: 'clouds', label: 'Clouds', icon: Cloud },
]

interface WeatherLayerBarProps {
  active: Set<WeatherOverlay>
  onToggle: (layer: WeatherOverlay) => void
}

export default function WeatherLayerBar({ active, onToggle }: WeatherLayerBarProps) {
  return (
    <div className="flex w-[148px] flex-col gap-1 rounded-xl border border-slate-700 bg-[#0a1020] p-1.5 shadow-xl">
      <p className="px-1 text-[8px] font-bold uppercase tracking-wider text-slate-500">Weather</p>
      {LAYERS.map((l) => {
        const Icon = l.icon
        const on = active.has(l.id)
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onToggle(l.id)}
            title={l.label}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
              on
                ? 'border border-cyan-500/30 bg-cyan-600/20 text-cyan-300'
                : 'border border-transparent text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
