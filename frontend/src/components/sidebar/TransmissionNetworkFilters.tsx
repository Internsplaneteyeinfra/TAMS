import React, { useMemo } from 'react'
import { X } from 'lucide-react'
import type { Alert, Asset } from '@/lib/api'

export type FilterPanelId =
  | 'state'
  | 'voltage'
  | 'status'
  | 'alert'
  | 'assetType'
  | 'operator'
  | 'date'
  | 'weather'

export interface NetworkFilterValues {
  state: string | null
  voltage: string | null
  status: string | null
  alert: 'open' | 'none' | null
  assetType: 'tower' | 'line' | 'substation' | null
  operator: string | null
  date: '7d' | '30d' | '90d' | null
  weather: 'high' | 'medium' | 'low' | null
}

export const EMPTY_NETWORK_FILTERS: NetworkFilterValues = {
  state: null,
  voltage: null,
  status: null,
  alert: null,
  assetType: null,
  operator: null,
  date: null,
  weather: null,
}

const FILTER_BUTTONS: { id: FilterPanelId; label: string }[] = [
  { id: 'state', label: 'State' },
  { id: 'voltage', label: 'Voltage' },
  { id: 'status', label: 'Status' },
  { id: 'alert', label: 'Alert' },
  { id: 'assetType', label: 'Asset Type' },
  { id: 'operator', label: 'Operator' },
  { id: 'date', label: 'Date' },
  { id: 'weather', label: 'Weather' },
]

const VOLTAGE_OPTS = ['765', '400', '220', '132', '66', 'other'] as const
const STATUS_OPTS = [
  { id: 'healthy', label: 'Healthy', emoji: '🟢' },
  { id: 'attention_required', label: 'Attention', emoji: '🟡' },
  { id: 'critical', label: 'Critical', emoji: '🔴' },
] as const
const TYPE_OPTS = [
  { id: 'line' as const, label: 'Lines', emoji: '⚡' },
  { id: 'substation' as const, label: 'Substations', emoji: '🏭' },
  { id: 'tower' as const, label: 'Towers', emoji: '🗼' },
]
const DATE_OPTS = [
  { id: '7d' as const, label: 'Last 7 days', emoji: '📅' },
  { id: '30d' as const, label: 'Last 30 days', emoji: '🗓️' },
  { id: '90d' as const, label: 'Last 90 days', emoji: '📆' },
]
const WEATHER_OPTS = [
  { id: 'high' as const, label: 'High fire risk', emoji: '🔥' },
  { id: 'medium' as const, label: 'Medium risk', emoji: '⛅' },
  { id: 'low' as const, label: 'Low risk', emoji: '🌤️' },
]

function assetState(a: Asset): string {
  const s = a.metadata?.country_or_state
  return typeof s === 'string' && s.trim() ? s.trim() : 'Unknown'
}

function assetVoltageKey(a: Asset): string {
  const raw = a.metadata?.voltage_kv
  const kv = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(kv)) return 'other'
  if (kv >= 700) return '765'
  if (kv >= 350) return '400'
  if (kv >= 200) return '220'
  if (kv >= 100) return '132'
  if (kv >= 50) return '66'
  return 'other'
}

function assetOperator(a: Asset): string {
  const o = a.metadata?.operator
  return typeof o === 'string' && o.trim() ? o.trim() : 'Unassigned'
}

/** Synthetic “days since last update” from id — stable per asset. */
function assetAgeDays(a: Asset): number {
  const hash = a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return hash % 100
}

function assetWeatherRisk(a: Asset): 'high' | 'medium' | 'low' {
  const hash = a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const temp = 24 + (hash % 12)
  const wind = 8 + (hash % 16)
  if (temp > 30 && wind > 14) return 'high'
  if (temp > 26) return 'medium'
  return 'low'
}

