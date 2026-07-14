import React from 'react'
import { Activity, CheckCircle2, WifiOff } from 'lucide-react'

interface MiniAnalyticsPanelProps {
  newAlerts: number
  resolved: number
  offlineTowers: number
  healthyPct: number
}

export default function MiniAnalyticsPanel({
  newAlerts,
  resolved,
  offlineTowers,
  healthyPct,
}: MiniAnalyticsPanelProps) {
  return (
    <div className="w-[168px] rounded-lg border border-slate-700 bg-[#0b1220] overflow-hidden select-none">
      <div className="px-2.5 py-1.5 border-b border-slate-800 bg-[#080d18] flex items-center justify-between">
        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Today</span>
        <Activity className="w-3 h-3 text-slate-400" />
      </div>
      <div className="p-2 space-y-1.5 text-[10px]">
        <Row label="New Alerts" value={newAlerts} valueClass="text-amber-400" />
        <Row label="Resolved" value={resolved} valueClass="text-emerald-400" icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />} />
        <Row label="Offline Towers" value={offlineTowers} valueClass={offlineTowers > 0 ? 'text-red-400' : 'text-slate-300'} icon={<WifiOff className="w-3 h-3 text-slate-500" />} />
        <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[8px]">Healthy</span>
          <span className="font-mono font-semibold text-emerald-400">{healthyPct}%</span>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  valueClass,
  icon,
}: {
  label: string
  value: number
  valueClass: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 font-semibold flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className={`font-mono font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}
