import React, { useCallback, useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

import AIAssistantFab from '@/components/map/AIAssistantFab'
import CorridorFocusOverlay from '@/components/map/CorridorFocusOverlay'
import MapEarthIntro from '@/components/map/MapEarthIntro'
import MapIntelPanel from '@/components/map/MapIntelPanel'
import MapRegionLoader from '@/components/map/MapRegionLoader'
import MapTopChrome from '@/components/map/MapTopChrome'
import { type HeatMapMode } from '@/components/map/HeatMapModeToggle'
import MapOverlaysPanel from '@/components/map/MapOverlaysPanel'
import MapControlRail, { type MapZoomHandlers } from '@/components/map/MapControlRail'
import { MAP_BOTTOM_INSET, MAP_DOCK_TOP, MAP_EDGE } from '@/components/map/mapLayout'
import { type MapBasemap } from '@/components/map/MapViewModeBar'
import TimeRangeSlider, { type TimeRange } from '@/components/map/TimeRangeSlider'
import WeatherLayerBar, { type WeatherOverlay } from '@/components/map/WeatherLayerBar'
import type { MapToolbarLayers } from '@/components/map/FloatingMapToolbar'
import { DEFAULT_PLACE_ID, flattenPlaces } from '@/config/places'
import { buildCorridorDirectionBrief } from '@/lib/corridorDirection'
import type { Alert, Asset, RegionAssetStats } from '@/lib/api'
import { computeRegionStats, filterAlertsByPlace, filterAssetsByPlace } from '@/lib/placeFilter'
import type { MapStatusSnapshot } from '@/types/mapStatus'

export type MapInteractionMode = 'explorer' | 'operations'

const ALL_VOLTAGE_FILTERS: Record<string, boolean> = {
  '765': true,
  '400': true,
  '220': true,
  '132': true,
  '66': true,
  other: true,
}

/** India explorer: EHV backbone only (hide 132 / 66 / other until state pick or toggle). */
const EXPLORER_VOLTAGE_FILTERS: Record<string, boolean> = {
  '765': true,
  '400': true,
  '220': true,
  '132': false,
  '66': false,
  other: false,
}

const GISMap = dynamic(() => import('@/components/GISMap'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#060B17] text-slate-400 text-sm">
      Loading map…
    </div>
  ),
})
const GISMap3D = dynamic(() => import('@/components/GISMap3D'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#060B17] text-slate-400 text-sm">
      Loading 3D map…
    </div>
  ),
})

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
  regionLoading?: boolean
  showOpsReopen?: boolean
  rightPanelOpen?: boolean
  onOpenOpsPanel?: () => void
  interactionMode?: MapInteractionMode
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
  regionLoading = false,
  showOpsReopen = false,
  rightPanelOpen = false,
  onOpenOpsPanel,
  interactionMode: externalInteractionMode,
}: MapViewportProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [earthIntroDone, setEarthIntroDone] = useState(false)
  const handleEarthIntroComplete = useCallback(() => {
    setEarthIntroDone(true)
  }, [])
  const [internalPlaceId, setInternalPlaceId] = useState(DEFAULT_PLACE_ID)
  const selectedPlaceId = externalPlaceId ?? internalPlaceId
  const onSelectPlace = externalOnSelectPlace ?? setInternalPlaceId
  const interactionMode: MapInteractionMode =
    externalInteractionMode ?? (selectedPlaceId === 'india' ? 'explorer' : 'operations')

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
  const [voltageFilters, setVoltageFilters] = useState<Record<string, boolean>>(() =>
    DEFAULT_PLACE_ID === 'india' ? { ...EXPLORER_VOLTAGE_FILTERS } : { ...ALL_VOLTAGE_FILTERS }
  )
  const [substationVoltageFilters, setSubstationVoltageFilters] = useState<Record<string, boolean>>(() =>
    DEFAULT_PLACE_ID === 'india' ? { ...EXPLORER_VOLTAGE_FILTERS } : { ...ALL_VOLTAGE_FILTERS }
  )
  const [labelsOn, setLabelsOn] = useState(true)
  const [intelPanelCollapsed, setIntelPanelCollapsed] = useState(true)
  const [controlRailCollapsed, setControlRailCollapsed] = useState(true)
  const placesHidRailRef = React.useRef(false)
  const handlePlacesOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      if (!controlRailCollapsed) {
        placesHidRailRef.current = true
        setControlRailCollapsed(true)
      }
      return
    }
    if (placesHidRailRef.current) {
      placesHidRailRef.current = false
      setControlRailCollapsed(false)
    }
  }, [controlRailCollapsed])
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

  // Reset voltage defaults when switching India explorer ↔ state operations
  useEffect(() => {
    if (selectedPlaceId === 'india') {
      setVoltageFilters({ ...EXPLORER_VOLTAGE_FILTERS })
      setSubstationVoltageFilters({ ...EXPLORER_VOLTAGE_FILTERS })
    } else {
      setVoltageFilters({ ...ALL_VOLTAGE_FILTERS })
      setSubstationVoltageFilters({ ...ALL_VOLTAGE_FILTERS })
    }
  }, [selectedPlaceId])

  useEffect(() => {
    if (selectedPlaceId === 'india') return
    setControlRailCollapsed(true)
    setIntelPanelCollapsed(true)
    setViewMode('3d')
    setBasemapMode('3d')
    const t = window.setTimeout(() => {
      setViewMode('2d')
      setBasemapMode('satellite')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [selectedPlaceId])

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

  const resolvedCount = useMemo(
    () =>
      filterAlertsByPlace(alerts, assets, selectedPlaceId).filter((a) => {
        const status = (a.status || '').toLowerCase()
        return status === 'closed' || status === 'resolved'
      }).length,
    [alerts, assets, selectedPlaceId]
  )
  const offlineTowers = regionStats.towers > 0 ? Math.min(2, regionStats.criticalAlerts) : 0

  return (
    <div className="absolute inset-0 w-full h-full bg-[#060B17] overflow-hidden">
      {!earthIntroDone && <MapEarthIntro onComplete={handleEarthIntroComplete} />}

      <CorridorFocusOverlay
        brief={corridorBrief}
        showToken={corridorShowToken}
        onClose={handleCloseCorridorOverlay}
      />

      {onSelectAsset && earthIntroDone && (
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
          showOpsReopen={showOpsReopen}
          onOpenOpsPanel={onOpenOpsPanel}
          onExpandMapTools={() => setControlRailCollapsed(false)}
          onPlacesOpenChange={handlePlacesOpenChange}
        />
      )}

      {earthIntroDone && (
        <MapRegionLoader
          loading={regionLoading}
          intelPanelCollapsed={intelPanelCollapsed}
        />
      )}

      {earthIntroDone && (
      <div
        className="pointer-events-none absolute z-[1100] flex flex-col items-start gap-2"
        style={{ top: MAP_DOCK_TOP, left: MAP_EDGE, bottom: MAP_BOTTOM_INSET }}
      >
        <div
          className={`pointer-events-auto flex min-h-0 flex-col ${intelPanelCollapsed ? 'shrink-0' : 'flex-1'}`}
        >
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
            resolvedToday={resolvedCount}
            offlineTowers={offlineTowers}
            collapsed={intelPanelCollapsed}
            onToggleCollapse={() => setIntelPanelCollapsed((v) => !v)}
            interactionMode={interactionMode}
          />
        </div>
        <div className="pointer-events-auto mt-auto shrink-0">
          <MapOverlaysPanel
            intelPanelCollapsed={intelPanelCollapsed}
            wildfireOn={showWildfireRisk}
            floodOn={showFloodRisk}
            onToggleWildfire={() => setShowWildfireRisk((v) => !v)}
            onToggleFlood={() => setShowFloodRisk((v) => !v)}
          />
        </div>
      </div>
      )}

      {earthIntroDone && (
      <div
        className="pointer-events-none absolute z-[1100] flex flex-col items-end gap-2"
        style={{ top: MAP_DOCK_TOP, right: MAP_EDGE, bottom: MAP_BOTTOM_INSET }}
      >
        {!controlRailCollapsed && (
          <div className="pointer-events-auto min-h-0 flex-1">
            <MapControlRail
              mapZoom={viewMode === '2d' ? mapZoom : null}
              layers={layers}
              onToggle={toggleLayer}
              onFullscreen={handleFullscreen}
              basemapMode={basemapMode}
              onBasemapMode={setBasemapMode}
              collapsed={controlRailCollapsed}
              onCollapsedChange={setControlRailCollapsed}
              rightPanelOpen={rightPanelOpen}
              onLocate={() => {
                if (typeof navigator !== 'undefined' && navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(() => { })
                }
              }}
            />
          </div>
        )}
        <div className="pointer-events-auto mt-auto flex shrink-0 flex-col items-end gap-2">
          {layers.weather && (
            <WeatherLayerBar active={weatherLayers} onToggle={toggleWeather} />
          )}
          <AIAssistantFab
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
        </div>
      </div>
      )}

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
          interactionMode={interactionMode}
          cinematicReady={earthIntroDone}
        />
      ) : (
        <GISMap3D
          assets={filterAssetsByPlace(assets, selectedPlaceId)}
          selectedAssetId={selectedAssetId}
          alertAssetIds={alertAssetIds}
          onSelectAsset={handleSelectAsset}
          selectedPlaceId={selectedPlaceId}
          _activeLayers={activeLayers}
        />
      )}
    </div>
  )
}
