/**
 * 3D Cesium globe — satellite imagery, extruded substations, tower models
 * Cesium loaded via shared loader to avoid Next.js webpack conflicts.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'

import type { Asset } from '@/lib/api'
import { fetchGisTowers } from '@/lib/api'
import { loadCesium, type CesiumModule } from '@/lib/cesiumLoader'
import { addLiveTowerModel, addElevatedSpansBetweenTowers, liveConductorHeightM } from '@/components/towers/towerGeometry'
import {
  resolveTowerTypeForAsset,
  loadCapacityForKv,
  assetVoltageKv,
  LOAD_CAPACITY_TIERS,
  type TowerStructureHints,
} from '@/config/towerTypeCatalog'
import { CESIUM_EOX_SENTINEL_URL, CESIUM_GOOGLE_SATELLITE_URL, HIGH_ZOOM } from '@/lib/basemapTiles'
import { withTowerNeOffset } from '@/lib/towerPosition'
import { getPlaceById, getStateFilterForPlace, INDIA_MAP_BOUNDS } from '@/config/places'

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

function addLineAsset(
  Cesium: CesiumModule,
  viewer: import('cesium').Viewer,
  asset: Asset,
  towers: Asset[],
  isSelected: boolean,
  hasAlert: boolean,
  loadColor?: string,
  heightByTowerId?: Map<string, number>
) {
  if (asset.geometry?.type !== 'LineString') return []
  const coords = asset.geometry.coordinates as number[][]
  if (coords.length < 2) return []

  const lineColor = isSelected
    ? '#ffffff'
    : hasAlert
    ? '#f97316'
    : loadColor ?? TYPE_CSS.line

  // Elevate corridor lines to nearest tower conductor height when towers exist.
  const canElevate = towers.length > 0 && heightByTowerId && heightByTowerId.size > 0
  const positions = canElevate
    ? coords.map(([lng, lat]) => {
        let bestH = 35
        let bestD = Number.POSITIVE_INFINITY
        for (const t of towers) {
          const dLat = (t.latitude - lat) * 111320
          const dLon = (t.longitude - lng) * 111320 * Math.cos((lat * Math.PI) / 180)
          const d = Math.hypot(dLat, dLon)
          if (d < bestD) {
            bestD = d
            bestH = heightByTowerId.get(t.id) ?? 35
          }
        }
        // Soften height when far from any tower
        const up = bestD < 500 ? bestH : Math.max(bestH * 0.55, 18)
        return Cesium.Cartesian3.fromDegrees(lng, lat, up)
      })
    : Cesium.Cartesian3.fromDegreesArray(coords.flatMap(([lng, lat]) => [lng, lat]))

  const lineEntity = viewer.entities.add({
    id: asset.id,
    name: asset.name,
    polyline: {
      positions,
      width: isSelected ? 5 : 2.5,
      arcType: canElevate ? Cesium.ArcType.NONE : undefined,
      material: Cesium.Color.fromCssColorString(lineColor).withAlpha(isSelected ? 0.95 : 0.75),
      clampToGround: !canElevate,
    },
    label: isSelected
      ? {
          text: `${asset.name} · Line`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, 12),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 180000),
        }
      : undefined,
  })
  return lineEntity?.id ? [lineEntity.id as string] : []
}

function addAssetEntity(
  Cesium: CesiumModule,
  viewer: import('cesium').Viewer,
  asset: Asset,
  isSelected: boolean,
  hasAlert: boolean
): string[] | import('cesium').Entity | null {
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
    return addLineAsset(Cesium, viewer, asset, [], isSelected, hasAlert)
  }

  if (asset.asset_type === 'tower') {
    // Tower-wise procedural model from voltage → catalog structure
    return null
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
  selectedPlaceId,
}: {
  assets: Asset[]
  selectedAssetId?: string | null
  alertAssetIds?: string[]
  onSelectAsset?: (id: string) => void
  selectedPlaceId?: string
  _activeLayers?: {
    heatmap: boolean
    riskOverlay: boolean
    satellite: boolean
    terrain: boolean
    corridors: boolean
  }
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const cesiumRef = useRef<CesiumModule | null>(null)
  const entityIdsRef = useRef<string[]>([])
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [towers, setTowers] = useState<Asset[]>([])
  const [towersTruncated, setTowersTruncated] = useState(false)
  const [full3dCount, setFull3dCount] = useState(0)
  const [markerCount, setMarkerCount] = useState(0)
  const [renderedCount, setRenderedCount] = useState(0)
  const [usePointFallback, setUsePointFallback] = useState(false)
  const [colorMode, setColorMode] = useState<'health' | 'load'>('load')
  const initialFocusRef = useRef(false)

  const passedTowerIds = useMemo(
    () => new Set(assets.filter((a) => a.asset_type === 'tower').map((a) => a.id)),
    [assets]
  )

  const passedTowers = useMemo(
    () => assets.filter((a) => a.asset_type === 'tower'),
    [assets]
  )

  const extraTowers = useMemo(
    () => towers.filter((t) => !passedTowerIds.has(t.id)),
    [towers, passedTowerIds]
  )

  const displayAssets = useMemo(
    () => [...assets.filter((a) => a.asset_type !== 'tower'), ...passedTowers, ...extraTowers],
    [assets, passedTowers, extraTowers]
  )

  // Snap each tower onto line *geometry* (not centroids). At junctions where
  // several lines meet, take the highest voltage for load-capacity colouring.
  const towerHintsById = useMemo(() => {
    const map = new Map<string, TowerStructureHints>()
    const SNAP_M = 120
    type LineGeom = {
      id: string
      voltageKv: number
      cables?: number
      circuits?: number
      power?: string
      structure?: string
      name?: string
      coords: number[][]
    }

    const distToSegM = (lon: number, lat: number, a: number[], b: number[]) => {
      const latR = (lat * Math.PI) / 180
      const mLat = 111320
      const mLon = Math.max(111320 * Math.cos(latR), 1)
      const ax = (a[0] - lon) * mLon
      const ay = (a[1] - lat) * mLat
      const bx = (b[0] - lon) * mLon
      const by = (b[1] - lat) * mLat
      const abx = bx - ax
      const aby = by - ay
      const ab2 = abx * abx + aby * aby
      const t = ab2 < 1e-6 ? 0 : Math.max(0, Math.min(1, (-ax * abx - ay * aby) / ab2))
      return Math.hypot(ax + t * abx, ay + t * aby)
    }

    const minDistToLineM = (lon: number, lat: number, coords: number[][]) => {
      let best = Number.POSITIVE_INFINITY
      for (let i = 0; i < coords.length - 1; i++) {
        best = Math.min(best, distToSegM(lon, lat, coords[i], coords[i + 1]))
      }
      return best
    }

    const lines: LineGeom[] = []
    displayAssets.forEach((a) => {
      if (a.asset_type !== 'line') return
      const coords =
        a.geometry?.type === 'LineString' ? (a.geometry.coordinates as number[][]) : null
      if (!coords || coords.length < 2) return
      const cables = a.metadata?.cables != null ? parseFloat(String(a.metadata.cables)) : undefined
      const circuits =
        a.metadata?.circuits != null ? parseFloat(String(a.metadata.circuits)) : undefined
      lines.push({
        id: a.id,
        voltageKv: assetVoltageKv(a),
        cables: Number.isFinite(cables) ? cables : undefined,
        circuits: Number.isFinite(circuits) ? circuits : undefined,
        power: typeof a.metadata?.power === 'string' ? a.metadata.power : undefined,
        structure: typeof a.metadata?.structure === 'string' ? a.metadata.structure : undefined,
        name: a.name,
        coords,
      })
    })

    displayAssets.forEach((a) => {
      if (a.asset_type !== 'tower') return
      const towerPower = typeof a.metadata?.power === 'string' ? a.metadata.power : undefined
      const towerStructure =
        typeof a.metadata?.structure === 'string' ? a.metadata.structure : undefined

      const hits: Array<LineGeom & { distM: number }> = []
      for (const line of lines) {
        const d = minDistToLineM(a.longitude, a.latitude, line.coords)
        if (d <= SNAP_M) hits.push({ ...line, distM: d })
      }
      hits.sort((x, y) => y.voltageKv - x.voltageKv || x.distM - y.distM)

      if (hits.length === 0) {
        const ownKv = assetVoltageKv(a)
        map.set(a.id, {
          voltageKv: ownKv,
          power: towerPower,
          structure: towerStructure,
          name: a.name,
        })
        return
      }

      const voltages = [...new Set(hits.map((h) => Math.round(h.voltageKv)))].sort((x, y) => y - x)
      const voltageConflict = voltages.length > 1
      const primary = hits[0]
      const cables = Math.max(...hits.map((h) => h.cables ?? 0)) || primary.cables
      const circuits = Math.max(...hits.map((h) => h.circuits ?? 0)) || primary.circuits

      // Prefer the tower's own voltage when present; otherwise use highest snapped line.
      const ownRaw =
        a.metadata?.voltage_kv ?? a.metadata?.voltage ?? a.voltage_level_kv ?? null
      const ownParsed =
        ownRaw != null && ownRaw !== ''
          ? typeof ownRaw === 'number'
            ? ownRaw
            : parseFloat(String(ownRaw))
          : NaN
      const ownKv = Number.isFinite(ownParsed) && ownParsed > 0 ? ownParsed : undefined
      const voltageKv = ownKv ?? primary.voltageKv

      map.set(a.id, {
        voltageKv,
        lineVoltages: voltages,
        voltageConflict: voltageConflict || (ownKv != null && Math.round(ownKv) !== Math.round(primary.voltageKv)),
        cables: cables && cables > 0 ? cables : undefined,
        circuits: circuits && circuits > 0 ? circuits : undefined,
        power: towerPower ?? primary.power,
        structure: towerStructure ?? primary.structure,
        name: a.name,
        snapDistanceM: primary.distM,
      })
    })
    return map
  }, [displayAssets])

  const towerState = getStateFilterForPlace(selectedPlaceId || '')

  const seedTowerQuery = useMemo(() => {
    const place = selectedPlaceId ? getPlaceById(selectedPlaceId) : undefined
    const bounds = place?.bounds ?? INDIA_MAP_BOUNDS
    const [[south, west], [north, east]] = bounds
    return {
      bbox: `${west},${south},${east},${north}`,
      state: towerState,
    }
  }, [selectedPlaceId, towerState])

  // Always load DB towers for the camera viewport and merge with any passed assets.
  // (Do not skip when assets already include a few towers — that hid most DB towers.)
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium || mapStatus !== 'ready') {
      // Initial seed until camera is ready — selected place bounds, not Gujarat-only
      let cancelled = false
      fetchGisTowers(seedTowerQuery.bbox, seedTowerQuery.state, 800)
        .then((res) => {
          if (!cancelled) {
            setTowers(res.assets)
            setTowersTruncated(res.truncated)
          }
        })
        .catch(() => {
          if (!cancelled) setTowers([])
        })
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight: AbortController | null = null

    const loadViewportTowers = () => {
      if (cancelled) return
      const rect = viewer.camera.computeViewRectangle()
      if (!rect) return
      const west = Cesium.Math.toDegrees(rect.west)
      const south = Cesium.Math.toDegrees(rect.south)
      const east = Cesium.Math.toDegrees(rect.east)
      const north = Cesium.Math.toDegrees(rect.north)
      // Pad bbox so edge / next-span towers are included for detect+connect
      const padLon = Math.max((east - west) * 0.15, 0.015)
      const padLat = Math.max((north - south) * 0.15, 0.015)
      const bbox = `${west - padLon},${south - padLat},${east + padLon},${north + padLat}`

      inFlight?.abort()
      inFlight = new AbortController()
      fetchGisTowers(bbox, seedTowerQuery.state, 5000, inFlight.signal)
        .then((res) => {
          if (!cancelled) {
            setTowers(res.assets)
            setTowersTruncated(res.truncated)
          }
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          // keep previous towers on transient failure
        })
    }

    const onCamera = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(loadViewportTowers, 350)
    }

    loadViewportTowers()
    viewer.camera.changed.addEventListener(onCamera)
    viewer.camera.moveEnd.addEventListener(onCamera)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      inFlight?.abort()
      try {
        viewer.camera.changed.removeEventListener(onCamera)
        viewer.camera.moveEnd.removeEventListener(onCamera)
      } catch {
        /* ignore */
      }
    }
  }, [mapStatus, seedTowerQuery.bbox, seedTowerQuery.state])

  // After towers arrive, zoom into a tight corridor so ideal-sized structures are visible.
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium || mapStatus !== 'ready') return
    if (initialFocusRef.current) return

    const all = displayAssets.filter((a) => a.asset_type === 'tower')
    if (all.length === 0) return

    // Prefer a compact cluster around the first tower (~1.2 km) for an ideal view.
    const anchor = all[0]
    const nearby = all.filter((t) => {
      const dLat = (t.latitude - anchor.latitude) * 111320
      const dLon = (t.longitude - anchor.longitude) * 111320 * Math.cos((anchor.latitude * Math.PI) / 180)
      return Math.hypot(dLat, dLon) <= 1200
    })
    const sample = (nearby.length >= 3 ? nearby : all).slice(0, 20)

    initialFocusRef.current = true
    const points = sample.map((t) => {
      const p = withTowerNeOffset(t)
      return Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 0)
    })
    const sphere = Cesium.BoundingSphere.fromPoints(points)
    // Ideal viewing distance for ~30–60 m towers (not regional overview).
    const range = Math.min(Math.max(sphere.radius * 3.5, 700), 2200)
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 1.5,
      // Oblique pitch so tower height is obvious (not top-down flat bases)
      offset: new Cesium.HeadingPitchRange(0.7, Cesium.Math.toRadians(-42), range),
    })
  }, [displayAssets, mapStatus])


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
          requestRenderMode: false,
          targetFrameRate: 30,
        })

        viewer.imageryLayers.removeAll()
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a2e28')
        try {
          // Sentinel base (never shows Esri "Map data not yet available")
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: CESIUM_EOX_SENTINEL_URL,
              maximumLevel: 18,
              credit: '© EOX Sentinel-2',
            })
          )
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: CESIUM_GOOGLE_SATELLITE_URL,
              maximumLevel: HIGH_ZOOM.maxNativeZoom,
              credit: '© Google',
            })
          )
        } catch {
          /* solid globe fallback */
        }

        viewer.scene.globe.enableLighting = false
        viewer.scene.fog.enabled = false
        viewer.scene.globe.depthTestAgainstTerrain = false
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true
        }

        // Recover instead of freezing the whole globe on shader failures.
        viewer.scene.rethrowRenderErrors = false
        viewer.scene.renderError.addEventListener(() => {
          try {
            viewer.scene.requestRender()
          } catch {
            /* ignore */
          }
        })

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
          if (!Cesium.defined(picked)) return
          const entity = picked.id as import('cesium').Entity | undefined
          if (!entity) return
          const props = entity.properties as {
            assetId?: { getValue?: (t: unknown) => string }
          } | undefined
          const fromProp = props?.assetId?.getValue?.(viewer.clock.currentTime)
          if (typeof fromProp === 'string' && fromProp) {
            onSelectAsset?.(fromProp)
            return
          }
          const eid = typeof entity.id === 'string' ? entity.id : ''
          const towerMatch = eid.match(/^tower-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
          if (towerMatch) {
            onSelectAsset?.(towerMatch[1])
            return
          }
          if (eid) onSelectAsset?.(eid)
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        viewerRef.current = viewer
        setMapStatus('ready')
        // Add lightweight render tick to update animated materials and respond to interactions.
        const tickFn = () => viewer.scene.requestRender()
        viewer.clock.onTick.addEventListener(tickFn)
        // Ask for render on camera change (user interaction)
        viewer.camera.changed.addEventListener(tickFn)
        ;(viewerRef as any)._tickFn = tickFn
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
      // remove render listeners if present
      const vf = viewerRef.current
      const tickFn = (vf as any)?._tickFn
      if (vf && tickFn) {
        try {
          vf.clock.onTick.removeEventListener(tickFn)
          vf.camera.changed.removeEventListener(tickFn)
        } catch (_err) {
          // If the listener removal fails, ignore because viewer is already disposing.
        }
      }
      viewerRef.current?.destroy()
      viewerRef.current = null
      entityIdsRef.current = []
    }
  }, [onSelectAsset])


  useEffect(() => {
      const viewer = viewerRef.current
      const Cesium = cesiumRef.current
      if (!viewer || !Cesium) return

      // Every tower in the near field gets solid 3D / pole markers; denser load for detect+connect.
      const MAX_FULL_3D = 400
      const MAX_LINE_ENTITIES = 600
      const FULL_3D_RADIUS_M = 12000

      const towersAll = displayAssets.filter((a) => a.asset_type === 'tower')
      const linesAll = displayAssets.filter((a) => a.asset_type === 'line')
      const otherAssets = displayAssets.filter((a) => a.asset_type !== 'tower' && a.asset_type !== 'line')

      // Prefer towers closest to camera focus so the visible area gets full 3D first.
      let camLon = 72.5
      let camLat = 22.8
      try {
        const carto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
        camLon = Cesium.Math.toDegrees(carto.longitude)
        camLat = Cesium.Math.toDegrees(carto.latitude)
      } catch {
        /* keep defaults */
      }

      const ranked = [...towersAll]
        .map((t) => {
          const dLat = (t.latitude - camLat) * 111320
          const dLon = (t.longitude - camLon) * 111320 * Math.cos((camLat * Math.PI) / 180)
          return { t, d: Math.hypot(dLat, dLon) }
        })
        .sort((a, b) => a.d - b.d)

      // Prefer near field; if camera is far, still solid-render the closest towers
      // so the 3D view is never empty when towers are loaded.
      const near = ranked.filter((x) => x.d <= FULL_3D_RADIUS_M)
      const structureTowers = (near.length > 0 ? near : ranked)
        .slice(0, MAX_FULL_3D)
        .map((x) => x.t)
      const structureIds = new Set(structureTowers.map((t) => t.id))
      const markerTowers = ranked.filter((x) => !structureIds.has(x.t.id)).map((x) => x.t)
      const lines = linesAll.slice(0, MAX_LINE_ENTITIES)

      setUsePointFallback(markerTowers.length > 0)
      setFull3dCount(structureTowers.length)
      setMarkerCount(markerTowers.length)

      entityIdsRef.current.forEach((id) => viewer.entities.removeById(id))
      entityIdsRef.current = []

      const heightByTowerId = new Map<string, number>()
      const colorByTowerId = new Map<string, string>()

      // Full solid 3D for every near/closest tower (lattice + pole)
      structureTowers.forEach((asset) => {
        const placed = withTowerNeOffset(asset)
        const isSelected = asset.id === selectedAssetId
        const hasAlert = alertAssetIds.includes(asset.id)
        const hints = towerHintsById.get(asset.id)
        const resolvedKv = hints?.voltageKv ?? assetVoltageKv(asset)
        const loadTier = colorMode === 'load' ? loadCapacityForKv(resolvedKv) : undefined
        const entry = resolveTowerTypeForAsset(asset, hints)
        heightByTowerId.set(asset.id, liveConductorHeightM(entry))
        const color = loadTier?.color ?? (entry.structure === 'pole' ? '#22c55e' : entry.color)
        colorByTowerId.set(asset.id, color)

        const ids = addLiveTowerModel(
          Cesium,
          viewer,
          placed,
          isSelected,
          hasAlert,
          loadTier ? { color: loadTier.color, mva: loadTier.mva } : undefined,
          resolvedKv,
          hints
        )
        entityIdsRef.current.push(...ids)
      })

      // 2) Far towers: lattice still get compact 3D stubs so none look "undetected"
      markerTowers.forEach((asset) => {
        const placed = withTowerNeOffset(asset)
        const isSelected = asset.id === selectedAssetId
        const hints = towerHintsById.get(asset.id)
        const resolvedKv = hints?.voltageKv ?? assetVoltageKv(asset)
        const loadTier = colorMode === 'load' ? loadCapacityForKv(resolvedKv) : undefined
        const entry = resolveTowerTypeForAsset(asset, hints)
        const color = loadTier?.color ?? (entry.structure === 'pole' ? '#22c55e' : entry.color)
        heightByTowerId.set(asset.id, liveConductorHeightM(entry))
        colorByTowerId.set(asset.id, color)
        const structLabel = entry.structure.replace(/_/g, ' ')
        const conflictNote = hints?.voltageConflict
          ? ` · ${hints.lineVoltages?.join('/')} kV`
          : ''
        const labelText = loadTier
          ? `${asset.name}\n${entry.voltageKv} kV · ${structLabel}${conflictNote}\n~${loadTier.mva} MVA`
          : `${asset.name}\n${entry.voltageKv} kV · ${structLabel}${conflictNote}`

        // Compact solid tower for lattice so gaps still read as 3D structures
        if (entry.structure !== 'pole') {
          const ids = addLiveTowerModel(
            Cesium,
            viewer,
            placed,
            isSelected,
            alertAssetIds.includes(asset.id),
            loadTier ? { color: loadTier.color, mva: loadTier.mva } : undefined,
            resolvedKv,
            hints
          )
          entityIdsRef.current.push(...ids)
          return
        }

        const ent = viewer.entities.add({
          id: `tower-${asset.id}`,
          name: asset.name,
          position: Cesium.Cartesian3.fromDegrees(placed.longitude, placed.latitude, 0),
          point: {
            pixelSize: isSelected ? 12 : 7,
            color: Cesium.Color.fromCssColorString(color),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(500, 1.4, 80000, 0.55),
          },
          label: {
            text: labelText,
            font: '11px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -8),
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#0a1020').withAlpha(0.85),
            backgroundPadding: new Cesium.Cartesian2(6, 3),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 25000),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: { assetId: asset.id },
        })
        if (ent?.id) entityIdsRef.current.push(ent.id as string)
      })

      // 3) Green corridor spans along line topology + junction adjacency (as in reference)
      const spanTowers = [...structureTowers, ...markerTowers].map(withTowerNeOffset)
      const spanIds = addElevatedSpansBetweenTowers(Cesium, viewer, spanTowers, {
        heightByTowerId,
        colorByTowerId,
        maxSpanM: 900,
        lines: lines.map((l) => ({
          id: l.id,
          geometry: l.geometry as { type: string; coordinates: number[][] } | undefined,
          metadata: l.metadata,
        })),
        defaultColor: '#22c55e',
      })
      entityIdsRef.current.push(...spanIds)

      // 4) Corridor lines elevated toward nearby towers
      lines.forEach((asset) => {
        const isSelected = asset.id === selectedAssetId
        const hasAlert = alertAssetIds.includes(asset.id)
        const resolvedKv = assetVoltageKv(asset)
        const loadTier = colorMode === 'load' ? loadCapacityForKv(resolvedKv) : undefined
        const lineIds = addLineAsset(
          Cesium,
          viewer,
          asset,
          spanTowers,
          isSelected,
          hasAlert,
          loadTier?.color ?? '#22c55e',
          heightByTowerId
        )
        entityIdsRef.current.push(...lineIds)
      })

      // 5) Substations / other
      otherAssets.forEach((asset) => {
        const isSelected = asset.id === selectedAssetId
        const hasAlert = alertAssetIds.includes(asset.id)
        const entityOrIds = addAssetEntity(Cesium, viewer, asset, isSelected, hasAlert)
        if (Array.isArray(entityOrIds)) {
          entityIdsRef.current.push(...entityOrIds)
        } else if (entityOrIds?.id) {
          entityIdsRef.current.push(entityOrIds.id as string)
        }
      })

      setRenderedCount(entityIdsRef.current.length)
      try {
        viewer.scene.requestRender()
      } catch {
        /* ignore */
      }
    }, [selectedAssetId, alertAssetIds, displayAssets, extraTowers, mapStatus, passedTowers, colorMode, towerHintsById])

  const typeBreakdown = towers.reduce<Record<string, number>>((acc, t) => {
    const entry = resolveTowerTypeForAsset(t, towerHintsById.get(t.id))
    acc[`${entry.structure}`] = (acc[`${entry.structure}`] || 0) + 1
    return acc
  }, {})
  const typeSummary = Object.entries(typeBreakdown)
    .slice(0, 4)
    .map(([k, v]) => `${v}× ${k}`)
    .join(' · ')

  const capacityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    displayAssets.forEach((a) => {
      if (a.asset_type !== 'tower') return
      const kv = towerHintsById.get(a.id)?.voltageKv ?? assetVoltageKv(a)
      const tier = loadCapacityForKv(kv)
      counts[tier.id] = (counts[tier.id] || 0) + 1
    })
    return counts
  }, [displayAssets, towerHintsById])

  const coverage = useMemo(() => {
    const towerList = displayAssets.filter((a) => a.asset_type === 'tower')
    let withCoords = 0
    let withOwnVoltage = 0
    towerList.forEach((a) => {
      if (Number.isFinite(a.latitude) && Number.isFinite(a.longitude)) withCoords += 1
      const raw = a.metadata?.voltage_kv ?? a.metadata?.voltage ?? a.voltage_level_kv
      const n = typeof raw === 'number' ? raw : raw != null && raw !== '' ? Number(raw) : NaN
      if (Number.isFinite(n) && n > 0) withOwnVoltage += 1
    })
    return {
      total: towerList.length,
      withCoords,
      withOwnVoltage,
      inferredVoltage: Math.max(0, towerList.length - withOwnVoltage),
    }
  }, [displayAssets])

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

      <div className="absolute top-4 left-4 z-10 bg-gray-900/90 text-[10px] text-gray-300 px-3 py-2 rounded-lg border border-gray-700 pointer-events-none max-w-sm">
        <p className="text-white font-semibold mb-0.5">
          DB in viewport: {towers.length.toLocaleString()} · On map:{' '}
          {coverage.total.toLocaleString()}
          {towersTruncated ? ' · truncated @5k' : ''}
        </p>
        <p className="text-slate-300 text-xs mb-0.5">
          Lat/lon: {coverage.withCoords.toLocaleString()}/{coverage.total.toLocaleString()} · Own
          voltage: {coverage.withOwnVoltage.toLocaleString()} · Load via line/default:{' '}
          {coverage.inferredVoltage.toLocaleString()}
        </p>
        <p className="text-slate-300 text-xs mb-1">
          Rendered: {renderedCount.toLocaleString()} · Full 3D:{' '}
          {full3dCount.toLocaleString()} · Markers: {markerCount.toLocaleString()}
          {usePointFallback ? ' · far markers on' : ' · full 3D focus'}
        </p>
        <p className="text-slate-400 leading-relaxed">
          {typeSummary || 'Pan/zoom to load DB towers…'} · database source when available
        </p>
      </div>

      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-[11px] font-medium shadow-lg">
          <button
            type="button"
            onClick={() => setColorMode('load')}
            className={`px-3 py-1.5 transition-colors ${
              colorMode === 'load'
                ? 'bg-amber-500 text-gray-900'
                : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800'
            }`}
          >
            Load capacity
          </button>
          <button
            type="button"
            onClick={() => setColorMode('health')}
            className={`px-3 py-1.5 transition-colors ${
              colorMode === 'health'
                ? 'bg-amber-500 text-gray-900'
                : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800'
            }`}
          >
            Health
          </button>
        </div>

        {colorMode === 'load' && (
          <div className="bg-gray-900/92 text-[11px] text-gray-200 px-3 py-2.5 rounded-lg border border-gray-700 shadow-lg max-w-[240px]">
            <p className="font-semibold text-white mb-1.5">
              Load capacity by voltage class
            </p>
            <ul className="space-y-1">
              {LOAD_CAPACITY_TIERS.map((tier) => (
                <li key={tier.id} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0 border border-black/40"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="flex-1 leading-tight">{tier.label}</span>
                  <span className="text-slate-400 tabular-nums">
                    ~{tier.mva} MVA
                  </span>
                  {capacityCounts[tier.id] ? (
                    <span className="text-white font-semibold tabular-nums ml-1">
                      {capacityCounts[tier.id]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-slate-400 mt-2 leading-snug">
              Towers &amp; their lines share the color of the load they can
              carry — matching colors mean the line is rated for that tower.
            </p>
          </div>
        )}
      </div>

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
