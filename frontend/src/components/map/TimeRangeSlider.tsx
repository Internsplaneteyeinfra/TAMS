import React from 'react'

export type TimeRange = 'today' | 'yesterday' | '7d' | 'month' | 'live'

const RANGES: { id: TimeRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7D' },
  { id: 'month', label: 'Month' },
  { id: 'live', label: 'Live' },
]

interface TimeRangeSliderProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
  embedded?: boolean
}

export default function TimeRangeSlider({ value, onChange, embedded = false }: TimeRangeSliderProps) {
  return (
    <div
      className={`flex gap-0.5 bg-slate-950/80 rounded-lg p-0.5 border border-slate-800 ${embedded ? '' : 'absolute top-[7.5rem] left-4 z-[4999]'
        }`}
    >
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded-md transition whitespace-nowrap ${value === r.id
            ? 'bg-blue-600 text-white'
            : 'text-slate-500 hover:text-slate-300'
            }`}
        >
          {r.label}
          {r.id === 'live' && value === 'live' && (
            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse align-middle" />
          )}
        </button>
      ))}
    </div>
  )
}
