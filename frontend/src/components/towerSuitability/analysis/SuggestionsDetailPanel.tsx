import React, { useState } from 'react'
import { MapPinned } from 'lucide-react'

import type { SuitabilitySuggestions } from '../scoring'
import type { CorridorPlacementAdvice } from '../corridorPlacementAdvice'

function corridorLine(advice: CorridorPlacementAdvice): string {
  const nearest =
    advice.nearestStation
      ? `nearest SS ${advice.nearestStation.distanceKm.toFixed(1)} km`
      : advice.nearestTower
        ? `nearest tower ${advice.nearestTower.distanceKm.toFixed(1)} km`
        : 'no mapped grid nearby'
  return `${advice.canPlaceCount} of ${advice.plannedCount} pads look placeable at ${advice.voltageLabel}. ${nearest}.`
}

export default function SuggestionsDetailPanel({
  suggestions,
  corridorAdvice,
  onFocusMap,
}: {
  suggestions: SuitabilitySuggestions
  corridorAdvice: CorridorPlacementAdvice | null
  onFocusMap: () => void
}) {
  const [stat, setStat] = useState<'current' | 'remaining' | 'accepted' | null>(null)
  const accepted = suggestions.pointsToAccepted <= 0

  const focusRemaining = () => {
    setStat('remaining')
    document.getElementById('ts-improve-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const focusAccepted = () => {
    setStat('accepted')
    if (!accepted) {
      document.getElementById('ts-improve-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="space-y-3 text-[#263238]">
      <p className="text-[12px] text-[#66727a] leading-snug">{suggestions.summary}</p>
      <button
        type="button"
        onClick={onFocusMap}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white px-2.5 text-[11px] font-black hover:bg-[#ecfeff]"
      >
        <MapPinned className="h-3.5 w-3.5" />
        Focus on Map
      </button>
      {corridorAdvice && (
        <p className="text-[11px] text-[#17879a] leading-snug">
          <span className="font-black uppercase tracking-wide text-[10px] text-[#66727a]">Corridor · </span>
          {corridorLine(corridorAdvice)}
        </p>
      )}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <button
          type="button"
          onClick={() => {
            setStat('current')
            onFocusMap()
          }}
          className={`rounded-lg border px-2 py-1.5 text-left hover:bg-white ${
            stat === 'current' ? 'border-[#17879a] bg-white' : 'border-[rgba(51,65,85,0.12)] bg-white/40'
          }`}
          title="Zoom the map to this site"
        >
          <p className="text-[#66727a]">Now</p>
          <p className="font-black tabular-nums">{suggestions.currentScore.toFixed(1)} / 10</p>
        </button>
        <button
          type="button"
          onClick={focusRemaining}
          className={`rounded-lg border px-2 py-1.5 text-left hover:bg-white ${
            stat === 'remaining' ? 'border-[#b97816] bg-white' : 'border-[rgba(51,65,85,0.12)] bg-white/40'
          }`}
          title="Jump to what still costs points"
        >
          <p className="text-[#b97816]">Gap to 10</p>
          <p className="font-black tabular-nums text-[#b97816]">−{suggestions.remainingToPerfect.toFixed(1)}</p>
        </button>
        <button
          type="button"
          onClick={focusAccepted}
          className={`rounded-lg border px-2 py-1.5 text-left hover:bg-white ${
            stat === 'accepted' ? 'border-[#27856b] bg-white' : 'border-[rgba(51,65,85,0.12)] bg-white/40'
          }`}
          title={accepted ? 'Already at accepted (≥7)' : 'See what to fix to reach 7/10'}
        >
          <p className="text-[#66727a]">Pass (≥7)</p>
          <p className="font-black tabular-nums">
            {accepted ? 'Met' : `Need +${suggestions.pointsToAccepted.toFixed(1)}`}
          </p>
        </button>
      </div>
      {stat === 'current' && (
        <p className="text-[10px] text-[#66727a]">Map zooms to this pad / corridor.</p>
      )}
      {stat === 'remaining' && (
        <p className="text-[10px] text-[#b97816]">
          {suggestions.remainingToPerfect.toFixed(1)} points left to a perfect 10. Fix the items below.
        </p>
      )}
      {stat === 'accepted' && (
        <p className="text-[10px] text-[#27856b]">
          {accepted
            ? 'Score is already 7 or above — screening pass.'
            : `Need ${suggestions.pointsToAccepted.toFixed(1)} more points to pass (≥7).`}
        </p>
      )}
      {suggestions.couldNotCheck && suggestions.couldNotCheck.length > 0 && (
        <p className="text-[11px] text-[#66727a] leading-snug">
          Could not check: {suggestions.couldNotCheck.join(', ')}
        </p>
      )}
      <div id="ts-improve-list" className="space-y-2">
        {suggestions.items.map((item, idx) => (
          <div key={item.factorId} className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/40 px-3 py-2">
            <p className="text-[12px] font-bold">
              {idx + 1}. {item.factorLabel}
            </p>
            <p className="text-[11px] text-[#c75b50] mt-1">Why: {item.whyNotIdeal}</p>
            <p className="text-[11px] text-[#27856b] mt-0.5">Fix: {item.howToImprove}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
