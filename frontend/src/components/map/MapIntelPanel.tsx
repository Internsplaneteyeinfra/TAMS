import React, { useState } from 'react'
import { AlertTriangle, ChevronDown, Radio } from 'lucide-react'

import {
  MAP_BOTTOM_INSET,
  MAP_EDGE,
  MAP_INTEL_COLLAPSED_WIDTH,
  MAP_INTEL_TOP,
  MAP_INTEL_WIDTH,
} from '@/components/map/mapLayout'
import PanelMinimizeButton from '@/components/ui/PanelMinimizeButton'
import type { HeatMapMode } from '@/components/map/HeatMapModeToggle'
import type { RegionStats } from '@/lib/placeFilter'

const LAYER_MODES: { id: HeatMapMode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'heatmap', label: 'Heat Map' },
  { id: 'ai-risk', label: 'AI Risk' },
  { id: 'vegetation', label: 'Vegetation' },
  { id: 'flood', label: 'Flood' },
  { id: 'wind', label: 'Wind' },
  { id: 'lightning', label: 'Lightning' },
]

const ASSET_ROWS: {
  key: string
  label: string
  color: string
  getCount: (s: RegionStats) => number
  filterKey?: 'tower' | 'substation' | 'line'
}[] = [
    { key: 'tower', label: 'Tower', color: '#ef4444', getCount: (s) => s.towers, filterKey: 'tower' },
    { key: 'substation', label: 'Substation', color: '#3b82f6', getCount: (s) => s.substations, filterKey: 'substation' },
    { key: 'line', label: 'Power Line', color: '#22c55e', getCount: (s) => s.lines, filterKey: 'line' },
    { key: 'transformer', label: 'Transformer', color: '#a855f7', getCount: (s) => s.transformers },
    { key: 'solar', label: 'Solar', color: '#f59e0b', getCount: (s) => s.solar },
  ]