export function applyNetworkFilters(
  assets: Asset[],
  filters: NetworkFilterValues,
  alerts: Alert[],
  searchQuery: string
): Asset[] {
  const openAlertIds = new Set(alerts.filter((al) => al.status === 'open').map((al) => al.asset_id))
  const q = searchQuery.trim().toLowerCase()

  return assets.filter((a) => {
    if (q) {
      const hay = `${a.name} ${a.id} ${assetState(a)} ${assetOperator(a)}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.state && assetState(a).toLowerCase() !== filters.state.toLowerCase()) return false
    if (filters.voltage && assetVoltageKey(a) !== filters.voltage) return false
    if (filters.status && (a.health_score || 'healthy') !== filters.status) return false
    if (filters.alert === 'open' && !openAlertIds.has(a.id)) return false
    if (filters.alert === 'none' && openAlertIds.has(a.id)) return false
    if (filters.assetType && a.asset_type !== filters.assetType) return false
    if (filters.operator && assetOperator(a) !== filters.operator) return false
    if (filters.date === '7d' && assetAgeDays(a) > 7) return false
    if (filters.date === '30d' && assetAgeDays(a) > 30) return false
    if (filters.date === '90d' && assetAgeDays(a) > 90) return false
    if (filters.weather && assetWeatherRisk(a) !== filters.weather) return false
    return true
  })
}

function countBy<T extends string>(assets: Asset[], keyFn: (a: Asset) => T): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of assets) {
    const k = keyFn(a)
    out[k] = (out[k] || 0) + 1
  }
  return out
}

interface TransmissionNetworkFiltersProps {
  assets: Asset[]
  alerts: Alert[]
  filters: NetworkFilterValues
  onChange: (next: NetworkFilterValues) => void
  openPanel: FilterPanelId | null
  onOpenPanel: (id: FilterPanelId | null) => void
  matchCount: number
}

export default function TransmissionNetworkFilters({
  assets,
  alerts,
  filters,
  onChange,
  openPanel,
  onOpenPanel,
  matchCount,
}: TransmissionNetworkFiltersProps) {
  const openAlertIds = useMemo(
    () => new Set(alerts.filter((a) => a.status === 'open').map((a) => a.asset_id)),
    [alerts]
  )

  const stateCounts = useMemo(() => countBy(assets, assetState), [assets])
  const voltageCounts = useMemo(() => countBy(assets, assetVoltageKey), [assets])
  const statusCounts = useMemo(
    () => countBy(assets, (a) => a.health_score || 'healthy'),
    [assets]
  )
  const typeCounts = useMemo(() => countBy(assets, (a) => a.asset_type), [assets])
  const operatorCounts = useMemo(() => countBy(assets, assetOperator), [assets])
  const dateCounts = useMemo(() => {
    const c = { '7d': 0, '30d': 0, '90d': 0 }
    for (const a of assets) {
      const d = assetAgeDays(a)
      if (d <= 7) c['7d']++
      if (d <= 30) c['30d']++
      if (d <= 90) c['90d']++
    }
    return c
  }, [assets])
  const weatherCounts = useMemo(() => countBy(assets, assetWeatherRisk), [assets])
  const alertCounts = useMemo(() => {
    let open = 0
    for (const a of assets) if (openAlertIds.has(a.id)) open++
    return { open, none: assets.length - open }
  }, [assets, openAlertIds])

  const activeCount = Object.values(filters).filter(Boolean).length

  const setFilter = <K extends keyof NetworkFilterValues>(key: K, value: NetworkFilterValues[K]) => {
    onChange({ ...filters, [key]: filters[key] === value ? null : value })
  }

  const clearAll = () => {
    onChange({ ...EMPTY_NETWORK_FILTERS })
    onOpenPanel(null)
  }

  const isButtonActive = (id: FilterPanelId) => {
    if (openPanel === id) return true
    if (id === 'state') return Boolean(filters.state)
    if (id === 'voltage') return Boolean(filters.voltage)
    if (id === 'status') return Boolean(filters.status)
    if (id === 'alert') return Boolean(filters.alert)
    if (id === 'assetType') return Boolean(filters.assetType)
    if (id === 'operator') return Boolean(filters.operator)
    if (id === 'date') return Boolean(filters.date)
    if (id === 'weather') return Boolean(filters.weather)
    return false
  }

  const chipLabels = useMemo(() => {
    const chips: { key: keyof NetworkFilterValues; label: string }[] = []
    if (filters.state) chips.push({ key: 'state', label: `📍 ${filters.state}` })
    if (filters.voltage)
      chips.push({
        key: 'voltage',
        label: `⚡ ${filters.voltage === 'other' ? 'Other' : `${filters.voltage} kV`}`,
      })
    if (filters.status) {
      const s = STATUS_OPTS.find((o) => o.id === filters.status)
      chips.push({ key: 'status', label: `${s?.emoji ?? ''} ${s?.label ?? filters.status}` })
    }
    if (filters.alert)
      chips.push({
        key: 'alert',
        label: filters.alert === 'open' ? '⚠️ Has alert' : '✅ No alert',
      })
    if (filters.assetType) {
      const t = TYPE_OPTS.find((o) => o.id === filters.assetType)
      chips.push({ key: 'assetType', label: `${t?.emoji ?? ''} ${t?.label ?? filters.assetType}` })
    }
    if (filters.operator) chips.push({ key: 'operator', label: `👤 ${filters.operator}` })
    if (filters.date) {
      const d = DATE_OPTS.find((o) => o.id === filters.date)
      chips.push({ key: 'date', label: `${d?.emoji ?? ''} ${d?.label ?? filters.date}` })
    }
    if (filters.weather) {
      const w = WEATHER_OPTS.find((o) => o.id === filters.weather)
      chips.push({ key: 'weather', label: `${w?.emoji ?? ''} ${w?.label ?? filters.weather}` })
    }
    return chips
  }, [filters])

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Filters</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-slate-500">{matchCount} shown</span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300"
            >
              Clear ({activeCount})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {FILTER_BUTTONS.map((f) => {
          const active = isButtonActive(f.id)
          return (
            <button
              key={f.id}
              type="button"
              aria-expanded={openPanel === f.id}
              aria-pressed={active}
              onClick={() => onOpenPanel(openPanel === f.id ? null : f.id)}
              className={`px-2 py-1.5 rounded text-[9px] font-semibold text-left transition border ${
                active
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]'
                  : 'text-slate-400 bg-slate-900 border-slate-800 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {chipLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chipLabels.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange({ ...filters, [c.key]: null })}
              className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-900 border border-slate-700 text-slate-200 hover:border-red-500/40 hover:text-red-300 transition"
              title="Remove filter"
            >
              <span className="truncate">{c.label}</span>
              <X className="w-2.5 h-2.5 shrink-0 opacity-70" />
            </button>
          ))}
        </div>
      )}

      {openPanel && (
        <div className="rounded-md border border-slate-800 bg-[#0a1020] p-2 max-h-44 overflow-y-auto scrollbar-thin space-y-1 animate-fade-up">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {FILTER_BUTTONS.find((b) => b.id === openPanel)?.label} options
          </p>

          {openPanel === 'state' &&
            Object.entries(stateCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([state, n]) => (
                <OptionRow
                  key={state}
                  label={`📍 ${state}`}
                  count={n}
                  selected={filters.state === state}
                  onClick={() => setFilter('state', state)}
                />
              ))}

          {openPanel === 'voltage' &&
            VOLTAGE_OPTS.map((v) => (
              <OptionRow
                key={v}
                label={v === 'other' ? '⚡ Other / unclassified' : `⚡ ${v} kV`}
                count={voltageCounts[v] || 0}
                selected={filters.voltage === v}
                onClick={() => setFilter('voltage', v)}
              />
            ))}

          {openPanel === 'status' &&
            STATUS_OPTS.map((s) => (
              <OptionRow
                key={s.id}
                label={`${s.emoji} ${s.label}`}
                count={statusCounts[s.id] || 0}
                selected={filters.status === s.id}
                onClick={() => setFilter('status', s.id)}
              />
            ))}

          {openPanel === 'alert' && (
            <>
              <OptionRow
                label="⚠️ Has open alert"
                count={alertCounts.open}
                selected={filters.alert === 'open'}
                onClick={() => setFilter('alert', 'open')}
              />
              <OptionRow
                label="✅ No open alert"
                count={alertCounts.none}
                selected={filters.alert === 'none'}
                onClick={() => setFilter('alert', 'none')}
              />
            </>
          )}

          {openPanel === 'assetType' &&
            TYPE_OPTS.map((t) => (
              <OptionRow
                key={t.id}
                label={`${t.emoji} ${t.label}`}
                count={typeCounts[t.id] || 0}
                selected={filters.assetType === t.id}
                onClick={() => setFilter('assetType', t.id)}
              />
            ))}

          {openPanel === 'operator' &&
            Object.entries(operatorCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 24)
              .map(([op, n]) => (
                <OptionRow
                  key={op}
                  label={`👤 ${op}`}
                  count={n}
                  selected={filters.operator === op}
                  onClick={() => setFilter('operator', op)}
                />
              ))}

          {openPanel === 'date' &&
            DATE_OPTS.map((d) => (
              <OptionRow
                key={d.id}
                label={`${d.emoji} ${d.label}`}
                count={dateCounts[d.id]}
                selected={filters.date === d.id}
                onClick={() => setFilter('date', d.id)}
              />
            ))}

          {openPanel === 'weather' &&
            WEATHER_OPTS.map((w) => (
              <OptionRow
                key={w.id}
                label={`${w.emoji} ${w.label}`}
                count={weatherCounts[w.id] || 0}
                selected={filters.weather === w.id}
                onClick={() => setFilter('weather', w.id)}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function OptionRow({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[10px] font-semibold transition border ${
        selected
          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-100'
          : 'bg-slate-900/60 border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      <span className="truncate text-left">{label}</span>
      <span className={`shrink-0 font-mono tabular-nums ${selected ? 'text-cyan-300' : 'text-slate-500'}`}>
        {count.toLocaleString()}
      </span>
    </button>
  )
}
