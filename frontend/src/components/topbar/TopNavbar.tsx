import React from 'react'
import { Command } from 'lucide-react'

import DashboardKpiStrip from '@/components/topbar/DashboardKpiStrip'
import NavbarNotifications from '@/components/topbar/NavbarNotifications'
import NavbarProfile from '@/components/topbar/NavbarProfile'
import type { Alert, Asset, WorkOrder } from '@/lib/api'

interface TopNavbarProps {
  assets: Asset[]
  alerts: Alert[]
  workOrders?: WorkOrder[]
  activeAlertsCount: number
  criticalAlertsCount: number
  openWorkOrders?: number
  onSelectAsset: (id: string) => void
  onOpenCommandPalette?: () => void
  isLoading?: boolean
  coveragePct?: number
  placeLabel?: string
  regionAssetsCount?: number
  aiDetections24h?: number
  runs24h?: number
  kmlHint?: string
  onOpenMission?: () => void
  interactionMode?: 'explorer' | 'operations'
}

export default function TopNavbar({
  assets,
  alerts,
  workOrders = [],
  activeAlertsCount,
  criticalAlertsCount,
  openWorkOrders,
  onSelectAsset,
  onOpenCommandPalette,
  coveragePct = 0,
  placeLabel,
  regionAssetsCount,
  aiDetections24h = 0,
  runs24h = 0,
  kmlHint,
  onOpenMission,
  interactionMode = 'operations',
}: TopNavbarProps) {
  const gridStatus = criticalAlertsCount > 0 ? 'warning' : 'ok'
  const assetsCount = regionAssetsCount ?? assets.length

  return (
    <header className="relative z-[80] shrink-0 bg-[#0e172a] border-b border-white/10 select-none">
      <div className="h-10 flex items-center gap-3 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon.png"
          alt="TAMS"
          width={28}
          height={28}
          className="h-7 w-7 rounded-md object-cover shrink-0"
          onError={(e) => {
            e.currentTarget.src = '/favicon.svg'
          }}
        />
        <div className="flex flex-col min-w-[120px] shrink-0">
          <h1 className="text-xs font-black tracking-widest text-white leading-none">TAMS GRID COMMAND</h1>
          <span className="text-[8px] text-slate-500 font-extrabold uppercase mt-0.5 tracking-wider">
            {interactionMode === 'explorer' ? 'India Explorer' : 'Utility Operations Center'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center gap-1.5 h-8 px-2 rounded-lg border border-white/10 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
              title="Command palette (Ctrl+K)"
              aria-label="Open command palette"
            >
              <Command className="w-3.5 h-3.5" />
              <kbd className="text-[9px] font-mono text-slate-500">Ctrl K</kbd>
            </button>
          )}
          <NavbarNotifications alerts={alerts} assets={assets} onSelectAsset={onSelectAsset} />

          <div
            className={`hidden md:flex items-center gap-2 border px-2.5 py-1 rounded-lg ${
              gridStatus === 'ok'
                ? 'bg-[#060B17] border-white/5'
                : 'bg-amber-950/30 border-amber-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full tams-breathe ${
                gridStatus === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-[9px] font-bold text-slate-300 tracking-wider">
              {gridStatus === 'ok' ? 'GRID OK' : 'GRID ALERT'}
            </span>
          </div>

          <div className="ml-2 pl-2 border-l border-white/10">
            <NavbarProfile />
          </div>
        </div>
      </div>

      <div className="px-4 pb-2.5 pt-1 border-t border-white/5">
        <DashboardKpiStrip
          assetsCount={assetsCount}
          activeAlertsCount={activeAlertsCount}
          criticalAlertsCount={criticalAlertsCount}
          openWorkOrders={openWorkOrders}
          coveragePct={coveragePct}
          placeLabel={placeLabel}
          aiDetections24h={aiDetections24h}
          runs24h={runs24h}
          kmlHint={kmlHint}
          alerts={alerts}
          workOrders={workOrders}
          onSelectAsset={onSelectAsset}
          onOpenMission={onOpenMission}
          interactionMode={interactionMode}
        />
      </div>
    </header>
  )
}
