import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  MapPin,
  Globe,
  Zap,
  Flame,
  Activity,
} from 'lucide-react'

import type { Asset } from '@/lib/api'

const GISMap = dynamic(() => import('@/components/GISMap'), { ssr: false })
const GISMap3D = dynamic(() => import('@/components/GISMap3D'), { ssr: false })

type ViewMode = '2d' | '3d'

interface MapViewportProps {
  assets: Asset[]
  selectedAssetId?: string | null
  alertAssetIds?: string[]
  onSelectAsset?: (id: string) => void
}

export default function MapViewport({
  assets,
  selectedAssetId,
  alertAssetIds = [],
  onSelectAsset,
}: MapViewportProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  
  // Enterprise layer states
  const [heatmap, setHeatmap] = useState(false)
  const [riskOverlay, setRiskOverlay] = useState(true)
  const [satelliteLayer, setSatelliteLayer] = useState(true)
  const [terrainLayer, setTerrainLayer] = useState(false)
  const [corridorLayer, setCorridorLayer] = useState(true)

  const activeLayers = {
    heatmap,
    riskOverlay,
    satellite: satelliteLayer,
    terrain: terrainLayer,
    corridors: corridorLayer,
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-[#060B17] overflow-hidden">
      
      {/* Top Center Unified Controls Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-1 bg-[#0e172a] rounded-xl p-1 shadow-2xl border border-white/10 select-none">
        
        {/* View Mode Toggle */}
        <div className="flex bg-slate-950 rounded-lg p-0.5 mr-2">
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition ${
              viewMode === '2d'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            2D Map
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition ${
              viewMode === '3d'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            3D Globe
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        {/* Feature Overlays Toggles */}
        <button
          type="button"
          onClick={() => setHeatmap(!heatmap)}
          className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1 transition ${
            heatmap ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Heatmap
        </button>

        <button
          type="button"
          onClick={() => setRiskOverlay(!riskOverlay)}
          className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1 transition ${
            riskOverlay ? 'bg-red-600/90 text-white' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Risk Overlay
        </button>

        <button
          type="button"
          onClick={() => setCorridorLayer(!corridorLayer)}
          className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1 transition ${
            corridorLayer ? 'bg-emerald-600/90 text-white' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Corridors
        </button>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        {/* Base Layer Switchers */}
        <button
          type="button"
          onClick={() => {
            setSatelliteLayer(true)
            setTerrainLayer(false)
          }}
          className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition ${
            satelliteLayer ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-900'
          }`}
        >
          Satellite
        </button>

        <button
          type="button"
          onClick={() => {
            setSatelliteLayer(false)
            setTerrainLayer(true)
          }}
          className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition ${
            terrainLayer ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-900'
          }`}
        >
          Terrain
        </button>
      </div>

      {/* Map Canvas viewport */}
      {viewMode === '2d' ? (
        <GISMap
          assets={assets}
          selectedAssetId={selectedAssetId}
          alertAssetIds={alertAssetIds}
          onSelectAsset={onSelectAsset}
          activeLayers={activeLayers}
        />
      ) : (
        <GISMap3D
          assets={assets}
          selectedAssetId={selectedAssetId}
          alertAssetIds={alertAssetIds}
          onSelectAsset={onSelectAsset}
          _activeLayers={activeLayers}
        />
      )}
    </div>
  )
}
