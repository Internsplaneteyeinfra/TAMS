import React, { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import FloatingMapToolbar, { type MapToolbarLayers } from '@/components/map/FloatingMapToolbar'
import MapViewModeBar, { type MapBasemap } from '@/components/map/MapViewModeBar'
import { MAP_CHROME_TOP, MAP_EDGE, MAP_RIGHT_RAIL_COLLAPSED_WIDTH, MAP_RIGHT_RAIL_WIDTH, mapRightInset } from '@/components/map/mapLayout'
import PanelMinimizeButton from '@/components/ui/PanelMinimizeButton'

export const MAP_RIGHT_CONTROLS_OFFSET = MAP_RIGHT_RAIL_WIDTH
export const MAP_RIGHT_CONTROLS_OFFSET_COLLAPSED = MAP_RIGHT_RAIL_COLLAPSED_WIDTH

export interface MapZoomHandlers { zoomIn: () => void; zoomOut: () => void }

interface MapControlRailProps {
  mapZoom?: MapZoomHandlers | null
  layers: MapToolbarLayers
  onToggle: (key: keyof MapToolbarLayers) => void
  onLocate?: () => void
  onFullscreen?: () => void
  basemapMode: MapBasemap
  onBasemapMode: (mode: MapBasemap) => void
  onCollapsedChange?: (collapsed: boolean) => void
}

function MapZoomButtons({ zoomIn, zoomOut }: MapZoomHandlers) {
  return (
    <div className="flex flex-col w-9 rounded-lg overflow-hidden border border-slate-600/90 bg-slate-950/95 shadow-lg shrink-0" role="group" aria-label="Map zoom">
      <button type="button" onClick={zoomIn} title="Zoom in" className="h-8 flex items-center justify-center text-slate-200 hover:bg-slate-800 transition"><Plus className="w-4 h-4" strokeWidth={2.5} /></button>
      <div className="h-px bg-slate-700/90" />
      <button type="button" onClick={zoomOut} title="Zoom out" className="h-8 flex items-center justify-center text-slate-200 hover:bg-slate-800 transition"><Minus className="w-4 h-4" strokeWidth={2.5} /></button>
    </div>
  )
}

export default function MapControlRail({ mapZoom, layers, onToggle, onLocate, onFullscreen, basemapMode, onBasemapMode, onCollapsedChange }: MapControlRailProps) {
  const [collapsed, setCollapsed] = useState(false)
  const setRailCollapsed = (next: boolean) => { setCollapsed(next); onCollapsedChange?.(next) }
  const pos = { top: MAP_CHROME_TOP, right: MAP_EDGE, width: mapRightInset(collapsed) }

  if (collapsed) {
    return (
      <div className="absolute z-[1200] flex justify-end pointer-events-auto" style={pos}>
        <PanelMinimizeButton minimized onClick={() => setRailCollapsed(false)} title="Show map controls" />
      </div>
    )
  }

  return (
    <div className="absolute z-[1200] pointer-events-auto" style={pos}>
      <div className="flex flex-col rounded-xl bg-[#0e172a]/95 backdrop-blur-sm border border-slate-700/80 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-950/90 border-b border-slate-700/60">
          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Map Tools</span>
          <PanelMinimizeButton variant="hide" onClick={() => setRailCollapsed(true)} title="Hide map controls" />
        </div>
        <div className="flex items-start gap-1 p-1.5">
          <MapViewModeBar variant="rail" mode={basemapMode} onChange={onBasemapMode} />
          <div className="flex flex-col items-center gap-1">
            {mapZoom && <MapZoomButtons zoomIn={mapZoom.zoomIn} zoomOut={mapZoom.zoomOut} />}
            <FloatingMapToolbar embedded layers={layers} onToggle={onToggle} onLocate={onLocate} onFullscreen={onFullscreen} />
          </div>
        </div>
      </div>
    </div>
  )
}
