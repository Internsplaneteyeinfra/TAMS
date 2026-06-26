/**
 * Dashboard component — Asset list, alerts, and analytics
 */

import React from 'react'

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
  healthy: 'text-tams-success',
  attention_required: 'text-tams-warning',
  critical: 'text-tams-danger',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-tams-danger',
  high: 'border-orange-500',
  medium: 'border-tams-warning',
  low: 'border-gray-500',
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
  const health = analytics?.health_distribution
  const openAlerts = alerts.filter((a) => a.status === 'open')

  return (
    <div className="space-y-6 px-4 pb-2">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Overview</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-700 rounded p-3">
            <p className="text-gray-400 text-xs">Total Assets</p>
            <p className="text-xl font-bold">{assets.length}</p>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <p className="text-gray-400 text-xs">Open Alerts</p>
            <p className="text-xl font-bold text-tams-warning">
              {analytics?.open_alerts ?? openAlerts.length}
            </p>
          </div>
        </div>
        {health && (
          <div className="bg-gray-700 rounded p-3 text-xs space-y-1">
            <p className="text-gray-400 mb-1">Health Index</p>
            <p className="text-tams-success">Healthy: {health.healthy}</p>
            <p className="text-tams-warning">Attention: {health.attention_required}</p>
            <p className="text-tams-danger">Critical: {health.critical}</p>
          </div>
        )}
        {(analytics as { substations_by_region?: { India?: number; World?: number } })
          ?.substations_by_region && (
          <div className="bg-gray-700 rounded p-3 text-xs space-y-1">
            <p className="text-gray-400 mb-1">Substations</p>
            <p className="text-white">
              India:{' '}
              {
                (analytics as { substations_by_region: { India: number } }).substations_by_region
                  .India
              }
            </p>
            <p className="text-white">
              Worldwide:{' '}
              {
                (analytics as { substations_by_region: { World: number } }).substations_by_region
                  .World
              }
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-gray-400 text-sm">No active alerts</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.slice(0, 6).map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => onSelectAlert(alert)}
                className={`w-full text-left bg-gray-700 rounded p-3 border-l-4 hover:bg-gray-600 transition ${PRIORITY_COLORS[alert.priority] || 'border-gray-500'}`}
              >
                <p className="font-semibold text-sm">{alert.title}</p>
                <p className="text-gray-400 text-xs capitalize">
                  {alert.alert_type.replace(/_/g, ' ')} · {alert.priority}
                  {alert.status !== 'open' && ` · ${alert.status}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Assets</h2>
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
                className={`w-full text-left rounded p-3 transition ${
                  selectedAssetId === asset.id
                    ? 'bg-tams-primary/30 ring-1 ring-tams-primary'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <p className="font-semibold text-sm">{asset.name}</p>
                <p className="text-gray-400 text-xs capitalize">{asset.asset_type}</p>
                {asset.health_score && (
                  <p
                    className={`text-xs capitalize ${HEALTH_COLORS[asset.health_score] || 'text-gray-400'}`}
                  >
                    Health: {asset.health_score.replace(/_/g, ' ')}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
