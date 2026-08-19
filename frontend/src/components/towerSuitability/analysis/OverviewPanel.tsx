import React from 'react'

import CorridorPlacementPanel from '../CorridorPlacementPanel'
import PowerNetworkAnalysisPanel from '../PowerNetworkAnalysisPanel'
import type { CorridorPlacementAdvice } from '../corridorPlacementAdvice'
import type { SuitabilityResult, SuitabilitySuggestions } from '../scoring'

export default function OverviewPanel({
  result,
  suggestions,
  corridorAdvice,
  onExploreFactors,
  lat,
  lon,
}: {
  result: SuitabilityResult
  suggestions: SuitabilitySuggestions
  corridorAdvice: CorridorPlacementAdvice | null
  onExploreFactors: () => void
  lat?: number | null
  lon?: number | null
}) {
  const findings = result.factors.slice(0, 4).map((f) => {
    if (f.live === false || f.rawLabel.toUpperCase() === 'N/A' || f.note.toLowerCase().includes('unavailable')) {
      return { ok: false as const, text: `${f.label} data limited` }
    }
    if (f.score >= 7) return { ok: true as const, text: `${f.label} suitable` }
    if (f.score < 4.5) return { ok: false as const, text: `${f.label} needs review` }
    return { ok: true as const, text: `${f.label} acceptable` }
  })

  return (
    <div className="space-y-3 text-[#263238]">
      {lat != null && lon != null && (
        <p className="text-[11px] font-mono font-bold tabular-nums">
          Start {lat.toFixed(6)}, {lon.toFixed(6)}
        </p>
      )}
      <p className="text-sm font-black">Analysis complete</p>
      <p className="text-[12px] text-[#263238] leading-relaxed">{suggestions.summary}</p>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#263238]">Site score</p>
        <p className="text-2xl font-black tabular-nums">
          {result.finalScore.toFixed(1)} <span className="text-sm text-[#263238]">/ 10</span>
        </p>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#263238] mb-1.5">Key findings</p>
        <ul className="space-y-1 text-[12px]">
          {findings.map((f) => (
            <li key={f.text} className={f.ok ? 'text-[#27856b]' : 'text-[#b97816]'}>
              {f.ok ? '✓' : '!'} {f.text}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onExploreFactors}
        className="h-9 w-full rounded-lg bg-[#17879a] text-white text-[11px] font-black hover:bg-[#126b79]"
      >
        Explore Factors
      </button>
      {result.signals.nearbyPower && (
        <PowerNetworkAnalysisPanel supply={result.signals.nearbyPower} result={result} />
      )}
      {corridorAdvice && <CorridorPlacementPanel advice={corridorAdvice} />}
    </div>
  )
}
