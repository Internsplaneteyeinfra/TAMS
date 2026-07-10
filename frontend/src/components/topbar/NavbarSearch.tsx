import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

import type { Asset } from '@/lib/api'

interface NavbarSearchProps {
  assets: Asset[]
  onSelectAsset: (id: string) => void
}

export default function NavbarSearch({ assets, onSelectAsset }: NavbarSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets.slice(0, 6)
    return assets
      .filter(
        (asset) =>
          asset.name.toLowerCase().includes(q) ||
          asset.id.toLowerCase().includes(q) ||
          asset.asset_type.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [assets, query])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (id: string) => {
    onSelectAsset(id)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md min-w-[180px]">
      <div className="flex items-center gap-2 bg-slate-950/70 border border-white/10 rounded-lg px-2.5 py-1.5 backdrop-blur-sm transition-colors focus-within:border-blue-500/40">
        <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search assets, towers, lines…"
          className="flex-1 bg-transparent text-[11px] text-slate-200 placeholder:text-slate-500 outline-none"
          aria-label="Search assets"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0e172a]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <p className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">
            {query ? 'Search Results' : 'Recent Assets'}
          </p>
          <ul className="max-h-52 overflow-y-auto scrollbar-thin">
            {results.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(asset.id)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-200 truncate">{asset.name}</p>
                    <p className="text-[9px] text-slate-500 font-mono truncate">{asset.id}</p>
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                    {asset.asset_type}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
