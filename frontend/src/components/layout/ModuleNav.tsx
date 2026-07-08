import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { MODULE_NAV_ITEMS } from '@/config/moduleNav'

interface ModuleNavProps {
  variant?: 'sidebar' | 'strip'
}

export default function ModuleNav({ variant = 'sidebar' }: ModuleNavProps) {
  const router = useRouter()

  if (variant === 'strip') {
    return (
      <nav className="flex items-center gap-1 flex-wrap" aria-label="TAMS modules">
        {MODULE_NAV_ITEMS.map((item) => {
          const active = router.pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wide border transition-colors ${
                active
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {item.shortLabel}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="p-3 border-b border-slate-800 bg-slate-950/80" aria-label="TAMS modules">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Enterprise Modules</p>
      <div className="grid grid-cols-2 gap-1.5">
        {MODULE_NAV_ITEMS.map((item) => {
          const active = router.pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`px-2 py-1.5 rounded-md text-[10px] font-semibold border text-left truncate transition-colors ${
                active
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {item.shortLabel}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
