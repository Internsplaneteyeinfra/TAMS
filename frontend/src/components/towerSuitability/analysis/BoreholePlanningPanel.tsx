import React from 'react'

import type { BoreholeInvestigationPlan } from '../geotech/boreholePlanning'

export default function BoreholePlanningPanel({
  plan,
  selectedBoreholeId = null,
  onSelectBorehole,
}: {
  plan: BoreholeInvestigationPlan | null | undefined
  selectedBoreholeId?: string | null
  onSelectBorehole?: (boreholeId: string) => void
}) {
  if (!plan) return null

  return (
    <section className="ts-glass rounded-lg p-2.5 space-y-2 border border-[#0f766e]/25">
      <div>
        <p className="text-[10px] font-black uppercase text-[#0f766e]">
          Recommended Geotechnical Investigation Plan
        </p>
        <p className="text-[9px] text-[#66727a] mt-0.5 leading-snug">
          Proposed GIS investigation points — not field-completed boreholes.
        </p>
      </div>

      <p className="text-[11px] font-semibold text-[#263238]">{plan.analysisSummary}</p>

      <div className="grid grid-cols-3 gap-1.5 text-[9px]">
        <div className="rounded bg-white/60 p-1.5 border border-slate-200">
          <p className="font-black text-[#66727a] uppercase">Points</p>
          <p className="text-[12px] font-mono font-bold">{plan.totalPoints}</p>
        </div>
        <div className="rounded bg-white/60 p-1.5 border border-slate-200">
          <p className="font-black text-[#66727a] uppercase">Spacing</p>
          <p className="text-[12px] font-mono font-bold">
            {plan.recommendedSpacingM > 0 ? `${plan.recommendedSpacingM} m` : '—'}
          </p>
        </div>
        <div className="rounded bg-white/60 p-1.5 border border-slate-200">
          <p className="font-black text-[#66727a] uppercase">Coverage</p>
          <p className="text-[12px] font-mono font-bold">{plan.estimatedCoveragePct}%</p>
        </div>
      </div>

      <p className="text-[9px] text-[#66727a] leading-snug">
        <span className="font-bold">Terrain:</span> {plan.terrainVariationNote}
      </p>
      <p className="text-[9px] text-[#66727a] leading-snug">
        <span className="font-bold">Soil variability:</span> {plan.soilVariabilityNote}
      </p>

      <div className="overflow-x-auto max-h-48 overflow-y-auto">
        <table className="w-full text-[8px] border-collapse">
          <thead className="sticky top-0 bg-[#ecfdf5]">
            <tr>
              <th className="p-1 border border-slate-200 text-left">ID</th>
              <th className="p-1 border border-slate-200 text-left">Lat</th>
              <th className="p-1 border border-slate-200 text-left">Lon</th>
              <th className="p-1 border border-slate-200 text-left">Depth</th>
              <th className="p-1 border border-slate-200 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {plan.points.map((p) => {
              const selected = selectedBoreholeId === p.boreholeId
              return (
              <tr
                key={p.boreholeId}
                className={`cursor-pointer transition-colors ${
                  selected ? 'bg-amber-100 ring-2 ring-amber-400 ring-inset' : 'hover:bg-[#ecfdf5]/80'
                }`}
                onClick={() => onSelectBorehole?.(p.boreholeId)}
                title="Click to highlight on map"
              >
                <td className="p-1 border border-slate-200 font-black text-[#0f766e]">{p.boreholeId}</td>
                <td className="p-1 border border-slate-200 font-mono">{p.latitude.toFixed(5)}</td>
                <td className="p-1 border border-slate-200 font-mono">{p.longitude.toFixed(5)}</td>
                <td className="p-1 border border-slate-200 font-mono">{p.recommendedInvestigationDepthM.toFixed(1)} m</td>
                <td className="p-1 border border-slate-200 max-w-[140px] truncate" title={p.selectionReason}>
                  {p.selectionReason}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </section>
  )
}
