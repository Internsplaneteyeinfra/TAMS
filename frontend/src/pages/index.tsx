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
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-80 bg-gray-800 shadow-lg overflow-y-auto flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-tams-primary">TAMS</h1>
          <p className="text-gray-400 text-sm">Transmission Asset Monitoring</p>
          <p className="text-gray-500 text-xs mt-1">
            Phase {phase} — Satellite + AI Pipeline
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
