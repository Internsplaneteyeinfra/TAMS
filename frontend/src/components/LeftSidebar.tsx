import React, { useMemo } from 'react'
import {
  ShieldAlert,
  Search,
  Menu,
  Radio,
} from 'lucide-react'
import type { Alert, Asset } from '@/lib/api'
import CollapsibleSidebar, { SidebarCollapseHeader } from '@/components/sidebar/CollapsibleSidebar'
import SidebarNav from '@/components/sidebar/SidebarNav'
import TransmissionNetworkFilters, {
  applyNetworkFilters,
  EMPTY_NETWORK_FILTERS,
  type FilterPanelId,
  type NetworkFilterValues,
} from '@/components/sidebar/TransmissionNetworkFilters'
import { SidebarListSkeleton } from '@/components/ui/Skeleton'

interface LeftSidebarProps {
  assets: Asset[]
  alerts: Alert[]
  selectedAssetId?: string | null
  onSelectAsset: (id: string) => void
  isLoading: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  onHiddenChange?: (hidden: boolean) => void
  hideSignal?: number
  networkFilters: NetworkFilterValues
  onNetworkFiltersChange: (next: NetworkFilterValues) => void
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#10B981',
  attention_required: '#F59E0B',
  critical: '#EF4444',
}

const HEALTH_LABEL: Record<string, string> = {
  healthy: 'HEALTHY',
  attention_required: 'ATTENTION',
  critical: 'CRITICAL',
}

function getTelemetryData(assetId: string) {
  const hash = assetId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const data = []
  for (let i = 6; i >= 0; i--) {
    const dayVal = (hash + i * 17) % 25
    const value = 55 + dayVal // 55% to 80%
    data.push({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][6 - i],
      'Load': value,
    })
  }
  return data
}

function getWeatherData(asset: Asset) {
  const hash = asset.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const temp = 24 + (hash % 12) // 24°C to 36°C
  const wind = 8 + (hash % 16) // 8 to 24 km/h
  const humidity = 45 + (hash % 36) // 45% to 81%
  const fireRisk = temp > 30 && wind > 14 ? 'High' : temp > 26 ? 'Medium' : 'Low'
  const lightningRisk = humidity > 65 ? 'High' : humidity > 50 ? 'Medium' : 'Low'
  return { temp, wind, humidity, fireRisk, lightningRisk }
}

/** Plain-language load level: color + emoji so status reads at a glance. */
function loadLevel(v: number): { color: string; label: string; emoji: string } {
  if (v >= 85) return { color: '#ef4444', label: 'Peak', emoji: '🔴' }
  if (v >= 70) return { color: '#f59e0b', label: 'High', emoji: '🟡' }
  return { color: '#10b981', label: 'Normal', emoji: '🟢' }
}

