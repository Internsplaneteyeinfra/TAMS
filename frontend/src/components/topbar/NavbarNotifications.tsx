import React, { useState } from 'react'
import { Bell } from 'lucide-react'

import NotificationDrawer from '@/components/layout/NotificationDrawer'
import type { Alert, Asset } from '@/lib/api'

interface NavbarNotificationsProps {
  alerts: Alert[]
  assets: Asset[]
  onSelectAsset: (id: string) => void
}

export default function NavbarNotifications({
  alerts,
  assets,
  onSelectAsset,
}: NavbarNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const openAlerts = alerts.filter((a) => a.status === 'open')
  const unreadCount = openAlerts.length

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
        aria-label="Open notifications"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        alerts={alerts}
        assets={assets}
        onSelectAsset={onSelectAsset}
      />
    </>
  )
}
