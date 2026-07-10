import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Search, X } from 'lucide-react'

import type { Asset } from '@/lib/api'

const RECENT_KEY = 'tams-map-search-recent'

interface FloatingMapSearchProps {
  assets: Asset[]
  onSelectAsset: (id: string) => void
}

function loadRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]
  } catch {
    return []
  }
}

function saveRecent(name: string) {
  if (typeof window === 'undefined') return
  const next = [name, ...loadRecent().filter((x) => x !== name)].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

export default function FloatingMapSearch({ assets, onSelectAsset }: FloatingMapSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'tower' | 'substation' | 'line'>('all')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRecent(loadRecent())
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets
      .filter((a) => (filter === 'all' ? true : a.asset_type === filter))
      .filter((a) => {
        if (!q) return true
        const meta = a.metadata || {}
        const haystack = [
          a.name,
          a.id,
          a.asset_type,
          a.description,
          meta.country_or_state,
          meta.region,
          meta.operator,
          meta.voltage_kv,
        ]
          .filter(Boolean)
          .map(String)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, 8)
  }, [assets, query, filter])

  const pick = (asset: Asset) => {
    saveRecent(asset.name)
    setRecent(loadRecent())
    onSelectAsset(asset.id)
    setQuery(asset.name)
    setOpen(false)
  }

  return (
    <div
      ref={ref}
      className="absolute top-4 left-4 z-[5000] w-[min(calc(100%-2rem),300px)] select-none"
    >
      <div className="flex items-center gap-2 rounded-2xl bg-[#0e172a]/90 backdrop-blur-xl border border-white/10 shadow-2xl px-3 py-2.5 transition focus-within:border-blue-500/40 focus-within:shadow-blue-500/10">
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search asset, state, city, line..."
          className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none"
          aria-label="Map asset search"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-slate-500 hover:text-slate-200"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-2xl bg-[#0e172a]/95 backdrop-blur-xl border border-slate-700 shadow-2xl overflow-hidden z-[5001] relative">
          <div className="flex gap-1 p-2 border-b border-slate-800">
            {(['all', 'tower', 'substation', 'line'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition ${filter === f
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>

          {!query && recent.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-800">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Recent
              </p>
              <div className="flex flex-wrap gap-1">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setQuery(r)
                      setOpen(true)
                    }}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-500"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="max-h-56 overflow-y-auto scrollbar-thin">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-[11px] text-slate-500">No matches</li>
            ) : (
              results.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => pick(asset)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-800/80 transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-100 truncate">{asset.name}</p>
                      <p className="text-[9px] text-slate-500 font-mono truncate">{asset.id}</p>
                    </div>
                    <span className="text-[8px] uppercase font-bold text-slate-400 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                      {asset.asset_type}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
