import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react'

import { PLACES_TREE, getPlacePath, type PlaceNode } from '@/config/places'

interface PlacesMenuProps {
  selectedPlaceId: string
  onSelectPlace: (placeId: string) => void
  assetCounts?: Record<string, number>
  variant?: 'toolbar' | 'default'
  /** Fired when the places panel opens/closes (e.g. hide map tools while open). */
  onOpenChange?: (open: boolean) => void
}

function PlaceColumn({
  title,
  nodes,
  selectedPlaceId,
  activeId,
  onHover,
  onSelect,
  assetCounts,
}: {
  title?: string
  nodes: PlaceNode[]
  selectedPlaceId: string
  activeId: string | null
  onHover: (node: PlaceNode) => void
  onSelect: (id: string) => void
  assetCounts?: Record<string, number>
}) {
  return (
    <div className="min-w-[180px] max-w-[220px] border-r border-slate-800/90 last:border-r-0 flex flex-col max-h-[min(70vh,440px)]">
      {title && (
        <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/80 shrink-0">
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.14em]">{title}</p>
        </div>
      )}
      <div className="overflow-y-auto scrollbar-thin py-1 flex-1">
        {nodes.map((node) => {
          const isSelected = selectedPlaceId === node.id
          const isActive = activeId === node.id
          const count = assetCounts?.[node.id]
          const hasChildren = Boolean(node.children?.length)
          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => onHover(node)}
              onClick={() => onSelect(node.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition ${isSelected
                ? 'bg-blue-600/30 text-blue-100 font-bold'
                : isActive
                  ? 'bg-slate-800/90 text-white'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
            >
              {node.icon ? <span className="text-sm leading-none shrink-0">{node.icon}</span> : null}
              <span className="flex-1 truncate">{node.label}</span>
              {count != null && count > 0 && (
                <span className="text-[9px] font-mono text-slate-500 tabular-nums shrink-0">{count}</span>
              )}
              {hasChildren && <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** States under India — skip the India root so the menu lists states only. */
const INDIA_ROOT = PLACES_TREE[0]
const STATE_NODES: PlaceNode[] = INDIA_ROOT?.children ?? []

export default function PlacesMenu({
  selectedPlaceId,
  onSelectPlace,
  assetCounts,
  variant = 'default',
  onOpenChange,
}: PlacesMenuProps) {
  const [open, setOpen] = useState(false)
  const path = useMemo(() => getPlacePath(selectedPlaceId), [selectedPlaceId])
  const [hoverState, setHoverState] = useState<PlaceNode | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const selectedState = useMemo(() => {
    // path: India → State → City — pick the state node
    return path.find((n) => n.stateOrCountry) ?? path[1] ?? null
  }, [path])

  useEffect(() => {
    if (open) {
      setHoverState(selectedState)
    }
  }, [open, selectedState])

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleSelect = (id: string) => {
    onSelectPlace(id)
    setOpen(false)
  }

  const activeState = hoverState ?? selectedState
  const cityNodes = activeState?.children ?? []

  const selectedLabel = path[path.length - 1]?.label ?? 'Places'

  const btnClass =
    variant === 'toolbar'
      ? `h-9 px-3 text-[11px] font-bold rounded-lg border transition flex items-center gap-1.5 shrink-0 ${open
        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
        : 'tams-az-float bg-slate-950/60 border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white'
      }`
      : `px-2.5 py-1 text-xs rounded-md transition flex items-center gap-1 ${open ? 'bg-tams-primary text-white' : 'text-gray-300 hover:bg-gray-700'
      }`

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className={btnClass}>
        <MapPin className="w-3.5 h-3.5" />
        <span className="max-w-[72px] sm:max-w-[88px] truncate">{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="tams-az-portal absolute top-full right-0 mt-2 z-[8000] flex flex-col rounded-xl border border-slate-600 bg-[#0a1020] shadow-2xl shadow-black/60 overflow-hidden"
          role="menu"
          aria-label="Select place"
        >
          <button
            type="button"
            onClick={() => handleSelect('india')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[11px] border-b border-slate-700/80 transition ${
              selectedPlaceId === 'india'
                ? 'bg-blue-600/30 text-blue-100 font-bold'
                : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <span className="text-sm leading-none shrink-0">🇮🇳</span>
            <span className="flex-1 truncate font-bold">India</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">Explorer</span>
          </button>
          <div className="flex">
            <PlaceColumn
              title="States"
              nodes={STATE_NODES}
              selectedPlaceId={selectedPlaceId}
              activeId={activeState?.id ?? null}
              onHover={(node) => setHoverState(node)}
              onSelect={handleSelect}
              assetCounts={assetCounts}
            />
            {cityNodes.length > 0 && (
              <PlaceColumn
                title={activeState?.label ?? 'Cities'}
                nodes={cityNodes}
                selectedPlaceId={selectedPlaceId}
                activeId={path[path.length - 1]?.id === activeState?.id ? null : path[path.length - 1]?.id ?? null}
                onHover={() => {}}
                onSelect={handleSelect}
                assetCounts={assetCounts}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
