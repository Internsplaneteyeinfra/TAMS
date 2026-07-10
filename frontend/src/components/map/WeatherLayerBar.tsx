import React from 'react'
import { Cloud, CloudRain, Thermometer, Wind, Zap } from 'lucide-react'

export type WeatherOverlay = 'rain' | 'temperature' | 'wind' | 'lightning' | 'clouds'

const LAYERS: { id: WeatherOverlay; label: string; icon: React.ElementType; emoji: string }[] = [
  { id: 'rain', label: 'Rain', icon: CloudRain, emoji: '🌧' },
  { id: 'temperature', label: 'Temperature', icon: Thermometer, emoji: '🌡' },
  { id: 'wind', label: 'Wind', icon: Wind, emoji: '💨' },
  { id: 'lightning', label: 'Lightning', icon: Zap, emoji: '⚡' },
  { id: 'clouds', label: 'Clouds', icon: Cloud, emoji: '☁' },
]

interface WeatherLayerBarProps {
  active: Set<WeatherOverlay>
  onToggle: (layer: WeatherOverlay) => void
}

export default function WeatherLayerBar({ active, onToggle }: WeatherLayerBarProps) {
  return (
    <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-[#0a1020] border border-slate-700 shadow-xl w-[148px]">
      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider px-1">Weather</p>
      {LAYERS.map((l) => {
        const Icon = l.icon
        const on = active.has(l.id)
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onToggle(l.id)}
            title={l.label}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] font-semibold transition w-full ${on
              ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800 border border-transparent'
              }`}
          >
            <span>{l.emoji}</span>
            <Icon className="w-3 h-3" />
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
