import React from 'react'
import {
  Activity,
  AlertTriangle,
  Boxes,
  BrainCircuit,
  ClipboardList,
  Radar,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

interface DashboardKpiStripProps {
  assetsCount: number
  activeAlertsCount: number
  criticalAlertsCount: number
  openWorkOrders?: number
  coveragePct?: number
  placeLabel?: string
}

type Glow = 'emerald' | 'amber' | 'red' | 'cyan' | 'indigo' | 'slate' | 'blue'

function MiniSpark({ color = '#34d399' }: { color?: string }) {
  const path = 'M0,14 L4,11 L8,12 L12,7 L16,9 L20,4 L24,6 L28,3 L32,5'
  return (
    <svg viewBox="0 0 32 16" className="w-10 h-4 opacity-80" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({
  title,
  value,
  trend,
  trendUp = true,
  icon: Icon,
  glow,
  valueClass,
  sparkColor,
}: {
  title: string
  value: React.ReactNode
  trend: string
  trendUp?: boolean
  icon: React.ElementType
  glow: Glow
  valueClass: string
  sparkColor: string
}) {
  const glowMap: Record<Glow, string> = {
    emerald: 'hover:shadow-emerald-500/20 hover:border-emerald-500/30',
    amber: 'hover:shadow-amber-500/20 hover:border-amber-500/30',
    red: 'hover:shadow-red-500/25 hover:border-red-500/40 shadow-red-500/10',
    cyan: 'hover:shadow-cyan-500/20 hover:border-cyan-500/30',
    indigo: 'hover:shadow-indigo-500/25 hover:border-indigo-500/40',
    slate: 'hover:shadow-slate-500/10 hover:border-slate-600/40',
    blue: 'hover:shadow-blue-500/20 hover:border-blue-500/30',
  }

  const iconTone: Record<Glow, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
    slate: 'text-slate-300 bg-slate-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  }

  return (
    <div
      className={`group relative bg-slate-950/50 border border-white/5 rounded-xl px-2.5 py-2 flex flex-col justify-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-sm ${glowMap[glow]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${iconTone[glow]}`}>
            <Icon className="w-3 h-3" />
          </span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider truncate">{title}</span>
        </div>
        <MiniSpark color={sparkColor} />
      </div>
      <div className="flex items-baseline justify-between mt-1">
        <span className={`text-sm font-mono font-black ${valueClass}`}>{value}</span>
        <span
          className={`text-[8px] font-bold flex items-center gap-0.5 ${trendUp ? 'text-emerald-400' : 'text-red-400'
            }`}
        >
          {trendUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {trend}
        </span>
      </div>
    </div>
  )
}

export default function DashboardKpiStrip({
  assetsCount,
  activeAlertsCount,
  criticalAlertsCount,
  openWorkOrders,
  coveragePct = 98.4,
  placeLabel,
}: DashboardKpiStripProps) {
  return (
    <div className="space-y-1">
      {placeLabel && (
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
          Region: <span className="text-blue-400">{placeLabel}</span>
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <KpiCard
          title="Monitored Assets"
          value={assetsCount}
          trend="+2"
          icon={Boxes}
          glow="emerald"
          valueClass="text-white"
          sparkColor="#34d399"
        />
        <KpiCard
          title="Active Alerts"
          value={activeAlertsCount}
          trend="+3"
          trendUp={false}
          icon={AlertTriangle}
          glow="amber"
          valueClass="text-amber-400"
          sparkColor="#fbbf24"
        />
        <KpiCard
          title="Critical Alerts"
          value={criticalAlertsCount}
          trend="-1"
          icon={ShieldCheck}
          glow="red"
          valueClass="text-red-500"
          sparkColor="#f87171"
        />
        <KpiCard
          title="Coverage %"
          value={`${coveragePct}%`}
          trend="+0.2%"
          icon={Radar}
          glow="cyan"
          valueClass="text-cyan-300"
          sparkColor="#22d3ee"
        />
        <KpiCard
          title="AI Detections"
          value={14}
          trend="+4"
          icon={BrainCircuit}
          glow="indigo"
          valueClass="text-indigo-400"
          sparkColor="#a78bfa"
        />
        <KpiCard
          title="Runs (24H)"
          value={6}
          trend="+1"
          icon={Activity}
          glow="blue"
          valueClass="text-white"
          sparkColor="#60a5fa"
        />
        <KpiCard
          title="Work Orders"
          value={openWorkOrders ?? '—'}
          trend="Hold"
          trendUp
          icon={ClipboardList}
          glow="slate"
          valueClass="text-white"
          sparkColor="#94a3b8"
        />
      </div>
    </div>
  )
}
