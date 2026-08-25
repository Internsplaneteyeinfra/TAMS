import React from 'react'
import { Sparkles } from 'lucide-react'

import type { CorridorPlacementAdvice } from '../corridorPlacementAdvice'
import type { SuitabilitySuggestions } from '../scoring'

function corridorLine(advice: CorridorPlacementAdvice): string {
  const nearest =
    advice.nearestStation
      ? `SS ${advice.nearestStation.distanceKm.toFixed(1)} km`
      : advice.nearestTower
        ? `tower ${advice.nearestTower.distanceKm.toFixed(1)} km`
        : 'no nearby grid'
  return `${advice.canPlaceCount}/${advice.plannedCount} pads OK · ${advice.voltageLabel} · ${nearest}`
}

export default function SmartSuggestionsCard({
  suggestions,
  corridorAdvice,
  onViewAll,
}: {
  suggestions: SuitabilitySuggestions
  corridorAdvice: CorridorPlacementAdvice | null
  onViewAll: () => void
}) {
  const preview = suggestions.items.slice(0, 2)
  return (
    <article className="ts-glass ts-card-in p-2.5 w-full">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#66727a] flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#b97816]" />
          Suggestions
        </p>
        <span className="text-[10px] font-black tabular-nums text-[#263238]">{suggestions.items.length}</span>
      </div>
      {corridorAdvice && (
        <p className="mt-1.5 text-[10px] font-semibold text-[#17879a] leading-snug">
          Corridor: {corridorLine(corridorAdvice)}
        </p>
      )}
      <ul className="mt-1.5 max-h-[22vh] space-y-1.5 overflow-y-auto">
        {preview.length === 0 ? (
          <li className="text-[11px] text-[#66727a]">No gaps to close on this screening.</li>
        ) : (
          preview.map((item) => (
            <li key={item.factorId} className="text-[11px] text-[#263238] leading-snug">
              <p className="font-bold">{item.factorLabel}</p>
              <p className="text-[#c75b50]">Why: {item.whyNotIdeal}</p>
              <p className="text-[#27856b]">Fix: {item.howToImprove}</p>
            </li>
          ))
        )}
      </ul>
      {suggestions.couldNotCheck && suggestions.couldNotCheck.length > 0 && (
        <p className="mt-2 text-[10px] text-[#66727a] leading-snug">
          Could not check: {suggestions.couldNotCheck.join(', ')}
        </p>
      )}
      <button
        type="button"
        onClick={onViewAll}
        className="mt-2 text-[11px] font-bold text-[#17879a] hover:underline"
      >
        Open full list →
      </button>
    </article>
  )
}
