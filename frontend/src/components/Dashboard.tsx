/**
 * Dashboard component — Asset list, alerts, and analytics
 */

import React, { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Activity,
  CloudSun,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Thermometer,
  Wind,
  Droplets,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react'

import type { Alert, Asset } from '@/lib/api'

interface Analytics {
  health_distribution?: {
    healthy: number
    attention_required: number
    critical: number
  }
  open_alerts?: number
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-emerald-400',
  attention_required: 'text-amber-400',
  critical: 'text-red-400',
}

const HEALTH_BG: Record<string, string> = {
  healthy: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  attention_required: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  critical: 'bg-red-500/10 border-red-500/20 text-red-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-red-500 bg-red-500/5',
  high: 'border-orange-500 bg-orange-500/5',
  medium: 'border-amber-500 bg-amber-500/5',
  low: 'border-slate-500 bg-slate-500/5',
}

function getTelemetryData(assetId: string) {
  const hash = assetId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const data = []
  for (let i = 6; i >= 0; i--) {
    const dayVal = (hash + i * 19) % 30
    const value = 60 + dayVal // between 60% and 90%
    data.push({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][6 - i],
      'Load': value,
    })
  }
  return data
}

function getWeatherData(asset: Asset) {
  const hash = asset.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const temp = 22 + (hash % 14) // 22°C to 36°C
  const wind = 6 + (hash % 18) // 6 to 24 km/h
  const humidity = 42 + (hash % 41) // 42% to 83%
  const fireRisk = temp > 31 && wind > 14 ? 'High' : temp > 27 ? 'Moderate' : 'Low'
  return { temp, wind, humidity, fireRisk }
}

