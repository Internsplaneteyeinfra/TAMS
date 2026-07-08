import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  ShieldAlert,
  Thermometer,
  Wind,
  Droplets,
  Flame,
  Search,
} from 'lucide-react'
import type { Alert, Asset } from '@/lib/api'
import ModuleNav from '@/components/layout/ModuleNav'

interface LeftSidebarProps {
  assets: Asset[]
  alerts: Alert[]
  selectedAssetId?: string | null
  onSelectAsset: (id: string) => void
  isLoading: boolean
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

export default function LeftSidebar({
  assets,
  alerts,
  selectedAssetId,
  onSelectAsset,
  isLoading,
}: LeftSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState('')

  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId)
  }, [assets, selectedAssetId])

  const filteredAssetsList = useMemo(() => {
    return assets.filter((a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [assets, searchQuery])

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

  return (
    <div className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col min-h-0 h-full overflow-hidden select-none">
      {/* Sidebar Header / Logo */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-wider bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            TAMS CORE
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">GRID INTELLIGENCE</p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ONLINE
        </div>
      </div>

      <ModuleNav variant="sidebar" />

      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-900">
        
        {/* SECTION 1: Asset Picker / Asset List */}
        {!selectedAsset ? (
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transmission Network</h2>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                {assets.length} Units
              </span>
            </div>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search substation, line..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            {/* List */}
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="py-8 text-center text-slate-500 text-xs">Loading asset catalog...</div>
              ) : filteredAssetsList.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No assets match search</div>
              ) : (
                filteredAssetsList.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onSelectAsset(asset.id)}
                    className="w-full p-2.5 bg-slate-900/50 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-lg flex items-center justify-between text-left transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-200 truncate max-w-[160px]">{asset.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                        {asset.asset_type} · {asset.metadata?.voltage_kv ? `${asset.metadata.voltage_kv} KV` : '765 KV'}
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                        asset.health_score === 'healthy'
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
            </div>
          </div>
        ) : (
          /* Detail View: Active Asset Intelligence */
          <div className="p-4 space-y-4">
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
                  <p className={`text-sm font-black ${
                    healthCategory === 'healthy' ? 'text-emerald-400' : healthCategory === 'attention_required' ? 'text-amber-400' : 'text-red-400'
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
          <div className="p-4 space-y-3">
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
          <div className="p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weather Intelligence</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-900 border border-slate-850 rounded-lg flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-indigo-400" />
                <div>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Temp</p>
                  <p className="font-mono font-bold text-slate-200">{weather.temp}°C</p>
                </div>
              </div>
              <div className="p-2.5 bg-slate-900 border border-slate-850 rounded-lg flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-400" />
                <div>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Wind Speed</p>
                  <p className="font-mono font-bold text-slate-200">{weather.wind} km/h</p>
                </div>
              </div>
              <div className="p-2.5 bg-slate-900 border border-slate-850 rounded-lg flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Humidity</p>
                  <p className="font-mono font-bold text-slate-200">{weather.humidity}%</p>
                </div>
              </div>
              <div className="p-2.5 bg-slate-900 border border-slate-850 rounded-lg flex items-center gap-2">
                <Flame className={`w-4 h-4 ${weather.fireRisk === 'High' ? 'text-red-500' : 'text-amber-500'}`} />
                <div>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Fire Risk</p>
                  <p className="font-bold text-slate-200">{weather.fireRisk}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: SCADA 7-Day Load Trend */}
        {selectedAsset && telemetry.length > 0 && (
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">SCADA Telemetry</h2>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">7D Load Trend</span>
            </div>
            
            {/* Telemetry Line Chart */}
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <defs>
                    <linearGradient id="scadaGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} />
                  <YAxis domain={[40, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ background: '#0e172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: 10 }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Load"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#scadaGlow)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center text-[9px] border-t border-slate-900 pt-2.5">
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-bold">Current</span>
                <p className="font-mono font-extrabold text-slate-200 text-xs mt-0.5">{telemetry[telemetry.length - 1].Load}%</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-bold">Peak (7D)</span>
                <p className="font-mono font-extrabold text-red-400 text-xs mt-0.5">84.2%</p>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider font-bold">Forecast</span>
                <p className="font-mono font-extrabold text-indigo-400 text-xs mt-0.5">71.0%</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