export default function LeftSidebar({
  assets,
  alerts,
  selectedAssetId,
  onSelectAsset,
  isLoading,
  onCollapsedChange,
  onHiddenChange,
  hideSignal = 0,
  networkFilters,
  onNetworkFiltersChange,
}: LeftSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isHidden, setIsHidden] = React.useState(true)

  React.useEffect(() => {
    onHiddenChange?.(true)
    // Notify once on mount so map layout matches default-hidden Core panel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [openFilterPanel, setOpenFilterPanel] = React.useState<FilterPanelId | null>(null)
  const [sidebarSection, setSidebarSection] = React.useState<'core' | 'network'>('core')

  const handleHide = () => {
    setIsHidden(true)
    onHiddenChange?.(true)
  }

  const handleShow = (section: 'core' | 'network' = 'core') => {
    setSidebarSection(section)
    setIsHidden(false)
    onHiddenChange?.(false)
  }

  React.useEffect(() => {
    if (hideSignal > 0) handleHide()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideSignal])

  React.useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) handleHide()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      onCollapsedChange?.(next)
      return next
    })
  }

  const handleAssetTypeFilter = (type: 'tower' | 'line' | 'substation' | null) => {
    onNetworkFiltersChange({ ...networkFilters, assetType: type })
    setOpenFilterPanel(type ? 'assetType' : null)
    if (type) {
      setSidebarSection('network')
      setIsHidden(false)
      onHiddenChange?.(false)
    }
    onSelectAsset('')
  }

  const handleNetworkFiltersChange = (next: NetworkFilterValues) => {
    onNetworkFiltersChange(next)
  }

  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId)
  }, [assets, selectedAssetId])

  const mapMatchCount = useMemo(
    () => applyNetworkFilters(assets, networkFilters, alerts, '').length,
    [assets, networkFilters, alerts]
  )

  const filteredAssetsList = useMemo(
    () => applyNetworkFilters(assets, networkFilters, alerts, searchQuery),
    [assets, networkFilters, alerts, searchQuery]
  )

  // SCADA load analytics
  const telemetry = useMemo(() => {
    if (!selectedAssetId) return []
    return getTelemetryData(selectedAssetId)
  }, [selectedAssetId])

  const weather = useMemo(() => {
    if (!selectedAsset) return null
    return getWeatherData(selectedAsset)
  }, [selectedAsset])

  // Circular health ring calculations
  const healthScore = selectedAsset
    ? selectedAsset.health_score === 'healthy'
      ? 94
      : selectedAsset.health_score === 'attention_required'
        ? 72
        : 38
    : 85

  const healthCategory = selectedAsset?.health_score || 'healthy'
  const strokeColor = HEALTH_COLORS[healthCategory]

  // Filter alerts for the selected asset
  const activeAnomalies = useMemo(() => {
    if (!selectedAssetId) return []
    return alerts.filter((a) => a.asset_id === selectedAssetId && a.status === 'open')
  }, [alerts, selectedAssetId])

  if (isHidden) {
    return (
      <div
        className="relative shrink-0 h-full overflow-hidden tams-sidebar-ease border-r border-slate-800/90"
        style={{ width: '2.75rem' }}
      >
        <div className="w-full h-full flex flex-col bg-[#070b14] tams-az-rail">
          <button
            type="button"
            onClick={() => handleShow('core')}
            title="Open Core"
            aria-label="Open Core"
            className="flex-1 flex flex-col items-center pt-3 gap-2 text-slate-400 hover:text-white hover:bg-slate-900/80 transition border-b border-slate-800/80"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[7px] font-bold uppercase tracking-widest text-slate-500 [writing-mode:vertical-rl] rotate-180">
              Core
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleShow('network')}
            title="Open Network"
            aria-label="Open Network"
            className="flex-1 flex flex-col items-center pt-3 gap-2 text-slate-400 hover:text-cyan-200 hover:bg-slate-900/80 transition"
          >
            <Radio className="w-5 h-5" />
            <span className="text-[7px] font-bold uppercase tracking-widest text-slate-500 [writing-mode:vertical-rl] rotate-180">
              Network
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <CollapsibleSidebar
      isCollapsed={isCollapsed}
      onToggle={handleToggleCollapse}
      collapsedRail={
        <>
          <SidebarCollapseHeader isCollapsed={isCollapsed} onToggle={handleToggleCollapse} />
          <SidebarNav collapsed onAssetTypeFilter={handleAssetTypeFilter} />
        </>
      }
    >
      <div className="w-full h-full flex flex-col min-h-0 overflow-hidden select-none">
        {/* Sidebar Header / Logo */}
        <div className="px-3 py-2.5 border-b border-slate-800/80 bg-[#070b14] flex items-center gap-2">
          <button
            type="button"
            onClick={handleHide}
            title="Hide sidebar"
            aria-label="Hide sidebar"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-800 transition"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold tracking-wide text-slate-100 leading-tight">
              TAMS{' '}
              <span className={sidebarSection === 'network' ? 'text-cyan-400' : 'text-blue-400'}>
                {sidebarSection === 'network' ? 'NETWORK' : 'CORE'}
              </span>
            </h1>
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.14em] font-medium">
              {sidebarSection === 'network' ? 'Map filters' : 'Grid Intelligence'}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-emerald-500/8 border border-emerald-500/25 px-1.5 py-0.5 rounded text-[9px] font-semibold text-emerald-400 shrink-0">
            <span className="w-1 h-1 rounded-full bg-emerald-400 tams-online-pulse" />
            Online
          </div>
        </div>

        {sidebarSection === 'core' && <SidebarNav onAssetTypeFilter={handleAssetTypeFilter} />}

        <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-900">

          {sidebarSection === 'network' && (
            <div className="tams-az-network p-3 space-y-2.5 bg-[#0a1220]">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h2 className="text-xs font-bold text-cyan-300/90 uppercase tracking-wider">
                    Transmission network
                  </h2>
                  <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
                    Filters towers, lines, and substations on the map
                  </p>
                </div>
                <span className="text-[10px] bg-cyan-950/50 text-cyan-300 border border-cyan-800/50 px-1.5 py-0.5 rounded font-mono shrink-0">
                  {mapMatchCount.toLocaleString()} on map
                </span>
              </div>
              <TransmissionNetworkFilters
                assets={assets}
                alerts={alerts}
                filters={networkFilters}
                onChange={handleNetworkFiltersChange}
                openPanel={openFilterPanel}
                onOpenPanel={setOpenFilterPanel}
                matchCount={mapMatchCount}
              />
            </div>
          )}

          {sidebarSection === 'network' && !selectedAsset && (
            <div className="p-3 space-y-2.5">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asset list</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search asset, state, city, line..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              {/* List */}
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
                {isLoading ? (
                  <SidebarListSkeleton rows={4} />
                ) : filteredAssetsList.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-slate-500 text-xs">No assets match these filters</p>
                    <button
                      type="button"
                      onClick={() => {
                        onNetworkFiltersChange({ ...EMPTY_NETWORK_FILTERS })
                        setSearchQuery('')
                        setOpenFilterPanel(null)
                      }}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  filteredAssetsList.slice(0, 200).map((asset, index) => (
                    <button
                      key={asset.id}
                      onClick={() => onSelectAsset(asset.id)}
                      style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
                      className="tams-row-in w-full p-2.5 bg-slate-900/50 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-lg flex items-center justify-between text-left transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate max-w-[140px]">{asset.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
                          {asset.asset_type}
                          {asset.metadata?.voltage_kv ? ` · ${asset.metadata.voltage_kv} KV` : ''}
                          {typeof asset.metadata?.country_or_state === 'string'
                            ? ` · ${asset.metadata.country_or_state}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${asset.health_score === 'healthy'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : asset.health_score === 'attention_required'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}
                      >
                        {HEALTH_LABEL[asset.health_score || 'healthy']}
                      </span>
                    </button>
                  ))
                )}
                {filteredAssetsList.length > 200 && (
                  <p className="text-[9px] text-center text-slate-600 py-1">
                    Showing 200 of {filteredAssetsList.length.toLocaleString()} — refine filters
                  </p>
                )}
              </div>
            </div>
          )}

          {selectedAsset && (
            /* Detail View: Active Asset Intelligence */
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asset Intelligence</h2>
                <button
                  onClick={() => onSelectAsset('')}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                >
                  ← Back to List
                </button>
              </div>

              {/* Selected Asset Card */}
              <div className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-3">
                <div>
                  <h3 className="font-extrabold text-sm text-white truncate">{selectedAsset.name}</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                    {selectedAsset.asset_type} · {selectedAsset.metadata?.voltage_kv ? String(selectedAsset.metadata.voltage_kv) : '765'} KV Line
                  </p>
                </div>

                {/* Grid Metadata */}
                <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-800/60 pt-2.5">
                  <div>
                    <span className="text-slate-500">Region:</span>
                    <p className="font-medium text-slate-300">
                      {selectedAsset.metadata?.region ? String(selectedAsset.metadata.region) : 'Global'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Coordinates:</span>
                    <p className="font-medium text-slate-300 truncate">
                      {selectedAsset.latitude.toFixed(4)}, {selectedAsset.longitude.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Inspection:</span>
                    <p className="font-medium text-slate-300">12 Hrs Ago</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Status:</span>
                    <span className="inline-block text-emerald-400 font-bold uppercase mt-0.5">
                      {selectedAsset.status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Circular Health score Ring & Risk Gauge */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 border border-slate-850 rounded-xl p-3 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wide font-bold mb-2">Health Score</span>
                  <div className="relative w-16 h-16">
                    {/* SVG circular ring */}
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-800"
                        strokeWidth="2.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        strokeDasharray={`${healthScore}, 100`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke={strokeColor}
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-mono font-black text-white">{healthScore}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-850 rounded-xl p-3 flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wide font-bold">Risk Matrix</span>
                    <p className={`text-sm font-black ${healthCategory === 'healthy' ? 'text-emerald-400' : healthCategory === 'attention_required' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                      {healthCategory === 'healthy' ? 'LOW' : healthCategory === 'attention_required' ? 'MEDIUM' : 'CRITICAL'}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Outage Prob:
                    <span className="font-mono font-bold text-white block">
                      {healthCategory === 'healthy' ? '0.04%' : healthCategory === 'attention_required' ? '3.82%' : '44.18%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: Active Anomalies */}
          {selectedAsset && (
            <div className="p-3 space-y-2.5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Anomalies</h2>

              {activeAnomalies.length === 0 ? (
                <div className="p-4 border border-slate-850 bg-slate-900/20 rounded-xl text-center text-slate-500 text-xs">
                  No active anomalies identified
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeAnomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="p-3 bg-slate-900 border border-slate-850 rounded-lg flex items-start gap-2.5"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-[11px]">{anomaly.title}</span>
                          <span className="text-[8px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.2 rounded">
                            {anomaly.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">{anomaly.message}</p>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono pt-1">
                          <span>Confidence: {anomaly.confidence ? (anomaly.confidence * 100).toFixed(0) : '85'}%</span>
                          <span>Dist: 4.8m</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: Weather Intelligence */}
          {selectedAsset && weather && (
            <div className="p-3 space-y-2.5">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span aria-hidden>🌦️</span> Weather
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <WeatherTile emoji="🌡️" label="Temperature" value={`${weather.temp}°C`} />
                <WeatherTile emoji="💨" label="Wind Speed" value={`${weather.wind} km/h`} />
                <WeatherTile emoji="💧" label="Humidity" value={`${weather.humidity}%`} />
                <WeatherTile
                  emoji={weather.fireRisk === 'High' ? '🔥' : '🌿'}
                  label="Fire Risk"
                  value={weather.fireRisk}
                  valueClass={
                    weather.fireRisk === 'High'
                      ? 'text-red-400'
                      : weather.fireRisk === 'Medium'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }
                />
              </div>
            </div>
          )}

          {/* SECTION 4: SCADA Weekly Load — bar chart (easy to read at a glance) */}
          {selectedAsset && telemetry.length > 0 && (() => {
            const current = telemetry[telemetry.length - 1].Load
            const peak = Math.max(...telemetry.map((t) => t.Load))
            const forecast = Math.round((current + peak) / 2)
            const cur = loadLevel(current)
            return (
              <div className="p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span aria-hidden>⚡</span> Weekly Load
                  </h2>
                  <span className="text-[11px] font-bold" style={{ color: cur.color }}>
                    {cur.emoji} {cur.label}
                  </span>
                </div>

                {/* Vertical bars — height = load %, color = level */}
                <div
                  className="flex items-end justify-between gap-1.5 h-28 bg-slate-950/40 border border-slate-850 rounded-lg p-2.5"
                  role="img"
                  aria-label={`Weekly load, current ${current} percent (${cur.label})`}
                >
                  {telemetry.map((t) => {
                    const lvl = loadLevel(t.Load)
                    const heightPct = ((t.Load - 40) / 60) * 100 // domain 40–100%
                    return (
                      <div key={t.day} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                        <span className="text-[9px] font-mono font-bold text-slate-300">{t.Load}</span>
                        <div
                          className="w-full rounded-t-sm transition-all"
                          style={{ height: `${Math.max(6, heightPct)}%`, backgroundColor: lvl.color }}
                          title={`${t.day}: ${t.Load}% (${lvl.label})`}
                        />
                        <span className="text-[9px] font-semibold text-slate-500">{t.day[0]}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Plain-language legend */}
                <div className="flex items-center justify-center gap-3 text-[9px] font-semibold text-slate-400">
                  <span>🟢 Normal</span>
                  <span>🟡 High</span>
                  <span>🔴 Peak</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center border-t border-slate-800/70 pt-2.5">
                  <LoadStat label="Now" value={`${current}%`} className="text-slate-100" />
                  <LoadStat label="Peak (7d)" value={`${peak}%`} className="text-red-400" />
                  <LoadStat label="Forecast" value={`${forecast}%`} className="text-sky-400" />
                </div>
              </div>
            )
          })()}

        </div>
      </div>
    </CollapsibleSidebar>
  )
}

function WeatherTile({
  emoji,
  label,
  value,
  valueClass = 'text-slate-100',
}: {
  emoji: string
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="p-2.5 bg-slate-900 border border-slate-850 rounded-lg flex items-center gap-2.5">
      <span className="text-lg leading-none" aria-hidden>{emoji}</span>
      <div className="min-w-0">
        <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide truncate">{label}</p>
        <p className={`font-mono font-bold text-sm ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}

function LoadStat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div>
      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{label}</span>
      <p className={`font-mono font-extrabold text-sm mt-0.5 ${className}`}>{value}</p>
    </div>
  )
}
