/**
 * Tower Analyzer — TAMS GIS Command Center (full feature map workspace).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'

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
  getWorkOrders,
  summarizeMonitoringKpis,
  type Alert,
  type Asset,
  type MonitoringRunResult,
} from '@/lib/api'
import { computeRegionStats, filterAlertsByPlace } from '@/lib/placeFilter'
import { selectAsset, type RootState } from '@/lib/store'
import type { MapStatusSnapshot } from '@/types/mapStatus'

const MapViewport = dynamic(() => import('@/components/MapViewport'), { ssr: false })

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
    queryFn: ({ signal }) => {
      // Larger page once state filter is strict — all rows belong to one state pack
      const params = new URLSearchParams({ page_size: '8000' })
      if (stateFilter) params.set('state', stateFilter)
      return fetchApi<Asset[]>(`/assets?${params}`, { signal })
    },
    enabled: isClient,
    // Do not keep previous state's assets on screen (caused Gujarat flash on Rajasthan)
    placeholderData: undefined,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (n) => Math.min(1200 * (n + 1), 4000),
    // Keep trying after cold backend start until corridor data arrives
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.length === 0) return 5000
      return false
    },
  })

  const assetsReady = assets.length > 0

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: ({ signal }) => fetchApi<Alert[]>('/alerts', { signal }),
    enabled: isClient && assetsReady,
    staleTime: 45_000,
  })

  const { data: maintenanceDash } = useQuery({
    queryKey: ['dashboard-maintenance'],
    queryFn: ({ signal }) =>
      fetchApi<{ open_work_orders: number }>('/dashboard/maintenance', { signal }),
    enabled: isClient && assetsReady,
    staleTime: 60_000,
  })

  const { data: workOrders = [] } = useQuery({
    queryKey: ['workorders-kpi'],
    queryFn: () => getWorkOrders(20),
    enabled: isClient && assetsReady,
    staleTime: 60_000,
  })

  const { data: monitoringRuns = [] } = useQuery({
    queryKey: ['monitoring-runs'],
    queryFn: () => fetchMonitoringRuns(20),
    enabled: isClient && assetsReady,
    refetchInterval: 90_000,
    staleTime: 45_000,
  })

  const monitoringKpis = useMemo(
    () => summarizeMonitoringKpis(monitoringRuns, missionResult),
    [monitoringRuns, missionResult]
  )

  const handleOpenMission = useCallback(() => {
    if (missionResult || missionError) {
      setMissionOpen(true)
      return
    }
    setIsOperationsPanelOpen(true)
    dispatch(selectAsset(''))
  }, [missionResult, missionError, dispatch])

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
    queryFn: ({ signal }) => fetchGisPlaceStats(signal),
    enabled: isClient && assetsReady,
    staleTime: 5 * 60 * 1000,
  })

  const { data: regionKmlStats, isFetching: regionKmlStatsFetching } = useQuery({
    queryKey: ['gis-stats', selectedPlaceId],
    queryFn: ({ signal }) => fetchGisStats(selectedPlaceId, signal),
    enabled: isClient && assetsReady,
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
  const regionLoading =
    assetsFetching || regionKmlStatsFetching || Boolean(mapStatus.regionLoading)
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
        alerts={placeAlerts}
        workOrders={workOrders}
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
        onOpenMission={handleOpenMission}
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

        {/* Center GIS Viewport + Operations Panel — flex siblings, no overlap */}
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
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
                  No map assets loaded — click to retry (is the API reachable?)
                </button>
              </div>
            )}
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
              regionLoading={regionLoading}
              showOpsReopen={!showRightRail}
              rightPanelOpen={showRightRail}
              onOpenOpsPanel={() => setIsOperationsPanelOpen(true)}
            />

            <MonitoringResultModal
              open={missionOpen}
              result={missionResult}
              error={missionError}
              onClose={() => setMissionOpen(false)}
              onViewAsset={handleViewMonitoredAsset}
            />
          </div>

          {/* Operations Center — flex column beside map (not over it) */}
          <div
            className={`shrink-0 overflow-hidden border-l border-slate-800/80 bg-[#060B17] transition-[width] duration-300 ease-in-out ${
              showOpsPanel ? 'w-80' : 'w-0 border-l-0 pointer-events-none'
            }`}
            aria-hidden={!showOpsPanel}
          >
            <div className="h-full w-80">
              <RightSidebar
                assets={assets}
                alerts={alerts}
                selectedAssetId={selectedAssetId}
                onSelectAsset={handleSelectAsset}
                onMinimize={() => setIsOperationsPanelOpen(false)}
                onMissionReport={handleMissionReport}
              />
            </div>
          </div>

          {/* Asset detail — same right rail slot as Operations */}
          <div
            className={`shrink-0 overflow-hidden border-l border-slate-800/80 bg-[#060B17] transition-[width] duration-300 ease-in-out ${
              assetDockOpen ? 'w-80' : 'w-0 border-l-0 pointer-events-none'
            }`}
            aria-hidden={!assetDockOpen}
          >
            <div className="h-full w-80">
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
          </div>
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
