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
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#c75b50]/35 bg-[#c75b50]/10 text-xs font-bold text-[#c75b50] hover:bg-[#c75b50]/20 transition-colors',
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
      className={`${VARIANT_CLASS[variant]} disabled:opacity-60 ${className}`}
      title="Sign out and return to login"
      aria-label="Logout"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}
