import React from 'react'

import type { FoundationRecommendation } from '../geotech/foundationRecommendation'
import type { SoilVerdictAnalysis } from '../geotech/verdict/types'
import { formatVerdictLabel } from '../geotech/verdict'

export interface PostSoilActionPanelProps {
  verdict: SoilVerdictAnalysis
  foundationRecommendation: FoundationRecommendation | null
  onCreateTransmissionLine: () => void
  onCreateInvestigationPolygon: () => void
  onCheckTowerSuitability: () => void
}

export default function PostSoilActionPanel({
  verdict,
  foundationRecommendation,
  onCreateTransmissionLine,
  onCreateInvestigationPolygon,
  onCheckTowerSuitability,
}: PostSoilActionPanelProps) {
  const overall = formatVerdictLabel(verdict.overall.status)

  return (
    <section className="ts-glass rounded-lg p-3 border border-[#0f766e]/30 space-y-3 mt-3">
      <div>
        <p className="text-[10px] font-black uppercase text-[#0f766e]">Soil Investigation Complete</p>
        <p className="text-[12px] font-black mt-1">Overall suitability: {overall}</p>
        {foundationRecommendation && (
          <p className="text-[11px] font-semibold text-[#263238] mt-0.5">
            Recommended foundation: {foundationRecommendation.label}
          </p>
        )}
      </div>

      {verdict.whatWeKnow.correlated.length > 0 || verdict.whatWeKnow.modelled.length > 0 ? (
        <div>
          <p className="text-[9px] font-black uppercase text-[#66727a]">Key findings</p>
          <ul className="mt-1 space-y-0.5">
            {[...verdict.whatWeKnow.correlated, ...verdict.whatWeKnow.modelled].slice(0, 4).map((item) => (
              <li key={item} className="text-[10px] text-[#263238]">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-[9px] font-black uppercase text-[#66727a] mb-1.5">What would you like to analyze next?</p>
        <div className="grid grid-cols-1 gap-1.5">
          <button
            type="button"
            onClick={onCreateTransmissionLine}
            className="w-full px-2 py-2 rounded-lg bg-[#0f766e] text-white text-[10px] font-black uppercase tracking-wide hover:bg-[#0d9488]"
          >
            Create Transmission Line
          </button>
          <button
            type="button"
            onClick={onCreateInvestigationPolygon}
            className="w-full px-2 py-2 rounded-lg bg-white/80 border border-slate-200 text-[#263238] text-[10px] font-black uppercase tracking-wide hover:bg-slate-50"
          >
            Create Investigation Polygon
          </button>
          <button
            type="button"
            onClick={onCheckTowerSuitability}
            className="w-full px-2 py-2 rounded-lg bg-white/80 border border-slate-200 text-[#263238] text-[10px] font-black uppercase tracking-wide hover:bg-slate-50"
          >
            Check Tower Suitability
          </button>
        </div>
      </div>

      <p className="text-[8px] text-[#66727a] italic leading-snug">
        GIS / model-derived estimates — field verification required before final design.
      </p>
    </section>
  )
}
