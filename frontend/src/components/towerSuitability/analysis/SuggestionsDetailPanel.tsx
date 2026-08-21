import React from 'react'
import { MapPinned, ShieldAlert } from 'lucide-react'

import type { SuitabilityResult, SuitabilitySuggestions } from '../scoring'
import type { CorridorPlacementAdvice } from '../corridorPlacementAdvice'

export default function SuggestionsDetailPanel({
  result,
  suggestions,
  corridorAdvice,
  onFocusMap,
}: {
  result: SuitabilityResult
  suggestions: SuitabilitySuggestions
  corridorAdvice: CorridorPlacementAdvice | null
  onFocusMap: () => void
}) {
  return (
    <div className="space-y-3 text-[#263238]">
      <p className="text-[12px] text-[#66727a] leading-relaxed">{suggestions.summary}</p>
      <button
        type="button"
        onClick={onFocusMap}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(51,65,85,0.16)] px-2.5 text-[11px] font-black"
      >
        <MapPinned className="h-3.5 w-3.5" />
        Focus on Map
      </button>
      {corridorAdvice && (
        <div className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/50 px-2.5 py-2 space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-[#66727a]">Corridor suggestion</p>
          <p className="text-[11px] text-[#66727a] leading-snug">{corridorAdvice.summary}</p>
          <p className="text-[11px] text-[#27856b] leading-snug">{corridorAdvice.whyFollow}</p>
          <p className="text-[11px] text-[#c75b50] leading-snug">{corridorAdvice.whyNotFollow}</p>
          <p className="text-[10px] text-[#b97816] leading-snug">{corridorAdvice.suggestionNote}</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/40 px-2 py-1.5">
          <p className="text-[#66727a]">Current</p>
          <p className="font-black tabular-nums">{suggestions.currentScore.toFixed(1)} / 10</p>
        </div>
        <div className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/40 px-2 py-1.5">
          <p className="text-[#b97816]">Remaining</p>
          <p className="font-black tabular-nums text-[#b97816]">−{suggestions.remainingToPerfect.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/40 px-2 py-1.5">
          <p className="text-[#66727a]">To accepted</p>
          <p className="font-black tabular-nums">
            {suggestions.pointsToAccepted > 0 ? `+${suggestions.pointsToAccepted.toFixed(1)}` : 'Met'}
          </p>
        </div>
      </div>
      {suggestions.placementTips && suggestions.placementTips.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.placementTips.map((tip, idx) => (
            <div key={`place-${idx}`} className="rounded-lg border border-[rgba(23,135,154,0.2)] bg-white/40 px-2.5 py-2">
              <p className="text-[12px] font-bold">{idx + 1}. {tip.title}</p>
              <p className="text-[11px] text-[#66727a] mt-0.5">{tip.detail}</p>
              <p className="text-[10px] text-[#b97816] mt-0.5">{tip.accuracy}</p>
            </div>
          ))}
        </div>
      )}
      {suggestions.items.map((item, idx) => (
        <div key={item.factorId} className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/40 px-3 py-2">
          <p className="text-[12px] font-bold">
            {idx + 1}. {item.factorLabel}
          </p>
          <p className="text-[11px] text-[#c75b50] mt-1">{item.whyNotIdeal}</p>
          <p className="text-[11px] text-[#27856b] mt-1">{item.howToImprove}</p>
        </div>
      ))}
      {result.disclaimer && (
        <p className="text-[10px] text-[#b97816] leading-snug flex gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {result.disclaimer}
        </p>
      )}
    </div>
  )
}
