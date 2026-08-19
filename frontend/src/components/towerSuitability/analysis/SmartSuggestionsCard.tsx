import React from 'react'
import { Sparkles } from 'lucide-react'

import type { SuitabilitySuggestions } from '../scoring'

export default function SmartSuggestionsCard({
  suggestions,
  onViewAll,
}: {
  suggestions: SuitabilitySuggestions
  onViewAll: () => void
}) {
  const preview = suggestions.items.slice(0, 3)
  return (
    <article className="ts-glass ts-card-in p-3.5 w-[min(280px,calc(100vw-5.5rem))]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#66727a] flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#b97816]" />
          Smart suggestions
        </p>
        <span className="text-[10px] font-black tabular-nums text-[#263238]">{suggestions.items.length}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {preview.length === 0 ? (
          <li className="text-[11px] text-[#66727a]">No material screening gaps.</li>
        ) : (
          preview.map((item) => (
            <li key={item.factorId} className="text-[11px] text-[#263238] leading-snug">
              • {item.howToImprove}
            </li>
          ))
        )}
      </ul>
      <button
        type="button"
        onClick={onViewAll}
        className="mt-2.5 text-[11px] font-bold text-[#17879a] hover:underline"
      >
        View all suggestions →
      </button>
    </article>
  )
}
