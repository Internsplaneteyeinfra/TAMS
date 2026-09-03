import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { GOOGLE_SATELLITE_URL, GOOGLE_SUBDOMAINS } from '@/lib/basemapTiles'
import type { KmlFeature, KmlLatLng } from './fetchSiteSignals'
import type { PlannedTower } from './lineTowers'
import { voltageLabel } from './lineTowers'
import type { NearbyPowerAsset } from './nearbyPowerSupply'
import { powerKindLabel } from './nearbyPowerSupply'
import type { PlannedTowerAdvice, PowerConnectSuggestion, CorridorConnectHint, PlacementVerdict } from './corridorPlacementAdvice'
import type { SelectedTowerDetail } from './TowerAssetDetailCard'
import type { TowerConnectionOverlay } from './towerConnection'
import { formatMeters } from './towerConnection'
import { closestPointOnCorridor, metersLabel, transmissionLineSegments } from './towerGridLinks'
import type { SuitabilityResult } from './scoring'
import { verdictColor } from './scoring'
import SearchRadiusToolbarButton from './analysis/SearchRadiusToolbarButton'

export type DrawMode = 'pin' | 'line' | 'polygon' | 'point'

/** Full country extent — empty planning view, no site pre-selected. */
const INDIA_BOUNDS: L.LatLngBoundsExpression = [
  [6.75, 68.1],
  [35.5, 97.4],
]

function isMapAlive(map: L.Map | null): map is L.Map {
  if (!map) return false
  const pane = map.getPane('mapPane')
  const el = map.getContainer()
  return !!pane && !!el && el.isConnected && el.offsetWidth > 0 && el.offsetHeight > 0
}

function fitIndia(map: L.Map, animate = false) {
  if (!isMapAlive(map)) return
  map.fitBounds(INDIA_BOUNDS, { padding: [28, 28], animate, maxZoom: 6 })
}

function centroidOf(pts: KmlLatLng[]): { lat: number; lon: number } {
  let lat = 0
  let lon = 0
  for (const [a, b] of pts) {
    lat += a
    lon += b
  }
  const n = Math.max(1, pts.length)
  return { lat: lat / n, lon: lon / n }
}

type PathMetrics = { pts: L.LatLng[]; dists: number[]; total: number }

function pathMetrics(pts: L.LatLng[]): PathMetrics | null {
  if (pts.length < 2) return null
  const dists = [0]
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += pts[i - 1].distanceTo(pts[i])
    dists.push(total)
  }
  if (total < 1) return null
  return { pts, dists, total }
}

function alongPath(m: PathMetrics, distM: number): L.LatLng {
  let d = distM % m.total
  if (d < 0) d += m.total
  for (let i = 1; i < m.pts.length; i++) {
    if (d <= m.dists[i]) {
      const span = Math.max(m.dists[i] - m.dists[i - 1], 1e-6)
      const t = (d - m.dists[i - 1]) / span
      const a = m.pts[i - 1]
      const b = m.pts[i]
      return L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t)
    }
  }
  return m.pts[m.pts.length - 1]
}

function slicePath(m: PathMetrics, fromM: number, toM: number): L.LatLng[] {
  const wrap = fromM < 0
  if (wrap) {
    return [...slicePath(m, m.total + fromM, m.total), ...slicePath(m, 0, toM)]
  }
  const out: L.LatLng[] = [alongPath(m, fromM)]
  for (let i = 0; i < m.pts.length; i++) {
    if (m.dists[i] > fromM && m.dists[i] < toM) out.push(m.pts[i])
  }
  out.push(alongPath(m, toM))
  return out
}

function corridorScanPoints(plannedTowers: PlannedTower[], kmlFeatures: KmlFeature[]): L.LatLng[] {
  if (plannedTowers.length >= 2) {
    return plannedTowers.map((t) => L.latLng(t.lat, t.lon))
  }
  const line = kmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2)
  if (line) return line.latlngs.map(([la, lo]) => L.latLng(la, lo))
  const poly = kmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
  if (poly) return poly.latlngs.map(([la, lo]) => L.latLng(la, lo))
  return []
}

function formatDistKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`
}

function towerKvDisplay(asset: NearbyPowerAsset): string {
  if (asset.voltageKv != null) {
    return asset.voltageInferred ? `~${asset.voltageKv} kV` : `${asset.voltageKv} kV`
  }
  return 'kV unmapped'
}

export default function TowerSuitabilityMap({
  lat,
  lon,
  result,
  kmlFeatures,
  planningKmlFeatures = [],
  plannedTowers = [],
  nearbyAssets = [],
  placementAdvice = [],
  voltageKv = null,
  spanM,
  searchRadiusKm = 8,
  corridorLineColor = '#fbbf24',
  highlightTowerId = null,
  highlightStationId = null,
  corridorNearestTower = null,
  corridorNearestStation = null,
  corridorPowerLoading = false,
  corridorPath = [],
  showNearbyGrid = false,
  onTowerSelect,
  powerConnect = null,
  roadNearest = null,
  padRoadAccess = [],
  onMapBackgroundClick,
  analyzing = false,
  drawMode,
  drawingEnabled = true,
  focusTick = 0,
  padFocusTick = 0,
  focusedPadIndex = null,
  verdictFilter = null,
  connectionOverlay = null,
  undoDraftTick = 0,
  onDraftCountChange,
  onDrawModeChange,
  onPick,
  candidateIdByIndex = null,
  candidateColorByIndex = null,
  onGeometryDrawn,
  startLocationSlot = null,
  chromeElevated = false,
  onSearchRadiusKm,
  geometryActionSlot = null,
  geometryPending = false,
  onGeometryCancel,
  highlightBoreholeId = null,
  onBoreholeSelect,
  boreholeFocusTick = 0,
}: {
  lat: number | null
  lon: number | null
  result: SuitabilityResult | null
  kmlFeatures: KmlFeature[]
  /** Phase I planning geometry — distinct from investigation geometry */
  planningKmlFeatures?: KmlFeature[]
  plannedTowers?: PlannedTower[]
  nearbyAssets?: NearbyPowerAsset[]
  placementAdvice?: PlannedTowerAdvice[]
  voltageKv?: number | null
  spanM?: number
  searchRadiusKm?: number
  /** Suitability color for the drawn corridor line */
  corridorLineColor?: string
  /** Emphasize nearest existing tower / station on map */
  highlightTowerId?: string | null
  highlightStationId?: string | null
  /** Nearest tower/station measured from drawn corridor (perpendicular distance) */
  corridorNearestTower?: CorridorConnectHint | null
  corridorNearestStation?: CorridorConnectHint | null
  corridorPowerLoading?: boolean
  corridorPath?: Array<{ lat: number; lon: number }>
  /** Show existing grid + interconnect lines after user picks kV */
  showNearbyGrid?: boolean
  onTowerSelect?: (detail: SelectedTowerDetail | null) => void
  /** Station ↔ best new pad (+ existing tower) connect suggestion */
  powerConnect?: PowerConnectSuggestion | null
  /** Nearest drivable road snap from OSRM (site pin fallback) */
  roadNearest?: { lat: number; lon: number; km: number } | null
  /** Nearest road for each planned pad (T1, T2, …) */
  padRoadAccess?: Array<{
    index: number
    lat: number
    lon: number
    roadLat: number
    roadLon: number
    km: number
  }>
  /** Dismiss tower detail card when clicking empty map */
  onMapBackgroundClick?: () => void
  analyzing?: boolean
  drawMode: DrawMode
  drawingEnabled?: boolean
  focusTick?: number
  /** Fly to a specific planned pad (from panel click) */
  padFocusTick?: number
  focusedPadIndex?: number | null
  verdictFilter?: PlacementVerdict | null
  connectionOverlay?: TowerConnectionOverlay | null
  undoDraftTick?: number
  onDraftCountChange?: (count: number) => void
  onDrawModeChange: (mode: DrawMode) => void
  onPick: (lat: number, lon: number) => void
  onGeometryDrawn: (feature: KmlFeature, focus: { lat: number; lon: number }) => void
  /** Phase I tower IDs (e.g. T-01) keyed by pad index */
  candidateIdByIndex?: Record<number, string> | null
  candidateColorByIndex?: Record<number, string> | null
  /** Lat/lon panel (planning mode) */
  startLocationSlot?: React.ReactNode
  /** Raise toolbar above Earth intro overlay (z-5000) */
  chromeElevated?: boolean
  onSearchRadiusKm?: (km: number) => void
  /** Save KML / Analyze site — shown center-bottom after drawing */
  geometryActionSlot?: React.ReactNode
  /** Drawn line/polygon awaiting Save or Analyze */
  geometryPending?: boolean
  /** Map click in pin mode cancels committed geometry */
  onGeometryCancel?: () => void
  highlightBoreholeId?: string | null
  onBoreholeSelect?: (boreholeId: string | null) => void
  boreholeFocusTick?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const ringRef = useRef<L.Circle | null>(null)
  const searchRingRef = useRef<L.Circle | null>(null)
  const kmlLayerRef = useRef<L.LayerGroup | null>(null)
  const nearbyLayerRef = useRef<L.LayerGroup | null>(null)
  const gridHighlightLayerRef = useRef<L.LayerGroup | null>(null)
  const roadLayerRef = useRef<L.LayerGroup | null>(null)
  const shiftLayerRef = useRef<L.LayerGroup | null>(null)
  const connectionLayerRef = useRef<L.LayerGroup | null>(null)
  const draftLayerRef = useRef<L.LayerGroup | null>(null)
  const boreholeLayerRef = useRef<L.LayerGroup | null>(null)
  const draftPtsRef = useRef<KmlLatLng[]>([])
  const drawModeRef = useRef(drawMode)
  const drawingEnabledRef = useRef(drawingEnabled)
  const onPickRef = useRef(onPick)
  const onDrawnRef = useRef(onGeometryDrawn)
  const geometryPendingRef = useRef(geometryPending)
  const onGeometryCancelRef = useRef(onGeometryCancel)
  const onBoreholeSelectRef = useRef(onBoreholeSelect)
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick)
  const hadStartRef = useRef(false)
  const [mapReady, setMapReady] = useState(0)
  const [draftCount, setDraftCount] = useState(0)

  drawModeRef.current = drawMode
  geometryPendingRef.current = geometryPending
  onGeometryCancelRef.current = onGeometryCancel
  onBoreholeSelectRef.current = onBoreholeSelect
  onMapBackgroundClickRef.current = onMapBackgroundClick
  drawingEnabledRef.current = drawingEnabled
  onPickRef.current = onPick
  onDrawnRef.current = onGeometryDrawn

  const clearDraft = () => {
    draftPtsRef.current = []
    setDraftCount(0)
    draftLayerRef.current?.clearLayers()
  }

  const redrawDraft = () => {
    const layer = draftLayerRef.current
    if (!layer) return
    layer.clearLayers()
    const pts = draftPtsRef.current
    pts.forEach(([la, lo], i) => {
      L.circleMarker([la, lo], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: drawModeRef.current === 'polygon' ? '#22d3ee' : '#fbbf24',
        fillOpacity: 1,
      })
        .bindTooltip(`${i + 1}`, { permanent: true, direction: 'top', className: 'ts-tower-label', offset: [0, -6] })
        .addTo(layer)
    })
    if (pts.length >= 2) {
      if (drawModeRef.current === 'polygon' && pts.length >= 3) {
        L.polygon(pts, {
          color: '#22d3ee',
          weight: 2.5,
          fillColor: '#22d3ee',
          fillOpacity: 0.15,
          dashArray: '6 4',
        }).addTo(layer)
      } else {
        L.polyline(pts, {
          color: '#fbbf24',
          weight: 4,
          dashArray: '8 6',
          opacity: 0.95,
        }).addTo(layer)
      }
    }
  }

  const finishDraft = () => {
    const pts = draftPtsRef.current
    const mode = drawModeRef.current
    if (mode === 'line' && pts.length >= 2) {
      const feature: KmlFeature = { type: 'LineString', latlngs: [...pts], name: 'Drawn line' }
      const mid = pts[Math.floor(pts.length / 2)]
      draftPtsRef.current = []
      setDraftCount(0)
      draftLayerRef.current?.clearLayers()
      onDrawnRef.current(feature, { lat: mid[0], lon: mid[1] })
      return
    }
    if (mode === 'polygon' && pts.length >= 3) {
      const closed = [...pts]
      const a = closed[0]
      const b = closed[closed.length - 1]
      if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9) closed.push([...a] as KmlLatLng)
      const feature: KmlFeature = { type: 'Polygon', latlngs: closed, name: 'Drawn polygon' }
      const focus = centroidOf(pts)
      draftPtsRef.current = []
      setDraftCount(0)
      draftLayerRef.current?.clearLayers()
      onDrawnRef.current(feature, focus)
    }
  }

  const finishDraftRef = useRef(finishDraft)
  const clearDraftRef = useRef(clearDraft)
  const redrawDraftRef = useRef(redrawDraft)
  finishDraftRef.current = finishDraft
  clearDraftRef.current = clearDraft
  redrawDraftRef.current = redrawDraft

  const clearLeafletContainer = (el: HTMLDivElement | null) => {
    if (!el) return
    const node = el as HTMLDivElement & { _leaflet_id?: number }
    delete node._leaflet_id
    el.replaceChildren()
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return
    if ((container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id != null) {
      clearLeafletContainer(container)
    }

    let cancelled = false
    const map = L.map(container, {
      center: [22.97, 78.66],
      zoom: 5,
      minZoom: 4,
      zoomControl: true,
      preferCanvas: true,
      fadeAnimation: false,
      zoomAnimation: false,
    })
    mapRef.current = map

    L.tileLayer(GOOGLE_SATELLITE_URL, {
      maxZoom: 20,
      subdomains: [...GOOGLE_SUBDOMAINS],
      attribution: '© Google',
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const addingDrawPoint =
        drawingEnabledRef.current &&
        (drawModeRef.current === 'line' || drawModeRef.current === 'polygon') &&
        draftPtsRef.current.length > 0
      if (!addingDrawPoint) {
        onMapBackgroundClickRef.current?.()
      }
      if (!drawingEnabledRef.current) return
      const mode = drawModeRef.current
      const { lat: la, lng: lo } = e.latlng
      if (mode === 'pin' || mode === 'point') {
        if (mode === 'pin' && geometryPendingRef.current && onGeometryCancelRef.current) {
          onGeometryCancelRef.current()
          return
        }
        clearDraftRef.current()
        onPickRef.current(la, lo)
        return
      }
      draftPtsRef.current = [...draftPtsRef.current, [la, lo]]
      setDraftCount(draftPtsRef.current.length)
      redrawDraftRef.current()
    })

    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (!drawingEnabledRef.current) return
      if (drawModeRef.current === 'pin' || drawModeRef.current === 'point') return
      L.DomEvent.stopPropagation(e as unknown as Event)
      L.DomEvent.preventDefault(e as unknown as Event)
      const pts = draftPtsRef.current
      if (pts.length >= 2) {
        const last = pts[pts.length - 1]
        const prev = pts[pts.length - 2]
        if (Math.abs(last[0] - prev[0]) < 1e-7 && Math.abs(last[1] - prev[1]) < 1e-7) {
          draftPtsRef.current = pts.slice(0, -1)
          setDraftCount(draftPtsRef.current.length)
        }
      }
      finishDraftRef.current()
    })

    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const attachLayers = () => {
      if (cancelled || mapRef.current !== map) return
      if (!isMapAlive(map)) {
        retryTimer = setTimeout(attachLayers, 60)
        return
      }
      kmlLayerRef.current = L.layerGroup().addTo(map)
      boreholeLayerRef.current = L.layerGroup().addTo(map)
      draftLayerRef.current = L.layerGroup().addTo(map)
      map.invalidateSize({ animate: false })
      fitIndia(map, false)
      setMapReady((n) => n + 1)
    }

    map.whenReady(() => {
      requestAnimationFrame(attachLayers)
    })

    return () => {
      cancelled = true
      if (retryTimer != null) clearTimeout(retryTimer)
      map.stop()
      map.off()
      map.remove()
      mapRef.current = null
      kmlLayerRef.current = null
      nearbyLayerRef.current = null
      gridHighlightLayerRef.current = null
      roadLayerRef.current = null
      shiftLayerRef.current = null
      connectionLayerRef.current = null
      draftLayerRef.current = null
      boreholeLayerRef.current = null
      markerRef.current = null
      ringRef.current = null
      searchRingRef.current = null
      clearLeafletContainer(containerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    clearDraftRef.current()
    const map = mapRef.current
    if (!isMapAlive(map)) return
    if (drawMode === 'pin' || drawMode === 'point') map.doubleClickZoom.enable()
    else map.doubleClickZoom.disable()
  }, [drawMode])

  useEffect(() => {
    onDraftCountChange?.(draftCount)
  }, [draftCount, onDraftCountChange])

  useEffect(() => {
    if (!undoDraftTick) return
    const pts = draftPtsRef.current
    if (!pts.length) return
    draftPtsRef.current = pts.slice(0, -1)
    setDraftCount(draftPtsRef.current.length)
    redrawDraftRef.current()
  }, [undoDraftTick])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = window.setTimeout(() => {
      if (isMapAlive(map)) map.invalidateSize({ animate: false })
    }, 80)
    return () => window.clearTimeout(t)
  }, [result, plannedTowers.length, kmlFeatures.length])

  useEffect(() => {
    const map = mapRef.current
    const layer = boreholeLayerRef.current
    if (!isMapAlive(map) || !layer || !mapReady) return
    layer.clearLayers()
    const points = result?.geotechnicalIntelligence?.boreholeInvestigationPlan?.points
    if (!points?.length) return
    points.forEach((p) => {
      const selected = highlightBoreholeId === p.boreholeId
      const m = L.circleMarker([p.latitude, p.longitude], {
        radius: selected ? 13 : 9,
        color: selected ? '#f59e0b' : '#0f766e',
        weight: selected ? 3 : 2,
        fillColor: selected ? '#fde68a' : '#5eead4',
        fillOpacity: 0.95,
      })
      m.bindTooltip(p.boreholeId, {
        permanent: true,
        direction: 'top',
        className: 'ts-bh-label',
        offset: [0, -10],
      })
      m.bindPopup(
        `<strong>${p.boreholeId}</strong><br/>Proposed GIS investigation point<br/>Depth: 0.0–${p.recommendedInvestigationDepthM.toFixed(1)} m<br/><span style="font-size:10px;color:#64748b">${p.selectionReason}</span>`
      )
      m.on('click', () => onBoreholeSelectRef.current?.(p.boreholeId))
      m.addTo(layer)
    })
  }, [
    result?.geotechnicalIntelligence?.boreholeInvestigationPlan,
    mapReady,
    highlightBoreholeId,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!isMapAlive(map) || !mapReady || !highlightBoreholeId) return
    const pt = result?.geotechnicalIntelligence?.boreholeInvestigationPlan?.points.find(
      (p) => p.boreholeId === highlightBoreholeId
    )
    if (!pt) return
    map.setView([pt.latitude, pt.longitude], Math.max(map.getZoom(), 16), { animate: true })
  }, [boreholeFocusTick, highlightBoreholeId, mapReady, result?.geotechnicalIntelligence?.boreholeInvestigationPlan])

  useEffect(() => {
    const map = mapRef.current
    const layer = kmlLayerRef.current
    if (!isMapAlive(map) || !layer || !mapReady) return
    layer.clearLayers()

    if (!kmlFeatures.length && !plannedTowers.length) return

    const outline = '#22d3ee'
    const fill = '#22d3ee'
    const bounds = L.latLngBounds([])

    kmlFeatures.forEach((feat) => {
      if (feat.type === 'Polygon') {
        const poly = L.polygon(feat.latlngs, {
          color: outline,
          weight: 3.5,
          opacity: 1,
          fillColor: fill,
          fillOpacity: 0.18,
          lineJoin: 'round',
        })
        if (feat.name) {
          poly.bindTooltip(feat.name, {
            permanent: true,
            direction: 'center',
            className: 'ts-kml-label',
          })
        }
        poly.addTo(layer)
        bounds.extend(poly.getBounds())
      } else if (feat.type === 'LineString') {
        L.polyline(feat.latlngs, {
          color: '#111827',
          weight: 14,
          opacity: 0.75,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer)
        const line = L.polyline(feat.latlngs, {
          color: corridorLineColor,
          weight: 7,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        })
        line.addTo(layer)
        const label = [
          feat.name || 'Suggested corridor',
          voltageKv != null ? `${voltageKv} kV` : null,
          'screening suggestion — not an order',
        ]
          .filter(Boolean)
          .join(' · ')
        line.bindTooltip(label, { sticky: true, className: 'ts-kml-label' })
        bounds.extend(line.getBounds())
      } else if (feat.type === 'Point') {
        feat.latlngs.forEach(([la, lo]) => {
          const m = L.circleMarker([la, lo], {
            radius: 8,
            color: '#fff',
            weight: 2,
            fillColor: outline,
            fillOpacity: 0.95,
          })
          if (feat.name) {
            m.bindTooltip(feat.name, { permanent: true, direction: 'top', className: 'ts-kml-label' })
          }
          m.addTo(layer)
          bounds.extend([la, lo])
        })
      }
    })

    planningKmlFeatures.forEach((feat) => {
      if (feat.type === 'Polygon') {
        const poly = L.polygon(feat.latlngs, {
          color: '#7c3aed',
          weight: 3,
          opacity: 1,
          dashArray: '8 6',
          fillColor: '#a78bfa',
          fillOpacity: 0.12,
        })
        poly.bindTooltip('Planning investigation area', { sticky: true, className: 'ts-kml-label' })
        poly.addTo(layer)
        bounds.extend(poly.getBounds())
      } else if (feat.type === 'LineString') {
        const line = L.polyline(feat.latlngs, {
          color: '#7c3aed',
          weight: 6,
          opacity: 1,
          dashArray: '10 8',
          lineCap: 'round',
        })
        line.bindTooltip('Planning transmission line', { sticky: true, className: 'ts-kml-label' })
        line.addTo(layer)
        bounds.extend(line.getBounds())
      }
    })

    const dense = plannedTowers.length > 60
    const adviceByIndex = new Map(placementAdvice.map((a) => [a.index, a]))
    const bestPad = powerConnect?.bestPadIndex ?? null
    const padLabel = (index: number) => candidateIdByIndex?.[index] ?? `T${index}`
    plannedTowers.forEach((tower) => {
      const advice = adviceByIndex.get(tower.index)
      const isBest = bestPad != null && tower.index === bestPad
      const showLabel =
        !analyzing &&
        (isBest ||
          advice?.verdict === 'place' ||
          tower.index === 1 ||
          tower.index === plannedTowers.length ||
          (!dense && tower.index % 8 === 0))
      const hideSkip = advice?.verdict === 'skip_existing' && !analyzing
      const rainbowFill = candidateColorByIndex?.[tower.index]
      const fill =
        rainbowFill ??
        (advice?.verdict === 'skip_existing'
          ? '#94a3b8'
          : advice?.verdict === 'too_close'
            ? '#f59e0b'
            : advice?.verdict === 'review'
              ? '#38bdf8'
              : '#22c55e')
      if (isBest && !analyzing) {
        L.circleMarker([tower.lat, tower.lon], {
          radius: dense ? 16 : 20,
          color: '#0f766e',
          weight: 3,
          fillColor: '#5eead4',
          fillOpacity: 0.3,
        })
          .bindTooltip(`★ Best new pad ${padLabel(tower.index)} · power take-off`, {
            permanent: true,
            direction: 'top',
            offset: [0, -10],
            className: 'ts-tower-label',
          })
          .addTo(layer)
      }
      const marker = L.circleMarker([tower.lat, tower.lon], {
        radius: hideSkip ? (dense ? 5 : 6) : isBest ? (dense ? 10 : 14) : dense ? 7 : 11,
        color: isBest ? '#0f766e' : '#ffffff',
        weight: isBest ? 4 : hideSkip ? 2 : 3,
        fillColor: isBest ? '#14b8a6' : fill,
        fillOpacity: hideSkip ? 0.55 : 1,
      })
      if (showLabel) {
        marker.bindTooltip(
          isBest
            ? `★ ${padLabel(tower.index)} · ${voltageLabel(voltageKv)}`
            : `${padLabel(tower.index)} · ${voltageLabel(voltageKv)}`,
          {
            permanent: true,
            direction: 'top',
            offset: [0, -8],
            className: 'ts-tower-label',
          }
        )
      }
      marker
        .bindPopup(
          `<strong>${isBest ? '★ Best new transmission pad ' : 'Suggested pad '}${padLabel(tower.index)
          }</strong><br/>${voltageLabel(voltageKv)}<br/>${spanM ? `${spanM} m span` : ''}<br/>${isBest && powerConnect
            ? `<b style="color:#0f766e">Suggested power take-off toward “${powerConnect.station.name
            }” (~${powerConnect.stationToPadKm.toFixed(2)} km) · ~${powerConnect.confidencePct
            }% screening confidence</b><br/>`
            : ''
          }${advice
            ? `<b>${advice.verdict === 'place'
              ? 'Suggestion: place OK'
              : advice.verdict === 'skip_existing'
                ? 'Suggestion: skip / reuse existing'
                : advice.verdict === 'too_close'
                  ? 'Suggestion: shift (under min span)'
                  : 'Suggestion: review first'
            }</b><br/>${advice.reason}<br/><em>Not an order — change kV anytime.</em><br/>`
            : ''
          }${tower.lat.toFixed(6)}, ${tower.lon.toFixed(6)}<br/><em>Click marker for full details</em>`
        )
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          onTowerSelect?.({
            kind: 'planned',
            index: tower.index,
            lat: tower.lat,
            lon: tower.lon,
            voltageKv,
            spanM,
            advice,
            isBestPad: isBest,
          })
        })
        .addTo(layer)
      bounds.extend([tower.lat, tower.lon])
    })

    if (bounds.isValid() && isMapAlive(map)) {
      map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 16 })
    }
  }, [kmlFeatures, planningKmlFeatures, plannedTowers, voltageKv, spanM, placementAdvice, corridorLineColor, powerConnect, mapReady, analyzing, onTowerSelect, candidateIdByIndex, candidateColorByIndex])

  useEffect(() => {
    const map = mapRef.current
    if (!analyzing || !isMapAlive(map) || !mapReady) return

    if (!map.getPane('ts-scan')) {
      map.createPane('ts-scan')
      const pane = map.getPane('ts-scan')
      if (pane) pane.style.zIndex = '450'
    }

    const group = L.layerGroup([], { pane: 'ts-scan' }).addTo(map)
    const scanOpts = { pane: 'ts-scan' as const }
    let raf = 0

    const corridor = corridorScanPoints(plannedTowers, kmlFeatures)
    const metrics = pathMetrics(corridor)
    const pulseAt =
      plannedTowers.length > 0
        ? plannedTowers.map((t) => L.latLng(t.lat, t.lon))
        : corridor.filter((_, i) => i === 0 || i === corridor.length - 1 || i % 3 === 0)

    const pulses = pulseAt.map((ll) =>
      L.circleMarker(ll, {
        ...scanOpts,
        radius: 14,
        color: '#5eead4',
        weight: 2,
        fillColor: '#22d3ee',
        fillOpacity: 0.18,
      }).addTo(group)
    )

    if (metrics) {
      L.polyline(metrics.pts, {
        ...scanOpts,
        color: '#5eead4',
        weight: 10,
        opacity: 0.22,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)

      const beam = L.polyline([metrics.pts[0], metrics.pts[1] ?? metrics.pts[0]], {
        ...scanOpts,
        color: '#22d3ee',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group)

      const head = L.circleMarker(metrics.pts[0], {
        ...scanOpts,
        radius: 10,
        color: '#ffffff',
        weight: 2,
        fillColor: '#22d3ee',
        fillOpacity: 1,
      }).addTo(group)

      const LOOP_MS = 2800
      const beamM = Math.max(metrics.total * 0.12, 80)
      const t0 = performance.now()
      const tick = (now: number) => {
        const u = ((now - t0) % LOOP_MS) / LOOP_MS
        const d = u * metrics.total
        const from = d - beamM
        beam.setLatLngs(slicePath(metrics, from, d))
        head.setLatLng(alongPath(metrics, d))
        pulses.forEach((p, i) => {
          const wave = 0.5 + 0.5 * Math.sin(now / 280 + i * 0.9)
          p.setRadius(11 + wave * 8)
          p.setStyle({ fillOpacity: 0.1 + wave * 0.22, opacity: 0.45 + wave * 0.45 })
        })
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } else if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      const maxM = Math.max(searchRadiusKm, 8) * 1000
      const rings = [0, 0.45].map(() =>
        L.circle([lat, lon], {
          ...scanOpts,
          radius: 80,
          color: '#22d3ee',
          weight: 2,
          fillColor: '#22d3ee',
          fillOpacity: 0.08,
        }).addTo(group)
      )
      const t0 = performance.now()
      const LOOP_MS = 2400
      const tick = (now: number) => {
        rings.forEach((ring, i) => {
          const u = ((now - t0) / LOOP_MS + i * 0.45) % 1
          ring.setRadius(60 + u * maxM)
          ring.setStyle({
            opacity: 0.55 * (1 - u),
            fillOpacity: 0.12 * (1 - u),
          })
        })
        pulses.forEach((p, i) => {
          const wave = 0.5 + 0.5 * Math.sin(now / 280 + i)
          p.setRadius(12 + wave * 7)
        })
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(raf)
      group.remove()
    }
  }, [analyzing, plannedTowers, kmlFeatures, lat, lon, mapReady, searchRadiusKm])

  useEffect(() => {
    const map = mapRef.current
    if (!isMapAlive(map) || !mapReady) return
    const hasStart = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)

    if (!nearbyLayerRef.current) {
      nearbyLayerRef.current = L.layerGroup().addTo(map)
    }
    const layer = nearbyLayerRef.current
    layer.clearLayers()

    if (!showNearbyGrid) return
    const hiTowerIds = new Set<string>()
    const hiStationIds = new Set<string>()
    if (highlightTowerId) hiTowerIds.add(highlightTowerId)
    if (highlightStationId) hiStationIds.add(highlightStationId)
    if (powerConnect?.towerNearStation) hiTowerIds.add(powerConnect.towerNearStation.id)
    if (powerConnect?.towerNearPad) hiTowerIds.add(powerConnect.towerNearPad.id)
    if (powerConnect?.station) hiStationIds.add(powerConnect.station.id)

    // Ensure connect targets are drawn even if missing from the asset slice
    const drawAssets = [...nearbyAssets]
    const seen = new Set(drawAssets.map((a) => a.id))
    const ensure = (
      hint: { id: string; name: string; kind: string; lat: number; lon: number; distanceKm: number; voltageKv: number | null } | null | undefined,
      kind: NearbyPowerAsset['kind']
    ) => {
      if (!hint || seen.has(hint.id)) return
      seen.add(hint.id)
      drawAssets.push({
        id: hint.id,
        name: hint.name,
        kind,
        distanceKm: hint.distanceKm,
        voltageKv: hint.voltageKv,
        voltagesKv: hint.voltageKv != null ? [hint.voltageKv] : [],
        source: 'osm',
        lat: hint.lat,
        lon: hint.lon,
      })
    }
    ensure(powerConnect?.station, powerConnect?.station?.kind === 'plant' ? 'plant' : 'substation')
    ensure(powerConnect?.towerNearStation, 'tower')
    ensure(powerConnect?.towerNearPad, 'tower')

    // Existing transmission lines between towers (draw under markers)
    if (showNearbyGrid && corridorPath.length >= 2) {
      const lineSegs = transmissionLineSegments(drawAssets, corridorPath)
      for (const link of lineSegs) {
        const midLat = (link.from.lat + link.to.lat) / 2
        const midLon = (link.from.lon + link.to.lon) / 2
        const spanM = Math.round(link.km * 1000)
        L.polyline(
          [
            [link.from.lat, link.from.lon],
            [link.to.lat, link.to.lon],
          ],
          { color: '#22c55e', weight: 5, opacity: 0.92, lineCap: 'round' }
        )
          .bindTooltip(
            `${towerKvDisplay(link.from)} ↔ ${towerKvDisplay(link.to)} · ${spanM} m`,
            { permanent: spanM < 800, direction: 'center', className: 'ts-power-line-label' }
          )
          .addTo(layer)
        L.circleMarker([midLat, midLon], {
          radius: 0,
          opacity: 0,
          fillOpacity: 0,
        })
          .bindTooltip(`${spanM} m span`, {
            permanent: spanM >= 800,
            direction: 'center',
            className: 'ts-power-line-label',
          })
          .addTo(layer)
      }
    }

    drawAssets.forEach((asset) => {
      const isHiTower = hiTowerIds.has(asset.id)
      const isHiStation = hiStationIds.has(asset.id)
      const isHighlight = isHiTower || isHiStation
      const isTowerNearSs = powerConnect?.towerNearStation?.id === asset.id
      const isTowerNearPad = powerConnect?.towerNearPad?.id === asset.id && !isTowerNearSs

      const fill =
        asset.kind === 'substation'
          ? '#a855f7'
          : asset.kind === 'line'
            ? '#22c55e'
            : asset.kind === 'tower'
              ? '#3b82f6'
              : asset.kind === 'plant'
                ? '#ec4899'
                : '#2dd4bf'

      if (isHighlight) {
        L.circleMarker([asset.lat, asset.lon], {
          radius: 18,
          color: isHiStation ? '#a855f7' : '#3b82f6',
          weight: 3,
          fillColor: isHiStation ? '#c084fc' : '#93c5fd',
          fillOpacity: 0.25,
        })
          .bindTooltip(
            isHiStation
              ? `Nearest power station · ${asset.name}`
              : isTowerNearSs
                ? `Existing tower nearest to station · ${asset.name}`
                : isTowerNearPad
                  ? `Existing tower nearest to new pad · ${asset.name}`
                  : `Nearest tower · ${asset.name}`,
            { direction: 'top', offset: [0, -10], sticky: true }
          )
          .addTo(layer)
      }

      const marker = L.circleMarker([asset.lat, asset.lon], {
        radius: isHighlight ? 12 : asset.kind === 'pole' ? 6 : asset.kind === 'tower' ? 9 : 8,
        color: isHighlight ? (isHiStation ? '#7e22ce' : '#1d4ed8') : '#ffffff',
        weight: isHighlight ? 3 : 2,
        fillColor: fill,
        fillOpacity: 0.95,
      })

      const voltageText =
        asset.voltageKv != null
          ? asset.voltageInferred
            ? `~${asset.voltageKv} kV (from line/name)`
            : `${asset.voltageKv} kV`
          : 'Not tagged in OSM/TAMS'
      const conf =
        asset.voltageKv != null
          ? asset.voltageInferred
            ? 'medium (inferred from line/name)'
            : 'high (tagged)'
          : 'low'
      const distText = formatDistKm(asset.distanceKm)

      const roleLabel = isHiStation
        ? '★ Nearest station · '
        : isTowerNearSs
          ? '★ Tower next to station · '
          : isTowerNearPad
            ? '★ Tower near new pad · '
            : isHiTower
              ? '★ Nearest tower · '
              : ''

      const towerKvLabel =
        asset.kind === 'tower' || asset.kind === 'pole' ? towerKvDisplay(asset) : null

      if (asset.kind === 'substation' || asset.kind === 'plant') {
        const distM = Math.round(asset.distanceKm * 1000)
        marker.bindTooltip(
          `${isHiStation ? '★ ' : ''}${asset.name} · ${distM} m · ${towerKvDisplay(asset)}`,
          {
            permanent: true,
            direction: 'top',
            offset: [0, -8],
            className: 'ts-nearest-ss-label',
          }
        )
      } else {
        const distM = Math.round(asset.distanceKm * 1000)
        marker.bindTooltip(
          towerKvLabel != null
            ? isHighlight
              ? `${roleLabel}${towerKvLabel} · ${distM} m`
              : `${towerKvLabel} · ${distM} m`
            : `${roleLabel}${powerKindLabel(asset.kind)}${
                asset.voltageKv != null ? ` · ${towerKvDisplay(asset)}` : ' · kV unmapped'
              } · ${distText}`,
          {
            direction: towerKvLabel != null ? 'bottom' : 'top',
            offset: towerKvLabel != null ? [0, 8] : [0, -6],
            permanent: asset.kind === 'tower' || asset.kind === 'pole' || isHighlight,
            sticky: towerKvLabel == null && !isHighlight,
            className:
              towerKvLabel != null
                ? asset.voltageKv != null && !asset.voltageInferred
                  ? 'ts-tower-kv-label'
                  : 'ts-tower-kv-label ts-tower-kv-label--unknown'
                : undefined,
          }
        )
      }

      marker
        .bindPopup(
          `<strong>${asset.name}</strong><br/>` +
          (roleLabel
            ? `<b style="color:${isHiStation ? '#7e22ce' : '#1d4ed8'}">${roleLabel.trim()}</b><br/>`
            : '') +
          `ID: ${asset.id}<br/>` +
          `${powerKindLabel(asset.kind)} · ${distText} (Haversine)<br/>` +
          `Voltage: ${voltageText}<br/>` +
          `Lat: ${asset.lat.toFixed(6)} · Lon: ${asset.lon.toFixed(6)}<br/>` +
          `Source: ${asset.source === 'tams' ? 'TAMS GIS' : 'OSM'} · Confidence: ${conf}<br/>` +
          `<span style="opacity:.7">Click marker for full details</span>`
        )
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          onTowerSelect?.({ kind: 'existing', asset })
        })
        .addTo(layer)

      if (asset.kind === 'line') {
        L.circleMarker([asset.lat, asset.lon], {
          radius: 4,
          color: '#22c55e',
          weight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.5,
        }).addTo(layer)
      }
    })

    if (!powerConnect && hasStart && showNearbyGrid) {
      // Fallback: start pin → nearest asset
      const nearest =
        [...drawAssets].sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null
      if (nearest && Number.isFinite(nearest.lat) && Number.isFinite(nearest.lon)) {
        L.polyline(
          [
            [lat!, lon!],
            [nearest.lat, nearest.lon],
          ],
          {
            color: '#22d3ee',
            weight: 3,
            opacity: 0.85,
            dashArray: '8 6',
          }
        )
          .bindTooltip(
            `Suggested connect direction · ${nearest.distanceKm < 1
              ? `${Math.round(nearest.distanceKm * 1000)} m`
              : `${nearest.distanceKm.toFixed(2)} km`
            } direct (Haversine)`,
            { sticky: true }
          )
          .addTo(layer)
      }
    }
  }, [
    nearbyAssets,
    lat,
    lon,
    mapReady,
    highlightTowerId,
    highlightStationId,
    powerConnect,
    plannedTowers,
    kmlFeatures,
    voltageKv,
    showNearbyGrid,
    corridorPath,
    onTowerSelect,
  ])

  /** Nearest tower / SS + power take-off — always visible (not gated on kV pick). */
  useEffect(() => {
    const map = mapRef.current
    if (!isMapAlive(map) || !mapReady) return

    if (!map.getPane('ts-grid-highlight')) {
      map.createPane('ts-grid-highlight')
      const pane = map.getPane('ts-grid-highlight')
      if (pane) pane.style.zIndex = '470'
    }

    if (!gridHighlightLayerRef.current) {
      gridHighlightLayerRef.current = L.layerGroup([], { pane: 'ts-grid-highlight' }).addTo(map)
    }
    const layer = gridHighlightLayerRef.current
    layer.clearLayers()

    const path =
      corridorPath.length >= 2
        ? corridorPath
        : corridorScanPoints(plannedTowers, kmlFeatures).map((p) => ({ lat: p.lat, lon: p.lng }))

    const drawNearest = (
      hint: CorridorConnectHint | null | undefined,
      kind: 'tower' | 'station'
    ) => {
      if (!hint || path.length < 2) return
      const snap = closestPointOnCorridor(hint.lat, hint.lon, path)
      const distLabel = metersLabel(hint.distanceKm)
      const kv =
        hint.voltageKv != null
          ? ` · ${hint.voltageKv} kV`
          : voltageKv != null
            ? ` · ${voltageKv} kV`
            : ''
      const color = kind === 'tower' ? '#2563eb' : '#7e22ce'
      const css = kind === 'tower' ? 'ts-nearest-tower-label' : 'ts-nearest-ss-label'
      const lineLabel =
        kind === 'tower'
          ? `Nearest tower · ${distLabel} from line${kv}`
          : `Nearest SS · ${hint.name} · ${distLabel}${kv}`

      L.polyline(
        [
          [snap.lat, snap.lon],
          [hint.lat, hint.lon],
        ],
        { color, weight: 5, opacity: 0.95, dashArray: '12 8' }
      )
        .bindTooltip(lineLabel, { permanent: true, direction: 'center', className: css })
        .addTo(layer)

      L.circleMarker([snap.lat, snap.lon], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip('Closest point on your line', { direction: 'bottom', offset: [0, 6] })
        .addTo(layer)

      const assetKind = kind === 'station' ? ('substation' as const) : ('tower' as const)
      L.circleMarker([hint.lat, hint.lon], {
        radius: kind === 'station' ? 17 : 15,
        color: '#ffffff',
        weight: 4,
        fillColor: kind === 'station' ? '#a855f7' : '#3b82f6',
        fillOpacity: 1,
      })
        .bindTooltip(
          kind === 'tower' ? `★ Nearest tower · ${distLabel}${kv}` : `★ ${hint.name} · ${distLabel}${kv}`,
          { permanent: true, direction: 'top', offset: [0, -14], className: css }
        )
        .bindPopup(
          `<strong>${kind === 'tower' ? 'Nearest transmission tower' : 'Nearest substation / power station'}</strong><br/>` +
            `${hint.name}<br/>` +
            `Distance from corridor: <b>${distLabel}</b>${kv}<br/>` +
            `Lat: ${hint.lat.toFixed(6)} · Lon: ${hint.lon.toFixed(6)}<br/>` +
            `<em>Click for full details in side card</em>`
        )
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          onTowerSelect?.({
            kind: 'existing',
            asset: {
              id: hint.id,
              name: hint.name,
              kind: assetKind,
              distanceKm: hint.distanceKm,
              voltageKv: hint.voltageKv,
              voltagesKv: hint.voltageKv != null ? [hint.voltageKv] : [],
              source: 'osm',
              lat: hint.lat,
              lon: hint.lon,
            },
          })
        })
        .addTo(layer)
    }

    drawNearest(corridorNearestTower, 'tower')
    drawNearest(corridorNearestStation, 'station')

    if (powerConnect) {
      const ss = powerConnect.station
      const padM = Math.round(powerConnect.stationToPadKm * 1000)
      L.polyline(
        [
          [ss.lat, ss.lon],
          [powerConnect.bestPadLat, powerConnect.bestPadLon],
        ],
        { color: '#0f766e', weight: 5, opacity: 0.95, dashArray: '10 6' }
      )
        .bindTooltip(
          `Power take-off · SS → T${powerConnect.bestPadIndex} · ${padM} m · ~${powerConnect.confidencePct}% fit`,
          { permanent: true, direction: 'center', className: 'ts-nearest-ss-label' }
        )
        .addTo(layer)

      if (powerConnect.towerNearStation) {
        const tw = powerConnect.towerNearStation
        const dM = Math.round(tw.distanceKm * 1000)
        L.polyline(
          [
            [ss.lat, ss.lon],
            [tw.lat, tw.lon],
          ],
          { color: '#7c3aed', weight: 4, opacity: 0.95, dashArray: '8 5' }
        )
          .bindTooltip(`SS → existing tower · ${dM} m`, {
            permanent: true,
            direction: 'center',
            className: 'ts-nearest-ss-label',
          })
          .addTo(layer)
      }

      if (
        powerConnect.towerNearPad &&
        powerConnect.towerNearPad.id !== powerConnect.towerNearStation?.id
      ) {
        const tw = powerConnect.towerNearPad
        const dM = Math.round(tw.distanceKm * 1000)
        L.polyline(
          [
            [powerConnect.bestPadLat, powerConnect.bestPadLon],
            [tw.lat, tw.lon],
          ],
          { color: '#2563eb', weight: 4, opacity: 0.95, dashArray: '6 4' }
        )
          .bindTooltip(`T${powerConnect.bestPadIndex} → existing tower · ${dM} m`, {
            permanent: true,
            direction: 'center',
            className: 'ts-nearest-tower-label',
          })
          .addTo(layer)
      }
    }
  }, [
    corridorNearestTower,
    corridorNearestStation,
    corridorPath,
    plannedTowers,
    kmlFeatures,
    powerConnect,
    voltageKv,
    mapReady,
    onTowerSelect,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!isMapAlive(map) || !mapReady) return
    if (!roadLayerRef.current) {
      roadLayerRef.current = L.layerGroup().addTo(map)
    }
    const layer = roadLayerRef.current
    layer.clearLayers()

    const drawRoad = (
      fromLat: number,
      fromLon: number,
      roadLat: number,
      roadLon: number,
      km: number,
      label: string
    ) => {
      const distLabel = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`
      L.polyline(
        [
          [fromLat, fromLon],
          [roadLat, roadLon],
        ],
        { color: '#f97316', weight: 2.5, opacity: 0.88, dashArray: '6 5' }
      )
        .bindTooltip(`${label} · ${distLabel} (road)`, { sticky: true, className: 'ts-road-label' })
        .addTo(layer)

      L.circleMarker([roadLat, roadLon], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: '#f97316',
        fillOpacity: 1,
      })
        .bindTooltip(`${label} · nearest road · ${distLabel}`, {
          permanent: padRoadAccess.length <= 8,
          direction: 'top',
          offset: [0, -6],
          className: 'ts-road-label',
        })
        .addTo(layer)
    }

    for (const pad of padRoadAccess) {
      drawRoad(pad.lat, pad.lon, pad.roadLat, pad.roadLon, pad.km, `T${pad.index}`)
    }

    if (
      padRoadAccess.length === 0 &&
      lat != null &&
      lon != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      roadNearest
    ) {
      drawRoad(lat, lon, roadNearest.lat, roadNearest.lon, roadNearest.km, 'Site pin')
    }
  }, [lat, lon, roadNearest, padRoadAccess, mapReady])

  /** Shift / reuse ghost markers when filtering or selecting pads */
  useEffect(() => {
    const map = mapRef.current
    if (!isMapAlive(map) || !mapReady) return

    if (!map.getPane('ts-shift')) {
      map.createPane('ts-shift')
      const pane = map.getPane('ts-shift')
      if (pane) pane.style.zIndex = '465'
    }

    if (!shiftLayerRef.current) {
      shiftLayerRef.current = L.layerGroup([], { pane: 'ts-shift' }).addTo(map)
    }
    const layer = shiftLayerRef.current
    layer.clearLayers()

    const showShiftFor = (advice: PlannedTowerAdvice) => {
      if (advice.suggestedLat == null || advice.suggestedLon == null) return false
      if (advice.verdict !== 'too_close' && advice.verdict !== 'skip_existing') return false
      if (focusedPadIndex === advice.index) return true
      if (verdictFilter && advice.verdict === verdictFilter) return true
      return false
    }

    for (const advice of placementAdvice) {
      if (!showShiftFor(advice)) continue
      const isShift = advice.verdict === 'too_close'
      const ghostColor = isShift ? '#f59e0b' : '#94a3b8'
      const label = isShift ? `Shift T${advice.index}` : `Reuse T${advice.index}`

      L.polyline(
        [
          [advice.lat, advice.lon],
          [advice.suggestedLat!, advice.suggestedLon!],
        ],
        { color: ghostColor, weight: 4, opacity: 0.9, dashArray: '10 8' }
      )
        .bindTooltip(
          isShift
            ? `Suggested shift for T${advice.index} · ≥ min span`
            : `Reuse existing tower for T${advice.index}`,
          { permanent: true, direction: 'center', className: 'ts-shift-label' }
        )
        .addTo(layer)

      L.circleMarker([advice.suggestedLat!, advice.suggestedLon!], {
        radius: 13,
        color: '#ffffff',
        weight: 3,
        fillColor: ghostColor,
        fillOpacity: 0.35,
      })
        .bindTooltip(label, {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'ts-shift-label',
        })
        .addTo(layer)

      if (advice.nearestExistingLat != null && advice.nearestExistingLon != null) {
        L.polyline(
          [
            [advice.suggestedLat!, advice.suggestedLon!],
            [advice.nearestExistingLat, advice.nearestExistingLon],
          ],
          { color: '#2563eb', weight: 3, opacity: 0.75, dashArray: '6 5' }
        )
          .bindTooltip(
            advice.nearestExistingM != null
              ? `To ${advice.nearestExistingName ?? 'existing'} · ${formatMeters(advice.nearestExistingM)}`
              : `To ${advice.nearestExistingName ?? 'existing tower'}`,
            { sticky: true, className: 'ts-nearest-tower-label' }
          )
          .addTo(layer)
      }
    }

    // Focus ring on selected pad
    if (focusedPadIndex != null) {
      const tower = plannedTowers.find((t) => t.index === focusedPadIndex)
      if (tower) {
        L.circleMarker([tower.lat, tower.lon], {
          radius: 22,
          color: '#17879a',
          weight: 3,
          fillColor: '#17879a',
          fillOpacity: 0.12,
        }).addTo(layer)
      }
    }
  }, [placementAdvice, plannedTowers, focusedPadIndex, verdictFilter, mapReady])

  /** Straight-line + optional OSRM road route when a tower/pad is selected */
  useEffect(() => {
    const map = mapRef.current
    if (!isMapAlive(map) || !mapReady) return

    if (!map.getPane('ts-connection')) {
      map.createPane('ts-connection')
      const pane = map.getPane('ts-connection')
      if (pane) pane.style.zIndex = '480'
    }

    if (!connectionLayerRef.current) {
      connectionLayerRef.current = L.layerGroup([], { pane: 'ts-connection' }).addTo(map)
    }
    const layer = connectionLayerRef.current
    layer.clearLayers()

    if (!connectionOverlay) return

    const {
      from,
      to,
      straightM,
      showRoad,
      roadKm,
      roadCoords,
      roadLoading,
      corridorSnap,
      corridorDistM,
    } = connectionOverlay
    const straightLabel = `Power line · ${formatMeters(straightM)}`

    L.polyline(
      [
        [from.lat, from.lon],
        [to.lat, to.lon],
      ],
      { color: '#64748b', weight: 4, opacity: 0.95, dashArray: '14 8' }
    )
      .bindTooltip(straightLabel, {
        permanent: true,
        direction: 'center',
        className: 'ts-connection-straight-label',
      })
      .addTo(layer)

    if (corridorSnap) {
      L.circleMarker([corridorSnap.lat, corridorSnap.lon], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      })
        .bindTooltip(
          corridorDistM != null
            ? `Closest on your line · ${formatMeters(corridorDistM)}`
            : 'Closest on your line',
          { permanent: true, direction: 'bottom', offset: [0, 6], className: 'ts-nearest-tower-label' }
        )
        .addTo(layer)
    }

    if (showRoad) {
      if (roadCoords?.length) {
        const roadM = roadKm != null ? roadKm * 1000 : null
        L.polyline(roadCoords, { color: '#f97316', weight: 6, opacity: 0.95 })
          .bindTooltip(
            roadM != null ? `By road · ${formatMeters(roadM)}` : 'By road (OSRM)',
            { permanent: true, direction: 'center', className: 'ts-road-route-label' }
          )
          .addTo(layer)
      } else if (roadLoading) {
        const midLat = (from.lat + to.lat) / 2
        const midLon = (from.lon + to.lon) / 2
        L.circleMarker([midLat, midLon], {
          radius: 0,
          opacity: 0,
          fillOpacity: 0,
        })
          .bindTooltip('Loading road route…', { permanent: true, className: 'ts-road-route-label' })
          .addTo(layer)
      }
    }

    L.circleMarker([to.lat, to.lon], {
      radius: 10,
      color: '#ffffff',
      weight: 3,
      fillColor: '#2563eb',
      fillOpacity: 1,
    })
      .bindTooltip(to.label, { direction: 'top', offset: [0, -8], className: 'ts-nearest-tower-label' })
      .addTo(layer)
  }, [connectionOverlay, mapReady])

  useEffect(() => {
    if (!padFocusTick || focusedPadIndex == null || !mapReady) return
    const map = mapRef.current
    if (!isMapAlive(map)) return
    const tower = plannedTowers.find((t) => t.index === focusedPadIndex)
    if (tower) {
      map.setView([tower.lat, tower.lon], Math.max(map.getZoom(), 16), { animate: true })
    }
  }, [padFocusTick, focusedPadIndex, plannedTowers, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!isMapAlive(map) || !mapReady) return
    const hasStart = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)

    if (!hasStart) {
      markerRef.current?.remove()
      ringRef.current?.remove()
      searchRingRef.current?.remove()
      markerRef.current = null
      ringRef.current = null
      searchRingRef.current = null
      if (hadStartRef.current) {
        fitIndia(map, true)
      }
      hadStartRef.current = false
      return
    }

    const color = result ? verdictColor(result.verdict) : '#22d3ee'
    const hidePad = plannedTowers.length > 0 || kmlFeatures.some((f) => f.type !== 'Point')

    if (!markerRef.current) {
      markerRef.current = L.circleMarker([lat, lon], {
        radius: 11,
        color: '#fff',
        weight: 3,
        fillColor: color,
        fillOpacity: 0.95,
      }).addTo(map)
    } else {
      markerRef.current.setLatLng([lat, lon])
      markerRef.current.setStyle({ fillColor: color })
    }

    if (!ringRef.current) {
      ringRef.current = L.circle([lat, lon], {
        radius: 140,
        color,
        weight: 2.5,
        fillColor: color,
        fillOpacity: 0.14,
      }).addTo(map)
    } else {
      ringRef.current.setLatLng([lat, lon])
      ringRef.current.setStyle({ color, fillColor: color })
    }

    const searchMeters = Math.max(searchRadiusKm, 8) * 1000
    if (!searchRingRef.current) {
      searchRingRef.current = L.circle([lat, lon], {
        radius: searchMeters,
        color: '#22d3ee',
        weight: 2,
        dashArray: '8 6',
        fillColor: '#22d3ee',
        fillOpacity: 0.04,
      }).addTo(map)
    } else {
      searchRingRef.current.setLatLng([lat, lon])
      searchRingRef.current.setRadius(searchMeters)
    }

    if (hidePad) {
      markerRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
      ringRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
    } else {
      markerRef.current.setStyle({ opacity: 1, fillOpacity: 0.95 })
      ringRef.current.setStyle({ opacity: 1, fillOpacity: 0.14 })
    }

    if (!kmlFeatures.length && isMapAlive(map)) {
      if (searchRadiusKm >= 15 && searchRingRef.current) {
        map.fitBounds(searchRingRef.current.getBounds(), { padding: [28, 28], maxZoom: 11, animate: false })
      } else {
        map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: false })
      }
    }
    hadStartRef.current = true
  }, [lat, lon, result, kmlFeatures, plannedTowers.length, mapReady, searchRadiusKm])

  useEffect(() => {
    if (!focusTick || !mapReady) return
    const map = mapRef.current
    if (!isMapAlive(map)) return
    const bounds = L.latLngBounds([])
    plannedTowers.forEach((t) => bounds.extend([t.lat, t.lon]))
    kmlFeatures.forEach((feat) => {
      feat.latlngs.forEach(([la, lo]) => bounds.extend([la, lo]))
    })
    if (lat != null && lon != null) bounds.extend([lat, lon])
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18), { padding: [36, 36], maxZoom: 15, animate: true })
    } else if (lat != null && lon != null) {
      map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: true })
    }
  }, [focusTick, mapReady, lat, lon, kmlFeatures, plannedTowers])

  const canFinish =
    (drawMode === 'line' && draftCount >= 2) || (drawMode === 'polygon' && draftCount >= 3)

  const hint =
    drawMode === 'pin'
      ? 'Set Start · click the map to pin the origin only. Then draw or click Analyze.'
      : drawMode === 'point'
        ? 'Analyze Pad · click the map to run live suitability on that point now'
        : drawMode === 'line'
          ? `Line mode · click vertices (${draftCount}) · Finish when done`
          : `Polygon mode · click corners (${draftCount}) · Finish when done`

  const isDrawing = drawMode === 'line' || drawMode === 'polygon'
  const showDrawPhase = isDrawing && draftCount > 0

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 w-full h-full ts-suitability-map" />

      {drawingEnabled && startLocationSlot && (
        <div
          className={`absolute top-3 right-3 pointer-events-none w-[min(380px,calc(100vw-2rem))] ${
            chromeElevated ? 'z-[5000]' : 'z-[1200]'
          }`}
        >
          <div className="pointer-events-auto ts-glass ts-glass-see px-3 py-2.5">{startLocationSlot}</div>
        </div>
      )}

      {drawingEnabled && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 pointer-events-none w-[min(720px,calc(100vw-2rem))] ${
            geometryActionSlot ? 'bottom-[8.5rem]' : 'bottom-6'
          } ${chromeElevated ? 'z-[5000]' : 'z-[1200]'}`}
        >
          <div className="pointer-events-auto ts-glass ts-glass-see px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(
                [
                  {
                    id: 'pin' as const,
                    label: 'Set Start',
                    title: 'Click the map to place the start. Does not run analysis.',
                  },
                  { id: 'line' as const, label: 'Draw Line', title: 'Click vertices to draw a corridor, then Finish.' },
                  { id: 'polygon' as const, label: 'Draw Polygon', title: 'Click corners to draw a site, then Finish.' },
                  {
                    id: 'point' as const,
                    label: 'Analyze Pad',
                    title: 'Click the map to run live analysis on that pad immediately.',
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-label={m.title}
                  title={m.title}
                  aria-pressed={drawMode === m.id}
                  onClick={() => onDrawModeChange(m.id)}
                  className={`h-9 px-3 rounded-xl text-xs font-black border transition-colors ${
                    drawMode === m.id
                      ? 'bg-[#17879a] text-white border-[#126b79]'
                      : 'bg-white/80 text-[#0f172a] border-[rgba(51,65,85,0.22)] hover:border-[#17879a]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
              {onSearchRadiusKm && (
                <SearchRadiusToolbarButton value={searchRadiusKm} onChange={onSearchRadiusKm} />
              )}
            </div>
            <p className="mt-1.5 text-center text-[11px] font-bold text-[#0f172a] leading-snug">{hint}</p>
            {lat != null && lon != null && (
              <p className="mt-0.5 text-center text-[10px] font-bold text-[#17879a] tabular-nums">
                Live search {searchRadiusKm} km
                {corridorPowerLoading ? ' · loading grid…' : ''}
              </p>
            )}
            {(corridorNearestTower || corridorNearestStation) && (
              <div className="mt-1.5 rounded-lg border border-[rgba(51,65,85,0.14)] bg-white/85 px-2 py-1.5 text-[10px] leading-snug text-[#263238]">
                {corridorNearestTower && (
                  <p>
                    <span className="font-black text-[#1d4ed8]">Nearest tower:</span>{' '}
                    {corridorNearestTower.name} · {formatDistKm(corridorNearestTower.distanceKm)}
                  </p>
                )}
                {corridorNearestStation && (
                  <p className={corridorNearestTower ? 'mt-0.5' : ''}>
                    <span className="font-black text-[#7e22ce]">Nearest station:</span>{' '}
                    {corridorNearestStation.name} · {formatDistKm(corridorNearestStation.distanceKm)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {drawingEnabled && showDrawPhase && (
        <div
          className={`absolute bottom-[7.5rem] left-1/2 -translate-x-1/2 pointer-events-none ${
            chromeElevated ? 'z-[5001]' : 'z-[1201]'
          }`}
        >
          <div className="pointer-events-auto ts-glass ts-glass-see px-4 py-3 text-center shadow-lg min-w-[min(22rem,calc(100vw-2rem))]">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#17879a]">
              {drawMode === 'line' ? 'Drawing corridor' : 'Drawing site polygon'}
            </p>
            <p className="mt-1 text-[11px] font-bold text-[#0f172a]">
              {draftCount} point{draftCount === 1 ? '' : 's'} placed · click map to add corners
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={!canFinish}
                onClick={() => finishDraftRef.current()}
                className="h-10 px-4 rounded-xl text-xs font-black border border-[#27856b]/50 bg-[#dff0e8] text-[#126b79] disabled:opacity-40"
              >
                Finish drawing
              </button>
              <button
                type="button"
                disabled={draftCount === 0}
                onClick={() => clearDraftRef.current()}
                className="h-10 px-4 rounded-xl text-xs font-bold border border-[rgba(51,65,85,0.22)] text-[#0f172a] disabled:opacity-40 hover:bg-white/50"
              >
                Clear draft
              </button>
              <button
                type="button"
                onClick={() => {
                  clearDraftRef.current()
                  onDrawModeChange('pin')
                }}
                className="h-10 px-4 rounded-xl text-xs font-bold border border-rose-200 text-rose-800 hover:bg-rose-50"
              >
                Cancel drawing
              </button>
            </div>
          </div>
        </div>
      )}

      {geometryActionSlot && (
        <div
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none ${
            chromeElevated ? 'z-[5002]' : 'z-[1202]'
          }`}
        >
          <div className="pointer-events-auto">{geometryActionSlot}</div>
        </div>
      )}
    </div>
  )
}
