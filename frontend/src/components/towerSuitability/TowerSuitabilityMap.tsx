import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { GOOGLE_SATELLITE_URL, GOOGLE_SUBDOMAINS } from '@/lib/basemapTiles'
import type { KmlFeature, KmlLatLng } from './fetchSiteSignals'
import type { PlannedTower } from './lineTowers'
import { voltageLabel } from './lineTowers'
import type { NearbyPowerAsset } from './nearbyPowerSupply'
import { powerKindLabel } from './nearbyPowerSupply'
import type { PlannedTowerAdvice, PowerConnectSuggestion } from './corridorPlacementAdvice'
import type { SuitabilityResult } from './scoring'
import { verdictColor } from './scoring'

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

export default function TowerSuitabilityMap({
  lat,
  lon,
  result,
  kmlFeatures,
  plannedTowers = [],
  nearbyAssets = [],
  placementAdvice = [],
  voltageKv = null,
  spanM,
  searchRadiusKm = 8,
  corridorLineColor = '#fbbf24',
  highlightTowerId = null,
  highlightStationId = null,
  powerConnect = null,
  analyzing = false,
  drawMode,
  drawingEnabled = true,
  focusTick = 0,
  undoDraftTick = 0,
  onDraftCountChange,
  onDrawModeChange,
  onPick,
  onGeometryDrawn,
}: {
  lat: number | null
  lon: number | null
  result: SuitabilityResult | null
  kmlFeatures: KmlFeature[]
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
  /** Station ↔ best new pad (+ existing tower) connect suggestion */
  powerConnect?: PowerConnectSuggestion | null
  analyzing?: boolean
  drawMode: DrawMode
  drawingEnabled?: boolean
  focusTick?: number
  undoDraftTick?: number
  onDraftCountChange?: (count: number) => void
  onDrawModeChange: (mode: DrawMode) => void
  onPick: (lat: number, lon: number) => void
  onGeometryDrawn: (feature: KmlFeature, focus: { lat: number; lon: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const ringRef = useRef<L.Circle | null>(null)
  const searchRingRef = useRef<L.Circle | null>(null)
  const kmlLayerRef = useRef<L.LayerGroup | null>(null)
  const nearbyLayerRef = useRef<L.LayerGroup | null>(null)
  const draftLayerRef = useRef<L.LayerGroup | null>(null)
  const draftPtsRef = useRef<KmlLatLng[]>([])
  const drawModeRef = useRef(drawMode)
  const drawingEnabledRef = useRef(drawingEnabled)
  const onPickRef = useRef(onPick)
  const onDrawnRef = useRef(onGeometryDrawn)
  const hadStartRef = useRef(false)
  const [mapReady, setMapReady] = useState(0)
  const [draftCount, setDraftCount] = useState(0)

  drawModeRef.current = drawMode
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
      if (!drawingEnabledRef.current) return
      const mode = drawModeRef.current
      const { lat: la, lng: lo } = e.latlng
      if (mode === 'pin' || mode === 'point') {
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
      draftLayerRef.current = null
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

    const dense = plannedTowers.length > 60
    const adviceByIndex = new Map(placementAdvice.map((a) => [a.index, a]))
    const bestPad = powerConnect?.bestPadIndex ?? null
    plannedTowers.forEach((tower) => {
      const advice = adviceByIndex.get(tower.index)
      const isBest = bestPad != null && tower.index === bestPad
      const fill =
        advice?.verdict === 'skip_existing'
          ? '#ef4444'
          : advice?.verdict === 'too_close'
            ? '#f59e0b'
            : advice?.verdict === 'review'
              ? '#38bdf8'
              : '#22c55e'
      if (isBest) {
        L.circleMarker([tower.lat, tower.lon], {
          radius: dense ? 16 : 20,
          color: '#0f766e',
          weight: 3,
          fillColor: '#5eead4',
          fillOpacity: 0.3,
        })
          .bindTooltip(`★ Best new pad T${tower.index} · power take-off`, {
            permanent: true,
            direction: 'top',
            offset: [0, -10],
            className: 'ts-tower-label',
          })
          .addTo(layer)
      }
      L.circleMarker([tower.lat, tower.lon], {
        radius: isBest ? (dense ? 10 : 14) : dense ? 7 : 11,
        color: isBest ? '#0f766e' : '#ffffff',
        weight: isBest ? 4 : 3,
        fillColor: isBest ? '#14b8a6' : fill,
        fillOpacity: 1,
      })
        .bindTooltip(isBest ? `★ T${tower.index} (best for power)` : `T${tower.index}`, {
          permanent:
            isBest ||
            !dense ||
            tower.index === 1 ||
            tower.index === plannedTowers.length ||
            tower.index % 5 === 0,
          direction: 'top',
          offset: [0, -8],
          className: 'ts-tower-label',
        })
        .bindPopup(
          `<strong>${isBest ? '★ Best new transmission pad ' : 'Suggested pad '}T${tower.index
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
          }${tower.lat.toFixed(5)}, ${tower.lon.toFixed(5)}`
        )
        .addTo(layer)
      bounds.extend([tower.lat, tower.lon])
    })

    if (bounds.isValid() && isMapAlive(map)) {
      map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 16 })
    }
  }, [kmlFeatures, plannedTowers, voltageKv, spanM, placementAdvice, corridorLineColor, powerConnect, mapReady])

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

    // Existing infrastructure only — never mix with planned T1…Tn (those are on kml layer)
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
        asset.voltageKv != null ? `${asset.voltageKv} kV` : 'Unknown'
      const conf =
        asset.voltageKv != null
          ? asset.voltageInferred
            ? 'medium (inferred)'
            : 'high (tagged)'
          : 'low'
      const distText =
        asset.distanceKm < 1
          ? `${Math.round(asset.distanceKm * 1000)} m`
          : `${asset.distanceKm.toFixed(2)} km`

      const roleLabel = isHiStation
        ? '★ Nearest station · '
        : isTowerNearSs
          ? '★ Tower next to station · '
          : isTowerNearPad
            ? '★ Tower near new pad · '
            : isHiTower
              ? '★ Nearest tower · '
              : ''

      marker
        .bindTooltip(
          `${roleLabel}${powerKindLabel(asset.kind)}${asset.voltageKv != null ? ` · ${asset.voltageKv} kV` : ' · Unknown V'
          } · ${distText}`,
          { direction: 'top', offset: [0, -6], sticky: true }
        )
        .bindPopup(
          `<strong>${asset.name}</strong><br/>` +
          (roleLabel
            ? `<b style="color:${isHiStation ? '#7e22ce' : '#1d4ed8'}">${roleLabel.trim()}</b><br/>`
            : '') +
          `ID: ${asset.id}<br/>` +
          `${powerKindLabel(asset.kind)} · ${distText} (Haversine)<br/>` +
          `Voltage: ${voltageText}<br/>` +
          `Source: ${asset.source === 'tams' ? 'TAMS GIS' : 'OSM'} · Confidence: ${conf}<br/>` +
          `<span style="opacity:.7">Existing infrastructure — suggestion reference only</span>`
        )
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

    // Power take-off links: station → best new pad, station → existing tower
    if (powerConnect) {
      const ss = powerConnect.station
      L.polyline(
        [
          [ss.lat, ss.lon],
          [powerConnect.bestPadLat, powerConnect.bestPadLon],
        ],
        {
          color: '#0f766e',
          weight: 4,
          opacity: 0.95,
          dashArray: '10 6',
        }
      )
        .bindTooltip(
          `Power take-off · SS → new T${powerConnect.bestPadIndex} · ${powerConnect.stationToPadKm.toFixed(
            2
          )} km · ~${powerConnect.confidencePct}% fit`,
          { sticky: true }
        )
        .addTo(layer)

      if (powerConnect.towerNearStation) {
        const tw = powerConnect.towerNearStation
        L.polyline(
          [
            [ss.lat, ss.lon],
            [tw.lat, tw.lon],
          ],
          {
            color: '#7c3aed',
            weight: 3,
            opacity: 0.9,
            dashArray: '6 4',
          }
        )
          .bindTooltip(
            `Station → nearest existing tower · ${tw.name} · ${tw.distanceKm.toFixed(2)} km`,
            { sticky: true }
          )
          .addTo(layer)
      }

      if (
        powerConnect.towerNearPad &&
        powerConnect.towerNearPad.id !== powerConnect.towerNearStation?.id
      ) {
        const tw = powerConnect.towerNearPad
        L.polyline(
          [
            [powerConnect.bestPadLat, powerConnect.bestPadLon],
            [tw.lat, tw.lon],
          ],
          {
            color: '#2563eb',
            weight: 2.5,
            opacity: 0.85,
            dashArray: '4 4',
          }
        )
          .bindTooltip(
            `New T${powerConnect.bestPadIndex} → nearest existing tower · ${tw.name} · ${tw.distanceKm.toFixed(
              2
            )} km`,
            { sticky: true }
          )
          .addTo(layer)
      }
    } else if (hasStart) {
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
  }, [nearbyAssets, lat, lon, mapReady, highlightTowerId, highlightStationId, powerConnect])

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

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 w-full h-full ts-suitability-map" />

      {drawingEnabled && (
        <div className="absolute top-3 left-1/2 z-[1200] -translate-x-1/2 w-[min(640px,calc(100%-1.5rem))] pointer-events-auto">
          <div className="ts-glass px-3 py-2.5">
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
                  className={`h-9 px-3 rounded-xl text-xs font-black border transition-colors ${drawMode === m.id
                      ? 'bg-[#17879a] text-white border-[#126b79]'
                      : 'bg-white/80 text-[#0f172a] border-[rgba(51,65,85,0.22)] hover:border-[#17879a]'
                    }`}
                >
                  {m.label}
                </button>
              ))}
              {(drawMode === 'line' || drawMode === 'polygon') && (
                <>
                  <button
                    type="button"
                    disabled={!canFinish}
                    onClick={() => finishDraftRef.current()}
                    className="h-9 px-3 rounded-xl text-xs font-black border border-[#27856b]/50 bg-[#dff0e8] text-[#126b79] disabled:opacity-40"
                  >
                    Finish drawing
                  </button>
                  <button
                    type="button"
                    disabled={draftCount === 0}
                    onClick={() => clearDraftRef.current()}
                    className="h-9 px-3 rounded-xl text-xs font-bold border border-[rgba(51,65,85,0.22)] text-[#0f172a] disabled:opacity-40 hover:bg-white/50"
                  >
                    Clear draft
                  </button>
                </>
              )}
            </div>
            <p className="mt-1.5 text-center text-[11px] font-bold text-[#0f172a]">{hint}</p>
            {plannedTowers.length > 0 && (
              <p className="mt-1 text-center text-sm font-black text-[#b97816] tabular-nums">
                {plannedTowers.length} towers · {voltageLabel(voltageKv)}
                {spanM != null ? ` · ${spanM} m` : ''}
              </p>
            )}
            {lat != null && lon != null && (
              <p className="mt-0.5 text-center text-[10px] font-bold text-[#17879a] tabular-nums">
                Live search {searchRadiusKm} km
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