interface MapIntelPanelProps {
  stats: RegionStats
  typeFilters: Record<string, boolean>
  onToggleType: (type: 'tower' | 'substation' | 'line') => void
  heatMapMode: HeatMapMode
  onHeatMapMode: (mode: HeatMapMode) => void
  resolvedToday?: number
  offlineTowers?: number
  collapsed?: boolean
  onToggleCollapse?: () => void
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-800/80 last:border-b-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-900/50 transition">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

export default function MapIntelPanel({
  stats,
  typeFilters,
  onToggleType,
  heatMapMode,
  onHeatMapMode,
  resolvedToday = 12,
  offlineTowers = 0,
  collapsed = false,
  onToggleCollapse,
}: MapIntelPanelProps) {
  const panelStyle = {
    top: MAP_INTEL_TOP,
    left: MAP_EDGE,
    bottom: MAP_BOTTOM_INSET,
    width: collapsed ? MAP_INTEL_COLLAPSED_WIDTH : MAP_INTEL_WIDTH,
  }

  if (collapsed) {
    return (
      <aside
        className="absolute z-[1100] flex flex-col items-center gap-1.5 rounded-xl border border-slate-700/90 bg-[#0a1020]/95 shadow-lg overflow-hidden select-none py-2 px-1 backdrop-blur-sm"
        style={{ top: MAP_INTEL_TOP, left: MAP_EDGE, width: MAP_INTEL_COLLAPSED_WIDTH }}
        aria-label="Region summary (collapsed)"
      >
        <PanelMinimizeButton minimized onClick={() => onToggleCollapse?.()} title="Expand region summary" />
        <button
          type="button"
          onClick={() => onToggleCollapse?.()}
          className="text-[7px] font-bold text-slate-500 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180 hover:text-white transition px-0.5"
          title="Expand region summary"
        >
          Region
        </button>
      </aside>
    )
  }

  return (
    <aside className="absolute z-[1100] flex flex-col rounded-xl border border-slate-700/90 bg-[#0a1020]/95 shadow-xl overflow-hidden select-none backdrop-blur-sm" style={panelStyle} aria-label="Region summary">
      <div className="shrink-0 px-3 py-2 border-b border-slate-800 bg-slate-950/90">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Region Summary</p>
            <h3 className="text-sm font-extrabold text-white truncate">{stats.placeLabel}</h3>
          </div>
          {onToggleCollapse && <PanelMinimizeButton variant="hide" onClick={() => onToggleCollapse()} title="Hide region summary" />}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[10px]">
          <Metric label="Assets" value={stats.totalAssets} />
          <Metric label="Alerts" value={stats.openAlerts} accent={stats.openAlerts > 0 ? 'text-amber-400' : 'text-emerald-400'} />
          <Metric label="Coverage" value={`${stats.coveragePct}%`} accent="text-cyan-300" />
          <Metric label="Healthy" value={`${stats.healthyPct}%`} accent="text-emerald-400" />
        </div>
        {stats.lineKm > 0 && (
          <p className="mt-1.5 text-[9px] text-slate-500 font-mono">
            Corridor {stats.lineKm.toLocaleString()} km · OSM / indian_KML
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <Section title="Asset Breakdown">
          <table className="w-full text-[10px]">
            <tbody>
              {ASSET_ROWS.map((row) => {
                const active = row.filterKey ? typeFilters[row.filterKey] !== false : true
                return (
                  <tr key={row.key} className="border-b border-slate-800/60 last:border-b-0">
                    <td className="py-1 pr-1">
                      {row.filterKey ? (
                        <button type="button" onClick={() => onToggleType(row.filterKey!)} className={`flex items-center gap-1.5 w-full text-left transition ${active ? 'opacity-100' : 'opacity-40'}`}>
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="text-slate-200 font-medium">{row.label}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                          <span className="text-slate-200 font-medium">{row.label}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-1 text-right font-mono text-slate-200 tabular-nums font-bold">{row.getCount(stats).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>

        <Section title="Corridor Voltage" defaultOpen={stats.placeId === 'gujarat' || stats.placeLabel === 'Gujarat'}>
          <div className="space-y-1 text-[9px]">
            {[
              { kv: '765 kV', color: '#dc2626' },
              { kv: '400 kV', color: '#ea580c' },
              { kv: '220 kV', color: '#2563eb' },
              { kv: '132 kV', color: '#0891b2' },
              { kv: '66 kV', color: '#16a34a' },
              { kv: 'Other', color: '#64748b' },
            ].map((row) => (
              <div key={row.kv} className="flex items-center gap-2">
                <span className="w-4 h-0.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                <span className="text-slate-400 font-mono">{row.kv}</span>
              </div>
            ))}
            <p className="text-[8px] text-slate-600 pt-1">Line color = voltage class from KML. Zoom in for individual towers.</p>
          </div>
        </Section>

        <Section title="Today">
          <div className="space-y-1.5 text-[10px]">
            <Row label="New Alerts" value={stats.openAlerts} className="text-amber-400" />
            <Row label="Resolved" value={resolvedToday} className="text-emerald-400" />
            <Row label="Offline Towers" value={offlineTowers} className={offlineTowers > 0 ? 'text-red-400' : 'text-slate-300'} />
            <Row label="Critical" value={stats.criticalAlerts} className={stats.criticalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'} icon={<AlertTriangle className="w-3 h-3" />} />
          </div>
        </Section>
      </div>

      <div className="shrink-0 p-2 border-t border-slate-800 bg-slate-950/90">
        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
          <Radio className="w-3 h-3" /> Layer Mode
        </label>
        <select value={heatMapMode} onChange={(e) => onHeatMapMode(e.target.value as HeatMapMode)} className="w-full h-7 px-2 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-200 font-semibold outline-none focus:border-blue-500/50 cursor-pointer">
          {LAYER_MODES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
        </select>
      </div>
    </aside>
  )
}

function Metric({ label, value, accent = 'text-white' }: { label: string; value: React.ReactNode; accent?: string }) {
  const display =
    typeof value === 'number' ? value.toLocaleString() : value
  return (
    <div>
      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
      <p className={`font-mono font-black text-xs ${accent}`}>{display}</p>
    </div>
  )
}

function Row({ label, value, className, icon }: { label: string; value: number; className: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 font-semibold flex items-center gap-1">{icon}{label}</span>
      <span className={`font-mono font-bold ${className}`}>{value}</span>
    </div>
  )
}
