import React from 'react'
import { ChevronRight } from 'lucide-react'

import { getPlacePath } from '@/config/places'

interface PlaceBreadcrumbProps {
  placeId: string
  onSelectPlace: (placeId: string) => void
}

export default function PlaceBreadcrumb({ placeId, onSelectPlace }: PlaceBreadcrumbProps) {
  const path = getPlacePath(placeId)
  if (path.length === 0) return null

  return (
    <nav
      className="absolute top-[4.25rem] left-3 right-3 z-[999] flex flex-wrap items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0e172a]/85 backdrop-blur-xl border border-white/10 shadow-lg max-w-[calc(100%-1.5rem)]"
      aria-label="Current region"
    >
      {path.map((node, i) => (
        <React.Fragment key={node.id}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
          <button
            type="button"
            onClick={() => onSelectPlace(node.id)}
            className={`flex items-center gap-1 text-[10px] font-semibold transition rounded px-1 py-0.5 ${i === path.length - 1
              ? 'text-blue-300'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            {node.icon && <span className="text-xs">{node.icon}</span>}
            {node.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  )
}
