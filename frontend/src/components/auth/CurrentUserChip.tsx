import React from 'react'

import { initialsFromUsername } from '@/lib/auth/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type Variant = 'dark' | 'light'

const VARIANT: Record<Variant, { chip: string; name: string; avatar: string }> = {
  dark: {
    chip: 'border-white/15 bg-slate-950/50 text-slate-200',
    name: 'text-slate-200',
    avatar: 'from-blue-600 to-indigo-700 text-white',
  },
  light: {
    chip: 'border-[rgba(51,65,85,0.22)] bg-white/80 text-[#0f172a]',
    name: 'text-[#0f172a]',
    avatar: 'from-blue-600 to-indigo-700 text-white',
  },
}

/** Compact signed-in operator label for page headers. */
export default function CurrentUserChip({ variant = 'dark' }: { variant?: Variant }) {
  const { username } = useCurrentUser()
  const styles = VARIANT[variant]
  const initials = initialsFromUsername(username)

  return (
    <div
      className={`inline-flex items-center gap-1.5 h-9 pl-1 pr-2.5 rounded-lg border ${styles.chip}`}
      title={username}
      aria-label={`Signed in as ${username}`}
    >
      <span
        className={`w-6 h-6 rounded-md bg-gradient-to-br ${styles.avatar} flex items-center justify-center text-[10px] font-black`}
      >
        {initials}
      </span>
      <span className={`text-xs font-bold max-w-[9rem] truncate ${styles.name}`}>{username}</span>
    </div>
  )
}
