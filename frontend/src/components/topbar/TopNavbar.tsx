import React from 'react'
import { Command } from 'lucide-react'

import ModuleNav from '@/components/layout/ModuleNav'
import DashboardKpiStrip from '@/components/topbar/DashboardKpiStrip'
import NavbarNotifications from '@/components/topbar/NavbarNotifications'
import NavbarProfile from '@/components/topbar/NavbarProfile'
import NavbarSearch from '@/components/topbar/NavbarSearch'
import { KpiStripSkeleton } from '@/components/ui/Skeleton'
import type { Alert, Asset } from '@/lib/api'

interface TopNavbarProps {
  assets: Asset[]
  alerts: Alert[]
  activeAlertsCount: number
  criticalAlertsCount: number
  openWorkOrders?: number
  onSelectAsset: (id: string) => void
  onOpenCommandPalette?: () => void
  isLoading?: boolean
  coveragePct?: number
  placeLabel?: string
  regionAssetsCount?: number
}

export default function TopNavbar({
  assets,
  alerts,
  activeAlertsCount,
  criticalAlertsCount,
  openWorkOrders,
  onSelectAsset,
  onOpenCommandPalette,
  isLoading = false,
  coveragePct,
  placeLabel,
  regionAssetsCount,
}: TopNavbarProps) {
  const gridStatus = criticalAlertsCount > 0 ? 'warning' : 'ok'

  return (
    <header className="shrink-0 bg-[#0e172a] border-b border-white/10 select-none">
      {/* Toolbar row */}
      <div className="h-10 flex items-center gap-3 px-4 border-b border-white/5">
        <div className="flex flex-col min-w-[120px] shrink-0">
          <h1 className="text-xs font-black tracking-widest text-white leading-none">TAMS GRID COMMAND</h1>
          <span className="text-[8px] text-slate-500 font-extrabold uppercase mt-0.5 tracking-wider">
            Utility Operations Center
          </span>
        </div>

        <div className="hidden lg:block shrink-0">
          <ModuleNav variant="strip" />
        </div>

        <NavbarSearch assets={assets} onSelectAsset={onSelectAsset} />

        <div className="flex items-center gap-2 shrink-0">
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
          <NavbarProfile />

          <div
            className={`hidden md:flex items-center gap-2 border px-2.5 py-1 rounded-lg ${gridStatus === 'ok'
              ? 'bg-[#060B17] border-white/5'
              : 'bg-amber-950/30 border-amber-500/30'
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-ping ${gridStatus === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
            />
            <span className="text-[9px] font-bold text-slate-300 tracking-wider">
              {gridStatus === 'ok' ? 'GRID OK' : 'GRID ALERT'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="px-4 py-2">
        {isLoading ? (
          <KpiStripSkeleton />
        ) : (
          <DashboardKpiStrip
            assetsCount={regionAssetsCount ?? assets.length}
            activeAlertsCount={activeAlertsCount}
            criticalAlertsCount={criticalAlertsCount}
            openWorkOrders={openWorkOrders}
            coveragePct={coveragePct}
            placeLabel={placeLabel}
          />
        )}
      </div>
    </header>
  )
}
