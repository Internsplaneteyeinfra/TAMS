import React from 'react'

import type { RegionStats } from '@/lib/placeFilter'

interface AssetStatisticsPanelProps {
  stats: RegionStats
  typeFilters: Record<string, boolean>
  onToggleType: (type: 'tower' | 'substation' | 'line') => void
}

const ROWS: {
  key: 'tower' | 'substation' | 'line' | 'transformer' | 'solar'
  label: string
  color: string
  getCount: (s: RegionStats) => number
  filterKey?: 'tower' | 'substation' | 'line'
}[] = [
    { key: 'tower', label: 'Tower', color: '#ef4444', getCount: (s) => s.towers, filterKey: 'tower' },
    { key: 'substation', label: 'Substation', color: '#3b82f6', getCount: (s) => s.substations, filterKey: 'substation' },
    { key: 'line', label: 'Power Line', color: '#22c55e', getCount: (s) => s.lines, filterKey: 'line' },
    { key: 'transformer', label: 'Transformer', color: '#a855f7', getCount: (s) => s.transformers },
    { key: 'solar', label: 'Solar', color: '#f59e0b', getCount: (s) => s.solar },
  ]

export default function AssetStatisticsPanel({
  stats,
  typeFilters,
  onToggleType,
}: AssetStatisticsPanelProps) {
  return (
    <div className="w-[168px] rounded-xl border border-slate-700/80 bg-[#0a1020]/95 shadow-lg backdrop-blur-sm overflow-hidden select-none">
      <div className="px-2 py-1 border-b border-gray-700 bg-gray-950/60">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Assets</p>
      </div>
      <table className="w-full text-[10px]">
        <tbody>
          {ROWS.map((row) => {
            const active = row.filterKey ? typeFilters[row.filterKey] !== false : true
            return (
              <tr key={row.key} className="border-b border-gray-800/80 last:border-b-0">
                <td className="pl-2 pr-1 py-1">
                  {row.filterKey ? (
                    <button
                      type="button"
                      onClick={() => onToggleType(row.filterKey!)}
                      className={`flex items-center gap-1.5 w-full text-left rounded transition ${active ? 'opacity-100' : 'opacity-40'
                        } hover:opacity-100`}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-white font-medium whitespace-nowrap">{row.label}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 pl-0.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-white font-medium">{row.label}</span>
                    </div>
                  )}
                </td>
                <td className="pr-2 py-1 text-right text-gray-400 font-mono tabular-nums w-8">
                  {row.getCount(stats)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
