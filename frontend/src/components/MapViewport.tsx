/**
 * Map viewport — toggle between 2D (Leaflet) and 3D (Cesium globe)
 */

import React, { useState } from 'react'
import dynamic from 'next/dynamic'

import type { Asset } from '@/lib/api'

const GISMap = dynamic(() => import('@/components/GISMap'), { ssr: false })
const GISMap3D = dynamic(() => import('@/components/GISMap3D'), { ssr: false })

type ViewMode = '2d' | '3d'

export default function MapViewport({
  assets,
  selectedAssetId,
  alertAssetIds,
  onSelectAsset,
}: {
  assets: Asset[]
  selectedAssetId?: string | null
  alertAssetIds?: string[]
  onSelectAsset?: (id: string) => void
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('2d')

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* 2D / 3D toggle */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[2000] flex bg-gray-900/95 rounded-lg p-1 shadow-lg border border-gray-700">
        <button
          type="button"
          onClick={() => setViewMode('2d')}
          className={`px-4 py-2 text-xs font-medium rounded-md transition ${
            viewMode === '2d'
              ? 'bg-tams-primary text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          2D Map
        </button>
        <button
          type="button"
          onClick={() => setViewMode('3d')}
          className={`px-4 py-2 text-xs font-medium rounded-md transition ${
            viewMode === '3d'
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          3D Globe
        </button>
      </div>

      {viewMode === '2d' ? (
        <GISMap
          assets={assets}
          selectedAssetId={selectedAssetId}
          alertAssetIds={alertAssetIds}
          onSelectAsset={onSelectAsset}
        />
      ) : (
        <GISMap3D
          assets={assets}
          selectedAssetId={selectedAssetId}
          alertAssetIds={alertAssetIds}
          onSelectAsset={onSelectAsset}
        />
      )}
    </div>
  )
}
