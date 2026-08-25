import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bell, X } from 'lucide-react'

import type { Alert, Asset } from '@/lib/api'

interface NotificationDrawerProps {
  isOpen: boolean
  onClose: () => void
  alerts: Alert[]
  assets: Asset[]
  onSelectAsset: (id: string) => void
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  alerts,
  assets,
  onSelectAsset,
}: NotificationDrawerProps) {
  const openAlerts = alerts.filter((a) => a.status === 'open')

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      <div
        className={`fixed inset-0 z-[4000] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md z-[4001] tams-az-portal bg-[#0a1020]/95 backdrop-blur-xl border-l border-slate-700 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        aria-hidden={!isOpen}
        aria-label="Notification drawer"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Live Notifications</h2>
              <p className="text-[10px] text-slate-500">{openAlerts.length} open alerts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-slate-800 flex gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full">
            {openAlerts.filter((a) => a.priority === 'critical' || a.priority === 'high').length} Critical
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
            {openAlerts.length} Total Open
          </span>
        </div>

        <ul className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-800/80">
          {openAlerts.length === 0 ? (
            <li className="px-4 py-16 text-center text-sm text-slate-500">No active grid alerts</li>
          ) : (
            openAlerts.map((alert) => {
              const assetName = assets.find((a) => a.id === alert.asset_id)?.name || alert.asset_id
              const isCritical = alert.priority === 'critical' || alert.priority === 'high'
              return (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectAsset(alert.asset_id)
                      onClose()
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={`w-4 h-4 mt-0.5 shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-100">{alert.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{assetName}</p>
                        {alert.message && (
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{alert.message}</p>
                        )}
                      </div>
                      <span className="text-[9px] font-bold uppercase text-slate-400 shrink-0">
                        {alert.priority}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>

        <div className="p-4 border-t border-slate-800">
          <Link
            href="/alarms"
            onClick={onClose}
            className="block w-full text-center py-2.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-600/30 transition-colors"
          >
            Open Alarm Center →
          </Link>
        </div>
      </aside>
    </>
  )
}
