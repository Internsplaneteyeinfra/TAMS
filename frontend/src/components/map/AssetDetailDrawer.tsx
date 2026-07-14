import React, { useEffect, useMemo } from 'react'
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
  /** Docked bottom panel in the right column (default) */
  variant?: 'dock' | 'overlay'
}

function healthPct(asset: Asset): number {
  if (asset.health_score === 'healthy') return 96
  if (asset.health_score === 'attention_required') return 72
  if (asset.health_score === 'critical') return 38
  return 85
}

export default function AssetDetailDrawer({
  asset,
  onClose,
  nearbyAssets = [],
  variant = 'dock',
}: AssetDetailDrawerProps) {
  const [tab, setTab] = React.useState<TabId>('overview')

  useEffect(() => {
    setTab('overview')
  }, [asset?.id])

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

  const panel = (
    <aside
      className={`bg-[#0b1220] border-slate-700 flex flex-col min-h-0 h-full w-full ${
        variant === 'dock' ? 'border-l' : 'border-l absolute top-0 right-0 bottom-0 w-[min(100%,22rem)] z-[6001]'
      }`}
    >
      <header className="shrink-0 px-3 py-2.5 border-b border-slate-800 flex items-start justify-between gap-2 bg-[#080d18]">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-cyan-400" aria-hidden />
            Asset detail
          </p>
          <h2 className="text-sm font-bold text-white truncate mt-0.5">{asset.name}</h2>
          <p className="text-[9px] font-mono text-slate-500 truncate">{asset.id}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white p-1 shrink-0" aria-label="Close asset detail">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="shrink-0 flex gap-0.5 overflow-x-auto scrollbar-thin px-2 py-1.5 border-b border-slate-800">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-2 py-1 rounded text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1 transition ${
                tab === t.id
                  ? 'bg-slate-800 text-slate-100 border border-slate-600'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3 min-h-0">
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Voltage" value={metrics.voltage} />
              <Metric label="Status" value={healthLabel} valueClass={healthColor} />
              <Metric label="Temperature" value={metrics.temp} />
              <Metric label="Load" value={metrics.load} />
              <Metric label="Health" value={`${metrics.health}%`} valueClass="text-emerald-400" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-900 text-xs font-semibold transition"
              >
                Open full
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
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
                <li key={a.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-semibold text-slate-200">{a.name}</span>
                  <span className="text-slate-500 ml-2 uppercase text-[9px]">{a.asset_type}</span>
                </li>
              ))
            )}
          </ul>
        )}
        {tab !== 'overview' && tab !== 'nearby' && (
          <p className="text-xs text-slate-500 text-center py-6">
            {TABS.find((t) => t.id === tab)?.label} data loads from SCADA / AI pipeline.
          </p>
        )}
      </div>
    </aside>
  )

  if (variant === 'overlay') {
    return (
      <>
        <button
          type="button"
          className="absolute inset-0 bg-[#020617]/45 z-[6000] pointer-events-auto"
          aria-label="Close asset drawer"
          onClick={onClose}
        />
        {panel}
      </>
    )
  }

  return panel
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
    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
      <p className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-mono font-semibold mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  )
}
