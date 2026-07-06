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
      <div style="border:3px solid ${ring};border-radius:6px;padding:2px;background:rgba(0,0,0,0.35);">
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

interface GeoPoint {
  lat: number
  lng: number
  source: 'gps' | 'map_click' | 'manual'
  accuracy?: number
}

function formatCoord(value: number, decimals = 6): string {
  return value.toFixed(decimals)
}

function parseLatLng(latStr: string, lngStr: string): { lat: number; lng: number } | null {
  const lat = parseFloat(latStr.trim())
  const lng = parseFloat(lngStr.trim())
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90) return null
  if (lng < -180 || lng > 180) return null
  return { lat, lng }
}

/** Accept "lat, lng" or "lat lng" in one string */
function parseCoordPair(text: string): { lat: number; lng: number } | null {
  const cleaned = text.trim().replace(/[;,]/g, ' ')
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return parseLatLng(parts[0], parts[1])
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
}: {
  assets: Asset[]
  selectedAssetId?: string | null
  alertAssetIds?: string[]
  onSelectAsset?: (id: string) => void
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
  const [geoPoint, setGeoPoint] = useState<GeoPoint | null>(null)
  const [inputLat, setInputLat] = useState('')
  const [inputLng, setInputLng] = useState('')
  const [inputPair, setInputPair] = useState('')
  const [cursorPoint, setCursorPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [typeFilters, setTypeFilters] = useState<Record<AssetType, boolean>>({
    tower: true,
    substation: true,
    line: true,
  })
  const [showWildfireRisk, setShowWildfireRisk] = useState(false)
  const [showFloodRisk, setShowFloodRisk] = useState(false)

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

  const getMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.')
      return
    }

    setLocating(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy = pos.coords.accuracy

        setGeoPoint({ lat, lng, source: 'gps', accuracy })
        setLocating(false)
        setInputLat(formatCoord(lat))
        setInputLng(formatCoord(lng))
        setInputPair(`${formatCoord(lat)}, ${formatCoord(lng)}`)

        const map = mapRef.current
        if (map) {
          map.flyTo([lat, lng], 14, { duration: 1.2 })
          placeMarker(
            userLocationMarkerRef,
            lat,
            lng,
            userLocationIcon(),
            `<div style="font-family:sans-serif;font-size:13px">
              <b>Your location</b><br/>
              Lat: ${formatCoord(lat)}<br/>
              Lng: ${formatCoord(lng)}<br/>
              ${accuracy ? `Accuracy: ±${Math.round(accuracy)} m` : ''}
            </div>`
          )
          setTimeout(() => userLocationMarkerRef.current?.openPopup(), 1300)
        }
      },
      (err) => {
        setLocating(false)
        const messages: Record<number, string> = {
          1: 'Location permission denied. Allow location access in browser settings.',
          2: 'Location unavailable. Check GPS / network.',
          3: 'Location request timed out. Try again.',
        }
        setLocationError(messages[err.code] || err.message || 'Could not get location.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [placeMarker])

  const copyCoordinates = useCallback(async () => {
    if (!geoPoint) return
    const text = `${formatCoord(geoPoint.lat)}, ${formatCoord(geoPoint.lng)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setLocationError('Could not copy to clipboard.')
    }
  }, [geoPoint])

  const flyToCoordinates = useCallback(
    (lat: number, lng: number, source: GeoPoint['source']) => {
      setGeoPoint({ lat, lng, source })
      setInputLat(formatCoord(lat))
      setInputLng(formatCoord(lng))
      setInputPair(`${formatCoord(lat)}, ${formatCoord(lng)}`)
      setLocationError(null)

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

  const goToLocation = useCallback(() => {
    let parsed = parseLatLng(inputLat, inputLng)
    if (!parsed && inputPair.trim()) {
      parsed = parseCoordPair(inputPair)
    }
    if (!parsed) {
      setLocationError('Enter valid coordinates. Lat: -90 to 90, Lng: -180 to 180.')
      return
    }
    flyToCoordinates(parsed.lat, parsed.lng, 'manual')
  }, [inputLat, inputLng, inputPair, flyToCoordinates])

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
        setInputLat(formatCoord(lat))
        setInputLng(formatCoord(lng))
        setInputPair(`${formatCoord(lat)}, ${formatCoord(lng)}`)
        flyToCoordinates(lat, lng, 'map_click')
      })

      setTimeout(() => map.invalidateSize(), 100)
      const onResize = () => map.invalidateSize()
      window.addEventListener('resize', onResize)

      return () => {
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
        const latlngs = toLatLngs(asset.geometry.coordinates as number[][])
        const polyline = L.polyline(latlngs, {
          color: cfg.color,
          weight: isSelected ? 6 : 4,
          opacity: 0.9,
          dashArray: hasAlert ? '8 6' : undefined,
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
            className={`px-3 py-1.5 text-xs rounded-md transition ${
              mapLayer === 'satellite' ? 'bg-tams-primary text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapLayer('satellite-labels')}
            className={`px-3 py-1.5 text-xs rounded-md transition ${
              mapLayer === 'satellite-labels'
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
              className={`px-2.5 py-1.5 text-xs rounded-md transition ${
                regionFilter === key ? 'bg-tams-primary text-white' : 'text-gray-300 hover:bg-gray-700'
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
                className={`flex items-center gap-2 w-full py-1.5 px-1 rounded transition ${
                  typeFilters[type] ? 'opacity-100' : 'opacity-40'
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
              className={`flex items-center gap-2 w-full py-1.5 px-1 rounded transition-all duration-150 ${
                showWildfireRisk ? 'text-orange-400 font-medium bg-orange-500/5' : 'text-gray-400 hover:bg-gray-800'
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
              className={`flex items-center gap-2 w-full py-1.5 px-1 rounded transition-all duration-150 ${
                showFloodRisk ? 'text-cyan-400 font-medium bg-cyan-500/5' : 'text-gray-400 hover:bg-gray-800'
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

      {/* Coordinates panel */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-gray-900 rounded-lg p-3 shadow-lg border border-gray-700 text-xs min-w-[240px]">
        <p className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Coordinates</p>

        {/* Go to lat/lng */}
        <div className="mb-3 space-y-2 pb-3 border-b border-gray-700">
          <p className="text-gray-500 text-[10px]">Go to location (Lat / Lng)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={inputLat}
              onChange={(e) => setInputLat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goToLocation()}
              placeholder="Latitude"
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white font-mono text-[11px] placeholder:text-gray-500 focus:outline-none focus:border-tams-primary"
            />
            <input
              type="text"
              value={inputLng}
              onChange={(e) => setInputLng(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goToLocation()}
              placeholder="Longitude"
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white font-mono text-[11px] placeholder:text-gray-500 focus:outline-none focus:border-tams-primary"
            />
          </div>
          <input
            type="text"
            value={inputPair}
            onChange={(e) => setInputPair(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goToLocation()}
            placeholder="Or paste: 28.6139, 77.2090"
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white font-mono text-[11px] placeholder:text-gray-500 focus:outline-none focus:border-tams-primary"
          />
          <button
            type="button"
            onClick={goToLocation}
            className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 rounded text-white text-xs font-medium transition"
          >
            Go to Location
          </button>
        </div>

        {geoPoint ? (
          <div className="space-y-1 text-white mb-2">
            <p>
              <span className="text-gray-400">Lat:</span>{' '}
              <span className="font-mono">{formatCoord(geoPoint.lat)}</span>
            </p>
            <p>
              <span className="text-gray-400">Lng:</span>{' '}
              <span className="font-mono">{formatCoord(geoPoint.lng)}</span>
            </p>
            <p className="text-gray-500 capitalize">
              Source:{' '}
              {geoPoint.source === 'gps'
                ? 'GPS / device'
                : geoPoint.source === 'manual'
                  ? 'Manual entry'
                  : 'Map click'}
              {geoPoint.accuracy != null && ` · ±${Math.round(geoPoint.accuracy)} m`}
            </p>
          </div>
        ) : cursorPoint ? (
          <div className="space-y-1 text-gray-300 mb-2">
            <p className="text-gray-500 text-[10px]">Hover / click map for coordinates</p>
            <p>
              <span className="text-gray-400">Lat:</span>{' '}
              <span className="font-mono">{formatCoord(cursorPoint.lat)}</span>
            </p>
            <p>
              <span className="text-gray-400">Lng:</span>{' '}
              <span className="font-mono">{formatCoord(cursorPoint.lng)}</span>
            </p>
          </div>
        ) : (
          <p className="text-gray-500 mb-2">Click map or use Get Location</p>
        )}

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={getMyLocation}
            disabled={locating}
            className="w-full py-2 px-3 bg-tams-primary hover:bg-blue-700 disabled:opacity-50 rounded text-white text-xs font-medium transition"
          >
            {locating ? 'Getting location…' : '📍 Get My Location'}
          </button>
          {geoPoint && (
            <button
              type="button"
              onClick={copyCoordinates}
              className="w-full py-1.5 px-3 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 text-xs transition"
            >
              {copied ? '✓ Copied!' : 'Copy Lat, Lng'}
            </button>
          )}
        </div>

        {locationError && (
          <p className="text-tams-danger text-[10px] mt-2 leading-relaxed">{locationError}</p>
        )}
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
