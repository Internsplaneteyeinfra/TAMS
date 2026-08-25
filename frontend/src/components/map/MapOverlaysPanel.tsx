import React, { useState } from 'react'
import { ChevronDown, Maximize2 } from 'lucide-react'

import { MAP_INTEL_WIDTH } from '@/components/map/mapLayout'

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
  const [minimized, setMinimized] = useState(true)

  return (
    <div
      className="tams-az-float rounded-xl border border-slate-700/90 bg-[#0a1020]/95 backdrop-blur-xl shadow-lg text-[10px] overflow-hidden"
      style={{ width: intelPanelCollapsed ? '9rem' : MAP_INTEL_WIDTH }}
    >
        <button
          type="button"
          onClick={() => setMinimized((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-800/80 bg-slate-950/80 text-left hover:bg-slate-900/80 transition"
          title={minimized ? 'Open map overlays' : 'Hide map overlays'}
          aria-expanded={!minimized}
        >
          <p className="font-bold uppercase tracking-wider text-[8px] text-slate-300">Map overlays</p>
          <span className="h-6 w-6 flex items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-slate-300 shrink-0">
            {minimized ? <Maximize2 className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        </button>
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
            <p className="pt-1 text-[8px] leading-snug text-slate-500">
              {wildfireOn || floodOn
                ? 'On 2D map: orange = health-risk sites, cyan = flood-keyword sites.'
                : 'Turn a layer on — rings draw on the 2D map around matching assets.'}
            </p>
          </div>
        )}
    </div>
  )
}
