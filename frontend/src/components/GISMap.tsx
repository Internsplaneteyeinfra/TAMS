import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

import type { Asset } from '@/lib/api'

type MapLayer = 'satellite' | 'satellite-labels'
type AssetType = Asset['asset_type']
type RegionFilter = 'all' | 'india' | 'world'

const ASSET_CONFIG: Record<
  AssetType,
  { label: string; badge: string; color: string; size: number }
> = {
  tower: { label: 'Transmission Tower', badge: 'TWR', color: '#ef4444', size: 28 },
  substation: { label: 'Substation', badge: 'SUB', color: '#3b82f6', size: 36 },
  line: { label: 'Power Line', badge: 'LINE', color: '#22c55e', size: 24 },
}

const HEALTH_RING: Record<string, string> = {
  healthy: '#06a77d',
  attention_required: '#f77f00',
  critical: '#d62828',
}

function safeInvalidateMapSize(map: L.Map | null | undefined) {
  if (!map) return
  try {
    const container = map.getContainer()
    if (!container.isConnected || container.offsetWidth === 0 || container.offsetHeight === 0) return
    if (!map.getPane('mapPane')) return
    map.invalidateSize({ animate: false })
  } catch {
    // Map panes not ready yet — skip until layout stabilizes
  }
}

function buildTileLayer(layer: MapLayer): L.Layer {
  if (layer === 'satellite') {
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }
    )
  }
  return L.layerGroup([
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    ),
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }
    ),
  ])
}

function healthColor(asset: Asset): string {
  return HEALTH_RING[asset.health_score || ''] || ASSET_CONFIG[asset.asset_type].color
}

