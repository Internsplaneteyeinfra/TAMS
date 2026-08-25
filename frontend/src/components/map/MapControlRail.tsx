import React, { useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'

import FloatingMapToolbar, { type MapToolbarLayers } from '@/components/map/FloatingMapToolbar'
import MapViewModeBar, { type MapBasemap } from '@/components/map/MapViewModeBar'
import {
  MAP_RIGHT_RAIL_COLLAPSED_WIDTH,
  MAP_RIGHT_RAIL_WIDTH,
  mapRightInset,
} from '@/components/map/mapLayout'
import PanelMinimizeButton from '@/components/ui/PanelMinimizeButton'

export const MAP_RIGHT_CONTROLS_OFFSET = MAP_RIGHT_RAIL_WIDTH
export const MAP_RIGHT_CONTROLS_OFFSET_COLLAPSED = MAP_RIGHT_RAIL_COLLAPSED_WIDTH

export interface MapZoomHandlers {
  zoomIn: () => void
  zoomOut: () => void
}

interface MapControlRailProps {
  mapZoom?: MapZoomHandlers | null
  layers: MapToolbarLayers
  onToggle: (key: keyof MapToolbarLayers) => void
  onLocate?: () => void
  onFullscreen?: () => void
  basemapMode: MapBasemap
  onBasemapMode: (mode: MapBasemap) => void
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  rightPanelOpen?: boolean
}

function MapZoomButtons({ zoomIn, zoomOut }: MapZoomHandlers) {
  return (
    <div
      className="flex w-11 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-600/90 bg-slate-950/95 shadow-lg"
      role="group"
      aria-label="Map zoom"
    >
      <button
        type="button"
        onClick={zoomIn}
        title="Zoom in"
        className="flex h-8 items-center justify-center text-slate-200 transition hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <div className="h-px bg-slate-700/90" />
      <button
        type="button"
        onClick={zoomOut}
        title="Zoom out"
        className="flex h-8 items-center justify-center text-slate-200 transition hover:bg-slate-800"
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}

export default function MapControlRail({
  mapZoom,
  layers,
  onToggle,
  onLocate,
  onFullscreen,
  basemapMode,
  onBasemapMode,
  collapsed = false,
  onCollapsedChange,
  rightPanelOpen = false,
}: MapControlRailProps) {
  useEffect(() => {
    if (rightPanelOpen) onCollapsedChange?.(true)
  }, [rightPanelOpen, onCollapsedChange])

  if (collapsed) return null

  return (
    <div className="pointer-events-auto flex h-full min-h-0 flex-col items-end">
      <div
        className="tams-az-float flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-[#0e172a]/95 shadow-xl backdrop-blur-sm"
        style={{ width: mapRightInset(false) }}
      >
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-700/60 bg-slate-950/90 px-2 py-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Map Tools</span>
          <PanelMinimizeButton variant="close" onClick={() => onCollapsedChange?.(true)} title="Minimize map tools" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-x-hidden overflow-y-auto p-1.5">
          <MapViewModeBar variant="rail" mode={basemapMode} onChange={onBasemapMode} />
          {mapZoom && <MapZoomButtons zoomIn={mapZoom.zoomIn} zoomOut={mapZoom.zoomOut} />}
          <FloatingMapToolbar
            embedded
            layers={layers}
            onToggle={onToggle}
            onLocate={onLocate}
            onFullscreen={onFullscreen}
          />
        </div>
      </div>
    </div>
  )
}
