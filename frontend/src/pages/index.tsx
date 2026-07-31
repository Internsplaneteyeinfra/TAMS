/**
 * Home page — TAMS GIS Command Center Redesign
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import {
  ChevronLeft,
} from 'lucide-react'

import LeftSidebar from '@/components/LeftSidebar'
import RightSidebar from '@/components/RightSidebar'
import BottomStatusBar from '@/components/layout/BottomStatusBar'
import DashboardSkeleton from '@/components/layout/DashboardSkeleton'
import TopNavbar from '@/components/topbar/TopNavbar'
import CommandPalette, { useCommandPaletteShortcut } from '@/components/ui/CommandPalette'
import MonitoringResultModal from '@/components/ui/MonitoringResultModal'
import AssetDetailDrawer from '@/components/map/AssetDetailDrawer'
import { DEFAULT_PLACE_ID, getStateFilterForPlace } from '@/config/places'
import {
  fetchApi,
  fetchGisPlaceStats,
  fetchGisStats,
  fetchMonitoringRuns,
  summarizeMonitoringKpis,
  type Alert,
  type Asset,
  type MonitoringRunResult,
} from '@/lib/api'
import { computeRegionStats, filterAlertsByPlace } from '@/lib/placeFilter'
import { selectAsset, type RootState } from '@/lib/store'
import type { MapStatusSnapshot } from '@/types/mapStatus'

const MapViewport = dynamic(() => import('@/components/MapViewport'), { ssr: false })

const OPERATIONS_PANEL_WIDTH = '20rem' // w-80 — matches left sidebar width

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const [isOperationsPanelOpen, setIsOperationsPanelOpen] = useState(true)
  const [mapResizeSignal, setMapResizeSignal] = useState(0)
  const [mapStatus, setMapStatus] = useState<MapStatusSnapshot>({
    coordinates: null,
    zoom: null,
    viewMode: '2d',
  })
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState(DEFAULT_PLACE_ID)
  const [missionOpen, setMissionOpen] = useState(false)
  const [missionResult, setMissionResult] = useState<MonitoringRunResult | null>(null)
  const [missionError, setMissionError] = useState<string | null>(null)
  const [mapFocusTarget, setMapFocusTarget] = useState<{
    id: string
    latitude: number
    longitude: number
  } | null>(null)
  const [missionHighlightId, setMissionHighlightId] = useState<string | null>(null)
  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const selectedAssetId = useSelector((state: RootState) => state.assets.selected)

  const handleMissionReport = useCallback(
    (payload: { result: MonitoringRunResult | null; error?: string | null }) => {
      setMissionResult(payload.result)
      setMissionError(payload.error ?? null)
      setMissionOpen(true)
      void queryClient.invalidateQueries({ queryKey: ['monitoring-runs'] })
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    [queryClient]
  )

  const handleSelectAsset = useCallback(
    (id: string) => {
      if (id !== missionHighlightId) setMissionHighlightId(null)
      dispatch(selectAsset(id))
    },
    [dispatch, missionHighlightId]
  )

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMapResizeSignal((n) => n + 1)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [isOperationsPanelOpen, selectedAssetId])

  const handleLeftSidebarCollapsedChange = useCallback(() => {
    window.setTimeout(() => setMapResizeSignal((n) => n + 1), 300)
  }, [])

  const handleCoreSidebarHiddenChange = useCallback(() => {
    window.setTimeout(() => setMapResizeSignal((n) => n + 1), 300)
  }, [])

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), [])
  useCommandPaletteShortcut(() => setCommandPaletteOpen((open) => !open))

  const stateFilter = getStateFilterForPlace(selectedPlaceId)

  const { data: assets = [], isLoading: assetsLoading, isFetching: assetsFetching, isError: assetsError, refetch: refetchAssets } = useQuery({
    queryKey: ['assets', stateFilter ?? 'india'],
    queryFn: () => {
      const params = new URLSearchParams({ page_size: '4000' })
      if (stateFilter) params.set('state', stateFilter)
      return fetchApi<Asset[]>(`/assets?${params}`)
    },
    enabled: isClient,
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
    // Keep trying after cold backend start until corridor data arrives
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.length === 0) return 5000
      return false
    },
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchApi<Alert[]>('/alerts'),
    enabled: isClient,
    staleTime: 45_000,
  })

  const { data: maintenanceDash } = useQuery({
    queryKey: ['dashboard-maintenance'],
    queryFn: () => fetchApi<{ open_work_orders: number }>('/dashboard/maintenance'),
    enabled: isClient,
  })

  const { data: monitoringRuns = [] } = useQuery({
    queryKey: ['monitoring-runs'],
    queryFn: () => fetchMonitoringRuns(50),
    enabled: isClient,
    refetchInterval: 60_000,
    staleTime: 20_000,
  })

  const monitoringKpis = useMemo(
    () => summarizeMonitoringKpis(monitoringRuns, missionResult),
    [monitoringRuns, missionResult]
  )

  const handleOpenAlerts = useCallback(() => {
    setIsOperationsPanelOpen(true)
    dispatch(selectAsset(''))
    setMissionHighlightId(null)
  }, [dispatch])

  const handleOpenMission = useCallback(() => {
    if (missionResult || missionError) {
      setMissionOpen(true)
      return
    }
    setIsOperationsPanelOpen(true)
    dispatch(selectAsset(''))
  }, [missionResult, missionError, dispatch])

  const handleOpenWorkOrders = useCallback(() => {
    setIsOperationsPanelOpen(true)
    dispatch(selectAsset(''))
  }, [dispatch])

  const handleCheckImportedTowers = useCallback(
    (placeId?: string) => {
      setSelectedPlaceId(placeId || 'rajasthan')
      setIsOperationsPanelOpen(true)
      setMissionHighlightId(null)
      void refetchAssets()
      void queryClient.invalidateQueries({ queryKey: ['gis-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['gis-place-stats'] })
    },
    [refetchAssets, queryClient]
  )

  // Declared after `assets` so View never hits TDZ / "before initialization"
  const handleViewMonitoredAsset = useCallback(
    (assetId: string) => {
      const summary = missionResult?.monitored_assets?.find((a) => a.id === assetId)
      const fromDetection = missionResult?.detections?.find((d) => d.asset_id === assetId)
      const fromAssets = assets.find((a) => a.id === assetId)
      const lat = summary?.latitude ?? fromDetection?.latitude ?? fromAssets?.latitude
      const lng = summary?.longitude ?? fromDetection?.longitude ?? fromAssets?.longitude
      setMissionOpen(false)
      setMissionHighlightId(assetId)
      dispatch(selectAsset(assetId))
      if (typeof lat === 'number' && typeof lng === 'number') {
        setMapFocusTarget({ id: assetId, latitude: lat, longitude: lng })
      }
    },
    [dispatch, missionResult, assets]
  )

  const handleMapStatusChange = useCallback((status: MapStatusSnapshot) => {
    setMapStatus(status)
  }, [])

  const alertAssetIds = useMemo(
    () => alerts.filter((a) => a.status === 'open').map((a) => a.asset_id),
    [alerts]
  )

  const { data: placeStatsMap = {} } = useQuery({
    queryKey: ['gis-place-stats'],
    queryFn: () => fetchGisPlaceStats(),
    enabled: isClient,
    staleTime: 5 * 60 * 1000,
  })

  const { data: regionKmlStats } = useQuery({
    queryKey: ['gis-stats', selectedPlaceId],
    queryFn: () => fetchGisStats(selectedPlaceId),
    enabled: isClient,
    staleTime: 60 * 1000,
  })

  const kmlHint = useMemo(() => {
    if (!regionKmlStats) return undefined
    const parts = [
      regionKmlStats.towers ? `${regionKmlStats.towers.toLocaleString()} towers` : null,
      regionKmlStats.lines ? `${regionKmlStats.lines.toLocaleString()} lines` : null,
      regionKmlStats.substations ? `${regionKmlStats.substations.toLocaleString()} subs` : null,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : undefined
  }, [regionKmlStats])

  const regionStats = useMemo(
    () => computeRegionStats(assets, alerts, selectedPlaceId, regionKmlStats ?? null),
    [assets, alerts, selectedPlaceId, regionKmlStats]
  )

  const placeAlerts = useMemo(
    () => filterAlertsByPlace(alerts, assets, selectedPlaceId),
    [alerts, assets, selectedPlaceId]
  )

  const regionActiveAlerts = placeAlerts.filter((a) => a.status === 'open').length
  const regionCriticalAlerts = placeAlerts.filter(
    (a) => a.status === 'open' && (a.priority === 'critical' || a.priority === 'high')
  ).length

  const criticalAlertsCount = alerts.filter(
    (a) => a.status === 'open' && (a.priority === 'critical' || a.priority === 'high')
  ).length

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return undefined
    const fromCatalog = assets.find((a) => a.id === selectedAssetId)
    if (fromCatalog) return fromCatalog
    const summary = missionResult?.monitored_assets?.find((a) => a.id === selectedAssetId)
    if (!summary) return undefined
    return {
      id: summary.id,
      name: summary.name,
      asset_type: (summary.asset_type as Asset['asset_type']) || 'line',
      latitude: summary.latitude ?? 0,
      longitude: summary.longitude ?? 0,
      health_score: summary.health_score || 'healthy',
      status: 'active',
      metadata: summary.voltage_kv != null ? { voltage_kv: summary.voltage_kv } : {},
    } satisfies Asset
  }, [assets, selectedAssetId, missionResult])

  const nearbyDockAssets = useMemo(() => {
    if (!selectedAsset) return []
    return assets.filter((a) => a.id !== selectedAsset.id).slice(0, 5)
  }, [assets, selectedAsset])

  const assetDockOpen = Boolean(selectedAsset)
  const showAssetsBootOverlay = assetsLoading && assets.length === 0
  /** Ops and Asset detail are mutually exclusive — no overlap */
  const showOpsPanel = isOperationsPanelOpen && !assetDockOpen
  const showRightRail = showOpsPanel || assetDockOpen

  if (!isClient) {
    return <DashboardSkeleton />
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#060B17] text-slate-100 antialiased font-sans overflow-hidden">

      <TopNavbar
        assets={assets}
        alerts={alerts}
        activeAlertsCount={regionActiveAlerts}
        criticalAlertsCount={regionCriticalAlerts}
        openWorkOrders={maintenanceDash?.open_work_orders}
        onSelectAsset={handleSelectAsset}
        onOpenCommandPalette={openCommandPalette}
        isLoading={assetsLoading}
        coveragePct={regionStats.coveragePct}
        placeLabel={regionStats.placeLabel}
        regionAssetsCount={regionStats.totalAssets}
        aiDetections24h={monitoringKpis.detections24h}
        runs24h={monitoringKpis.runs24h}
        kmlHint={kmlHint}
        onOpenAlerts={handleOpenAlerts}
        onOpenMission={handleOpenMission}
        onOpenWorkOrders={handleOpenWorkOrders}
        onCheckImportedTowers={handleCheckImportedTowers}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
        assets={assets}
        onSelectAsset={handleSelectAsset}
        onSelectPlace={setSelectedPlaceId}
      />

      {/* 2. LOWER THREE-PANEL CORE SYSTEM */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden">

        {/* Left Intelligence Sidebar */}
        <LeftSidebar
          assets={assets}
          alerts={alerts}
          selectedAssetId={selectedAssetId}
          onSelectAsset={handleSelectAsset}
          isLoading={assetsLoading}
          onCollapsedChange={handleLeftSidebarCollapsedChange}
          onHiddenChange={handleCoreSidebarHiddenChange}
        />

        {/* Center GIS Viewport + Operations Panel */}
        <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden">
          {showAssetsBootOverlay && (
            <div className="absolute top-3 left-1/2 z-[90] -translate-x-1/2 pointer-events-none">
              <div className="rounded-full border border-cyan-500/30 bg-[#0b1224]/90 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 shadow-lg backdrop-blur-sm">
                Loading corridor assets…
              </div>
            </div>
          )}
          {!assetsLoading && (assetsError || assets.length === 0) && (
            <div className="absolute top-3 left-1/2 z-[90] -translate-x-1/2">
              <button
                type="button"
                onClick={() => void refetchAssets()}
                className="rounded-full border border-amber-500/40 bg-[#0b1224]/95 px-3 py-1.5 text-[11px] font-semibold text-amber-200 shadow-lg backdrop-blur-sm hover:border-amber-400/60"
              >
                No map assets loaded — click to retry (is backend on :8000?)
              </button>
            </div>
          )}
          {assetsFetching && assets.length > 0 && (
            <div className="absolute top-3 left-1/2 z-[90] -translate-x-1/2 pointer-events-none">
              <div className="rounded-full border border-slate-600/40 bg-[#0b1224]/80 px-3 py-1 text-[10px] font-medium text-slate-300 shadow backdrop-blur-sm">
                Updating region…
              </div>
            </div>
          )}
          <div
            className="absolute top-0 left-0 bottom-0 bg-[#060B17] transition-[right] duration-300 ease-in-out"
            style={{ right: showRightRail ? OPERATIONS_PANEL_WIDTH : 0 }}
          >
            <MapViewport
              assets={assets}
              alerts={alerts}
              selectedAssetId={selectedAssetId}
              alertAssetIds={alertAssetIds}
              onSelectAsset={handleSelectAsset}
              resizeSignal={mapResizeSignal}
              onMapStatusChange={handleMapStatusChange}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
              regionKmlStats={regionKmlStats ?? null}
              placeAssetCounts={placeStatsMap}
              focusTarget={mapFocusTarget}
              onFocusConsumed={() => setMapFocusTarget(null)}
              highlightAssetId={missionHighlightId}
            />
          </div>

          {/* Operations Center — hidden while asset detail is open */}
          <div
            className={`absolute top-0 bottom-0 right-0 z-30 w-80 transition-transform duration-300 ease-in-out ${
              showOpsPanel ? 'translate-x-0' : 'translate-x-full pointer-events-none'
            }`}
            aria-hidden={!showOpsPanel}
          >
            <RightSidebar
              assets={assets}
              alerts={alerts}
              selectedAssetId={selectedAssetId}
              onSelectAsset={handleSelectAsset}
              onMinimize={() => setIsOperationsPanelOpen(false)}
              onMissionReport={handleMissionReport}
            />
          </div>

          {/* Asset detail — full right rail (replaces Operations while open) */}
          <div
            className={`absolute top-0 bottom-0 right-0 z-40 w-80 transition-transform duration-300 ease-in-out ${
              assetDockOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
            }`}
            aria-hidden={!assetDockOpen}
          >
            {selectedAsset && (
              <AssetDetailDrawer
                variant="dock"
                asset={selectedAsset}
                nearbyAssets={nearbyDockAssets}
                onClose={() => {
                  setMissionHighlightId(null)
                  dispatch(selectAsset(''))
                }}
              />
            )}
          </div>

          {/* Alert popup — blurs GIS section; close restores exact view */}
          <MonitoringResultModal
            open={missionOpen}
            result={missionResult}
            error={missionError}
            onClose={() => setMissionOpen(false)}
            onViewAsset={handleViewMonitoredAsset}
          />

          {!showRightRail && (
            <button
              type="button"
              title="Show Operations Panel"
              aria-label="Show Operations Panel"
              onClick={() => setIsOperationsPanelOpen(true)}
              className="absolute top-1/2 z-30 w-7 h-9 flex items-center justify-center bg-slate-950 border border-slate-500 rounded-l-md text-slate-200 hover:text-white hover:border-slate-300 -translate-y-1/2 right-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      <BottomStatusBar
        mapStatus={mapStatus}
        selectedAssetName={selectedAsset?.name ?? null}
        gridStatus={criticalAlertsCount > 0 ? 'warning' : 'ok'}
      />
    </div>
  )
}
