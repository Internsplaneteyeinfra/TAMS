import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { SIDEBAR_NAV_ITEMS } from '@/config/sidebarNav'

interface SidebarNavProps {
  collapsed?: boolean
  onAssetTypeFilter?: (type: 'tower' | 'line' | 'substation' | null) => void
}

export default function SidebarNav({ collapsed = false, onAssetTypeFilter }: SidebarNavProps) {
  const router = useRouter()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    operations: true,
    assets: false,
  })

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleChildClick = (href: string, assetType?: 'tower' | 'line' | 'substation') => {
    if (assetType && router.pathname === '/analyzer' && onAssetTypeFilter) {
      onAssetTypeFilter(assetType)
      return
    }
    if (assetType && href === '/' && onAssetTypeFilter) {
      onAssetTypeFilter(assetType)
    }
  }

  if (collapsed) {
    return (
      <nav className="flex flex-col items-center gap-1 py-2 border-b border-slate-800" aria-label="Sidebar navigation">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const href = item.href ?? item.children?.[0]?.href ?? '/'
          const isActive = router.pathname === href
          return (
            <Link
              key={item.id}
              href={href}
              title={item.label}
              className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${isActive
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Icon className="w-4 h-4" />
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="border-b border-slate-800/80 bg-[#070b14]" aria-label="Sidebar navigation">
      <p className="px-3 pt-2 pb-1 text-[8px] font-semibold text-slate-600 uppercase tracking-[0.12em]">Navigation</p>
      <ul className="px-1.5 pb-2 space-y-px">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const hasChildren = Boolean(item.children?.length)
          const isExpanded = expandedGroups[item.id]
          const isActive = item.href ? router.pathname === item.href : false

          if (!hasChildren) {
            return (
              <li key={item.id}>
                <Link
                  href={item.href!}
                  className={`tams-nav-hover relative flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${isActive
                    ? 'bg-blue-600/12 text-blue-200 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                    }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-0.5 rounded-full bg-blue-400" />
                  )}
                  <Icon className="tams-nav-icon w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          }

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggleGroup(item.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium text-slate-300 hover:bg-slate-900/60 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                )}
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
                  }`}
              >
                <ul className="ml-4 mt-px mb-1 space-y-px border-l border-slate-800/80 pl-1.5">
                  {item.children!.map((child) => {
                    const childActive = router.pathname === child.href && !child.assetType
                    if (child.assetType && router.pathname === '/analyzer') {
                      return (
                        <li key={child.label}>
                          <button
                            type="button"
                            onClick={() => handleChildClick(child.href, child.assetType)}
                            className="w-full text-left px-2 py-1 rounded text-[9px] font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-900/50 transition-colors"
                          >
                            {child.label}
                          </button>
                        </li>
                      )
                    }
                    return (
                      <li key={child.label}>
                        <Link
                          href={child.href}
                          className={`block px-2 py-1 rounded text-[9px] font-medium transition-colors ${childActive
                            ? 'text-blue-300 bg-blue-600/10'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-900/50'
                            }`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
