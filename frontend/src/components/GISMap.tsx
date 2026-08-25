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
  placeShowsTowers,
} from '@/config/places'
import type { MapStatusSnapshot } from '@/types/mapStatus'
import {
  EOX_SENTINEL_URL,
  GOOGLE_LABELS_URL,
  GOOGLE_SATELLITE_URL,
  GOOGLE_SUBDOMAINS,
  GOOGLE_TERRAIN_URL,
  HIGH_ZOOM,
  IMAGERY_REVISION,
  OSM_STREET_URL,
  type BasemapKind,
} from '@/lib/basemapTiles'
import { withTowerNeOffset } from '@/lib/towerPosition'

type MapLayer = BasemapKind
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
  const common = {
    subdomains: [...GOOGLE_SUBDOMAINS],
    maxZoom: HIGH_ZOOM.maxZoom,
    maxNativeZoom: HIGH_ZOOM.maxNativeZoom,
    updateWhenIdle: false,
    keepBuffer: 2,
    crossOrigin: true as const,
  }

  if (layer === 'street') {
    return L.tileLayer(OSM_STREET_URL, {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      crossOrigin: true,
    })
  }

  if (layer === 'terrain') {
    return L.layerGroup([
      L.tileLayer(GOOGLE_TERRAIN_URL, {
        ...common,
        attribution: '© Google',
      }),
    ])
  }

  // Satellite: Google primary (high zoom). EOX Sentinel underneath as fill if Google gaps.
  const satelliteBase = L.layerGroup([
    L.tileLayer(EOX_SENTINEL_URL, {
      maxZoom: HIGH_ZOOM.maxZoom,
      maxNativeZoom: 18,
      attribution: '© EOX Sentinel-2',
      crossOrigin: true,
    }),
    L.tileLayer(GOOGLE_SATELLITE_URL, {
      ...common,
      attribution: '© Google',
      opacity: 1,
      zIndex: 1,
    }),
  ])

  if (layer === 'satellite') {
    return satelliteBase
  }

  // satellite-labels: Google sat + labels on top of Sentinel backup
  return L.layerGroup([
    L.tileLayer(EOX_SENTINEL_URL, {
      maxZoom: HIGH_ZOOM.maxZoom,
      maxNativeZoom: 18,
      attribution: '© EOX Sentinel-2',
      crossOrigin: true,
    }),
    L.tileLayer(GOOGLE_SATELLITE_URL, {
      ...common,
      attribution: '© Google',
    }),
    L.tileLayer(GOOGLE_LABELS_URL, {
      ...common,
      opacity: 0.95,
      attribution: '© Google',
      zIndex: 2,
    }),
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

function lineWeightForVoltage(
  kv: number | null | undefined,
  selected: boolean,
  explorerOverview = false
): number {
  // Keep low-voltage corridors (11–66 kV) visible at Gujarat overview zoom
  let base =
    kv != null && kv >= 400 ? 4.5 : kv != null && kv >= 220 ? 3.5 : kv != null && kv >= 66 ? 2.75 : 2.5
  // India explorer: thicken EHV so national backbone reads at low zoom
  if (explorerOverview && kv != null && kv >= 400) base += 1.75
  else if (explorerOverview && kv != null && kv >= 220) base += 0.75
  return selected ? base + 2 : base
}

/** Bucket a kV value into the panel's voltage-class filter keys. */
function voltageClassKey(kv: number | null | undefined): string {
  if (kv == null || Number.isNaN(kv)) return 'other'
  if (kv >= 765) return '765'
  if (kv >= 400) return '400'
  if (kv >= 220) return '220'
  if (kv >= 132) return '132'
  if (kv >= 66) return '66'
  return 'other'
}

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function bearingBetween(a: L.LatLng, b: L.LatLng): number {
  const p1 = (a.lat * Math.PI) / 180
  const p2 = (b.lat * Math.PI) / 180
  const dl = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Human-readable power-flow direction from corridor endpoints. */
function flowDirectionLabel(latlngs: L.LatLngExpression[]): string {
  if (latlngs.length < 2) return ''
  const start = L.latLng(latlngs[0])
  const end = L.latLng(latlngs[latlngs.length - 1])
  const bearing = bearingBetween(start, end)
  const to = COMPASS_8[Math.round(bearing / 45) % 8]
  const from = COMPASS_8[Math.round(((bearing + 180) % 360) / 45) % 8]
  return `${from} → ${to}`
}

function lineMidLatLng(latlngs: L.LatLngExpression[]): L.LatLng {
  const mid = latlngs[Math.floor(latlngs.length / 2)]
  return L.latLng(mid)
}

function directionEndpointIcon(label: string, caption: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    html: `<div style="display:flex;flex-direction:column;align-items:center;font-family:system-ui,sans-serif">
      <div style="
        width:24px;height:24px;border-radius:6px;background:#0A0A0A;border:2px solid #22D3EE;
        color:#22D3EE;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;
      ">${label}</div>
      <div style="
        margin-top:2px;padding:1px 5px;border-radius:3px;background:#0A0A0A;border:1px solid #22D3EE;
        color:#e2e8f0;font-size:8px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;
      ">${caption}</div>
    </div>`,
  })
}

const MISSION_FOCUS_COLOR = '#22D3EE' // bright cyan — center stroke
const MISSION_FOCUS_BORDER = '#0A0A0A' // very dark black casing — easy to spot on map

function makeAssetIcon(asset: Asset, isSelected: boolean, hasAlert: boolean, isMissionFocus = false) {
  const cfg = ASSET_CONFIG[asset.asset_type]
  const fillColor = isMissionFocus ? MISSION_FOCUS_COLOR : cfg.color
  const ring = isMissionFocus ? MISSION_FOCUS_COLOR : hasAlert ? '#f77f00' : healthColor(asset)
  const scale = isMissionFocus || isSelected ? 1.2 : 1
  const w = Math.round(cfg.size * scale)
  const h = Math.round(cfg.size * scale)
  const selectRing = isMissionFocus
    ? `outline:3px solid ${MISSION_FOCUS_BORDER};outline-offset:2px;border-radius:8px;`
    : isSelected
      ? 'outline:2px solid #fff;outline-offset:2px;'
      : ''

  let symbol = ''
  if (asset.asset_type === 'tower') {
    symbol = `<svg width="${w}" height="${h}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 28,28 4,28" fill="${fillColor}" stroke="${isMissionFocus ? MISSION_FOCUS_BORDER : '#fff'}" stroke-width="${isMissionFocus ? 3.5 : 2}"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="#fff" stroke-width="1.5"/>
      <line x1="12" y1="24" x2="20" y2="24" stroke="#fff" stroke-width="1.5"/>
    </svg>`
  } else if (asset.asset_type === 'substation') {
    symbol = `<svg width="${w}" height="${h}" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="30" height="30" rx="4" fill="${fillColor}" stroke="${isMissionFocus ? MISSION_FOCUS_BORDER : '#fff'}" stroke-width="${isMissionFocus ? 3.5 : 2}"/>
      <rect x="8" y="8" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="20" y="8" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="8" y="20" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <rect x="20" y="20" width="8" height="8" fill="none" stroke="#fff" stroke-width="1.5"/>
      <text x="18" y="6" text-anchor="middle" fill="#fff" font-size="5" font-weight="bold">SUB</text>
    </svg>`
  } else {
    symbol = `<svg width="${w}" height="${h}" viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="10" x2="30" y2="10" stroke="${isMissionFocus ? MISSION_FOCUS_BORDER : fillColor}" stroke-width="${isMissionFocus ? 9 : 4}" stroke-linecap="round"/>
      <line x1="2" y1="10" x2="30" y2="10" stroke="${fillColor}" stroke-width="${isMissionFocus ? 4 : 4}" stroke-linecap="round"/>
      <circle cx="16" cy="10" r="5" fill="${fillColor}" stroke="${isMissionFocus ? MISSION_FOCUS_BORDER : '#fff'}" stroke-width="2.5"/>
    </svg>`
  }

  const labelH = 18
  const totalH = h + labelH + 4
  const labelBorder = isMissionFocus ? MISSION_FOCUS_BORDER : 'rgba(255,255,255,0.2)'
  const labelBg = isMissionFocus ? '#0A0A0A' : 'rgba(17,24,39,0.92)'

  return L.divIcon({
    className: '',
    iconSize: [Math.max(w, 90), totalH],
    iconAnchor: [Math.max(w, 90) / 2, h / 2],
    html: `<div class="tams-asset-marker${isSelected ? ' tams-asset-selected' : ''}${isMissionFocus ? ' tams-asset-focus-ring' : ''}" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;${selectRing}">
      <div style="border:3px solid ${ring};border-radius:6px;padding:2px;background:rgba(0,0,0,0.45);position:relative;">
        ${symbol}
      </div>
      <div style="
        margin-top:3px;
        background:${labelBg};
        color:#fff;
        font-size:10px;
        font-weight:700;
        padding:2px 6px;
        border-radius:4px;
        white-space:nowrap;
        border:1px solid ${labelBorder};
        max-width:110px;
        overflow:hidden;
        text-overflow:ellipsis;
      ">${isMissionFocus ? '◎ ' : ''}${asset.name}</div>
      <div style="
        font-size:9px;
        color:${isMissionFocus ? MISSION_FOCUS_COLOR : cfg.color};
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:0.5px;
      ">${isMissionFocus ? 'FOCUSED' : cfg.badge}</div>
    </div>`,
  })
}

function buildMinimalPopupHtml(asset: Asset): string {
  const typeLabel =
    asset.asset_type === 'tower'
      ? 'Tower'
      : asset.asset_type === 'line'
        ? 'Transmission Line'
        : asset.asset_type === 'substation'
          ? 'Substation'
          : String(asset.asset_type)
  const state = asset.metadata?.country_or_state ? String(asset.metadata.country_or_state) : null
  const name = asset.name || asset.id
  const lat = Number.isFinite(asset.latitude) ? asset.latitude.toFixed(2) : '—'
  const lon = Number.isFinite(asset.longitude) ? asset.longitude.toFixed(2) : '—'
  return `<div style="padding:10px 12px;max-width:220px;font-family:system-ui,sans-serif">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:14px">⚡</span>
      <div style="font-weight:800;font-size:12px;color:#f8fafc;line-height:1.25">${name}</div>
    </div>
    <div style="font-size:10px;color:#94a3b8;line-height:1.6">
      <div>Type: <span style="color:#e2e8f0;font-weight:700">${typeLabel}</span></div>
      <div>ID: <span style="font-family:ui-monospace,monospace;color:#e2e8f0">${asset.id}</span></div>
      <div>Location: <span style="font-family:ui-monospace,monospace;color:#e2e8f0">${lat}, ${lon}</span></div>
      ${state ? `<div>State: <span style="color:#e2e8f0;font-weight:700">${state}</span></div>` : ''}
    </div>
  </div>`
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
  voltageFilters,
  substationVoltageFilters,
  showLabels: externalShowLabels,
  showWildfireRisk = false,
  showFloodRisk = false,
  focusTarget = null,
  onFocusConsumed,
  highlightAssetId = null,
  interactionMode = 'operations',
  cinematicReady = true,
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
  voltageFilters?: Record<string, boolean>
  substationVoltageFilters?: Record<string, boolean>
  showLabels?: boolean
  showWildfireRisk?: boolean
  showFloodRisk?: boolean
  focusTarget?: { id: string; latitude: number; longitude: number } | null
  onFocusConsumed?: () => void
  /** Unique color highlight after mission-report View */
  highlightAssetId?: string | null
  interactionMode?: 'explorer' | 'operations'
  /** When false, hold India fly-in until Earth intro overlay finishes. */
  cinematicReady?: boolean
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
  const introDoneRef = useRef(false)
  const lastSelectedFlyRef = useRef<string | null>(null)
  const towerRequestIdRef = useRef(0)
  const cursorRafRef = useRef<number>(0)
  const statusThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const lastAssetClickRef = useRef<{ id: string; t: number } | null>(null)
  const isExplorer = interactionMode === 'explorer' || selectedPlaceId === 'india'

  const [viewportTowers, setViewportTowers] = useState<Asset[]>([])
  const [towersLoading, setTowersLoading] = useState(false)
  const towerFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadViewportTowersRef = useRef<() => void>(() => { })

  const wildfireOn = showWildfireRisk || Boolean(activeLayers?.riskOverlay || heatMapMode === 'ai-risk')
  const floodOn = showFloodRisk || Boolean(activeLayers?.riskOverlay || heatMapMode === 'flood')
  const corridorsOn = activeLayers?.corridors !== false
  const heatmapOn = Boolean(activeLayers?.heatmap || heatMapMode === 'heatmap')
  const alertIdSet = useMemo(() => new Set(alertAssetIds), [alertAssetIds])
  const alertIdsKey = useMemo(() => [...alertIdSet].sort().join(','), [alertIdSet])
  const voltageFilterKey = useMemo(
    () =>
      voltageFilters
        ? Object.entries(voltageFilters)
            .map(([k, v]) => `${k}:${v ? 1 : 0}`)
            .join('|')
        : '',
    [voltageFilters]
  )

  const showTowers = placeShowsTowers(selectedPlaceId) && typeFilters.tower

  const filteredAssets = useMemo(() => {
    const base = filterAssetsByPlace(assets, selectedPlaceId).filter((a) => {
      if (a.asset_type === 'tower') return false
      if (!typeFilters[a.asset_type]) return false
      // Substation voltage sub-class filter
      if (a.asset_type === 'substation' && substationVoltageFilters) {
        const kvRaw = a.metadata?.voltage_kv
        const kv = typeof kvRaw === 'number' ? kvRaw : typeof kvRaw === 'string' ? Number(kvRaw) : null
        if (substationVoltageFilters[voltageClassKey(kv)] === false) return false
      }
      return true
    })
    if (!showTowers) return base
    const towers = viewportTowers.filter((t) => assetMatchesPlace(t, selectedPlaceId))
    return [...base, ...towers]
  }, [assets, typeFilters, substationVoltageFilters, selectedPlaceId, viewportTowers, showTowers])
  // Fit only on place / type filters — not when viewport towers refresh
  const corridorIds = useMemo(
    () =>
      filterAssetsByPlace(assets, selectedPlaceId)
        .filter((a) => a.asset_type !== 'tower' && typeFilters[a.asset_type])
        .map((a) => a.id)
        .join(','),
    [assets, selectedPlaceId, typeFilters]
  )
  // Fit only when the region changes — not when filter/voltage toggles change corridors
  const fitKey = selectedPlaceId
  void corridorIds

  const loadViewportTowers = useCallback(() => {
    const map = mapRef.current
    if (!map || !showTowers) {
      setViewportTowers([])
      return
    }
    const zoom = map.getZoom()
    const bounds = map.getBounds()
    const west = bounds.getWest()
    const east = bounds.getEast()
    const south = bounds.getSouth()
    const north = bounds.getNorth()
    // Skip world-size / country-zoom requests — they hang cold KML and cause 502s.
    // Explorer: require zoom >= 8; state ops keep zoom >= 7.
    const minTowerZoom = isExplorer ? 8 : 7
    if (east - west > 12 || north - south > 10 || zoom < minTowerZoom) {
      setViewportTowers([])
      setTowersLoading(false)
      return
    }
    // Keep tower counts interactive — denser only when tightly zoomed
    const limit = zoom >= 13 ? 2200 : zoom >= 11 ? 1600 : zoom >= 9 ? 1000 : 600
    const bbox = `${west},${south},${east},${north}`
    const state = getStateFilterForPlace(selectedPlaceId)

    towerRequestIdRef.current += 1
    const requestId = towerRequestIdRef.current

    setTowersLoading(true)
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), 45_000)
    fetchGisTowers(bbox, state, limit, controller.signal)
      .then((res) => {
        if (requestId !== towerRequestIdRef.current) return
        setViewportTowers(res.assets)
      })
      .catch(() => {
        if (requestId !== towerRequestIdRef.current) return
        setViewportTowers([])
      })
      .finally(() => {
        window.clearTimeout(abortTimer)
        if (requestId !== towerRequestIdRef.current) return
        setTowersLoading(false)
      })
  }, [selectedPlaceId, showTowers, isExplorer])

  useEffect(() => {
    loadViewportTowersRef.current = loadViewportTowers
  }, [loadViewportTowers])

  useEffect(() => {
    if (!showTowers) {
      towerRequestIdRef.current += 1
      setViewportTowers([])
      return
    }
    if (towerFetchRef.current) clearTimeout(towerFetchRef.current)
    towerFetchRef.current = setTimeout(loadViewportTowers, 550)
    return () => {
      if (towerFetchRef.current) clearTimeout(towerFetchRef.current)
    }
  }, [loadViewportTowers, showTowers, zoomVersion, selectedPlaceId])

  // Sync basemap layer with activeLayers / toolbar mode
  useEffect(() => {
    if (!activeLayers) return
    if (activeLayers.terrain) {
      setMapLayer('terrain')
      return
    }
    if (activeLayers.satellite === false && !activeLayers.terrain) {
      // street / non-satellite mode when satellite toggled off
      setMapLayer('street')
      return
    }
    setMapLayer(showLabels ? 'satellite-labels' : 'satellite')
  }, [activeLayers?.satellite, activeLayers?.terrain, showLabels, activeLayers])

  const fitToPlace = useCallback(
    (placeId: string, assetList: Asset[]) => {
      const map = mapRef.current
      if (!map) return

      const place = getPlaceById(placeId)
      if (place?.bounds) {
        const [[south0, west0], [north0, east0]] = place.bounds
        // Pad ~4% so north/south/east/west edges of the state stay in view
        const padLat = Math.max((north0 - south0) * 0.04, 0.05)
        const padLon = Math.max((east0 - west0) * 0.04, 0.05)
        const south = south0 - padLat
        const north = north0 + padLat
        const west = west0 - padLon
        const east = east0 + padLon
        // States: keep zoomed out enough to see full boundary; cities can go closer
        const maxZoom = placeId === 'india' ? 6 : place.stateOrCountry ? 8 : 12
        map.flyToBounds(
          L.latLngBounds([south, west], [north, east]),
          { padding: [56, 56], maxZoom, duration: 0.72, easeLinearity: 0.25 }
        )
        return
      }

      if (assetList.length === 0) return
      const bounds = collectBounds(assetList)
      if (!bounds) return
      map.flyToBounds(bounds, { padding: [56, 56], maxZoom: 8, duration: 0.72, easeLinearity: 0.25 })
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

      // Click pins settle without stealing the view; GPS/manual still fly in
      if (source !== 'map_click') {
        map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.65, easeLinearity: 0.25 })
      }

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
      if (source !== 'map_click') {
        setTimeout(() => markerRef.current?.openPopup(), 1100)
      } else {
        markerRef.current?.openPopup()
      }
    },
    [placeMarker]
  )

  useEffect(() => {
    const container = mapContainer.current
    if (!container || mapRef.current) return

    try {
      const map = L.map(container, {
        center: [18, 40],
        zoom: 2.4,
        zoomControl: false,
        attributionControl: false,
        minZoom: 2,
        maxZoom: HIGH_ZOOM.maxZoom,
        worldCopyJump: true,
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

      // Refresh labels on zoom; tower fetch is debounced via zoomVersion effect only
      map.on('zoomend', () => {
        setZoomVersion((v) => v + 1)
      })

      map.on('moveend', () => {
        if (towerFetchRef.current) clearTimeout(towerFetchRef.current)
        towerFetchRef.current = setTimeout(() => loadViewportTowersRef.current(), 550)
      })

      map.on('mousemove', (e) => {
        const next = { lat: e.latlng.lat, lng: e.latlng.lng }
        if (cursorRafRef.current) return
        cursorRafRef.current = requestAnimationFrame(() => {
          cursorRafRef.current = 0
          setCursorPoint(next)
        })
      })

      map.on('click', (e) => {
        // Ignore clicks on markers/lines — those have their own handlers
        const original = e.originalEvent?.target as HTMLElement | undefined
        if (original?.closest?.('.leaflet-marker-icon, .leaflet-interactive')) {
          // Still allow empty-map clicks; feature clicks bubble — skip fly hijack
          const path = original.closest('path.leaflet-interactive, .leaflet-marker-icon')
          if (path) return
        }
        flyToCoordinates(e.latlng.lat, e.latlng.lng, 'map_click')
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
        if (cursorRafRef.current) cancelAnimationFrame(cursorRafRef.current)
        if (statusThrottleRef.current) clearTimeout(statusThrottleRef.current)
        towerRequestIdRef.current += 1
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
    if (statusThrottleRef.current) clearTimeout(statusThrottleRef.current)
    statusThrottleRef.current = setTimeout(() => {
      onMapStatusChange({
        coordinates: cursorPoint,
        zoom: mapRef.current?.getZoom() ?? null,
        viewMode: '2d',
        regionLoading: towersLoading,
      })
    }, 120)
    return () => {
      if (statusThrottleRef.current) clearTimeout(statusThrottleRef.current)
    }
  }, [cursorPoint, zoomVersion, mapStatus, onMapStatusChange, towersLoading])

  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready') return

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    const layer = buildTileLayer(mapLayer)
    layer.addTo(map)
    tileLayerRef.current = layer
    // IMAGERY_REVISION forces tile rebuild after provider swaps (clears stale Esri HMR layers)
  }, [mapLayer, mapStatus, IMAGERY_REVISION])

  // Draw assets: markers + line corridors + substation footprints
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready') return

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
    }
    clusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 14,
      animate: true,
      animateAddingMarkers: false,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        const size = count > 100 ? 48 : count > 50 ? 44 : count > 15 ? 38 : 32
        const childMarkers = cluster.getAllChildMarkers() as L.Marker[]
        const bg = clusterHealthColor(childMarkers)
        const glow = clusterHealthGlow(childMarkers)
        return L.divIcon({
          html: `<div class="tams-cluster-icon" style="
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
    const compactTowers = zoom < 10 || isExplorer
    const explorerOverview = isExplorer && zoom <= 7
    const popupFor = (asset: Asset) =>
      isExplorer
        ? {
            html: buildMinimalPopupHtml(asset),
            opts: { className: 'asset-popup asset-popup--minimal', maxWidth: 220 },
          }
        : {
            html: buildPopupHtml(asset),
            opts: { className: 'asset-popup', maxWidth: 280 },
          }

    const onFeatureClick = (asset: Asset, layer: L.Layer) => {
      const now = Date.now()
      const last = lastAssetClickRef.current
      if (last && last.id === asset.id && now - last.t < 320) {
        lastAssetClickRef.current = null
        map.closePopup()
        return
      }
      lastAssetClickRef.current = { id: asset.id, t: now }
      if (isExplorer) {
        const pathLayer = layer as L.Path
        if (typeof pathLayer.openPopup === 'function') {
          pathLayer.openPopup()
        }
        return
      }
      onSelectAsset?.(asset.id)
    }

    filteredAssets.forEach((asset) => {
      const isSelected = asset.id === selectedAssetId
      const isMissionFocus = Boolean(highlightAssetId && asset.id === highlightAssetId)
      const hasAlert = alertIdSet.has(asset.id)
      const cfg = ASSET_CONFIG[asset.asset_type]
      const ring = isMissionFocus ? MISSION_FOCUS_COLOR : healthColor(asset)

      if (asset.asset_type === 'line' && asset.geometry?.type === 'LineString') {
        if (!corridorsOn) return
        const kvRaw = asset.metadata?.voltage_kv
        const kv = typeof kvRaw === 'number' ? kvRaw : typeof kvRaw === 'string' ? Number(kvRaw) : null
        // Voltage-class filter from the intel panel checkboxes
        if (voltageFilters && voltageFilters[voltageClassKey(kv)] === false) return
        const latlngs = toLatLngs(asset.geometry.coordinates as number[][])
        const lineHealth = asset.health_score || 'healthy'
        // Selected OR mission View — cyan corridor + A/B ends + direction popup
        const isCorridorFocus = isMissionFocus || isSelected
        const lineColor = isCorridorFocus
          ? MISSION_FOCUS_COLOR
          : hasAlert || lineHealth === 'critical'
            ? '#ef4444'
            : lineHealth === 'attention_required'
              ? '#F59E0B'
              : voltageLineColor(kv)
        const baseWeight = lineWeightForVoltage(kv, isCorridorFocus, explorerOverview) + (isCorridorFocus ? 3 : 0)
        // India overview: keep EHV corridors readable over satellite
        const baseOpacity = isCorridorFocus
          ? 1
          : explorerOverview
            ? kv != null && kv >= 220
              ? 0.98
              : 0.7
            : kv != null && kv >= 220
              ? 0.95
              : 0.75
        // Prefer solid strokes at national zoom so corridors read as a backbone
        const dashArray =
          isCorridorFocus || explorerOverview || (kv != null && kv >= 400) ? undefined : '8 6'
        const isEhv = kv != null && kv >= 220
        const lineClass = [
          isCorridorFocus ? 'tams-mission-focus-line' : 'tams-line-flow',
          'tams-map-fade-in',
          isEhv && !isCorridorFocus ? 'tams-ehv-flow' : '',
        ]
          .filter(Boolean)
          .join(' ')

        if (isCorridorFocus) {
          // Very dark black border casing so the corridor is unmistakable
          const border = L.polyline(latlngs, {
            color: MISSION_FOCUS_BORDER,
            weight: baseWeight + 7,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false,
            className: 'tams-mission-focus-border tams-map-fade-in',
          }).addTo(map)
          overlaysRef.current.push(border)
        }

        const polyline = L.polyline(latlngs, {
          color: lineColor,
          weight: baseWeight,
          opacity: baseOpacity,
          dashArray: isEhv && !isCorridorFocus ? '10 14' : dashArray,
          className: lineClass,
          interactive: true,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map)
        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          onFeatureClick(asset, polyline)
        })

        // Signature interaction: reveal directional power flow on hover
        const flow = flowDirectionLabel(latlngs)
        const kvLabel = kv != null ? `${kv} kV` : 'Unclassified'
        const startLl = L.latLng(latlngs[0])
        const endLl = L.latLng(latlngs[latlngs.length - 1])
        const midLl = lineMidLatLng(latlngs)

        if (isCorridorFocus && latlngs.length >= 2) {
          // Permanent direction chip above the corridor
          polyline.bindTooltip(
            `<div style="font-family:ui-monospace,monospace;text-align:center">
              <div style="font-weight:800;color:#22d3ee;font-size:11px;letter-spacing:0.04em">🧭 ${flow}</div>
              <div style="color:#e2e8f0;font-weight:700;font-size:10px;margin-top:2px">${kvLabel} · ${asset.name}</div>
            </div>`,
            {
              permanent: true,
              direction: 'top',
              opacity: 1,
              className: 'tams-direction-permanent',
              offset: [0, -8],
            }
          )

          const startPin = L.marker(startLl, {
            icon: directionEndpointIcon('A', 'Start'),
            zIndexOffset: 1200,
            interactive: false,
          }).addTo(map)
          const endPin = L.marker(endLl, {
            icon: directionEndpointIcon('B', 'End'),
            zIndexOffset: 1200,
            interactive: false,
          }).addTo(map)

          const directionAnchor = L.marker(midLl, {
            icon: L.divIcon({ className: '', iconSize: [1, 1], iconAnchor: [0, 0], html: '' }),
            zIndexOffset: 1300,
            interactive: false,
          }).addTo(map)

          // Direction detail opens as a React overlay above search/chrome (MapViewport).
          // Keep map markers A/B + permanent direction chip only.
          markerByIdRef.current.set(asset.id, directionAnchor)
          overlaysRef.current.push(startPin, endPin, directionAnchor)
        } else {
          const popup = popupFor(asset)
          polyline.bindPopup(popup.html, popup.opts)
          polyline.bindTooltip(
            `<div style="display:flex;align-items:center;gap:6px;font-family:ui-monospace,monospace">
              <span style="width:6px;height:6px;border-radius:50%;background:${lineColor}"></span>
              <span style="color:${lineColor};font-weight:800">${kvLabel}</span>
              <span style="color:#93c5fd;font-weight:700;letter-spacing:0.04em">⚡ ${flow}</span>
            </div>`,
            { sticky: true, direction: 'top', opacity: 1, className: 'tams-flow-tooltip' }
          )
        }

        polyline.on('mouseover', () => {
          polyline.setStyle({ weight: baseWeight + 2, opacity: 1 })
          polyline.getElement()?.classList.add('tams-line-flow-active')
          polyline.bringToFront()
        })
        polyline.on('mouseout', () => {
          if (isCorridorFocus) return
          polyline.setStyle({ weight: baseWeight, opacity: baseOpacity })
          polyline.getElement()?.classList.remove('tams-line-flow-active')
        })
        overlaysRef.current.push(polyline)
        return
      }

      // India national zoom: corridors + state labels only (avoid green cluster clutter)
      if (explorerOverview) return

      if (asset.asset_type === 'substation' && asset.geometry?.type === 'Polygon' && zoom >= 8) {
        const rings = asset.geometry.coordinates as number[][][]
        const latlngs = rings.map((r) => toLatLngs(r))
        const polygon = L.polygon(latlngs, {
          color: isMissionFocus ? MISSION_FOCUS_BORDER : ring,
          weight: isMissionFocus || isSelected ? 4 : 2,
          fillColor: isMissionFocus ? MISSION_FOCUS_COLOR : cfg.color,
          fillOpacity: isMissionFocus ? 0.45 : 0.35,
        }).addTo(map)
        polygon.bindPopup(popupFor(asset).html, popupFor(asset).opts)
        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          onFeatureClick(asset, polygon)
        })
        overlaysRef.current.push(polygon)
      }

      // Compact tower dots at overview zoom — full icons when zoomed in
      // N/E offset aligns OSM points with Google satellite pads
      const towerLatLng =
        asset.asset_type === 'tower'
          ? (() => {
              const p = withTowerNeOffset(asset)
              return [p.latitude, p.longitude] as [number, number]
            })()
          : ([asset.latitude, asset.longitude] as [number, number])
      let marker: L.Marker & { assetRef?: Asset }
      if (asset.asset_type === 'tower' && compactTowers && !isMissionFocus) {
        marker = L.marker(towerLatLng, {
          icon: L.divIcon({
            className: '',
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            html: `<div class="tams-asset-marker${isSelected ? ' tams-asset-selected' : ''}" style="width:10px;height:10px;border-radius:50%;background:${cfg.color};border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.45)"></div>`,
          }),
          zIndexOffset: 150,
        }) as L.Marker & { assetRef?: Asset }
      } else if (asset.asset_type === 'tower' && compactTowers && isMissionFocus) {
        marker = L.marker(towerLatLng, {
          icon: L.divIcon({
            className: '',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: `<div class="tams-asset-focus-ring" style="width:16px;height:16px;border-radius:50%;background:${MISSION_FOCUS_COLOR};border:3px solid ${MISSION_FOCUS_BORDER}"></div>`,
          }),
          zIndexOffset: 800,
        }) as L.Marker & { assetRef?: Asset }
      } else {
        marker = L.marker(towerLatLng, {
          icon: makeAssetIcon(asset, isSelected, hasAlert, isMissionFocus),
          zIndexOffset: isMissionFocus ? 900 : asset.asset_type === 'substation' ? 300 : 200,
        }) as L.Marker & { assetRef?: Asset }
      }
      marker.assetRef = asset

      const popup = popupFor(asset)
      marker.bindPopup(popup.html, popup.opts)

      if (labelsVisible && asset.asset_type !== 'tower') {
        marker.bindTooltip(`${cfg.badge}: ${asset.name}`, {
          permanent: true,
          direction: 'top',
          offset: [0, -cfg.size / 2 - 8],
          className: 'asset-map-label',
        })
      }

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onFeatureClick(asset, marker)
      })
      markerByIdRef.current.set(asset.id, marker)

      // Wildfire Risk overlay — thin outline only
      if (wildfireOn && (asset.health_score === 'critical' || asset.health_score === 'attention_required')) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#ea580c',
          fillColor: '#f97316',
          fillOpacity: 0.18,
          radius: 5000,
          weight: 2,
          opacity: 0.85,
          dashArray: '4 6',
          className: 'tams-map-fade-in',
        }).addTo(map)
        circle.bindTooltip('Wildfire risk proxy · attention/critical health', { sticky: true })
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
          color: '#0891b2',
          fillColor: '#22d3ee',
          fillOpacity: 0.16,
          radius: 6000,
          weight: 2,
          opacity: 0.85,
          dashArray: '4 6',
          className: 'tams-map-fade-in',
        }).addTo(map)
        circle.bindTooltip('Flood hazard proxy · coastal / river site', { sticky: true })
        overlaysRef.current.push(circle)
      }

      // Heatmap Anomaly Density overlay
      if (heatmapOn && hasAlert) {
        const circle = L.circle([asset.latitude, asset.longitude], {
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.04,
          radius: 4000,
          weight: 1,
          opacity: 0.35,
          className: 'tams-map-fade-in',
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
    alertIdsKey,
    alertIdSet,
    onSelectAsset,
    mapStatus,
    showLabels,
    zoomVersion,
    wildfireOn,
    floodOn,
    corridorsOn,
    heatmapOn,
    voltageFilterKey,
    voltageFilters,
    highlightAssetId,
    isExplorer,
  ])

  // Cinematic intro: world → brief spin → India → settle on region.
  // Waits for Earth overlay (cinematicReady) so stars/spin hand off cleanly.
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || !cinematicReady || introDoneRef.current) return
    introDoneRef.current = true

    const settle = () => {
      try {
        fitToPlace(selectedPlaceId, filteredAssets)
        lastFitKeyRef.current = fitKey
        hasInitialFitRef.current = true
      } catch {
        try {
          map.setView([22.5, 79], 4.5, { animate: true })
        } catch {
          /* map torn down */
        }
      }
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      settle()
      return
    }

    const timers: number[] = []
    try {
      // Deep space / world frame
      map.setView([10, -40], 1.8, { animate: false })
      // Spin east toward India (longitude pan)
      timers.push(
        window.setTimeout(() => {
          try {
            map.flyTo([12, 20], 2.2, { duration: 0.85, easeLinearity: 0.3 })
          } catch {
            /* ignore */
          }
        }, 80)
      )
      // Spot India
      timers.push(
        window.setTimeout(() => {
          try {
            map.flyTo([22.5, 79], 4.4, { duration: 1.05, easeLinearity: 0.25 })
          } catch {
            /* ignore */
          }
        }, 1000)
      )
      // Settle on place bounds / assets
      timers.push(window.setTimeout(settle, 2300))
    } catch {
      settle()
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStatus, cinematicReady])

  // Fit map only when the region changes — never on user zoom or filter toggles
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || !introDoneRef.current || filteredAssets.length === 0) return
    if (lastFitKeyRef.current === fitKey) return

    lastFitKeyRef.current = fitKey
    fitToPlace(selectedPlaceId, filteredAssets)
    hasInitialFitRef.current = true
  }, [fitKey, mapStatus, selectedPlaceId, filteredAssets, fitToPlace])

  // When assets arrive after a failed/empty first load (backend cold start), settle the camera once
  const hadCorridorDataRef = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || !introDoneRef.current) return
    if (filteredAssets.length === 0) {
      hadCorridorDataRef.current = false
      return
    }
    if (hadCorridorDataRef.current) return
    hadCorridorDataRef.current = true
    fitToPlace(selectedPlaceId, filteredAssets)
    lastFitKeyRef.current = fitKey
    hasInitialFitRef.current = true
  }, [filteredAssets, mapStatus, selectedPlaceId, fitToPlace, fitKey])

  // Explicit focus from mission report View — fit corridor bounds for lines, else fly to point
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapStatus !== 'ready' || !focusTarget) return
    lastSelectedFlyRef.current = focusTarget.id

    const asset =
      assets.find((a) => a.id === focusTarget.id) ||
      filteredAssets.find((a) => a.id === focusTarget.id)

    const lineCoords =
      asset?.asset_type === 'line' && asset.geometry?.type === 'LineString'
        ? (asset.geometry.coordinates as number[][])
        : null

    if (lineCoords && lineCoords.length >= 2) {
      try {
        const latlngs = toLatLngs(lineCoords)
        map.fitBounds(L.latLngBounds(latlngs as L.LatLngExpression[]).pad(0.45), {
          maxZoom: 16,
          animate: true,
          duration: 0.85,
        })
      } catch {
        map.flyTo([focusTarget.latitude, focusTarget.longitude], Math.max(map.getZoom(), 13), {
          duration: 0.9,
        })
      }
    } else {
      map.flyTo([focusTarget.latitude, focusTarget.longitude], Math.max(map.getZoom(), 13), {
        duration: 0.9,
      })
    }

    const t = setTimeout(() => {
      markerByIdRef.current.get(focusTarget.id)?.openPopup()
      onFocusConsumed?.()
    }, 950)
    return () => clearTimeout(t)
  }, [focusTarget, mapStatus, onFocusConsumed, assets, filteredAssets])

  // Fly to + open popup for selected asset — only when selection id changes
  useEffect(() => {
    if (focusTarget) return
    if (!selectedAssetId) {
      lastSelectedFlyRef.current = null
      return
    }
    const map = mapRef.current
    if (!map || mapStatus !== 'ready') return
    if (lastSelectedFlyRef.current === selectedAssetId) return

    const asset =
      assets.find((a) => a.id === selectedAssetId) ||
      viewportTowers.find((a) => a.id === selectedAssetId) ||
      filteredAssets.find((a) => a.id === selectedAssetId)
    if (!asset || !typeFilters[asset.asset_type] || !assetMatchesPlace(asset, selectedPlaceId)) {
      return
    }

    lastSelectedFlyRef.current = selectedAssetId

    const lineCoords =
      asset.asset_type === 'line' && asset.geometry?.type === 'LineString'
        ? (asset.geometry.coordinates as number[][])
        : null

    if (lineCoords && lineCoords.length >= 2) {
      try {
        const latlngs = toLatLngs(lineCoords)
        map.fitBounds(L.latLngBounds(latlngs as L.LatLngExpression[]).pad(0.45), {
          maxZoom: 16,
          animate: true,
          duration: 0.85,
        })
      } catch {
        map.flyTo([asset.latitude, asset.longitude], Math.max(map.getZoom(), 12), { duration: 0.9 })
      }
    } else {
      map.flyTo([asset.latitude, asset.longitude], Math.max(map.getZoom(), 12), { duration: 0.9 })
    }

    setTimeout(() => markerByIdRef.current.get(selectedAssetId)?.openPopup(), 950)
  }, [
    selectedAssetId,
    mapStatus,
    assets,
    viewportTowers,
    filteredAssets,
    typeFilters,
    selectedPlaceId,
    focusTarget,
  ])

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

      {(() => {
        const focusId = highlightAssetId || selectedAssetId
        if (!focusId) return null
        const focused =
          assets.find((a) => a.id === focusId) ||
          viewportTowers.find((a) => a.id === focusId) ||
          filteredAssets.find((a) => a.id === focusId) ||
          null
        const isLine = focused?.asset_type === 'line'
        // Chip for mission highlights always; for selection only when it's a corridor
        if (!highlightAssetId && !isLine) return null
        return (
          <div className="absolute bottom-4 right-4 z-[1000] max-w-[260px] rounded-lg border border-slate-800 bg-[#0b1220] px-3 py-2.5 pointer-events-none">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Focused on map</p>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm shrink-0 border-2 border-black"
                style={{ background: MISSION_FOCUS_COLOR }}
                aria-hidden
              />
              <p className="text-[11px] font-semibold text-slate-100 truncate">
                {focused?.name || focusId}
              </p>
            </div>
            {isLine ? (
              <p className="text-[9px] text-slate-400 mt-1">Cyan corridor · A / B ends · direction popup</p>
            ) : (
              <p className="text-[9px] text-slate-400 mt-1">Cyan highlight with black border</p>
            )}
            <p className="text-[9px] text-slate-500 mt-0.5 font-mono truncate">{focusId}</p>
          </div>
        )
      })()}

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
