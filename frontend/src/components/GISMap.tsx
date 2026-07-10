import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

import type { Asset } from '@/lib/api'
import { fetchGisTowers } from '@/lib/api'
import { assetMatchesPlace, filterAssetsByPlace } from '@/lib/placeFilter'
import {
  DEFAULT_PLACE_ID,
  getPlaceById,
  getStateFilterForPlace,
  INDIA_MAP_BOUNDS,
  placeShowsTowers,
} from '@/config/places'
import type { MapStatusSnapshot } from '@/types/mapStatus'

type MapLayer = 'satellite' | 'satellite-labels'
type AssetType = Asset['asset_type']

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

function voltageLineColor(kv: number | null | undefined): string {
  if (kv == null || Number.isNaN(kv)) return '#94a3b8'
  if (kv >= 765) return '#dc2626'
  if (kv >= 400) return '#ea580c'
  if (kv >= 220) return '#2563eb'
  if (kv >= 132) return '#0891b2'
  if (kv >= 66) return '#16a34a'
  return '#64748b'
}

function lineWeightForVoltage(kv: number | null | undefined, selected: boolean): number {
  const base = kv != null && kv >= 400 ? 4 : kv != null && kv >= 220 ? 3 : 2
  return selected ? base + 2 : base
}

function makeAssetIcon(asset: Asset, isSelected: boolean, hasAlert: boolean) {
  const cfg = ASSET_CONFIG[asset.asset_type]
  const ring = hasAlert ? '#f77f00' : healthColor(asset)
  const scale = isSelected ? 1.15 : 1
  const w = Math.round(cfg.size * scale)
  const h = Math.round(cfg.size * scale)
  const selectRing = isSelected ? 'outline:2px solid #fff;outline-offset:2px;' : ''

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
    html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;${selectRing}">
      <div style="border:3px solid ${ring};border-radius:6px;padding:2px;background:rgba(0,0,0,0.35);position:relative;">
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

function healthPct(asset: Asset): number {
  if (asset.health_score === 'healthy') return 96
  if (asset.health_score === 'attention_required') return 72
  if (asset.health_score === 'critical') return 38
  return 85
}

function buildPopupHtml(asset: Asset): string {
  const meta = asset.metadata || {}
  const voltageRaw = meta.voltage_kv ?? meta.voltage
  const voltage =
    typeof voltageRaw === 'number'
      ? `${voltageRaw} kV`
      : typeof voltageRaw === 'string' && voltageRaw
        ? `${Number(voltageRaw) > 1000 ? Number(voltageRaw) / 1000 : voltageRaw} kV`
        : '—'
  const statusLabel =
    asset.health_score === 'healthy'
      ? 'Healthy'
      : asset.health_score === 'attention_required'
        ? 'Warning'
        : asset.health_score === 'critical'
          ? 'Critical'
          : 'Active'
  const statusColor =
    asset.health_score === 'healthy'
      ? '#34d399'
      : asset.health_score === 'attention_required'
        ? '#fbbf24'
        : asset.health_score === 'critical'
          ? '#f87171'
          : '#94a3b8'
  const osmId = meta.osm_id ? String(meta.osm_id) : '—'
  const power = meta.power ? String(meta.power) : asset.asset_type
  const state = meta.country_or_state ? String(meta.country_or_state) : 'India'
  const operator = meta.operator ? String(meta.operator) : '—'
  const lengthKm = typeof meta.length_km === 'number' ? `${meta.length_km} km` : null
  return `<div style="padding:14px 16px;min-width:260px;font-family:system-ui,sans-serif">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:16px">⚡</span>
      <div style="font-weight:800;font-size:14px;color:#f8fafc;letter-spacing:0.02em">${asset.name}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;font-size:11px;margin-bottom:12px">
      <div><div style="color:#64748b;font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px">Type</div><div style="font-weight:800;color:#e2e8f0">${power}</div></div>
      <div><div style="color:#64748b;font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px">Voltage</div><div style="font-family:ui-monospace,monospace;font-weight:800;color:#e2e8f0">${voltage}</div></div>
      <div><div style="color:#64748b;font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px">State</div><div style="font-weight:800;color:#e2e8f0">${state}</div></div>
      <div><div style="color:#64748b;font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px">Status</div><div style="font-weight:800;color:${statusColor}">${statusLabel}</div></div>
      <div><div style="color:#64748b;font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px">OSM ID</div><div style="font-family:ui-monospace,monospace;font-weight:800;color:#e2e8f0">${osmId}</div></div>
      <div><div style="color:#64748b;font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px">Operator</div><div style="font-weight:800;color:#e2e8f0">${operator}</div></div>
      ${lengthKm ? `<div style="grid-column:1/-1"><div style="color:#64748b;font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px">Corridor length</div><div style="font-family:ui-monospace,monospace;font-weight:800;color:#e2e8f0">${lengthKm}</div></div>` : ''}
    </div>
    <div style="font-size:9px;color:#64748b;margin-bottom:10px">Source: indian_KML / OSM transmission data</div>
    <div style="display:flex;gap:8px">
      <button type="button" data-asset-action="view" data-asset-id="${asset.id}" style="flex:1;padding:8px 12px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:11px;font-weight:800;cursor:pointer">View</button>
      <button type="button" data-asset-action="analytics" data-asset-id="${asset.id}" style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:11px;font-weight:800;cursor:pointer">Analytics</button>
    </div>
  </div>`
}

function clusterHealthColor(markers: L.Marker[]): string {
  let worst = 0
  markers.forEach((m) => {
    const asset = (m as L.Marker & { assetRef?: Asset }).assetRef
    if (!asset) return
    if (asset.health_score === 'critical') worst = Math.max(worst, 3)
    else if (asset.health_score === 'attention_required') worst = Math.max(worst, 2)
    else worst = Math.max(worst, 1)
  })
  if (worst >= 3) return 'linear-gradient(135deg,#dc2626,#ef4444)'
  if (worst >= 2) return 'linear-gradient(135deg,#d97706,#f59e0b)'
  return 'linear-gradient(135deg,#059669,#10b981)'
}

function clusterHealthGlow(markers: L.Marker[]): string {
  let worst = 0
  markers.forEach((m) => {
    const asset = (m as L.Marker & { assetRef?: Asset }).assetRef
    if (!asset) return
    if (asset.health_score === 'critical') worst = Math.max(worst, 3)
    else if (asset.health_score === 'attention_required') worst = Math.max(worst, 2)
    else worst = Math.max(worst, 1)
  })
  if (worst >= 3) return 'rgba(239,68,68,0.55)'
  if (worst >= 2) return 'rgba(245,158,11,0.5)'
  return 'rgba(16,185,129,0.45)'
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
  onMapStatusChange,
  suppressInternalStatusBar = false,
  onMapReady,
  selectedPlaceId = DEFAULT_PLACE_ID,
  heatMapMode = 'normal',
  typeFilters: externalTypeFilters,
  showLabels: externalShowLabels,
  showWildfireRisk = false,
  showFloodRisk = false,
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
  onMapStatusChange?: (status: MapStatusSnapshot) => void
  suppressInternalStatusBar?: boolean
  onMapReady?: (api: { zoomIn: () => void; zoomOut: () => void }) => void
  selectedPlaceId?: string
  heatMapMode?: string
  typeFilters?: Record<AssetType, boolean>
  showLabels?: boolean
  showWildfireRisk?: boolean
  showFloodRisk?: boolean
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
  const showLabels = externalShowLabels ?? true
  const [zoomVersion, setZoomVersion] = useState(0)
  const [cursorPoint, setCursorPoint] = useState<{ lat: number; lng: number } | null>(null)
  const typeFilters = externalTypeFilters ?? {
    tower: true,
    substation: true,
    line: true,
  }

  const [viewportTowers, setViewportTowers] = useState<Asset[]>([])
  const [towersLoading, setTowersLoading] = useState(false)
  const towerFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadViewportTowersRef = useRef<() => void>(() => { })

  const wildfireOn = showWildfireRisk || Boolean(activeLayers?.riskOverlay || heatMapMode === 'ai-risk')
  const floodOn = showFloodRisk || Boolean(activeLayers?.riskOverlay || heatMapMode === 'flood')

  const showTowers = placeShowsTowers(selectedPlaceId) && typeFilters.tower

  const filteredAssets = useMemo(() => {
    const base = filterAssetsByPlace(assets, selectedPlaceId).filter((a) => {
      if (a.asset_type === 'tower') return false
      return typeFilters[a.asset_type]
    })
    if (!showTowers) return base
    const towers = viewportTowers.filter((t) => assetMatchesPlace(t, selectedPlaceId))
    return [...base, ...towers]
  }, [assets, typeFilters, selectedPlaceId, viewportTowers, showTowers])
  // Fit only on place / type filters — not when viewport towers refresh
  const corridorIds = useMemo(
    () =>
      filterAssetsByPlace(assets, selectedPlaceId)
        .filter((a) => a.asset_type !== 'tower' && typeFilters[a.asset_type])
        .map((a) => a.id)
        .join(','),
    [assets, selectedPlaceId, typeFilters]
  )
  const fitKey = `${selectedPlaceId}:${corridorIds}`

  const loadViewportTowers = useCallback(() => {
    const map = mapRef.current
    if (!map || !showTowers) {
      setViewportTowers([])
      return
    }
    const zoom = map.getZoom()
    // Dense towers only when zoomed in enough; sample more at higher zoom
    const limit = zoom >= 11 ? 8000 : zoom >= 9 ? 5000 : zoom >= 7 ? 3000 : 1500
    const bounds = map.getBounds()
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
    const state = getStateFilterForPlace(selectedPlaceId)
    setTowersLoading(true)
    fetchGisTowers(bbox, state === 'Gujarat' ? 'Gujarat' : undefined, limit)
      .then((towers) => setViewportTowers(towers))
      .catch(() => setViewportTowers([]))
      .finally(() => setTowersLoading(false))
  }, [selectedPlaceId, showTowers])

  useEffect(() => {
    loadViewportTowersRef.current = loadViewportTowers
  }, [loadViewportTowers])

  useEffect(() => {
    if (!showTowers) {
      setViewportTowers([])
      return
    }
    if (towerFetchRef.current) clearTimeout(towerFetchRef.current)
    towerFetchRef.current = setTimeout(loadViewportTowers, 350)
    return () => {
      if (towerFetchRef.current) clearTimeout(towerFetchRef.current)
    }
  }, [loadViewportTowers, showTowers, zoomVersion, selectedPlaceId])

  // Sync basemap layer with activeLayers
  useEffect(() => {
    if (activeLayers) {
      setMapLayer(activeLayers.satellite && showLabels ? 'satellite-labels' : 'satellite')
    }
  }, [activeLayers, showLabels])

  const fitToPlace = useCallback(
    (placeId: string, assetList: Asset[]) => {
      const map = mapRef.current
      if (!map) return

      const place = getPlaceById(placeId)
      if (place?.bounds) {
        const [[south, west], [north, east]] = place.bounds
        map.fitBounds(
          L.latLngBounds([south, west], [north, east]),
          { padding: [50, 50], maxZoom: placeId === 'india' ? 6 : placeId === 'gujarat' ? 8 : 11 }
        )
        return
      }

      if (assetList.length === 0) return
      const bounds = collectBounds(assetList)
      if (!bounds) return
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 })
    },
    []
  )

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
        center: [22.5, 72.5],
        zoom: 7,
        zoomControl: false,
        maxBounds: L.latLngBounds(
          [INDIA_MAP_BOUNDS[0][0], INDIA_MAP_BOUNDS[0][1]],
          [INDIA_MAP_BOUNDS[1][0], INDIA_MAP_BOUNDS[1][1]]
        ),
        maxBoundsViscosity: 0.85,
        minZoom: 5,
      })

      L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)

      onMapReady?.({
        zoomIn: () => map.zoomIn(),
        zoomOut: () => map.zoomOut(),
      })

      const layer = buildTileLayer('satellite-labels')
      layer.addTo(map)
      tileLayerRef.current = layer
      mapRef.current = map
      setMapStatus('ready')

      // Refresh labels/footprints on zoom — do NOT reset map bounds
      map.on('zoomend', () => {
        setZoomVersion((v) => v + 1)
        loadViewportTowersRef.current()
      })

      map.on('moveend', () => {
        if (towerFetchRef.current) clearTimeout(towerFetchRef.current)
        towerFetchRef.current = setTimeout(() => loadViewportTowersRef.current(), 300)
      })

      map.on('mousemove', (e) => {
        setCursorPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      })

      map.on('click', (e) => {
        const lat = e.latlng.lat
        const lng = e.latlng.lng
        flyToCoordinates(lat, lng, 'map_click')
      })

      const isMapAlive = () => mapRef.current === map && Boolean(map.getPane('mapPane'))
      const safeInvalidate = () => {
        if (isMapAlive()) safeInvalidateMapSize(map)
      }

      map.whenReady(() => {
        requestAnimationFrame(() => safeInvalidate())
      })
      const invalidateTimer = setTimeout(safeInvalidate, 100)
      const onResize = () => safeInvalidate()
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
    if (!onMapStatusChange || mapStatus !== 'ready') return
    onMapStatusChange({
      coordinates: cursorPoint,
      zoom: mapRef.current?.getZoom() ?? null,
      viewMode: '2d',
    })
  }, [cursorPoint, zoomVersion, mapStatus, onMapStatusChange])

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
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 12,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        const size = count > 100 ? 48 : count > 50 ? 44 : count > 15 ? 38 : 32
        const childMarkers = cluster.getAllChildMarkers() as L.Marker[]
        const bg = clusterHealthColor(childMarkers)
        const glow = clusterHealthGlow(childMarkers)
        return L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:10px;
            display:flex;align-items:center;justify-content:center;
            background:${bg};
            border:2px solid rgba(255,255,255,0.9);
            box-shadow:0 0 16px ${glow},0 6px 14px rgba(0,0,0,0.4);
            color:#fff;font-weight:800;font-size:${size > 38 ? 13 : 11}px;
            font-family:ui-monospace,monospace;
          ">${count}</div>`,
          className: '',
          iconSize: L.point(size, size),
        })
      },
    })
    markerByIdRef.current.clear()
    overlaysRef.current.forEach((o) => o.remove())
    overlaysRef.current = []

    const zoom = map.getZoom()
    const labelsVisible = showLabels && zoom >= 10
    const compactTowers = zoom < 10

    filteredAssets.forEach((asset) => {
      const isSelected = asset.id === selectedAssetId
      const hasAlert = alertAssetIds.includes(asset.id)
      const cfg = ASSET_CONFIG[asset.asset_type]
      const ring = healthColor(asset)

      if (asset.asset_type === 'line' && asset.geometry?.type === 'LineString') {
        if (activeLayers && !activeLayers.corridors) return
        const latlngs = toLatLngs(asset.geometry.coordinates as number[][])
        const kvRaw = asset.metadata?.voltage_kv
        const kv = typeof kvRaw === 'number' ? kvRaw : typeof kvRaw === 'string' ? Number(kvRaw) : null
        const lineHealth = asset.health_score || 'healthy'
        const lineColor =
          hasAlert || lineHealth === 'critical'
            ? '#ef4444'
            : lineHealth === 'attention_required'
              ? '#F59E0B'
              : voltageLineColor(kv)

        const polyline = L.polyline(latlngs, {
          color: lineColor,
          weight: lineWeightForVoltage(kv, isSelected),
          opacity: kv != null && kv >= 220 ? 0.95 : 0.75,
          dashArray: kv != null && kv >= 400 ? undefined : '8 6',
          className: 'tams-line-flow',
        }).addTo(map)
        polyline.bindPopup(buildPopupHtml(asset))
        polyline.on('click', () => onSelectAsset?.(asset.id))
        overlaysRef.current.push(polyline)
        return
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

      // Compact tower dots at overview zoom — full icons when zoomed in
      let marker: L.Marker & { assetRef?: Asset }
      if (asset.asset_type === 'tower' && compactTowers) {
        marker = L.marker([asset.latitude, asset.longitude], {
          icon: L.divIcon({
            className: '',
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            html: `<div style="width:10px;height:10px;border-radius:50%;background:${cfg.color};border:1.5px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
          }),
          zIndexOffset: 150,
        }) as L.Marker & { assetRef?: Asset }
      } else {
        marker = L.marker([asset.latitude, asset.longitude], {
          icon: makeAssetIcon(asset, isSelected, hasAlert),
          zIndexOffset: asset.asset_type === 'substation' ? 300 : 200,
        }) as L.Marker & { assetRef?: Asset }
      }
      marker.assetRef = asset

      marker.bindPopup(buildPopupHtml(asset), { className: 'asset-popup', maxWidth: 280 })

      if (labelsVisible && asset.asset_type !== 'tower') {
        marker.bindTooltip(`${cfg.badge}: ${asset.name}`, {
          permanent: true,
          direction: 'top',
          offset: [0, -cfg.size / 2 - 8],
          className: 'asset-map-label',
        })
      }

      marker.on('click', () => onSelectAsset?.(asset.id))
      markerByIdRef.current.set(asset.id, marker)

      // Wildfire Risk overlay — thin outline only
      if (wildfireOn && (asset.health_score === 'critical' || asset.health_score === 'attention_required')) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#f97316',
          fillColor: '#ea580c',
          fillOpacity: 0,
          radius: 5000,
          weight: 1,
          opacity: 0.45,
          dashArray: '6 8',
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
      if (floodOn && isFloodProne) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#06b6d4',
          fillColor: '#0891b2',
          fillOpacity: 0,
          radius: 6000,
          weight: 1,
          opacity: 0.4,
          dashArray: '6 8',
        }).addTo(map)
        overlaysRef.current.push(circle)
      }

      // Heatmap Anomaly Density overlay
      if ((activeLayers?.heatmap || heatMapMode === 'heatmap') && hasAlert) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.04,
          radius: 4000,
          weight: 1,
          opacity: 0.35,
        }).addTo(map)
        overlaysRef.current.push(circle)
      }

      // Cluster towers + substations for accurate Gujarat density visibility
      if (asset.asset_type === 'tower' || asset.asset_type === 'substation') {
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
    zoomVersion,
    wildfireOn,
    floodOn,
    activeLayers,
    heatMapMode,
  ])

  // Fit map only when region or asset filters change — never on user zoom
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || filteredAssets.length === 0) return
    if (lastFitKeyRef.current === fitKey) return

    lastFitKeyRef.current = fitKey
    fitToPlace(selectedPlaceId, filteredAssets)
    hasInitialFitRef.current = true
  }, [fitKey, mapStatus, selectedPlaceId, filteredAssets, fitToPlace])

  // Fly to + open popup for selected asset
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || !selectedAssetId) return
    const asset =
      assets.find((a) => a.id === selectedAssetId) ||
      viewportTowers.find((a) => a.id === selectedAssetId) ||
      filteredAssets.find((a) => a.id === selectedAssetId)
    if (!asset || !typeFilters[asset.asset_type] || !assetMatchesPlace(asset, selectedPlaceId)) return

    map.flyTo([asset.latitude, asset.longitude], Math.max(map.getZoom(), 12), { duration: 1.2 })
    const marker = markerByIdRef.current.get(selectedAssetId)
    if (marker) {
      setTimeout(() => marker.openPopup(), 1300)
    }
  }, [selectedAssetId, assets, viewportTowers, filteredAssets, mapStatus, typeFilters, selectedPlaceId])

  // Popup action buttons → open asset drawer
  useEffect(() => {
    const onPopupClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const btn = target.closest('[data-asset-action]') as HTMLElement | null
      if (!btn) return
      const id = btn.getAttribute('data-asset-id')
      if (id) onSelectAsset?.(id)
    }
    document.addEventListener('click', onPopupClick)
    return () => document.removeEventListener('click', onPopupClick)
  }, [onSelectAsset])

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full z-0" />

      {/* Bottom Map Status Bar */}
      {!suppressInternalStatusBar && (
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
            {showTowers && (
              <>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="text-slate-500 uppercase tracking-wider font-bold">Towers:</span>
                  <span className={`ml-1 font-bold ${towersLoading ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {towersLoading ? 'Loading…' : `${viewportTowers.length.toLocaleString()} in view`}
                  </span>
                </div>
              </>
            )}
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
      )}

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
