import React, { useState } from 'react'

import { MAP_OVERLAYS_BOTTOM, mapOverlaysLeft } from '@/components/map/mapLayout'
import PanelMinimizeButton from '@/components/ui/PanelMinimizeButton'

interface MapOverlaysPanelProps {
  intelPanelCollapsed?: boolean
  wildfireOn: boolean
  floodOn: boolean
  onToggleWildfire: () => void
  onToggleFlood: () => void
}

export default function MapOverlaysPanel({
  intelPanelCollapsed = false,
  wildfireOn,
  floodOn,
  onToggleWildfire,
  onToggleFlood,
}: MapOverlaysPanelProps) {
  const [minimized, setMinimized] = useState(false)

  return (
    <div
      className="absolute z-[1050] pointer-events-none"
      style={{ bottom: MAP_OVERLAYS_BOTTOM, left: mapOverlaysLeft(intelPanelCollapsed) }}
    >
      <div className="pointer-events-auto rounded-xl border border-slate-700/90 bg-[#0a1020]/95 backdrop-blur-xl shadow-lg text-[10px] min-w-[8.75rem] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-800/80 bg-slate-950/80">
          <p className="text-slate-300 font-bold uppercase tracking-wider text-[8px]">Overlays</p>
          <PanelMinimizeButton
            variant="hide"
            minimized={minimized}
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? 'Show overlays' : 'Hide overlays'}
          />
        </div>
        {!minimized && (
          <div className="p-2 space-y-1">
            <button
              type="button"
              onClick={onToggleWildfire}
              className={`flex items-center gap-2 w-full py-1 px-1.5 rounded transition ${wildfireOn ? 'text-orange-400 bg-orange-500/10' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${wildfireOn ? 'bg-orange-500' : 'bg-slate-700'}`} />
              Wildfire
            </button>
            <button
              type="button"
              onClick={onToggleFlood}
              className={`flex items-center gap-2 w-full py-1 px-1.5 rounded transition ${floodOn ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${floodOn ? 'bg-cyan-500' : 'bg-slate-700'}`} />
              Flood
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
