import React from 'react'
import { BarChart2, Hash, Layers, Radio, Settings } from 'lucide-react'

import type { IntelligencePanel } from '../workspaceTypes'

const ITEMS: { id: Exclude<IntelligencePanel, 'suggestions' | null>; label: string; Icon: typeof BarChart2 }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart2 },
  { id: 'live', label: 'Live Data', Icon: Radio },
  { id: 'factors', label: 'Factors', Icon: Layers },
  { id: 'controls', label: 'Controls', Icon: Settings },
  { id: 'breakdown', label: 'Breakdown', Icon: Hash },
]

export default function IntelligenceRail({
  active,
  onSelect,
}: {
  active: IntelligencePanel
  onSelect: (id: Exclude<IntelligencePanel, 'suggestions' | null>) => void
}) {
  return (
    <>
      <nav
        className="ts-rail-in hidden md:flex pointer-events-auto flex-col gap-1.5"
        aria-label="Analysis intelligence"
      >
        {ITEMS.map(({ id, label, Icon }) => {
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
      </nav>
      <nav
        className="md:hidden pointer-events-auto ts-glass flex w-full justify-around px-1 py-1.5"
        aria-label="Analysis intelligence"
      >
        {ITEMS.map(({ id, label, Icon }) => {
          const pressed = active === id
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={pressed}
              onClick={() => onSelect(id)}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md text-[8px] font-black uppercase ${
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
