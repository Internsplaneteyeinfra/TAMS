import React, { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'

import { logoutAndRedirect } from '@/lib/auth/client'

type Variant = 'dark' | 'light' | 'menu'

interface LogoutButtonProps {
  variant?: Variant
  className?: string
  label?: string
}

const VARIANT_CLASS: Record<Variant, string> = {
  dark:
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-rose-400/35 bg-rose-500/10 text-xs font-bold text-rose-200 hover:bg-rose-500/20 transition-colors',
  light:
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgba(51,65,85,0.22)] bg-white/80 text-xs font-bold text-[#0f172a] hover:border-[#c75b50] hover:text-[#7f1d1d] transition-colors',
  menu: 'w-full flex items-center gap-2 px-3 py-2 text-[11px] text-rose-200 hover:bg-slate-800/80 transition-colors',
}

export default function LogoutButton({
  variant = 'dark',
  className = '',
  label = 'Logout',
}: LogoutButtonProps) {
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (busy) return
    setBusy(true)
    await logoutAndRedirect()
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
        className={`tams-logout-btn ${VARIANT_CLASS[variant]} disabled:opacity-60 ${className}`}
      title="Sign out and return to login"
      aria-label="Logout"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}