function makeAssetIcon(asset: Asset, isSelected: boolean, hasAlert: boolean) {
  const cfg = ASSET_CONFIG[asset.asset_type]
  const ring = healthColor(asset)
  const scale = isSelected ? 1.15 : 1
  const w = Math.round(cfg.size * scale)
  const h = Math.round(cfg.size * scale)
  const alertGlow = hasAlert ? 'filter:drop-shadow(0 0 6px #f77f00);' : ''
  const selectRing = isSelected ? 'outline:3px solid #fff;outline-offset:2px;' : ''

  let symbol = ''
  if (asset.asset_type === 'tower') {
    symbol = `<svg width="${w}" height="${h}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 28,28 4,28" fill="${cfg.color}" stroke="#fff" stroke-width="2"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="#fff" stroke-width="1.5"/>
      <line x1="12" y1="24" x2="20" y2="24" stroke="#fff" stroke-width="1.5"/>
    </svg>`
  } else if (asset.asset_type === 'substation') {
    symbol = `<svg width="${w}" height="${h}" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="30" height="30" rx="4" fill="${cfg.color}" stroke="#fff" stroke-width="2"/>
      <rect x="8" y="8" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="20" y="8" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="8" y="20" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="20" y="20" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <text x="18" y="6" text-anchor="middle" fill="#fff" font-size="5" font-weight="bold">SUB</text>
    </svg>`
  } else {
    symbol = `<svg width="${w}" height="${h}" viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="10" x2="30" y2="10" stroke="${cfg.color}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="16" cy="10" r="5" fill="${cfg.color}" stroke="#fff" stroke-width="2"/>
    </svg>`
  }

  const labelH = 18
  const totalH = h + labelH + 4

  return L.divIcon({
    className: '',
    iconSize: [Math.max(w, 90), totalH],
    iconAnchor: [Math.max(w, 90) / 2, h / 2],
    html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;${alertGlow}${selectRing}">
      <div style="border:3px solid ${ring};border-radius:6px;padding:2px;background:rgba(0,0,0,0.35);position:relative;">
        ${asset.health_score === 'critical' ? `
        <div style="
          position:absolute;
          inset:-5px;
          border:2px solid #ef4444;
          border-radius:8px;
          animation: markerPulse 1.8s infinite ease-in-out;
          pointer-events:none;
        "></div>
        ` : ''}
        ${symbol}
      </div>
      <div style="
        margin-top:3px;
        background:rgba(17,24,39,0.92);
        color:#fff;
        font-size:10px;
        font-weight:700;
        padding:2px 6px;
        border-radius:4px;
        white-space:nowrap;
        border:1px solid rgba(255,255,255,0.2);
        max-width:110px;
        overflow:hidden;
        text-overflow:ellipsis;
      ">${asset.name}</div>
      <div style="
        font-size:9px;
        color:${cfg.color};
        font-weight:600;
        text-transform:uppercase;
        letter-spacing:0.5px;
      ">${cfg.badge}</div>
    </div>`,
  })
}

function buildPopupHtml(asset: Asset): string {
  const cfg = ASSET_CONFIG[asset.asset_type]
  const meta = asset.metadata || {}
  const voltage = meta.voltage_kv ? `${meta.voltage_kv} kV` : '—'
  const location = meta.country_or_state ? String(meta.country_or_state) : ''
  const region = meta.region ? String(meta.region) : ''
  const operator = meta.operator ? String(meta.operator) : ''
  return `<div>
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">${asset.name}</div>
    <div style="display:inline-block;background:${cfg.color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:6px">
      ${cfg.label}
    </div>
    <div style="font-size:12px;color:#374151">
      ${location ? `<div><b>Location:</b> ${location}${region ? ` (${region})` : ''}</div>` : ''}
      ${operator ? `<div><b>Operator:</b> ${operator}</div>` : ''}
      <div><b>Health:</b> ${(asset.health_score || 'unknown').replace(/_/g, ' ')}</div>
      <div><b>Voltage:</b> ${voltage}</div>
      <div><b>Status:</b> ${asset.status || 'active'}</div>
      <div><b>Lat:</b> ${formatCoord(asset.latitude)} · <b>Lng:</b> ${formatCoord(asset.longitude)}</div>
      ${asset.description ? `<div style="margin-top:4px;color:#6b7280">${asset.description}</div>` : ''}
    </div>
  </div>`
}

function assetRegion(asset: Asset): string | undefined {
  return asset.metadata?.region as string | undefined
}

function passesRegionFilter(asset: Asset, regionFilter: RegionFilter): boolean {
  if (regionFilter === 'all') return true
  if (asset.asset_type !== 'substation') return true
  const region = assetRegion(asset)
  if (regionFilter === 'india') return region === 'India'
  if (regionFilter === 'world') return region !== undefined && region !== 'India'
  return true
}

function collectBounds(assets: Asset[]): L.LatLngBounds | null {
  if (assets.length === 0) return null
  const points: L.LatLngExpression[] = []
  assets.forEach((a) => {
    points.push([a.latitude, a.longitude])
    if (a.geometry?.type === 'LineString') {
      toLatLngs(a.geometry.coordinates as number[][]).forEach((p) => points.push(p))
    }
  })
  return L.latLngBounds(points)
}

function toLatLngs(coords: number[][]): L.LatLngExpression[] {
  return coords.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
}



function formatCoord(value: number, decimals = 6): string {
  return value.toFixed(decimals)
}

function userLocationIcon() {
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:#06b6d4;border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(6,182,212,0.4),0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
  })
}

function clickPinIcon() {
  return L.divIcon({
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:#fbbf24;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
  })
}

function gotoPinIcon() {
  return L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:#a855f7;border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(168,85,247,0.35),0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
  })
}

export default function GISMap({
  assets,
  selectedAssetId,
  alertAssetIds = [],
  onSelectAsset,
  activeLayers,
  resizeSignal = 0,
}: {
  assets: Asset[]
  selectedAssetId?: string | null
  alertAssetIds?: string[]
  onSelectAsset?: (id: string) => void
  activeLayers?: {
    heatmap: boolean
    riskOverlay: boolean
    satellite: boolean
    terrain: boolean
    corridors: boolean
  }
  resizeSignal?: number
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map())
  const overlaysRef = useRef<L.Layer[]>([])
  const tileLayerRef = useRef<L.Layer | null>(null)
  const userLocationMarkerRef = useRef<L.Marker | null>(null)
  const clickMarkerRef = useRef<L.Marker | null>(null)
  const hasInitialFitRef = useRef(false)
  const lastFitKeyRef = useRef('')
  const [mapLayer, setMapLayer] = useState<MapLayer>('satellite-labels')
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showLabels, setShowLabels] = useState(true)
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('india')
  const [zoomVersion, setZoomVersion] = useState(0)
  const [cursorPoint, setCursorPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [typeFilters, setTypeFilters] = useState<Record<AssetType, boolean>>({
    tower: true,
    substation: true,
    line: true,
  })
  const [showWildfireRisk, setShowWildfireRisk] = useState(false)
  const [showFloodRisk, setShowFloodRisk] = useState(false)

  // Sync activeLayers props with internal state variables
  useEffect(() => {
    if (activeLayers) {
      setShowWildfireRisk(activeLayers.riskOverlay)
      setShowFloodRisk(activeLayers.riskOverlay)
      setMapLayer(activeLayers.satellite ? 'satellite-labels' : 'satellite')
    }
  }, [activeLayers])

  const filteredAssets = useMemo(
    () => assets.filter((a) => typeFilters[a.asset_type] && passesRegionFilter(a, regionFilter)),
    [assets, typeFilters, regionFilter]
  )
  const filteredIds = filteredAssets.map((a) => a.id).join(',')
  const fitKey = `${regionFilter}:${filteredIds}`

  const indiaCount = assets.filter(
    (a) => a.asset_type === 'substation' && assetRegion(a) === 'India'
  ).length
  const worldSubCount = assets.filter(
    (a) => a.asset_type === 'substation' && assetRegion(a) && assetRegion(a) !== 'India'
  ).length

  const fitToRegion = useCallback(
    (target: RegionFilter, assetList: Asset[]) => {
      const map = mapRef.current
      if (!map || assetList.length === 0) return

      let subset = assetList
      if (target === 'india') {
        const indiaSubs = assets.filter(
          (a) => a.asset_type === 'substation' && assetRegion(a) === 'India'
        )
        subset = indiaSubs.length ? indiaSubs : assetList
      } else if (target === 'world') {
        const worldSubs = assets.filter(
          (a) =>
            a.asset_type === 'substation' && assetRegion(a) && assetRegion(a) !== 'India'
        )
        subset = worldSubs.length ? worldSubs : assetList
      }

      const bounds = collectBounds(subset)
      if (!bounds) return

      const maxZoom = target === 'india' ? 6 : target === 'world' ? 4 : 5
      map.fitBounds(bounds, { padding: [50, 50], maxZoom })
    },
    [assets]
  )

  const toggleType = (type: AssetType) => {
    setTypeFilters((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const placeMarker = useCallback(
    (ref: React.MutableRefObject<L.Marker | null>, lat: number, lng: number, icon: L.DivIcon, popupHtml: string) => {
      const map = mapRef.current
      if (!map) return
      ref.current?.remove()
      const marker = L.marker([lat, lng], { icon, zIndexOffset: 500 })
        .addTo(map)
        .bindPopup(popupHtml)
      ref.current = marker
    },
    []
  )

  const flyToCoordinates = useCallback(
    (lat: number, lng: number, source: 'gps' | 'map_click' | 'manual') => {
      const map = mapRef.current
      if (!map) return

      map.flyTo([lat, lng], 14, { duration: 1.2 })

      const isGps = source === 'gps'
      const markerRef = isGps ? userLocationMarkerRef : clickMarkerRef
      const icon = isGps ? userLocationIcon() : source === 'manual' ? gotoPinIcon() : clickPinIcon()
      const title =
        source === 'gps' ? 'Your location' : source === 'manual' ? 'Go to location' : 'Map point'

      if (isGps) clickMarkerRef.current?.remove()

      placeMarker(
        markerRef,
        lat,
        lng,
        icon,
        `<div style="font-family:sans-serif;font-size:13px">
          <b>${title}</b><br/>
          Lat: ${formatCoord(lat)}<br/>
          Lng: ${formatCoord(lng)}
        </div>`
      )
      setTimeout(() => markerRef.current?.openPopup(), 1300)
    },
    [placeMarker]
  )

  useEffect(() => {
    const container = mapContainer.current
    if (!container || mapRef.current) return

    try {
      const map = L.map(container, {
        center: [22.5, 79.0],
        zoom: 5,
        zoomControl: false,
      })

      L.control.zoom({ position: 'topright' }).addTo(map)
      L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)

      const layer = buildTileLayer('satellite-labels')
      layer.addTo(map)
      tileLayerRef.current = layer
      mapRef.current = map
      setMapStatus('ready')

      // Refresh labels/footprints on zoom — do NOT reset map bounds
      map.on('zoomend', () => setZoomVersion((v) => v + 1))

      map.on('mousemove', (e) => {
        setCursorPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      })

      map.on('click', (e) => {
        const lat = e.latlng.lat
        const lng = e.latlng.lng
        flyToCoordinates(lat, lng, 'map_click')
      })

<<<<<<< Updated upstream
      // Guard against calling invalidateSize after the map has been removed
      // (React 18 StrictMode double-mount runs cleanup before this fires).
      const isMapAlive = () => mapRef.current === map && Boolean((map as unknown as { _mapPane?: unknown })._mapPane)
      const safeInvalidate = () => {
        if (isMapAlive()) map.invalidateSize()
      }

      const invalidateTimer = setTimeout(safeInvalidate, 100)
      const onResize = () => safeInvalidate()
=======
      map.whenReady(() => {
        requestAnimationFrame(() => safeInvalidateMapSize(map))
      })
      const onResize = () => safeInvalidateMapSize(map)
>>>>>>> Stashed changes
      window.addEventListener('resize', onResize)

      return () => {
        clearTimeout(invalidateTimer)
        window.removeEventListener('resize', onResize)
        clusterRef.current?.clearLayers()
        markerByIdRef.current.clear()
        overlaysRef.current.forEach((o) => o.remove())
        overlaysRef.current = []
        map.remove()
        mapRef.current = null
        tileLayerRef.current = null
        clusterRef.current = null
        userLocationMarkerRef.current?.remove()
        clickMarkerRef.current?.remove()
        userLocationMarkerRef.current = null
        clickMarkerRef.current = null
      }
    } catch (err) {
      console.error('Map init failed:', err)
      setMapStatus('error')
      return undefined
    }
  }, [placeMarker, flyToCoordinates])

  useEffect(() => {
    if (resizeSignal === 0) return
    safeInvalidateMapSize(mapRef.current)
  }, [resizeSignal])

  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready') return

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    const layer = buildTileLayer(mapLayer)
    layer.addTo(map)
    tileLayerRef.current = layer
  }, [mapLayer, mapStatus])

  // Draw assets: markers + line corridors + substation footprints
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready') return

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
    }
    clusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 9,
    })
    markerByIdRef.current.clear()
    overlaysRef.current.forEach((o) => o.remove())
    overlaysRef.current = []

    const zoom = map.getZoom()
    const labelsVisible = showLabels && zoom >= 7

    filteredAssets.forEach((asset) => {
      const isSelected = asset.id === selectedAssetId
      const hasAlert = alertAssetIds.includes(asset.id)
      const cfg = ASSET_CONFIG[asset.asset_type]
      const ring = healthColor(asset)

      if (asset.asset_type === 'line' && asset.geometry?.type === 'LineString') {
        if (activeLayers && !activeLayers.corridors) return
        const latlngs = toLatLngs(asset.geometry.coordinates as number[][])
        const lineHealth = asset.health_score || 'healthy'
        const lineColor =
          hasAlert || lineHealth === 'critical'
            ? '#ef4444' // Red (Critical)
            : lineHealth === 'attention_required'
              ? '#F59E0B' // Yellow (Warning)
              : '#2563EB' // Blue (Healthy)

        const polyline = L.polyline(latlngs, {
          color: lineColor,
          weight: isSelected ? 6 : 4,
          opacity: 0.9,
          dashArray: hasAlert || asset.status === 'investigation' || asset.status === 'maintenance' ? '6 6' : undefined,
        }).addTo(map)
        polyline.bindPopup(buildPopupHtml(asset))
        polyline.on('click', () => onSelectAsset?.(asset.id))
        overlaysRef.current.push(polyline)
      }

      if (asset.asset_type === 'substation' && asset.geometry?.type === 'Polygon' && zoom >= 8) {
        const rings = asset.geometry.coordinates as number[][][]
        const latlngs = rings.map((ring) => toLatLngs(ring))
        const polygon = L.polygon(latlngs, {
          color: ring,
          weight: isSelected ? 3 : 2,
          fillColor: cfg.color,
          fillOpacity: 0.35,
        }).addTo(map)
        polygon.bindPopup(buildPopupHtml(asset))
        polygon.on('click', () => onSelectAsset?.(asset.id))
        overlaysRef.current.push(polygon)
      }

      const marker = L.marker([asset.latitude, asset.longitude], {
        icon: makeAssetIcon(asset, isSelected, hasAlert),
        zIndexOffset: asset.asset_type === 'substation' ? 300 : 200,
      })

      marker.bindPopup(buildPopupHtml(asset), { className: 'asset-popup', maxWidth: 280 })

      if (labelsVisible) {
        marker.bindTooltip(`${cfg.badge}: ${asset.name}`, {
          permanent: true,
          direction: 'top',
          offset: [0, -cfg.size / 2 - 8],
          className: 'asset-map-label',
        })
      }

      marker.on('click', () => onSelectAsset?.(asset.id))
      markerByIdRef.current.set(asset.id, marker)

      // Wildfire Risk overlay (Orange-red translucent circles)
      if (showWildfireRisk && (asset.health_score === 'critical' || asset.health_score === 'attention_required')) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#f97316',
          fillColor: '#ea580c',
          fillOpacity: 0.12,
          radius: 8000,
          weight: 1,
        }).addTo(map)
        overlaysRef.current.push(circle)
      }

      // Flood Hazard overlay (Cyan-blue translucent circles)
      const desc = (asset.description || '').toLowerCase()
      const name = (asset.name || '').toLowerCase()
      const isFloodProne =
        desc.includes('coastal') ||
        desc.includes('flood') ||
        desc.includes('river') ||
        name.includes('mum') ||
        name.includes('chn') ||
        name.includes('ennore') ||
        name.includes('mundra') ||
        name.includes('viz') ||
        name.includes('anakapalle')
      if (showFloodRisk && isFloodProne) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#06b6d4',
          fillColor: '#0891b2',
          fillOpacity: 0.12,
          radius: 12000,
          weight: 1,
        }).addTo(map)
        overlaysRef.current.push(circle)
      }

      // Heatmap Anomaly Density overlay
      if (activeLayers?.heatmap && hasAlert) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.18,
          radius: 20000,
          weight: 0,
        }).addTo(map)
        overlaysRef.current.push(circle)
      }

      if (asset.asset_type === 'substation') {
        clusterRef.current!.addLayer(marker)
      } else {
        marker.addTo(map)
      }
    })

    map.addLayer(clusterRef.current!)
  }, [
    filteredAssets,
    selectedAssetId,
    alertAssetIds,
    onSelectAsset,
    mapStatus,
    showLabels,
    filteredIds,
    zoomVersion,
    showWildfireRisk,
    showFloodRisk,
    activeLayers,
  ])

  // Fit map only when region or asset filters change — never on user zoom
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || filteredAssets.length === 0) return
    if (lastFitKeyRef.current === fitKey) return

    lastFitKeyRef.current = fitKey
    fitToRegion(regionFilter, filteredAssets)
    hasInitialFitRef.current = true
  }, [fitKey, mapStatus, regionFilter, filteredAssets, fitToRegion])

  // Fly to + open popup for selected asset
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || !selectedAssetId) return
    const asset = assets.find((a) => a.id === selectedAssetId)
    if (!asset || !typeFilters[asset.asset_type] || !passesRegionFilter(asset, regionFilter)) return

    map.flyTo([asset.latitude, asset.longitude], 11, { duration: 1.2 })
    const marker = markerByIdRef.current.get(selectedAssetId)
    if (marker) {
      setTimeout(() => marker.openPopup(), 1300)
    }
  }, [selectedAssetId, assets, mapStatus, typeFilters, regionFilter])

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full z-0" />

      {/* Layer switcher */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 shadow-lg border border-gray-700">
          <button
            type="button"
            onClick={() => setMapLayer('satellite')}
            className={`px-3 py-1.5 text-xs rounded-md transition ${mapLayer === 'satellite' ? 'bg-tams-primary text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('satellite-labels')}
            className={`px-3 py-1.5 text-xs rounded-md transition ${mapLayer === 'satellite-labels'
                ? 'bg-tams-primary text-white'
                : 'text-gray-300 hover:bg-gray-700'
              }`}
          >
            + Labels
          </button>
        </div>

        {/* Region focus */}
        <div className="flex flex-wrap gap-1 bg-gray-900 rounded-lg p-1 shadow-lg border border-gray-700">
          {(
            [
              ['india', `India (${indiaCount})`],
              ['world', `World (${worldSubCount})`],
              ['all', 'All'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRegionFilter(key)}
              className={`px-2.5 py-1.5 text-xs rounded-md transition ${regionFilter === key ? 'bg-tams-primary text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Asset type legend & filters */}
        <div className="bg-gray-900 rounded-lg p-3 shadow-lg border border-gray-700 text-xs min-w-[180px] max-h-[60vh] overflow-y-auto">
          <p className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Asset Types</p>
          {(Object.keys(ASSET_CONFIG) as AssetType[]).map((type) => {
            const cfg = ASSET_CONFIG[type]
            const count = assets.filter(
              (a) => a.asset_type === type && passesRegionFilter(a, regionFilter)
            ).length
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`flex items-center gap-2 w-full py-1.5 px-1 rounded transition ${typeFilters[type] ? 'opacity-100' : 'opacity-40'
                  } hover:bg-gray-800`}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: cfg.color }}
                />
                <span className="text-white font-medium">{cfg.label}</span>
                <span className="text-gray-500 ml-auto">({count})</span>
              </button>
            )
          })}

          {/* Risk Zones Overlay Toggles */}
          <div className="mt-3 border-t border-gray-700 pt-3 space-y-1.5">
            <p className="text-gray-400 font-semibold mb-1 uppercase tracking-wide">Risk Overlays</p>
            <button
              type="button"
              onClick={() => setShowWildfireRisk(!showWildfireRisk)}
              className={`flex items-center gap-2 w-full py-1.5 px-1 rounded transition-all duration-150 ${showWildfireRisk ? 'text-orange-400 font-medium bg-orange-500/5' : 'text-gray-400 hover:bg-gray-800'
                }`}
            >
              <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border transition-all ${showWildfireRisk ? 'bg-orange-500 border-orange-600' : 'border-gray-600 bg-transparent'}`}>
                {showWildfireRisk && '✓'}
              </span>
              <span>Wildfire Threat Zone</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFloodRisk(!showFloodRisk)}
              className={`flex items-center gap-2 w-full py-1.5 px-1 rounded transition-all duration-150 ${showFloodRisk ? 'text-cyan-400 font-medium bg-cyan-500/5' : 'text-gray-400 hover:bg-gray-800'
                }`}
            >
              <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border transition-all ${showFloodRisk ? 'bg-cyan-500 border-cyan-600' : 'border-gray-600 bg-transparent'}`}>
                {showFloodRisk && '✓'}
              </span>
              <span>Flood Hazard Zone</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            className="mt-2 w-full py-1.5 text-gray-300 hover:text-white border-t border-gray-700 pt-2 text-left"
          >
            {showLabels ? '✓ Name labels on (zoom 7+)' : '○ Name labels off'}
          </button>
          <p className="text-gray-500 mt-2 text-[10px] leading-relaxed">
            {indiaCount} substations across India · {worldSubCount} worldwide. Click cluster to expand.
          </p>
        </div>
      </div>

      {/* Bottom Map Status Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-[#0e172a]/95 border border-slate-800 rounded-xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-4 text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-slate-500 uppercase tracking-wider font-bold">Grid Coordinates:</span>
            <span className="text-slate-200">
              {cursorPoint ? `${cursorPoint.lat.toFixed(4)}, ${cursorPoint.lng.toFixed(4)}` : '0.0000, 0.0000'}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <span className="text-slate-500 uppercase tracking-wider font-bold">Zoom:</span>
            <span className="text-slate-200 ml-1">Lvl {mapRef.current ? mapRef.current.getZoom() : 6}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <span className="text-slate-500 uppercase tracking-wider font-bold">Selected:</span>
            <span className="text-blue-400 font-bold ml-1">
              {selectedAssetId ? (assets.find(a => a.id === selectedAssetId)?.name || selectedAssetId) : 'None'}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <span className="text-slate-500 uppercase tracking-wider font-bold">Satellite Pass:</span>
            <span className="text-slate-200 ml-1">4.5 Hrs Ago (Sentinel-2)</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <span className="text-slate-500 uppercase tracking-wider font-bold">Freshness:</span>
            <span className="text-emerald-400 font-bold ml-1">REAL-TIME</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-1">
            <span className="text-slate-500 uppercase tracking-wider font-bold">Status:</span>
            <span className="text-indigo-400 font-bold ml-1 uppercase">Active Feed</span>
          </div>
        </div>
      </div>

      {mapStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-[999]">
          <p className="text-gray-300 text-sm">Loading satellite imagery…</p>
        </div>
      )}

      {mapStatus === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-[999]">
          <p className="text-tams-danger text-sm">Failed to load map. Please refresh.</p>
        </div>
      )}
    </div>
  )
}
