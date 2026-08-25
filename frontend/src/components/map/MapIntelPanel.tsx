import React, { useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Radio } from 'lucide-react'

import {
  MAP_BOTTOM_INSET,
  MAP_EDGE,
  MAP_INTEL_COLLAPSED_WIDTH,
  MAP_INTEL_TOP,
  MAP_INTEL_WIDTH,
} from '@/components/map/mapLayout'
import PanelMinimizeButton from '@/components/ui/PanelMinimizeButton'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import type { HeatMapMode } from '@/components/map/HeatMapModeToggle'
import { getPlaceById, getPlacePath } from '@/config/places'
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

type FilterKey = 'tower' | 'substation' | 'line'

const ASSET_ROWS: {
  key: string
  label: string
  color: string
  getCount: (s: RegionStats) => number
  filterKey?: FilterKey
}[] = [
    { key: 'tower', label: 'Tower', color: '#ef4444', getCount: (s) => s.towers, filterKey: 'tower' },
    { key: 'substation', label: 'Substation', color: '#3b82f6', getCount: (s) => s.substations, filterKey: 'substation' },
    { key: 'line', label: 'Power Line', color: '#22c55e', getCount: (s) => s.lines, filterKey: 'line' },
  ]

const ASSET_SUBROWS: { key: string; label: string; color: string; getCount: (s: RegionStats) => number }[] = [
  { key: 'transformer', label: 'Transformer', color: '#a855f7', getCount: (s) => s.transformers },
  { key: 'solar', label: 'Solar', color: '#f59e0b', getCount: (s) => s.solar },
]

const VOLTAGE_ROWS: { key: string; label: string; color: string }[] = [
  { key: '765', label: '765 kV', color: '#dc2626' },
  { key: '400', label: '400 kV', color: '#ea580c' },
  { key: '220', label: '220 kV', color: '#2563eb' },
  { key: '132', label: '132 kV', color: '#0891b2' },
  { key: '66', label: '66 kV', color: '#16a34a' },
  { key: 'other', label: 'Other', color: '#64748b' },
]

type FilterTab = 'assets' | 'voltage' | 'boundaries' | 'location'

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'assets', label: 'Assets' },
  { id: 'voltage', label: 'Voltage' },
  { id: 'boundaries', label: 'Bounds' },
  { id: 'location', label: 'Location' },
]

interface MapIntelPanelProps {
  stats: RegionStats
  typeFilters: Record<string, boolean>
  onToggleType: (type: FilterKey) => void
  voltageFilters: Record<string, boolean>
  onToggleVoltage: (kv: string) => void
  substationVoltageFilters: Record<string, boolean>
  onToggleSubstationVoltage: (kv: string) => void
  heatMapMode: HeatMapMode
  onHeatMapMode: (mode: HeatMapMode) => void
  corridorsOn: boolean
  onToggleCorridors: () => void
  labelsOn: boolean
  onToggleLabels: () => void
  selectedPlaceId: string
  onSelectPlace: (placeId: string) => void
  resolvedToday?: number
  offlineTowers?: number
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** India explorer: counts only — no map filter / location drill-down. */
  interactionMode?: 'explorer' | 'operations'
}

