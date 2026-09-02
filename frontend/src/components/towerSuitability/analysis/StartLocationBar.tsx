import React from 'react'
import { Crosshair, Navigation, Pencil } from 'lucide-react'

export default function StartLocationBar({
  latInput,
  lonInput,
  onLatInput,
  onLonInput,
  coordsLocked,
  onEditCoords,
  onGoToLocation,
  onLiveLocation,
  geoBusy,
}: {
  latInput: string
  lonInput: string
  onLatInput: (v: string) => void
  onLonInput: (v: string) => void
  coordsLocked: boolean
  onEditCoords: () => void
  onGoToLocation: () => void
  onLiveLocation: () => void
  geoBusy: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#0f172a]">
          Start · lat / lon
        </p>
        {coordsLocked && (
          <button
            type="button"
            onClick={onEditCoords}
            className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-[#17879a] hover:text-[#126b79]"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-[#0f172a] font-bold">
          Latitude / N
          <input
            value={latInput}
            onChange={(e) => onLatInput(e.target.value)}
            readOnly={coordsLocked}
            placeholder="22.9734"
            inputMode="decimal"
            className={`mt-1 w-full h-8 rounded-lg border px-2 text-xs font-mono text-[#0f172a] ${
              coordsLocked
                ? 'border-[rgba(51,65,85,0.1)] bg-[#f4f6f8] text-[#475569] cursor-default'
                : 'border-[rgba(51,65,85,0.16)] bg-white/70'
            }`}
          />
        </label>
        <label className="text-[10px] text-[#0f172a] font-bold">
          Longitude / E
          <input
            value={lonInput}
            onChange={(e) => onLonInput(e.target.value)}
            readOnly={coordsLocked}
            placeholder="78.6569"
            inputMode="decimal"
            className={`mt-1 w-full h-8 rounded-lg border px-2 text-xs font-mono text-[#0f172a] ${
              coordsLocked
                ? 'border-[rgba(51,65,85,0.1)] bg-[#f4f6f8] text-[#475569] cursor-default'
                : 'border-[rgba(51,65,85,0.16)] bg-white/70'
            }`}
          />
        </label>
      </div>
      {!coordsLocked && (
        <div className="mt-2 flex flex-col sm:flex-row gap-1.5">
          <button
            type="button"
            onClick={onGoToLocation}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#17879a] text-[11px] font-bold text-white hover:bg-[#126b79]"
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            Go to Site
          </button>
          <button
            type="button"
            disabled={geoBusy}
            onClick={onLiveLocation}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/60 text-[11px] font-bold text-[#0f172a] disabled:opacity-50"
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            {geoBusy ? 'Locating…' : 'Use GPS Location'}
          </button>
        </div>
      )}
    </div>
  )
}
