/**
 * Home page — TAMS GIS Command Center Redesign
 */

import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import {
  ShieldAlert,
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  Wrench,
} from 'lucide-react'

import LeftSidebar from '@/components/LeftSidebar'
import RightSidebar from '@/components/RightSidebar'
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

  const alertAssetIds = alerts
    .filter((a) => a.status === 'open')
    .map((a) => a.asset_id)

  if (!isClient) {
    return <div className="flex items-center justify-center h-screen bg-[#060B17] text-white">Loading...</div>
  }

  // Calculate metrics
  const activeAlertsCount = alerts.filter((a) => a.status === 'open').length
  const criticalAlertsCount = alerts.filter(
    (a) => a.status === 'open' && (a.priority === 'critical' || a.priority === 'high')
  ).length

  return (
    <div className="flex flex-col h-screen w-screen bg-[#060B17] text-slate-100 antialiased font-sans overflow-hidden">
      
      {/* 1. TOP GLOBAL KPI STRIP */}
      <div className="h-16 bg-[#0e172a] border-b border-white/10 flex items-center justify-between px-4 select-none shrink-0">
        
        {/* Logo and system status */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-widest text-white leading-none">TAMS GRID COMMAND</h1>
            <span className="text-[8px] text-slate-500 font-extrabold uppercase mt-0.5 tracking-wider">
              Utility Operations Center
            </span>
          </div>
        </div>

        {/* 7 KPI Cards */}
        <div className="flex-1 max-w-[80%] grid grid-cols-7 gap-2.5 px-6">
          
          {/* Card 1: Assets Monitored */}
          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Monitored Assets</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-sm font-mono font-black text-white">{assets.length}</span>
              <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> +2
              </span>
            </div>
          </div>

          {/* Card 2: Active Alerts */}
          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Active Alerts</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-sm font-mono font-black text-amber-400">{activeAlertsCount}</span>
              <span className="text-[8px] text-red-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> +3
              </span>
            </div>
          </div>

          {/* Card 3: Critical Alerts */}
          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Critical Alerts</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-sm font-mono font-black text-red-500">{criticalAlertsCount}</span>
              <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-2.5 h-2.5" /> -1
              </span>
            </div>
          </div>

          {/* Card 4: Coverage % */}
          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Coverage %</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-sm font-mono font-black text-white">98.4%</span>
              <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> +0.2%
              </span>
            </div>
          </div>

          {/* Card 5: AI Detections Today */}
          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">AI Detections</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-sm font-mono font-black text-indigo-400">14</span>
              <span className="text-[8px] text-indigo-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> +4
              </span>
            </div>
          </div>

          {/* Card 6: Monitoring Runs Today */}
          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Runs (24H)</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-sm font-mono font-black text-white">6</span>
              <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" /> +1
              </span>
            </div>
          </div>

          {/* Card 7: Open Work Orders */}
          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Work Orders</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-sm font-mono font-black text-white">3</span>
              <span className="text-[8px] text-slate-400 font-bold">Hold</span>
            </div>
          </div>

        </div>

        {/* Dispatch System Status LED */}
        <div className="flex items-center gap-2 bg-[#060B17] border border-white/5 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[9px] font-bold text-slate-300 tracking-wider">GRID OK</span>
        </div>

      </div>

      {/* 2. LOWER THREE-PANEL CORE SYSTEM */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden">
        
        {/* Left Intelligence Sidebar */}
        <LeftSidebar
          assets={assets}
          alerts={alerts}
          selectedAssetId={selectedAssetId}
          onSelectAsset={handleSelectAsset}
          isLoading={assetsLoading}
        />

        {/* Center GIS Viewport Map */}
        <div className="flex-1 relative min-h-0 h-full bg-[#060B17]">
          <MapViewport
            assets={assets}
            selectedAssetId={selectedAssetId}
            alertAssetIds={alertAssetIds}
            onSelectAsset={handleSelectAsset}
          />
        </div>

        {/* Right Operations Panel */}
        <RightSidebar
          assets={assets}
          alerts={alerts}
          selectedAssetId={selectedAssetId}
          onSelectAsset={handleSelectAsset}
        />

      </div>
    </div>
  )
}
