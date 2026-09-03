import React from 'react'
import {
  BarChart2,
  FileSearch,
  Hash,
  Layers,
  Mountain,
  Radio,
  Settings,
  Sparkles,
} from 'lucide-react'

import type { IntelligencePanel } from '../workspaceTypes'

/** Primary workflow — score lives inside Overview */
const PRIMARY_ITEMS: { id: Exclude<IntelligencePanel, null>; label: string; Icon: typeof BarChart2 }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart2 },
  { id: 'soil', label: 'Soil', Icon: FileSearch },
  { id: 'geotech', label: 'GeoTech', Icon: Mountain },
  { id: 'suggestions', label: 'Tips', Icon: Sparkles },
]

/** Secondary / detail panels */
const MORE_ITEMS: { id: Exclude<IntelligencePanel, null>; label: string; Icon: typeof BarChart2 }[] = [
  { id: 'live', label: 'Live', Icon: Radio },
  { id: 'factors', label: 'Factors', Icon: Layers },
  { id: 'breakdown', label: 'Score', Icon: Hash },
  { id: 'controls', label: 'Setup', Icon: Settings },
]

function RailButtons({
  items,
  active,
  onSelect,
  loadingIds,
}: {
  items: typeof PRIMARY_ITEMS
  active: IntelligencePanel
  onSelect: (id: Exclude<IntelligencePanel, null>) => void
  loadingIds?: Set<string>
}) {
  return (
    <>
      {items.map(({ id, label, Icon }) => {
        const pressed = active === id
        const loading = loadingIds?.has(id)
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            onClick={() => onSelect(id)}
            className={`ts-rail-btn relative ${pressed ? 'ts-rail-btn-active' : ''}`}
          >
            <Icon className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
            <span>{label}</span>
            {loading && (
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#0f766e] animate-pulse"
                aria-hidden
              />
            )}
          </button>
        )
      })}
    </>
  )
}

export default function IntelligenceRail({
  active,
  onSelect,
  geotechBuilding = false,
}: {
  active: IntelligencePanel
  onSelect: (id: Exclude<IntelligencePanel, null>) => void
  geotechBuilding?: boolean
}) {
  const loadingIds = geotechBuilding ? new Set(['geotech']) : undefined
  const allItems = [...PRIMARY_ITEMS, ...MORE_ITEMS]

  return (
    <>
      <nav
        className="ts-rail-in hidden md:flex pointer-events-auto flex-col gap-1.5"
        aria-label="Analysis intelligence"
      >
        <p className="text-[8px] font-black uppercase tracking-widest text-[#66727a] text-center px-1">
          Analysis
        </p>
        <RailButtons items={PRIMARY_ITEMS} active={active} onSelect={onSelect} loadingIds={loadingIds} />
        <div className="mx-auto h-px w-8 bg-[rgba(51,65,85,0.2)] my-0.5" aria-hidden />
        <p className="text-[8px] font-black uppercase tracking-widest text-[#66727a] text-center px-1">
          Details
        </p>
        <RailButtons items={MORE_ITEMS} active={active} onSelect={onSelect} loadingIds={loadingIds} />
      </nav>
      <nav
        className="md:hidden pointer-events-auto ts-glass flex w-full justify-around px-1 py-1.5 overflow-x-auto"
        aria-label="Analysis intelligence"
      >
        {allItems.map(({ id, label, Icon }) => {
          const pressed = active === id
          const loading = geotechBuilding && id === 'geotech'
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={pressed}
              onClick={() => onSelect(id)}
              className={`relative flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md text-[8px] font-black uppercase shrink-0 ${
                pressed ? 'text-[#17879a]' : 'text-[#263238]'
              }`}
            >
              <Icon className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
              {label.split(' ')[0]}
              {loading && (
                <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-[#0f766e] animate-pulse" />
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}
