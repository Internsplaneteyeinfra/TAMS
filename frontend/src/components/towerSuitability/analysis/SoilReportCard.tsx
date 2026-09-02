import React from 'react'
import { Mountain } from 'lucide-react'

import type { SoilScreening } from '../soilScreening'

/** Quick soil screening summary — downloads live in the Geotech tab. */
export default function SoilReportCard({
  soil,
  siteLabel,
  onOpenGeotech,
}: {
  soil?: SoilScreening | null
  siteLabel: string
  onOpenGeotech?: () => void
}) {
  if (!soil) {
    return (
      <article className="ts-glass ts-card-in p-3 w-full space-y-2 text-[#263238]">
        <p className="text-sm font-black">Soil screening</p>
        <p className="text-[11px] text-[#66727a] leading-snug">
          SoilGrids data was not returned for this site. Re-run Analyze or check network access to
          the soil API.
        </p>
        {onOpenGeotech && (
          <button
            type="button"
            onClick={onOpenGeotech}
            className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg border border-[#0f766e] text-[#0f766e] text-[11px] font-black hover:bg-[#ecfdf5]"
          >
            <Mountain className="h-3.5 w-3.5" />
            Open Geotech tab
          </button>
        )}
      </article>
    )
  }

  return (
    <article className="ts-glass ts-card-in p-3 w-full space-y-2 text-[#263238]">
      <p className="text-sm font-black">Soil screening (GIS)</p>
      <p className="text-[10px] text-[#66727a] truncate">{siteLabel}</p>
      <div className="rounded-lg border border-[#0f766e]/25 bg-[#ecfdf5] px-2.5 py-2 space-y-1">
        <p className="text-[12px] font-bold">
          {soil.textureClass} · SBC ~{soil.indicativeSbcTm2.low}–{soil.indicativeSbcTm2.high} T/m²
        </p>
        <p className="text-[11px]">
          CBR ~{soil.indicativeCbrPct.low}–{soil.indicativeCbrPct.high}% · confidence ~
          {soil.confidencePct}%
        </p>
        <p className="text-[10px] text-[#66727a] leading-snug">{soil.confidenceNote}</p>
      </div>
      <p className="text-[10px] text-[#66727a] leading-snug">
        Word investigation report, annexures, and screening HTML download are in the{' '}
        <strong className="text-[#0f766e]">Geotech</strong> tab — pre-built when analysis finishes.
      </p>
      {onOpenGeotech && (
        <button
          type="button"
          onClick={onOpenGeotech}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#0f766e] text-white text-[11px] font-black hover:bg-[#0d9488]"
        >
          <Mountain className="h-3.5 w-3.5" />
          Geotech · download reports
        </button>
      )}
    </article>
  )
}
