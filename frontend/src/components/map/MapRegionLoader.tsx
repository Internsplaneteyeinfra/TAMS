import React from 'react'
import { Loader2 } from 'lucide-react'

import {
  MAP_EDGE,
  MAP_INTEL_COLLAPSED_WIDTH,
  MAP_INTEL_TOP,
  MAP_INTEL_WIDTH,
  MAP_PANEL_GAP,
} from '@/components/map/mapLayout'

interface MapRegionLoaderProps {
  loading: boolean
  label?: string
  intelPanelCollapsed?: boolean
}

export default function MapRegionLoader({
  loading,
  label = 'Loading region data…',
  intelPanelCollapsed = false,
}: MapRegionLoaderProps) {
  if (!loading) return null

  const width = intelPanelCollapsed ? MAP_INTEL_COLLAPSED_WIDTH : MAP_INTEL_WIDTH

  return (
    <div
      className="absolute z-[1101] pointer-events-none select-none"
      style={{
        top: `calc(${MAP_INTEL_TOP} - ${MAP_PANEL_GAP} - 2rem)`,
        left: MAP_EDGE,
        width,
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-[#0a1020]/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-400" aria-hidden />
        {!intelPanelCollapsed && (
          <span className="truncate text-[10px] font-semibold text-cyan-100/90">{label}</span>
        )}
      </div>
    </div>
  )
}