export default function Dashboard({
  assets,
  alerts,
  analytics,
  isLoading,
  selectedAssetId,
  onSelectAsset,
  onSelectAlert,
}: {
  assets: Asset[]
  alerts: Alert[]
  analytics?: Analytics
  isLoading: boolean
  selectedAssetId?: string | null
  onSelectAsset: (id: string) => void
  onSelectAlert: (alert: Alert) => void
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [workOrderSent, setWorkOrderSent] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const health = analytics?.health_distribution
  const openAlerts = alerts.filter((a) => a.status === 'open')
  const selectedAsset = assets.find((a) => a.id === selectedAssetId)

  // Reset work order notice on select asset change
  useEffect(() => {
    setWorkOrderSent(false)
  }, [selectedAssetId])

  const triggerWorkOrder = () => {
    setWorkOrderSent(true)
    setTimeout(() => setWorkOrderSent(false), 4000)
  }

  // Render detail view if an asset is selected
  if (selectedAsset) {
    const weather = getWeatherData(selectedAsset)
    const telemetry = getTelemetryData(selectedAsset.id)
    const assetAlerts = alerts.filter((a) => a.asset_id === selectedAsset.id)

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-gray-900 border-r border-gray-800 text-slate-100 animate-fadeIn">
        {/* Back header */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectAsset('')}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-slate-400 hover:text-white transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="font-bold text-sm text-slate-200">Asset Detail View</h3>
            <p className="text-gray-500 text-xs">Explore telemetry & weather risk</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
          {/* Main Info */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4 space-y-3 shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {selectedAsset.asset_type}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${HEALTH_BG[selectedAsset.health_score || 'healthy']}`}>
                  Health: {(selectedAsset.health_score || 'healthy').replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-2">{selectedAsset.name}</h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">{selectedAsset.description}</p>
            </div>

            <div className="text-xs border-t border-gray-800 pt-3 space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-gray-500">Voltage Rating</span>
                <span className="font-semibold">{selectedAsset.metadata?.voltage_kv ? `${selectedAsset.metadata.voltage_kv} kV` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Coordinates</span>
                <span className="font-mono text-[11px]">{selectedAsset.latitude.toFixed(4)}, {selectedAsset.longitude.toFixed(4)}</span>
              </div>
              {selectedAsset.metadata?.length_km && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Segment Length</span>
                  <span className="font-semibold">{selectedAsset.metadata.length_km} km</span>
                </div>
              )}
            </div>
          </div>

          {/* Active Alerts for this asset */}
          {assetAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Active Anomalies</h4>
              <div className="space-y-1.5">
                {assetAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl flex items-start gap-2.5"
                  >
                    <ShieldAlert className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-200">{alert.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weather Widget */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center gap-1.5 text-gray-400">
              <CloudSun className="w-4 h-4" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider">Weather Intelligence</h4>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-900 rounded-lg p-2">
                <div className="flex justify-center text-orange-400 mb-0.5">
                  <Thermometer className="w-4 h-4" />
                </div>
                <p className="text-gray-500 text-[9px] uppercase font-semibold">Temperature</p>
                <p className="text-sm font-bold text-white mt-0.5">{weather.temp}°C</p>
              </div>

              <div className="bg-gray-900 rounded-lg p-2">
                <div className="flex justify-center text-cyan-400 mb-0.5">
                  <Wind className="w-4 h-4" />
                </div>
                <p className="text-gray-500 text-[9px] uppercase font-semibold">Wind Speed</p>
                <p className="text-sm font-bold text-white mt-0.5">{weather.wind} km/h</p>
              </div>

              <div className="bg-gray-900 rounded-lg p-2">
                <div className="flex justify-center text-blue-400 mb-0.5">
                  <Droplets className="w-4 h-4" />
                </div>
                <p className="text-gray-500 text-[9px] uppercase font-semibold">Humidity</p>
                <p className="text-sm font-bold text-white mt-0.5">{weather.humidity}%</p>
              </div>

              <div className="bg-gray-900 rounded-lg p-2">
                <div className="flex justify-center text-red-400 mb-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <p className="text-gray-500 text-[9px] uppercase font-semibold">Fire Threat</p>
                <p className="text-sm font-bold text-white mt-0.5">{weather.fireRisk}</p>
              </div>
            </div>
          </div>

          {/* SCADA Telemetry Chart */}
          <div className="bg-gray-850 border border-gray-800 rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Activity className="w-4 h-4" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider">SCADA Load Trend (7d)</h4>
            </div>

            <div className="h-28 w-full -ml-3">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetry}>
                    <defs>
                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      stroke="#64748b"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      domain={[50, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        fontSize: '10px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Load"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorLoad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Loading chart...
                </div>
              )}
            </div>
          </div>

          {/* Maintenance Action Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={triggerWorkOrder}
              disabled={workOrderSent}
              className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-slate-500 active:scale-[0.98] transition-all text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-md shadow-indigo-600/5"
            >
              <Wrench className="w-3.5 h-3.5" />
              Create Work Order
            </button>

            {workOrderSent && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] rounded-lg flex items-start gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Work Order Generated</span>
                  Maintenance crew dispatched to asset corridor.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Default Dashboard Overview View
  return (
    <div className="space-y-6 px-4 pb-2">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Overview</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-700/60 border border-gray-700/50 rounded-xl p-3">
            <p className="text-gray-400 text-xs">Total Assets</p>
            <p className="text-xl font-bold mt-1">{assets.length}</p>
          </div>
          <div className="bg-gray-700/60 border border-gray-700/50 rounded-xl p-3">
            <p className="text-gray-400 text-xs">Open Alerts</p>
            <p className="text-xl font-bold text-tams-warning mt-1">
              {analytics?.open_alerts ?? openAlerts.length}
            </p>
          </div>
        </div>
        {health && (
          <div className="bg-gray-700/60 border border-gray-700/50 rounded-xl p-3 text-xs space-y-1.5">
            <p className="text-gray-400 mb-1 font-semibold">Health Index</p>
            <div className="flex justify-between text-tams-success font-medium">
              <span>Healthy:</span>
              <span>{health.healthy}</span>
            </div>
            <div className="flex justify-between text-tams-warning font-medium">
              <span>Attention Required:</span>
              <span>{health.attention_required}</span>
            </div>
            <div className="flex justify-between text-tams-danger font-medium">
              <span>Critical:</span>
              <span>{health.critical}</span>
            </div>
          </div>
        )}
        {(analytics as { substations_by_region?: { India?: number; World?: number } })
          ?.substations_by_region && (
          <div className="bg-gray-700/60 border border-gray-700/50 rounded-xl p-3 text-xs space-y-1.5">
            <p className="text-gray-400 mb-1 font-semibold">Substations</p>
            <div className="flex justify-between text-slate-200">
              <span>India Grid:</span>
              <span>
                {
                  (analytics as { substations_by_region: { India: number } }).substations_by_region
                    .India
                }
              </span>
            </div>
            <div className="flex justify-between text-slate-200">
              <span>Worldwide:</span>
              <span>
                {
                  (analytics as { substations_by_region: { World: number } }).substations_by_region
                    .World
                }
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-gray-400 text-sm">No active alerts</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.slice(0, 6).map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => onSelectAlert(alert)}
                className={`w-full text-left bg-gray-700/60 border-l-4 rounded-lg p-3 hover:bg-gray-600/70 transition-all duration-200 ${PRIORITY_COLORS[alert.priority] || 'border-gray-500'}`}
              >
                <p className="font-semibold text-sm text-slate-200">{alert.title}</p>
                <p className="text-gray-400 text-xs mt-1 capitalize">
                  {alert.alert_type.replace(/_/g, ' ')} · {alert.priority}
                  {alert.status !== 'open' && ` · ${alert.status}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-100">Assets</h2>
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading assets...</p>
        ) : assets.length === 0 ? (
          <p className="text-gray-400 text-sm">No assets found</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelectAsset(asset.id)}
                className={`w-full text-left rounded-lg p-3 transition-all duration-200 ${
                  selectedAssetId === asset.id
                    ? 'bg-tams-primary/20 border border-tams-primary/40 text-white'
                    : 'bg-gray-700/60 hover:bg-gray-600/70 border border-transparent text-slate-300'
                }`}
              >
                <p className="font-semibold text-sm">{asset.name}</p>
                <div className="flex justify-between text-xs mt-1.5 text-gray-400">
                  <span className="capitalize">{asset.asset_type}</span>
                  {asset.health_score && (
                    <span className={`capitalize font-medium ${HEALTH_COLORS[asset.health_score] || 'text-gray-400'}`}>
                      {asset.health_score.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

