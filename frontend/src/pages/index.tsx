/**
 * Home page — TAMS GIS Command Center
 */

import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'

import Dashboard from '@/components/Dashboard'
import MonitoringWorkflow from '@/components/MonitoringWorkflow'
import { fetchApi, type Alert, type Asset } from '@/lib/api'
import { selectAsset, type RootState } from '@/lib/store'

const MapViewport = dynamic(() => import('@/components/MapViewport'), { ssr: false })

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const dispatch = useDispatch()
  const selectedAssetId = useSelector((state: RootState) => state.assets.selected)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => fetchApi<Asset[]>('/assets'),
    enabled: isClient,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchApi<Alert[]>('/alerts'),
    enabled: isClient,
  })

  const { data: analytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => fetchApi<Record<string, unknown>>('/analytics/overview'),
    enabled: isClient,
  })

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => fetchApi<Record<string, unknown>>('/status'),
    enabled: isClient,
  })

  const handleSelectAsset = useCallback(
    (id: string) => {
      dispatch(selectAsset(id))
    },
    [dispatch]
  )

  const handleSelectAlert = useCallback(
    (alert: Alert) => {
      dispatch(selectAsset(alert.asset_id))
    },
    [dispatch]
  )

  const alertAssetIds = alerts
    .filter((a) => a.status === 'open')
    .map((a) => a.asset_id)

  if (!isClient) {
    return <div className="flex items-center justify-center h-screen bg-gray-900">Loading...</div>
  }

  const phase = (status as { phase?: string })?.phase ?? '1'

  return (
    <div className="flex h-screen bg-gray-900 text-slate-100 antialiased font-sans">
      <div className="w-80 bg-slate-950 border-r border-gray-800 shadow-2xl overflow-y-auto flex-shrink-0 flex flex-col scrollbar-thin">
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-wide">
            TAMS
          </h1>
          <p className="text-slate-400 text-xs font-medium">Transmission Asset Monitoring</p>
          <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mt-1.5">
            Phase {phase} · Satellite + AI Pipeline
          </p>
        </div>
        <Dashboard
          assets={assets}
          alerts={alerts}
          analytics={analytics as never}
          isLoading={assetsLoading}
          selectedAssetId={selectedAssetId}
          onSelectAsset={handleSelectAsset}
          onSelectAlert={handleSelectAlert}
        />
        <MonitoringWorkflow selectedAssetId={selectedAssetId} />
      </div>

      <div className="flex-1 relative min-h-0 h-full">
        {isClient && (
          <MapViewport
            assets={assets}
            selectedAssetId={selectedAssetId}
            alertAssetIds={alertAssetIds}
            onSelectAsset={handleSelectAsset}
          />
        )}
      </div>
    </div>
  )
}
