import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Search, Tag, X } from 'lucide-react'

import { MAP_CHROME_TOP, MAP_EDGE, mapLeftInset, mapOverlayRight } from '@/components/map/mapLayout'
import PlacesMenu from '@/components/map/PlacesMenu'
import { getPlacePath } from '@/config/places'
import type { Asset } from '@/lib/api'

const RECENT_KEY = 'tams-map-search-recent'

interface MapTopChromeProps {
  assets: Asset[]
  selectedPlaceId: string
  onSelectPlace: (placeId: string) => void
  placeAssetCounts?: Record<string, number>
  onSelectAsset: (id: string) => void
  labelsOn: boolean
  onToggleLabels: () => void
  timeRangeSlot?: React.ReactNode
  intelPanelCollapsed?: boolean
  controlRailCollapsed?: boolean
  showOpsReopen?: boolean
  onOpenOpsPanel?: () => void
  onExpandMapTools?: () => void
  onPlacesOpenChange?: (open: boolean) => void
}

function loadRecent(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[] } catch { return [] }
}

function saveRecent(name: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(RECENT_KEY, JSON.stringify([name, ...loadRecent().filter((x) => x !== name)].slice(0, 5)))
}

export default function MapTopChrome({
  assets, selectedPlaceId, onSelectPlace, placeAssetCounts, onSelectAsset,
  labelsOn, onToggleLabels, timeRangeSlot,
  intelPanelCollapsed = false, controlRailCollapsed = false,
  showOpsReopen = false,
  onOpenOpsPanel,
  onExpandMapTools,
  onPlacesOpenChange,
}: MapTopChromeProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [, setRecent] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setRecent(loadRecent()) }, [])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets.filter((a) => {
      if (!q) return true
      const meta = a.metadata || {}
      const haystack = [a.name, a.id, a.asset_type, a.description, meta.country_or_state, meta.region, meta.operator, meta.voltage_kv].filter(Boolean).map(String).join(' ').toLowerCase()
      return haystack.includes(q)
    }).slice(0, 8)
  }, [assets, query])

  const pick = (asset: Asset) => {
    saveRecent(asset.name); setRecent(loadRecent()); onSelectAsset(asset.id); setQuery(asset.name); setOpen(false)
  }

  return (
    <div
      ref={ref}
      className="absolute z-[1200] flex flex-col gap-2 select-none pointer-events-none"
      style={{ top: MAP_CHROME_TOP, left: MAP_EDGE, right: MAP_EDGE, paddingLeft: mapLeftInset(intelPanelCollapsed), paddingRight: mapOverlayRight(controlRailCollapsed) }}
    >
      <div className="flex items-center gap-2 pointer-events-auto min-w-0">
        <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl bg-[#0a1020]/95 border border-slate-700/80 shadow-lg px-3 py-2 backdrop-blur-sm">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Search asset, state, city, line..." className="flex-1 min-w-0 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none" aria-label="Map asset search" />
          {query && <button type="button" onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-200" aria-label="Clear"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <PlacesMenu
          variant="toolbar"
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={onSelectPlace}
          assetCounts={placeAssetCounts}
          onOpenChange={onPlacesOpenChange}
        />
        <button type="button" onClick={onToggleLabels} title="Toggle asset name labels" className={`h-9 px-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 transition ${labelsOn ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-slate-950/80 border-slate-700 text-slate-400 hover:text-white'}`}>
          <Tag className="w-3.5 h-3.5" /><span className="hidden md:inline">Labels</span>
        </button>
        {showOpsReopen && onOpenOpsPanel && (
          <button
            type="button"
            onClick={onOpenOpsPanel}
            title="Show Operations Center"
            aria-label="Show Operations Center"
            className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-600 bg-slate-950 text-slate-200 shadow-lg transition hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="text-[6px] font-bold uppercase leading-none tracking-wide">Ops</span>
          </button>
        )}
        {controlRailCollapsed && onExpandMapTools && (
          <button
            type="button"
            onClick={onExpandMapTools}
            title="Show map tools"
            aria-label="Show map tools"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-950 text-slate-200 shadow-lg transition hover:border-blue-400/50 hover:bg-slate-800 hover:text-white"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pointer-events-auto min-w-0">
        <MapPlaceBreadcrumb placeId={selectedPlaceId} onSelectPlace={onSelectPlace} />
        {timeRangeSlot}
      </div>

      {open && (
        <div className="pointer-events-auto rounded-xl bg-[#0a1020] border border-slate-700 shadow-2xl overflow-hidden max-w-md">
          <ul className="max-h-40 overflow-y-auto scrollbar-thin">
            {results.length === 0 ? <li className="px-3 py-4 text-center text-[11px] text-slate-500">No matches</li> : results.map((asset) => (
              <li key={asset.id}><button type="button" onClick={() => pick(asset)} className="w-full text-left px-3 py-2 hover:bg-slate-800/80 transition flex justify-between gap-2">
                <div className="min-w-0"><p className="text-[11px] font-bold text-slate-100 truncate">{asset.name}</p><p className="text-[9px] text-slate-500 font-mono truncate">{asset.id}</p></div>
                <span className="text-[8px] uppercase font-bold text-slate-400 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">{asset.asset_type}</span>
              </button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function MapPlaceBreadcrumb({ placeId, onSelectPlace }: { placeId: string; onSelectPlace: (id: string) => void }) {
  const path = getPlacePath(placeId)
  if (path.length <= 1) return null
  return (
    <nav className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-[#0a1020]/95 border border-slate-700/80 w-fit max-w-full overflow-x-auto scrollbar-thin backdrop-blur-sm" aria-label="Current region">
      {path.map((node, i) => (
        <React.Fragment key={node.id}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
          <button type="button" onClick={() => onSelectPlace(node.id)} className={`flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap transition ${i === path.length - 1 ? 'text-blue-300 bg-blue-600/15' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}>
            {node.icon && <span className="text-xs">{node.icon}</span>}{node.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  )
}
