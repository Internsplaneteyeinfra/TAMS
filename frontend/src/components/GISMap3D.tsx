/**
 * 3D Cesium globe — satellite imagery, extruded substations, tower models
 * Cesium loaded from CDN to avoid Next.js webpack conflicts.
 */

import React, { useEffect, useRef, useState } from 'react'

import type { Asset } from '@/lib/api'

const CESIUM_VERSION = '1.142.0'

/** Local copy (public/cesium) first, then CDN fallbacks — cesium.com CDN returns 404 */
const CESIUM_SOURCES = [
  '/cesium/',
  `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`,
  `https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium/`,
]

type CesiumModule = typeof import('cesium')

let cesiumLoader: Promise<CesiumModule> | null = null

function ensureTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}

function loadScript(base: string): Promise<CesiumModule> {
  const CESIUM_BASE = ensureTrailingSlash(base)
  const win = window as Window & { CESIUM_BASE_URL?: string; Cesium?: CesiumModule }

  if (win.Cesium) {
    return Promise.resolve(win.Cesium)
  }

  win.CESIUM_BASE_URL = CESIUM_BASE

  const cssHref = `${CESIUM_BASE}Widgets/widgets.css`
  if (!document.querySelector(`link[data-cesium-widgets="${cssHref}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = cssHref
    link.setAttribute('data-cesium-widgets', cssHref)
    document.head.appendChild(link)
  }

  const existing = document.querySelector(`script[data-cesium-src="${CESIUM_BASE}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        if (win.Cesium) resolve(win.Cesium)
        else reject(new Error('Cesium global missing after script load'))
      })
      existing.addEventListener('error', () => reject(new Error(`Failed: ${CESIUM_BASE}`)))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${CESIUM_BASE}Cesium.js`
    script.async = true
    script.setAttribute('data-cesium-src', CESIUM_BASE)
    script.onload = () => {
      if (win.Cesium) resolve(win.Cesium)
      else reject(new Error('Cesium global missing after script load'))
    }
    script.onerror = () => {
      script.remove()
      reject(new Error(`Could not load Cesium from ${CESIUM_BASE}`))
    }
    document.head.appendChild(script)
  })
}

async function loadCesium(): Promise<CesiumModule> {
  if (typeof window === 'undefined') {
    throw new Error('Cesium requires browser environment')
  }

  const win = window as Window & { Cesium?: CesiumModule }
  if (win.Cesium) {
    return win.Cesium
  }

  if (!cesiumLoader) {
    cesiumLoader = (async () => {
      const errors: string[] = []
      for (const source of CESIUM_SOURCES) {
        try {
          return await loadScript(source)
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }
      throw new Error(errors.join(' | '))
    })()
  }

  return cesiumLoader
}

const HEALTH_CSS: Record<string, string> = {
  healthy: '#06a77d',
  attention_required: '#f77f00',
  critical: '#d62828',
}

const TYPE_CSS: Record<string, string> = {
  tower: '#ef4444',
  substation: '#3b82f6',
  line: '#22c55e',
}

function assetColor(Cesium: CesiumModule, asset: Asset) {
  const css = HEALTH_CSS[asset.health_score || ''] || TYPE_CSS[asset.asset_type] || '#3b82f6'
  return Cesium.Color.fromCssColorString(css)
}

function addAssetEntity(
  Cesium: CesiumModule,
  viewer: import('cesium').Viewer,
  asset: Asset,
  isSelected: boolean,
  hasAlert: boolean
) {
  const color = assetColor(Cesium, asset)
  const outline = hasAlert ? Cesium.Color.ORANGE : Cesium.Color.WHITE

  const label = {
    text: asset.name,
    font: '12px sans-serif',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, -12),
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 900000),
    scale: isSelected ? 1.15 : 1,
  }

  if (asset.asset_type === 'substation' && asset.geometry?.type === 'Polygon') {
    const ring = (asset.geometry.coordinates as number[][][])[0]
    return viewer.entities.add({
      id: asset.id,
      name: asset.name,
      description: asset.description || asset.name,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(ring.flatMap(([lng, lat]) => [lng, lat])),
        height: 0,
        extrudedHeight: isSelected ? 120 : 80,
        material: color.withAlpha(0.55),
        outline: true,
        outlineColor: outline,
        outlineWidth: isSelected ? 3 : 1,
      },
      label,
    })
  }

  if (asset.asset_type === 'line' && asset.geometry?.type === 'LineString') {
    const coords = asset.geometry.coordinates as number[][]
    return viewer.entities.add({
      id: asset.id,
      name: asset.name,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(
          coords.flatMap(([lng, lat]) => [lng, lat])
        ),
        width: isSelected ? 7 : 5,
        material: Cesium.Color.fromCssColorString(TYPE_CSS.line),
        clampToGround: true,
      },
      label,
    })
  }

  if (asset.asset_type === 'tower') {
    const towerHeight = 150
    return viewer.entities.add({
      id: asset.id,
      name: asset.name,
      description: asset.description || asset.name,
      position: Cesium.Cartesian3.fromDegrees(
        asset.longitude,
        asset.latitude,
        towerHeight / 2
      ),
      cylinder: {
        length: towerHeight,
        topRadius: 6,
        bottomRadius: 14,
        material: color.withAlpha(0.85),
        outline: true,
        outlineColor: outline,
      },
      label,
    })
  }

  return viewer.entities.add({
    id: asset.id,
    name: asset.name,
    description: asset.description || asset.name,
    position: Cesium.Cartesian3.fromDegrees(asset.longitude, asset.latitude),
    point: {
      pixelSize: isSelected ? 16 : 12,
      color,
      outlineColor: outline,
      outlineWidth: isSelected ? 3 : 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label,
  })
}

export default function GISMap3D({
  assets,
  selectedAssetId,
  alertAssetIds = [],
  onSelectAsset,
}: {
  assets: Asset[]
  selectedAssetId?: string | null
  alertAssetIds?: string[]
  onSelectAsset?: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const cesiumRef = useRef<CesiumModule | null>(null)
  const entityIdsRef = useRef<string[]>([])
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || viewerRef.current) return

    let handler: import('cesium').ScreenSpaceEventHandler | null = null
    let cancelled = false

    loadCesium()
      .then((Cesium) => {
        if (cancelled || !container) return
        cesiumRef.current = Cesium

        const viewer = new Cesium.Viewer(container, {
          animation: false,
          timeline: false,
          fullscreenButton: true,
          geocoder: false,
          homeButton: true,
          sceneModePicker: true,
          baseLayerPicker: false,
          navigationHelpButton: true,
          infoBox: true,
          selectionIndicator: true,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        })

        viewer.imageryLayers.removeAll()
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maximumLevel: 19,
            credit: '© Esri, Maxar',
          })
        )

        viewer.scene.globe.enableLighting = true
        viewer.scene.fog.enabled = true
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true
        }

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(79.0, 22.5, 2800000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-55),
            roll: 0,
          },
          duration: 0,
        })

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((movement: { position: import('cesium').Cartesian2 }) => {
          const picked = viewer.scene.pick(movement.position)
          if (Cesium.defined(picked)) {
            const entity = picked.id as import('cesium').Entity | undefined
            if (entity?.id && typeof entity.id === 'string') {
              onSelectAsset?.(entity.id)
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        viewerRef.current = viewer
        setMapStatus('ready')
      })
      .catch((err) => {
        console.error('Cesium init failed:', err)
        const detail = err instanceof Error ? err.message : 'Unknown error'
        setErrorMsg(`Failed to load 3D globe: ${detail}`)
        setMapStatus('error')
      })

    return () => {
      cancelled = true
      handler?.destroy()
      viewerRef.current?.destroy()
      viewerRef.current = null
      entityIdsRef.current = []
    }
  }, [onSelectAsset])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) return

    entityIdsRef.current.forEach((id) => viewer.entities.removeById(id))
    entityIdsRef.current = []

    assets.forEach((asset) => {
      const isSelected = asset.id === selectedAssetId
      const hasAlert = alertAssetIds.includes(asset.id)
      const entity = addAssetEntity(Cesium, viewer, asset, isSelected, hasAlert)
      if (entity?.id) entityIdsRef.current.push(entity.id as string)
    })
  }, [assets, selectedAssetId, alertAssetIds, mapStatus])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium || !selectedAssetId) return
    const asset = assets.find((a) => a.id === selectedAssetId)
    if (!asset) return

    const entity = viewer.entities.getById(selectedAssetId)
    if (entity) {
      viewer.flyTo(entity, {
        duration: 1.5,
        offset: new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(-40),
          asset.asset_type === 'substation' ? 8000 : 5000
        ),
      })
    } else {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(asset.longitude, asset.latitude, 12000),
        orientation: { pitch: Cesium.Math.toRadians(-40) },
        duration: 1.5,
      })
    }
  }, [selectedAssetId, assets, mapStatus])

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {mapStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <p className="text-gray-300 text-sm">Loading 3D globe…</p>
        </div>
      )}

      {mapStatus === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 p-6 text-center">
          <p className="text-tams-danger text-sm">{errorMsg}</p>
        </div>
      )}

      <div className="absolute bottom-20 right-4 z-10 bg-gray-900/90 text-[10px] text-gray-300 px-3 py-2 rounded-lg border border-gray-700 max-w-[200px] leading-relaxed pointer-events-none">
        <p className="font-semibold text-white mb-1">3D Controls</p>
        <p>Left-drag: rotate globe</p>
        <p>Right-drag: tilt view</p>
        <p>Scroll: zoom in/out</p>
        <p>Middle-drag: pan</p>
      </div>
    </div>
  )
}
