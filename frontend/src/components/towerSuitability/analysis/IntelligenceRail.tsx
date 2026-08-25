import React from 'react'
import {
  BarChart2,
  Download,
  FileSearch,
  Gauge,
  Hash,
  Layers,
  Radio,
  Settings,
  Sparkles,
} from 'lucide-react'

import type { IntelligencePanel } from '../workspaceTypes'

const TOP_ITEMS: { id: Exclude<IntelligencePanel, null>; label: string; Icon: typeof BarChart2 }[] = [
  { id: 'score', label: 'Score', Icon: Gauge },
  { id: 'soil', label: 'Soil', Icon: FileSearch },
  { id: 'report', label: 'Report', Icon: Download },
  { id: 'suggestions', label: 'Tips', Icon: Sparkles },
]

const MAIN_ITEMS: { id: Exclude<IntelligencePanel, null>; label: string; Icon: typeof BarChart2 }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart2 },
  { id: 'live', label: 'Live Data', Icon: Radio },
  { id: 'factors', label: 'Factors', Icon: Layers },
  { id: 'controls', label: 'Controls', Icon: Settings },
  { id: 'breakdown', label: 'Breakdown', Icon: Hash },
]

function RailButtons({
  items,
  active,
  onSelect,
}: {
  items: typeof TOP_ITEMS
  active: IntelligencePanel
  onSelect: (id: Exclude<IntelligencePanel, null>) => void
}) {
  return (
    <>
      {items.map(({ id, label, Icon }) => {
        const pressed = active === id
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            onClick={() => onSelect(id)}
            className={`ts-rail-btn ${pressed ? 'ts-rail-btn-active' : ''}`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        )
      })}
    </>
  )
}

export default function IntelligenceRail({
  active,
  onSelect,
}: {
  active: IntelligencePanel
  onSelect: (id: Exclude<IntelligencePanel, null>) => void
}) {
  return (
    <>
      <nav
        className="ts-rail-in hidden md:flex pointer-events-auto flex-col gap-1.5"
        aria-label="Analysis intelligence"
      >
        <RailButtons items={TOP_ITEMS} active={active} onSelect={onSelect} />
        <div className="mx-auto h-px w-8 bg-[rgba(51,65,85,0.2)] my-0.5" aria-hidden />
        <RailButtons items={MAIN_ITEMS} active={active} onSelect={onSelect} />
      </nav>
      <nav
        className="md:hidden pointer-events-auto ts-glass flex w-full justify-around px-1 py-1.5 overflow-x-auto"
        aria-label="Analysis intelligence"
      >
        {[...TOP_ITEMS, ...MAIN_ITEMS].map(({ id, label, Icon }) => {
          const pressed = active === id
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={pressed}
              onClick={() => onSelect(id)}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md text-[8px] font-black uppercase shrink-0 ${
                pressed ? 'text-[#17879a]' : 'text-[#263238]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label.split(' ')[0]}
            </button>
          )
        })}
      </nav>
    </>
  )
}
