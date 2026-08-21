import React from 'react'

import CorridorPlacementPanel from '../CorridorPlacementPanel'
import PowerNetworkAnalysisPanel from '../PowerNetworkAnalysisPanel'
import type { CorridorPlacementAdvice } from '../corridorPlacementAdvice'
import type { FactorResult, SuitabilityResult, SuitabilitySuggestions } from '../scoring'

/** Honest confidence bands for live open-data signals used in Key Findings. */
function signalConfidence(f: FactorResult, result: SuitabilityResult): number {
  const live = f.live !== false
  const fallback = result.signals.usedFallback
  if (f.id === 'slope' || f.id === 'elevation') {
    if (!live) return 55
    return 78 // Copernicus DEM ~30 m — good for screening, not survey
  }
  if (f.id === 'road') {
    if (!live) return 50
    return 72 // OSRM/OSM road network
  }
  if (f.id === 'water' || f.label.toLowerCase().includes('water')) {
    if (fallback?.water) return 58
    if (!live) return 50
    return 68 // OSM water — misses seasonal / unmapped
  }
  if (f.id === 'clearance' || f.label.toLowerCase().includes('settlement')) {
    if (fallback?.settlement) return 55
    return live ? 65 : 50
  }
  if (f.id === 'geotech') {
    if (result.signals.geotech) return 88
    if (result.signals.soilScreening) return result.signals.soilScreening.confidencePct
    return 40
  }
  return live ? 70 : 50
}

export default function OverviewPanel({
  result,
  suggestions,
  corridorAdvice,
  manualVoltageKv,
  onManualVoltageKv,
  onExploreFactors,
  lat,
  lon,
}: {
  result: SuitabilityResult
  suggestions: SuitabilitySuggestions
  corridorAdvice: CorridorPlacementAdvice | null
  manualVoltageKv?: number | null
  onManualVoltageKv?: (kv: number | null) => void
  onExploreFactors: () => void
  lat?: number | null
  lon?: number | null
}) {
  const findings = result.factors.slice(0, 4).map((f) => {
    const conf = signalConfidence(f, result)
    if (f.live === false || f.rawLabel.toUpperCase() === 'N/A' || f.note.toLowerCase().includes('unavailable')) {
      return { ok: false as const, text: `${f.label} data limited`, conf }
    }
    if (f.score >= 7) return { ok: true as const, text: `${f.label} suitable`, conf }
    if (f.score < 4.5) return { ok: false as const, text: `${f.label} needs review`, conf }
    return { ok: true as const, text: `${f.label} acceptable`, conf }
  })

  const soil = result.signals.soilScreening
  const overallConf = Math.round(result.confidencePct)

  return (
    <div className="space-y-3 text-[#263238]">
      {lat != null && lon != null && (
        <p className="text-[11px] font-mono font-bold tabular-nums">
          Start {lat.toFixed(6)}, {lon.toFixed(6)}
        </p>
      )}
      {result.signals.placeLabel && (
        <p className="text-[12px] font-bold text-[#17879a]">{result.signals.placeLabel}</p>
      )}
      <p className="text-sm font-black">Analysis complete</p>
      <p className="text-[12px] text-[#263238] leading-relaxed">{suggestions.summary}</p>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#263238]">Site score</p>
        <p className="text-2xl font-black tabular-nums">
          {result.finalScore.toFixed(1)} <span className="text-sm text-[#263238]">/ 10</span>
        </p>
        <p className="text-[11px] text-[#66727a] mt-0.5">
          Overall screening confidence ~{overallConf}% (open data — not a design certificate)
        </p>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#263238] mb-1.5">Key findings</p>
        <ul className="space-y-1 text-[12px]">
          {findings.map((f) => (
            <li key={f.text} className={f.ok ? 'text-[#27856b]' : 'text-[#b97816]'}>
              {f.ok ? '✓' : '!'} {f.text}
              <span className="text-[10px] text-[#66727a] font-semibold"> · ~{f.conf}% conf.</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-[#66727a] leading-snug">
          Slope/elevation: Copernicus DEM (~30 m). Road: OSM/OSRM. Water: OSM surface water (seasonal
          streams may be missing). Values are for screening, not cadastral/survey truth.
        </p>
      </div>
      {soil && (
        <div className="rounded-lg border border-[#0f766e]/25 bg-[#ecfdf5] px-2.5 py-2">
          <p className="text-[10px] font-black uppercase text-[#0f766e]">Open GIS soil</p>
          <p className="text-[12px] font-bold mt-0.5">
            {soil.textureClass} · SBC ~{soil.indicativeSbcTm2.low}–{soil.indicativeSbcTm2.high} T/m²
          </p>
          <p className="text-[10px] text-[#66727a]">
            SoilGrids screening · ~{soil.confidencePct}% confidence · use Generate/Download soil report
          </p>
        </div>
      )}
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
      {corridorAdvice && (
        <CorridorPlacementPanel
          advice={corridorAdvice}
          manualVoltageKv={manualVoltageKv}
          onManualVoltageKv={onManualVoltageKv}
        />
      )}
    </div>
  )
}
