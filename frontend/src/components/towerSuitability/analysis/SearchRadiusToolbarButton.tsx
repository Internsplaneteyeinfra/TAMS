import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { SEARCH_RADIUS_OPTIONS_KM } from '../nearbyPowerSupply'

export default function SearchRadiusToolbarButton({
  value,
  onChange,
}: {
  value: number
  onChange: (km: number) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Ground distance from start for TAMS + OSM grid search (cyan ring on map)"
        onClick={() => setOpen((o) => !o)}
        className={`h-9 px-3 rounded-xl text-xs font-black border transition-colors inline-flex items-center gap-1 ${
          open
            ? 'bg-[#17879a] text-white border-[#126b79]'
            : 'bg-white/80 text-[#0f172a] border-[rgba(51,65,85,0.22)] hover:border-[#17879a]'
        }`}
      >
        Search Radius · {value} km
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Search radius"
          className="absolute top-full left-0 mt-1 z-[1300] w-[min(12rem,calc(100vw-2rem))] rounded-xl border border-[rgba(51,65,85,0.16)] bg-white/75 backdrop-blur-md shadow-lg p-1.5 grid grid-cols-2 gap-1"
        >
          {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
            <button
              key={km}
              type="button"
              role="option"
              aria-selected={value === km}
              title={`Search existing grid within ${km} km of the focus point`}
              onClick={() => {
                onChange(km)
                setOpen(false)
              }}
              className={`h-8 rounded-lg text-[10px] font-black border ${
                value === km
                  ? 'bg-[#17879a] text-white border-[#126b79]'
                  : 'bg-white/55 text-[#263238] border-[rgba(51,65,85,0.16)] hover:border-[#17879a]'
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
