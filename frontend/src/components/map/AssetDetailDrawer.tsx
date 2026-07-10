import React, { useMemo } from 'react'
import {
  X,
  Activity,
  BarChart3,
  Camera,
  CloudSun,
  Cpu,
  History,
  MapPin,
  Wrench,
  FileText,
} from 'lucide-react'

import type { Asset } from '@/lib/api'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'health', label: 'Health', icon: BarChart3 },
  { id: 'sensors', label: 'Sensors', icon: Cpu },
  { id: 'images', label: 'Images', icon: Camera },
  { id: 'history', label: 'History', icon: History },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'ai', label: 'AI Report', icon: FileText },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'nearby', label: 'Nearby Assets', icon: MapPin },
] as const

type TabId = (typeof TABS)[number]['id']

interface AssetDetailDrawerProps {
  asset: Asset | null
  onClose: () => void
  nearbyAssets?: Asset[]
}

function healthPct(asset: Asset): number {
  if (asset.health_score === 'healthy') return 96
  if (asset.health_score === 'attention_required') return 72
  if (asset.health_score === 'critical') return 38
  return 85
}

export default function AssetDetailDrawer({ asset, onClose, nearbyAssets = [] }: AssetDetailDrawerProps) {
  const [tab, setTab] = React.useState<TabId>('overview')

  const metrics = useMemo(() => {
    if (!asset) return null
    const hash = asset.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return {
      voltage: asset.metadata?.voltage_kv ? `${asset.metadata.voltage_kv} KV` : '—',
      temp: `${24 + (hash % 12)}°C`,
      load: `${55 + (hash % 30)}%`,
      health: healthPct(asset),
    }
  }, [asset])

  if (!asset || !metrics) return null

  const healthLabel =
    asset.health_score === 'healthy'
      ? 'Healthy'
      : asset.health_score === 'attention_required'
        ? 'Warning'
        : 'Critical'

  const healthColor =
    asset.health_score === 'healthy'
      ? 'text-emerald-400'
      : asset.health_score === 'attention_required'
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/40 z-[6000]"
        aria-label="Close asset drawer"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 bottom-0 w-[min(100%,22rem)] z-[6001] bg-[#0a1020] border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in-right">
        <header className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{asset.asset_type}</p>
            <h2 className="text-sm font-extrabold text-white truncate flex items-center gap-1.5">
              <span>⚡</span> {asset.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="shrink-0 flex gap-0.5 overflow-x-auto scrollbar-thin px-2 py-2 border-b border-slate-800/80">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition ${tab === t.id
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Voltage" value={metrics.voltage} />
                <Metric label="Status" value={healthLabel} valueClass={healthColor} />
                <Metric label="Temperature" value={metrics.temp} />
                <Metric label="Load" value={metrics.load} />
                <Metric label="Health" value={`${metrics.health}%`} valueClass="text-emerald-400" />
              </div>
              <div className="flex gap-2">
                <button type="button" className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition">
                  View
                </button>
                <button type="button" className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition">
                  Analytics
                </button>
              </div>
              {asset.description && (
                <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-3">
                  {asset.description}
                </p>
              )}
            </>
          )}
          {tab === 'nearby' && (
            <ul className="space-y-2">
              {nearbyAssets.length === 0 ? (
                <li className="text-xs text-slate-500">No nearby assets in range</li>
              ) : (
                nearbyAssets.map((a) => (
                  <li key={a.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <span className="font-bold text-slate-200">{a.name}</span>
                    <span className="text-slate-500 ml-2 uppercase text-[9px]">{a.asset_type}</span>
                  </li>
                ))
              )}
            </ul>
          )}
          {tab !== 'overview' && tab !== 'nearby' && (
            <p className="text-xs text-slate-500 text-center py-8">
              {TABS.find((t) => t.id === tab)?.label} data loads from SCADA / AI pipeline.
            </p>
          )}
        </div>
      </aside>
    </>
  )
}

function Metric({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-mono font-black mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  )
}