export default function MapIntelPanel({
  stats,
  typeFilters,
  onToggleType,
  voltageFilters,
  onToggleVoltage,
  substationVoltageFilters,
  onToggleSubstationVoltage,
  heatMapMode,
  onHeatMapMode,
  corridorsOn,
  onToggleCorridors,
  labelsOn,
  onToggleLabels,
  selectedPlaceId,
  onSelectPlace,
  resolvedToday = 0,
  offlineTowers = 0,
  collapsed = false,
  onToggleCollapse,
  interactionMode = 'operations',
}: MapIntelPanelProps) {
  const [tab, setTab] = useState<FilterTab>('assets')
  const isExplorer = interactionMode === 'explorer' || selectedPlaceId === 'india'

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

  const panelStyle = {
    top: MAP_INTEL_TOP,
    left: MAP_EDGE,
    bottom: MAP_BOTTOM_INSET,
    width: MAP_INTEL_WIDTH,
  }

  return (
    <aside
      className="absolute z-[1100] flex flex-col rounded-xl border border-slate-700/90 bg-[#0a1020]/95 shadow-xl overflow-hidden select-none backdrop-blur-sm"
      style={panelStyle}
      aria-label="Region summary"
    >
      {/* Header + key metrics */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-800 bg-slate-950/90">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Region Summary</p>
            <h3 className="text-sm font-extrabold text-white truncate">
              {isExplorer ? 'India' : stats.placeLabel}
            </h3>
          </div>
          {onToggleCollapse && <PanelMinimizeButton variant="hide" onClick={() => onToggleCollapse()} title="Hide region summary" />}
        </div>
        {isExplorer && (
          <p className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-cyan-500/80">
            National KML counts · map filters locked
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[10px]">
          <Metric label="Assets" value={<AnimatedNumber value={stats.totalAssets} />} />
          <Metric
            label="Alerts"
            value={<AnimatedNumber value={stats.openAlerts} />}
            accent={stats.openAlerts > 0 ? 'text-amber-400' : 'text-emerald-400'}
          />
          <Metric
            label="Coverage"
            value={
              <>
                <AnimatedNumber value={stats.coveragePct} integer={false} format={(n) => n.toFixed(1)} />%
              </>
            }
            accent="text-cyan-300"
          />
          <Metric
            label="Healthy"
            value={
              <>
                <AnimatedNumber value={stats.healthyPct} integer={false} format={(n) => n.toFixed(0)} />%
              </>
            }
            accent="text-emerald-400"
          />
        </div>
        <p className="mt-1.5 text-[8px] leading-relaxed text-slate-500">
          Assets = towers + lines + substations (
          {stats.towers.toLocaleString()} + {stats.lines.toLocaleString()} +{' '}
          {stats.substations.toLocaleString()})
        </p>
        {stats.lineKm > 0 && (
          <p className="mt-1 text-[9px] text-slate-500 font-mono">
            Corridor {stats.lineKm.toLocaleString()} km · OSM / indian_KML
          </p>
        )}
      </div>

      {/* Segmented filter selector */}
      <div className="shrink-0 px-2 py-2 border-b border-slate-800/80">
        <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-slate-900/70 p-0.5">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={`h-6 rounded-md text-[9px] font-bold uppercase tracking-wide transition ${active
                    ? 'bg-cyan-500/15 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active filter group */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 py-2.5">
        <div key={tab} className="tams-panel-in">
        {tab === 'assets' && (
          <div className="space-y-0.5">
            {isExplorer ? (
              <>
                <GroupHint>India KML totals (counts only)</GroupHint>
                <p className="mb-2 text-[9px] leading-relaxed text-slate-500 tams-panel-in">
                  Full inventory for India. Select a state in Places for that state’s tower, line, and
                  substation counts with map filters.
                </p>
                {ASSET_ROWS.map((row) => (
                  <CountRow
                    key={row.key}
                    color={row.color}
                    label={row.label}
                    count={row.getCount(stats)}
                  />
                ))}
                <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[9px] text-slate-400">
                  Total assets:{' '}
                  <span className="font-mono font-bold text-slate-200">
                    <AnimatedNumber value={stats.totalAssets} />
                  </span>
                </div>
                <div className="mt-2 space-y-0.5 border-t border-slate-800/70 pt-2">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-slate-600">
                    Within substations
                  </p>
                  {ASSET_SUBROWS.map((row) => (
                    <CountRow
                      key={row.key}
                      color={row.color}
                      label={row.label}
                      count={row.getCount(stats)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <GroupHint>Show these asset classes on the map</GroupHint>
                {ASSET_ROWS.map((row) => (
                  <React.Fragment key={row.key}>
                    <CheckRow
                      checked={row.filterKey ? typeFilters[row.filterKey] !== false : true}
                      color={row.color}
                      label={row.label}
                      count={row.getCount(stats)}
                      onToggle={() => row.filterKey && onToggleType(row.filterKey)}
                    />
                    {row.key === 'substation' && typeFilters.substation !== false && (
                      <div className="ml-1.5 my-1 space-y-0.5 border-l border-slate-800 pl-2.5">
                        <p className="flex items-center gap-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                          <span aria-hidden>🏭</span> Substation types (kV)
                        </p>
                        {VOLTAGE_ROWS.filter((v) => v.key !== 'other').map((v) => (
                          <CheckRow
                            key={`sub-${v.key}`}
                            checked={substationVoltageFilters[v.key] !== false}
                            color={v.color}
                            label={v.label}
                            onToggle={() => onToggleSubstationVoltage(v.key)}
                          />
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                ))}
                <div className="mt-2 border-t border-slate-800/70 pt-2">
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-slate-600">
                    Within substations
                  </p>
                  {ASSET_SUBROWS.map((row) => (
                    <div key={row.key} className="flex items-center gap-2 py-0.5 text-[10px]">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                      <span className="flex-1 text-slate-400">{row.label}</span>
                      <span className="font-mono font-bold tabular-nums text-slate-300">
                        {row.getCount(stats).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'voltage' && (
          <div className="space-y-0.5">
            {isExplorer ? (
              <>
                <GroupHint>Voltage legend (India overview)</GroupHint>
                <p className="mb-2 text-[9px] leading-relaxed text-slate-500">
                  National map shows a light EHV corridor sample. Full voltage filters unlock after
                  you select a state.
                </p>
                {VOLTAGE_ROWS.map((row) => (
                  <CountRow key={row.key} color={row.color} label={row.label} swatch="line" />
                ))}
              </>
            ) : (
              <>
                <GroupHint>Filter corridors by voltage class</GroupHint>
                {VOLTAGE_ROWS.map((row) => (
                  <CheckRow
                    key={row.key}
                    checked={voltageFilters[row.key] !== false}
                    color={row.color}
                    label={row.label}
                    swatch="line"
                    onToggle={() => onToggleVoltage(row.key)}
                  />
                ))}
                <p className="mt-2 text-[8px] leading-relaxed text-slate-600">
                  Hover any corridor to see live power-flow direction. Line color = voltage class from
                  KML.
                </p>
              </>
            )}
          </div>
        )}

        {tab === 'boundaries' && (
          <div className="space-y-0.5">
            <GroupHint>Reference layers drawn over the basemap</GroupHint>
            {!isExplorer && (
              <CheckRow
                checked={corridorsOn}
                color="#22c55e"
                label="Transmission corridors"
                swatch="line"
                onToggle={onToggleCorridors}
              />
            )}
            <CheckRow checked={labelsOn} color="#38bdf8" label="Asset labels" onToggle={onToggleLabels} />
            {isExplorer && (
              <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
                Corridor layer stays on for India overview. Pick a state for full layer controls.
              </p>
            )}
          </div>
        )}

        {tab === 'location' && (
          isExplorer ? (
            <div className="space-y-2">
              <GroupHint>Region locked to India</GroupHint>
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-2">
                <p className="text-[11px] font-bold text-cyan-200">🇮🇳 India</p>
                <p className="mt-1 text-[9px] leading-relaxed text-slate-400">
                  Region Summary stays on national KML totals. Use the Places menu (top of map) to
                  open a state — then state/city filters and map asset classes unlock.
                </p>
              </div>
            </div>
          ) : (
            <LocationSelector selectedPlaceId={selectedPlaceId} onSelectPlace={onSelectPlace} />
          )
        )}
        </div>
      </div>

      {/* Today digest */}
      <div className="shrink-0 px-3 py-2 border-t border-slate-800/80">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Today</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <Row label="New Alerts" value={stats.openAlerts} className="text-amber-400" />
          <Row label="Resolved" value={resolvedToday} className="text-emerald-400" />
          <Row label="Offline" value={offlineTowers} className={offlineTowers > 0 ? 'text-red-400' : 'text-slate-300'} />
          <Row label="Critical" value={stats.criticalAlerts} className={stats.criticalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'} icon={<AlertTriangle className="w-3 h-3" />} />
        </div>
      </div>

      {/* Layer mode */}
      <div className="shrink-0 p-2 border-t border-slate-800 bg-slate-950/90">
        <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
          <Radio className="w-3 h-3" /> Layer Mode
        </label>
        <select
          value={heatMapMode}
          onChange={(e) => onHeatMapMode(e.target.value as HeatMapMode)}
          className="w-full h-7 px-2 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-200 font-semibold outline-none focus:border-cyan-500/50 cursor-pointer"
        >
          {LAYER_MODES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
        </select>
      </div>
    </aside>
  )
}

function GroupHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[8px] text-slate-600 uppercase tracking-wider font-bold mb-1.5">{children}</p>
}

function CountRow({
  color,
  label,
  count,
  swatch = 'box',
}: {
  color: string
  label: string
  count?: number
  swatch?: 'box' | 'line'
}) {
  return (
    <div className="flex w-full items-center gap-2 py-1 text-left">
      {swatch === 'line' ? (
        <span className="h-[3px] w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      )}
      <span className="flex-1 text-[10px] font-medium text-slate-200">{label}</span>
      {count != null && (
        <span className="font-mono text-[10px] font-bold tabular-nums text-slate-200">
          <AnimatedNumber value={count} />
        </span>
      )}
    </div>
  )
}

function CheckRow({
  checked,
  color,
  label,
  count,
  swatch = 'box',
  onToggle,
}: {
  checked: boolean
  color: string
  label: string
  count?: number
  swatch?: 'box' | 'line'
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="group flex items-center gap-2 w-full py-1 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-400/60 rounded"
    >
      <span
        className={`relative flex items-center justify-center w-3.5 h-3.5 rounded-[4px] border shrink-0 transition ${checked ? 'border-transparent' : 'border-slate-600 bg-slate-900 group-hover:border-slate-500'
          }`}
        style={checked ? { backgroundColor: color, boxShadow: `0 0 8px ${color}55` } : undefined}
      >
        {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />}
      </span>
      {swatch === 'line' ? (
        <span className="w-4 h-[3px] rounded-full shrink-0" style={{ backgroundColor: checked ? color : '#334155' }} />
      ) : (
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: checked ? color : '#334155' }} />
      )}
      <span className={`flex-1 text-[10px] font-medium transition ${checked ? 'text-slate-100' : 'text-slate-500'}`}>{label}</span>
      {count != null && (
        <span className={`font-mono text-[10px] font-bold tabular-nums transition ${checked ? 'text-slate-200' : 'text-slate-600'}`}>
          <AnimatedNumber value={count} />
        </span>
      )}
    </button>
  )
}

function LocationSelector({ selectedPlaceId, onSelectPlace }: { selectedPlaceId: string; onSelectPlace: (id: string) => void }) {
  const path = getPlacePath(selectedPlaceId)
  const current = getPlaceById(selectedPlaceId)
  const children = current?.children ?? []

  return (
    <div className="space-y-2">
      <GroupHint>Jump to a region</GroupHint>
      <div className="flex flex-wrap items-center gap-0.5 text-[10px]">
        {path.map((node, i) => (
          <React.Fragment key={node.id}>
            {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
            <button
              type="button"
              onClick={() => onSelectPlace(node.id)}
              className={`px-1.5 py-0.5 rounded font-semibold transition ${node.id === selectedPlaceId ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-white'
                }`}
            >
              {node.label}
            </button>
          </React.Fragment>
        ))}
      </div>
      {children.length > 0 && (
        <div className="grid grid-cols-2 gap-1">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => onSelectPlace(child.id)}
              className="h-7 px-2 rounded-md bg-slate-900/70 border border-slate-800 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-white transition truncate text-left"
            >
              {child.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, accent = 'text-white' }: { label: string; value: React.ReactNode; accent?: string }) {
  const display = typeof value === 'number' ? value.toLocaleString() : value
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
      <span className={`font-mono font-bold ${className}`}>
        <AnimatedNumber value={value} />
      </span>
    </div>
  )
}
