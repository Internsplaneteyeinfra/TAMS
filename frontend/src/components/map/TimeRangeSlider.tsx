import React, { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = RANGES.find((r) => r.id === value)?.label ?? 'Live'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div
      ref={ref}
      className={`relative ${embedded ? '' : 'absolute top-[7.5rem] left-4 z-[4999]'}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Time range"
        className="tams-az-float flex h-7 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0a1020]/95 px-2 text-[8px] font-bold uppercase tracking-wider text-slate-200 shadow-lg"
      >
        <Clock className="h-3 w-3 text-slate-400" />
        <span>{current}</span>
        {value === 'live' && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-[1300] mt-1 flex flex-wrap gap-0.5 rounded-lg border border-slate-800 bg-slate-950/95 p-0.5 shadow-xl"
          role="listbox"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={value === r.id}
              onClick={() => {
                onChange(r.id)
                setOpen(false)
              }}
              className={`px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded-md transition whitespace-nowrap ${
                value === r.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
