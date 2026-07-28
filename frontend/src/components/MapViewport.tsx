import React, { useCallback, useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

import AIAssistantFab from '@/components/map/AIAssistantFab'
import CorridorFocusOverlay from '@/components/map/CorridorFocusOverlay'
import MapIntelPanel from '@/components/map/MapIntelPanel'
import MapTopChrome from '@/components/map/MapTopChrome'
import { type HeatMapMode } from '@/components/map/HeatMapModeToggle'
import MapOverlaysPanel from '@/components/map/MapOverlaysPanel'
import MapControlRail, { type MapZoomHandlers } from '@/components/map/MapControlRail'
import { mapRightInset } from '@/components/map/mapLayout'
import { type MapBasemap } from '@/components/map/MapViewModeBar'
import TimeRangeSlider, { type TimeRange } from '@/components/map/TimeRangeSlider'
import WeatherLayerBar, { type WeatherOverlay } from '@/components/map/WeatherLayerBar'
import type { MapToolbarLayers } from '@/components/map/FloatingMapToolbar'
import { DEFAULT_PLACE_ID, flattenPlaces } from '@/config/places'
import { buildCorridorDirectionBrief } from '@/lib/corridorDirection'
import type { Alert, Asset, RegionAssetStats } from '@/lib/api'
import { computeRegionStats, filterAssetsByPlace } from '@/lib/placeFilter'
import type { MapStatusSnapshot } from '@/types/mapStatus'

const GISMap = dynamic(() => import('@/components/GISMap'), { ssr: false })
const GISMap3D = dynamic(() => import('@/components/GISMap3D'), { ssr: false })

type ViewMode = '2d' | '3d'
type AssetType = Asset['asset_type']

interface MapViewportProps {
  assets: Asset[]
  alerts?: Alert[]
  selectedAssetId?: string | null
  alertAssetIds?: string[]
  onSelectAsset?: (id: string) => void
  resizeSignal?: number
  onMapStatusChange?: (status: MapStatusSnapshot) => void
  selectedPlaceId?: string
  onSelectPlace?: (placeId: string) => void
  regionKmlStats?: RegionAssetStats | null
  placeAssetCounts?: Record<string, { total: number }>
  focusTarget?: { id: string; latitude: number; longitude: number } | null
  onFocusConsumed?: () => void
  highlightAssetId?: string | null
}

export default function MapViewport({
  assets,
  alerts = [],
  selectedAssetId,
  alertAssetIds = [],
  onSelectAsset,
  resizeSignal = 0,
  onMapStatusChange,
  selectedPlaceId: externalPlaceId,
  onSelectPlace: externalOnSelectPlace,
  regionKmlStats = null,
  placeAssetCounts: externalPlaceCounts,
  focusTarget = null,
  onFocusConsumed,
  highlightAssetId = null,
}: MapViewportProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [internalPlaceId, setInternalPlaceId] = useState(DEFAULT_PLACE_ID)
  const selectedPlaceId = externalPlaceId ?? internalPlaceId
  const onSelectPlace = externalOnSelectPlace ?? setInternalPlaceId

  const [mapZoom, setMapZoom] = useState<MapZoomHandlers | null>(null)
  const [heatMapMode, setHeatMapMode] = useState<HeatMapMode>('normal')
  const [timeRange, setTimeRange] = useState<TimeRange>('live')
  const [basemapMode, setBasemapMode] = useState<MapBasemap>('satellite')
  const [weatherLayers, setWeatherLayers] = useState<Set<WeatherOverlay>>(new Set())
  const [typeFilters, setTypeFilters] = useState<Record<AssetType, boolean>>({
    tower: true,
    substation: true,
    line: true,
  })
  const [voltageFilters, setVoltageFilters] = useState<Record<string, boolean>>({
    '765': true,
    '400': true,
    '220': true,
    '132': true,
    '66': true,
    other: true,
  })
  const [substationVoltageFilters, setSubstationVoltageFilters] = useState<Record<string, boolean>>({
    '765': true,
    '400': true,
    '220': true,
    '132': true,
    '66': true,
    other: true,
  })
  const [labelsOn, setLabelsOn] = useState(true)
  const [intelPanelCollapsed, setIntelPanelCollapsed] = useState(false)
  const [controlRailCollapsed, setControlRailCollapsed] = useState(false)
  const [showWildfireRisk, setShowWildfireRisk] = useState(false)
  const [showFloodRisk, setShowFloodRisk] = useState(false)
  const [corridorBrief, setCorridorBrief] = useState<ReturnType<typeof buildCorridorDirectionBrief>>(null)
  const [corridorShowToken, setCorridorShowToken] = useState(0)
  const corridorShownForRef = React.useRef<string | null>(null)
  const lastFocusTargetRef = React.useRef<string | null>(null)
  const [layers, setLayers] = useState<MapToolbarLayers>({
    heatmap: false,
    riskOverlay: true,
    satellite: true,
    terrain: false,
    corridors: true,
    weather: false,
    flood: false,
    wildfire: false,
    labels: true,
  })

  // Surface corridor location above search/chrome for 2s when a line is focused
  useEffect(() => {
    const focusId = focusTarget?.id || highlightAssetId || selectedAssetId
    if (!focusId) {
      corridorShownForRef.current = null
      lastFocusTargetRef.current = null
      setCorridorBrief(null)
      return
    }
    const asset = assets.find((a) => a.id === focusId)
    if (!asset || asset.asset_type !== 'line') {
      if (!focusTarget?.id) setCorridorBrief(null)
      return
    }
    const brief = buildCorridorDirectionBrief(asset)
    if (!brief) return

    setCorridorBrief(brief)

    const isNewFocusTarget =
      Boolean(focusTarget?.id) && focusTarget!.id !== lastFocusTargetRef.current
    if (focusTarget?.id) lastFocusTargetRef.current = focusTarget.id
    else lastFocusTargetRef.current = null

    if (isNewFocusTarget || corridorShownForRef.current !== focusId) {
      corridorShownForRef.current = focusId
      setCorridorShowToken((n) => n + 1)
    }
  }, [highlightAssetId, selectedAssetId, assets, focusTarget?.id])

  const handleCloseCorridorOverlay = useCallback(() => {
    // Visibility is owned by the overlay; keep brief so map focus stays active.
  }, [])

  useEffect(() => {
    if (viewMode !== '2d') setMapZoom(null)
  }, [viewMode])

  useEffect(() => {
    if (!onMapStatusChange || viewMode !== '3d') return
    onMapStatusChange({
      coordinates: null,
      zoom: null,
      viewMode: '3d',
    })
  }, [viewMode, onMapStatusChange])

  useEffect(() => {
    if (basemapMode === '3d') setViewMode('3d')
    else if (basemapMode === '2d') setViewMode('2d')
    else if (basemapMode === 'terrain') {
      setLayers((prev) => ({ ...prev, terrain: true, satellite: false }))
    } else if (basemapMode === 'satellite') {
      setLayers((prev) => ({ ...prev, satellite: true, terrain: false }))
    } else if (basemapMode === 'street') {
      setLayers((prev) => ({ ...prev, satellite: false, terrain: false }))
    }
  }, [basemapMode])

  useEffect(() => {
    setLayers((prev) => ({
      ...prev,
      heatmap: heatMapMode === 'heatmap',
      riskOverlay: heatMapMode === 'ai-risk' || heatMapMode === 'vegetation',
      flood: heatMapMode === 'flood',
      wildfire: heatMapMode === 'ai-risk',
      weather: weatherLayers.size > 0,
    }))
  }, [heatMapMode, weatherLayers])

  const regionStats = useMemo(
    () => computeRegionStats(assets, alerts, selectedPlaceId, regionKmlStats),
    [assets, alerts, selectedPlaceId, regionKmlStats]
  )

  const placeAssetCounts = useMemo(() => {
    if (externalPlaceCounts && Object.keys(externalPlaceCounts).length > 0) {
      const counts: Record<string, number> = {}
      Object.entries(externalPlaceCounts).forEach(([id, s]) => {
        counts[id] = s.total
      })
      return counts
    }
    const counts: Record<string, number> = {}
    flattenPlaces().forEach((p) => {
      counts[p.id] = filterAssetsByPlace(assets, p.id).length
    })
    return counts
  }, [assets, externalPlaceCounts])

  const toggleLayer = (key: keyof MapToolbarLayers) => {
    setLayers((prev) => {
      if (key === 'satellite') {
        setBasemapMode('satellite')
        return { ...prev, satellite: true, terrain: false }
      }
      if (key === 'terrain') {
        setBasemapMode('terrain')
        return { ...prev, terrain: true, satellite: false }
      }
      return { ...prev, [key]: !prev[key] }
    })
  }

  const toggleType = useCallback((type: AssetType) => {
    setTypeFilters((prev) => ({ ...prev, [type]: !prev[type] }))
  }, [])

  const toggleVoltage = useCallback((kv: string) => {
    setVoltageFilters((prev) => ({ ...prev, [kv]: !prev[kv] }))
  }, [])

  const toggleSubstationVoltage = useCallback((kv: string) => {
    setSubstationVoltageFilters((prev) => ({ ...prev, [kv]: !prev[kv] }))
  }, [])

  const handleSelectAsset = useCallback(
    (id: string) => {
      onSelectAsset?.(id)
    },
    [onSelectAsset]
  )

  const handleFullscreen = () => {
    const el = document.documentElement
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  const toggleWeather = (layer: WeatherOverlay) => {
    setWeatherLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  const activeLayers = useMemo(
    () => ({
      heatmap: layers.heatmap,
      riskOverlay: layers.riskOverlay,
      satellite: layers.satellite,
      terrain: layers.terrain,
      corridors: layers.corridors,
    }),
    [layers.heatmap, layers.riskOverlay, layers.satellite, layers.terrain, layers.corridors]
  )

  const offlineTowers = regionStats.towers > 0 ? Math.min(2, regionStats.criticalAlerts) : 0

  return (
    <div className="absolute inset-0 w-full h-full bg-[#060B17] overflow-hidden">
      <CorridorFocusOverlay
        brief={corridorBrief}
        showToken={corridorShowToken}
        onClose={handleCloseCorridorOverlay}
      />

      {onSelectAsset && (
        <MapTopChrome
          assets={filterAssetsByPlace(assets, selectedPlaceId)}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={onSelectPlace}
          placeAssetCounts={placeAssetCounts}
          onSelectAsset={handleSelectAsset}
          labelsOn={labelsOn}
          onToggleLabels={() => setLabelsOn((v) => !v)}
          timeRangeSlot={<TimeRangeSlider embedded value={timeRange} onChange={setTimeRange} />}
          intelPanelCollapsed={intelPanelCollapsed}
          controlRailCollapsed={controlRailCollapsed}
        />
      )}

      <MapIntelPanel
        stats={regionStats}
        typeFilters={typeFilters}
        onToggleType={toggleType}
        voltageFilters={voltageFilters}
        onToggleVoltage={toggleVoltage}
        substationVoltageFilters={substationVoltageFilters}
        onToggleSubstationVoltage={toggleSubstationVoltage}
        heatMapMode={heatMapMode}
        onHeatMapMode={setHeatMapMode}
        corridorsOn={layers.corridors}
        onToggleCorridors={() => toggleLayer('corridors')}
        labelsOn={labelsOn}
        onToggleLabels={() => setLabelsOn((v) => !v)}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={onSelectPlace}
        resolvedToday={12}
        offlineTowers={offlineTowers}
        collapsed={intelPanelCollapsed}
        onToggleCollapse={() => setIntelPanelCollapsed((v) => !v)}
      />

      <MapOverlaysPanel
        intelPanelCollapsed={intelPanelCollapsed}
        wildfireOn={showWildfireRisk}
        floodOn={showFloodRisk}
        onToggleWildfire={() => setShowWildfireRisk((v) => !v)}
        onToggleFlood={() => setShowFloodRisk((v) => !v)}
      />

      <MapControlRail
        mapZoom={viewMode === '2d' ? mapZoom : null}
        layers={layers}
        onToggle={toggleLayer}
        onFullscreen={handleFullscreen}
        basemapMode={basemapMode}
        onBasemapMode={setBasemapMode}
        onCollapsedChange={setControlRailCollapsed}
        onLocate={() => {
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(() => { })
          }
        }}
      />

      {layers.weather && (
        <div className="absolute bottom-20 z-[1100]" style={{ right: mapRightInset(controlRailCollapsed) }}>
          <WeatherLayerBar active={weatherLayers} onToggle={toggleWeather} />
        </div>
      )}

      <AIAssistantFab
        rightOffset={mapRightInset(controlRailCollapsed)}
        onPrompt={(text) => {
          if (text.toLowerCase().includes('maharashtra')) onSelectPlace('maharashtra')
          if (text.toLowerCase().includes('critical')) {
            const critical = filterAssetsByPlace(assets, selectedPlaceId).find(
              (a) => a.health_score === 'critical'
            )
            if (critical) handleSelectAsset(critical.id)
          }
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-[500] opacity-[0.025]"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse at 70% 30%, rgba(59,130,246,0.35), transparent 55%)',
        }}
      />

      {viewMode === '2d' ? (
        <GISMap
          assets={assets}
          selectedAssetId={selectedAssetId}
          alertAssetIds={alertAssetIds}
          onSelectAsset={handleSelectAsset}
          activeLayers={activeLayers}
          resizeSignal={resizeSignal}
          onMapStatusChange={onMapStatusChange}
          suppressInternalStatusBar={Boolean(onMapStatusChange)}
          onMapReady={setMapZoom}
          selectedPlaceId={selectedPlaceId}
          heatMapMode={heatMapMode}
          typeFilters={typeFilters}
          voltageFilters={voltageFilters}
          substationVoltageFilters={substationVoltageFilters}
          showLabels={labelsOn}
          showWildfireRisk={showWildfireRisk}
          showFloodRisk={showFloodRisk}
          focusTarget={focusTarget}
          onFocusConsumed={onFocusConsumed}
          highlightAssetId={highlightAssetId}
        />
      ) : (
        <GISMap3D
          assets={filterAssetsByPlace(assets, selectedPlaceId)}
          selectedAssetId={selectedAssetId}
          alertAssetIds={alertAssetIds}
          onSelectAsset={handleSelectAsset}
          _activeLayers={activeLayers}
        />
      )}
    </div>
  )
}
