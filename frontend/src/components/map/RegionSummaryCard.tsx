import React from 'react'
import { AlertTriangle, Radio, Zap } from 'lucide-react'

import type { RegionStats } from '@/lib/placeFilter'

interface RegionSummaryCardProps {
  stats: RegionStats
  embedded?: boolean
}

export default function RegionSummaryCard({ stats, embedded = false }: RegionSummaryCardProps) {
  return (
    <div
      className={`w-[200px] rounded-xl border border-slate-700/80 bg-[#0a1020]/95 backdrop-blur-xl shadow-2xl overflow-hidden select-none ${embedded ? '' : 'absolute top-[7.25rem] left-3 z-[998]'
        }`}
    >
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/80">
        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.14em]">Region Summary</p>
        <h3 className="text-sm font-extrabold text-white truncate">{stats.placeLabel}</h3>
      </div>
      <div className="p-2.5 grid grid-cols-2 gap-2 text-[10px]">
        <Stat label="Assets" value={stats.totalAssets} />
        <Stat label="Alerts" value={stats.openAlerts} valueClass={stats.openAlerts > 0 ? 'text-amber-400' : 'text-emerald-400'} />
        <Stat label="Substations" value={stats.substations} />
        <Stat label="Towers" value={stats.towers} />
        <Stat label="Power Lines" value={stats.lines > 0 ? `${stats.lineKm || stats.lines} km` : stats.lines} />
        <Stat
          label="Critical"
          value={stats.criticalAlerts}
          valueClass={stats.criticalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'}
          icon={<AlertTriangle className="w-3 h-3" />}
        />
        <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 text-[8px]">
            <Radio className="w-3 h-3" /> Coverage
          </span>
          <span className="font-mono font-black text-cyan-300">{stats.coveragePct}%</span>
        </div>
        <div className="col-span-2 flex items-center justify-between">
          <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 text-[8px]">
            <Zap className="w-3 h-3" /> Healthy
          </span>
          <span className="font-mono font-black text-emerald-400">{stats.healthyPct}%</span>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass = 'text-white',
  icon,
}: {
  label: string
  value: React.ReactNode
  valueClass?: string
  icon?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-0.5">
        {icon}
        {label}
      </p>
      <p className={`font-mono font-black text-xs mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  )
}
