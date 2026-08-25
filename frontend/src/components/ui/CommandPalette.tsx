import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Command, MapPin, Navigation } from 'lucide-react'

import type { Asset } from '@/lib/api'
import { ANALYZER_STRIP_NAV_ITEMS, MODULE_NAV_ITEMS } from '@/config/moduleNav'
import { flattenPlaces, getPlacePath } from '@/config/places'

export interface CommandItem {
  id: string
  label: string
  hint?: string
  group: string
  icon?: React.ReactNode
  onSelect: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  assets: Asset[]
  onSelectAsset: (id: string) => void
  onSelectPlace?: (placeId: string) => void
}

export default function CommandPalette({
  open,
  onClose,
  assets,
  onSelectAsset,
  onSelectPlace,
}: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = useMemo<CommandItem[]>(() => {
    const navSource =
      router.pathname === '/analyzer' ? ANALYZER_STRIP_NAV_ITEMS : MODULE_NAV_ITEMS
    const navItems: CommandItem[] = navSource.map((item) => ({
      id: `nav-${item.href}`,
      label: item.label,
      hint: item.shortLabel,
      group: 'Navigation',
      icon: <Navigation className="w-3.5 h-3.5 text-slate-500" />,
      onSelect: () => router.push(item.href),
    }))

    const placeItems: CommandItem[] = flattenPlaces()
      .slice(0, 30)
      .map((place) => ({
        id: `place-${place.id}`,
        label: place.label,
        hint: getPlacePath(place.id).map((p) => p.label).join(' › '),
        group: 'Places',
        icon: <span className="text-sm">{place.icon ?? '📍'}</span>,
        onSelect: () => onSelectPlace?.(place.id),
      }))

    const commandItems: CommandItem[] = [
      { id: 'cmd-layers', label: 'Toggle heat map layer', group: 'Commands', onSelect: () => { } },
      { id: 'cmd-critical', label: 'Show critical alerts', group: 'Commands', onSelect: () => { } },
      { id: 'cmd-report', label: 'Generate operations report', group: 'Commands', onSelect: () => { } },
    ]

    const assetItems: CommandItem[] = assets.slice(0, 50).map((asset) => ({
      id: `asset-${asset.id}`,
      label: asset.name,
      hint: [
        asset.asset_type,
        asset.metadata?.country_or_state,
        asset.metadata?.region,
      ]
        .filter(Boolean)
        .join(' · '),
      group: 'Assets',
      icon: <MapPin className="w-3.5 h-3.5 text-blue-400" />,
      onSelect: () => onSelectAsset(asset.id),
    }))

    return [...commandItems, ...placeItems, ...navItems, ...assetItems]
  }, [assets, onSelectAsset, onSelectPlace, router])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 12)
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.hint?.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q)
      )
      .slice(0, 12)
  }, [items, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault()
        filtered[activeIndex].onSelect()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, activeIndex, onClose])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  if (!open) return null

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    acc[item.group] = acc[item.group] ?? []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[5000] flex items-start justify-center pt-[12vh] px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        aria-label="Close command palette"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-[#0e172a]/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl tams-palette-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <Command className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets, cities, states, commands, layers…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            aria-label="Command palette search"
          />
          <kbd className="hidden sm:inline text-[9px] font-mono text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto scrollbar-thin py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No results found</p>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group} className="mb-2">
                <p className="px-4 py-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  {group}
                </p>
                <ul>
                  {groupItems.map((item) => {
                    const globalIndex = filtered.indexOf(item)
                    const isActive = globalIndex === activeIndex
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          onClick={() => {
                            item.onSelect()
                            onClose()
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-blue-600/20 text-white' : 'text-slate-300 hover:bg-slate-800/80'
                            }`}
                        >
                          {item.icon}
                          <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
                          {item.hint && (
                            <span className="text-[10px] text-slate-500 uppercase font-mono shrink-0">
                              {item.hint}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-3 text-[9px] text-slate-500">
          <span>
            <kbd className="font-mono border border-slate-700 rounded px-1">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono border border-slate-700 rounded px-1">↵</kbd> select
          </span>
          <span>
            <kbd className="font-mono border border-slate-700 rounded px-1">Ctrl K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  )
}

export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}
