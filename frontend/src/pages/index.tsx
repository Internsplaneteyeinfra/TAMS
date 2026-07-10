/**
 * Home page — TAMS GIS Command Center Redesign
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import LeftSidebar from '@/components/LeftSidebar'
import RightSidebar from '@/components/RightSidebar'
import BottomStatusBar from '@/components/layout/BottomStatusBar'
import DashboardSkeleton from '@/components/layout/DashboardSkeleton'
import TopNavbar from '@/components/topbar/TopNavbar'
import CommandPalette, { useCommandPaletteShortcut } from '@/components/ui/CommandPalette'
import { DEFAULT_PLACE_ID, getStateFilterForPlace } from '@/config/places'
import { fetchApi, fetchGisPlaceStats, fetchGisStats, type Alert, type Asset } from '@/lib/api'
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
  const dispatch = useDispatch()
  const selectedAssetId = useSelector((state: RootState) => state.assets.selected)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMapResizeSignal((n) => n + 1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [isOperationsPanelOpen])

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

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', stateFilter ?? 'india'],
    queryFn: () => {
      const params = new URLSearchParams({ page_size: '15000' })
      if (stateFilter) params.set('state', stateFilter)
      return fetchApi<Asset[]>(`/assets?${params}`)
    },
    enabled: isClient,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchApi<Alert[]>('/alerts'),
    enabled: isClient,
  })

  const { data: maintenanceDash } = useQuery({
    queryKey: ['dashboard-maintenance'],
    queryFn: () => fetchApi<{ open_work_orders: number }>('/dashboard/maintenance'),
    enabled: isClient,
  })

  const handleMapStatusChange = useCallback((status: MapStatusSnapshot) => {
    setMapStatus(status)
  }, [])

  const handleSelectAsset = useCallback(
    (id: string) => {
      dispatch(selectAsset(id))
    },
    [dispatch]
  )

  const alertAssetIds = alerts
    .filter((a) => a.status === 'open')
    .map((a) => a.asset_id)

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

  if (!isClient) {
    return <DashboardSkeleton />
  }

  const isInitialLoading = assetsLoading && assets.length === 0

  if (isInitialLoading) {
    return <DashboardSkeleton />
  }

  const criticalAlertsCount = alerts.filter(
    (a) => a.status === 'open' && (a.priority === 'critical' || a.priority === 'high')
  ).length

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)

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
          <div
            className="absolute top-0 left-0 bottom-0 bg-[#060B17] transition-[right] duration-300 ease-in-out"
            style={{ right: isOperationsPanelOpen ? OPERATIONS_PANEL_WIDTH : 0 }}
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
            />
          </div>

          <div
            className={`absolute top-0 bottom-0 right-0 z-30 w-80 transition-transform duration-300 ease-in-out ${isOperationsPanelOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
          >
            <RightSidebar
              assets={assets}
              alerts={alerts}
              selectedAssetId={selectedAssetId}
              onSelectAsset={handleSelectAsset}
              onMinimize={() => setIsOperationsPanelOpen(false)}
            />
          </div>

          {!isOperationsPanelOpen && (
            <button
              type="button"
              title="Show Operations Panel"
              aria-label="Show Operations Panel"
              onClick={() => setIsOperationsPanelOpen(true)}
              className="absolute top-1/2 z-30 w-7 h-9 flex items-center justify-center bg-slate-950 border border-slate-500 rounded-l-md text-slate-200 hover:text-white hover:border-slate-300 shadow-lg -translate-y-1/2 right-0"
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
