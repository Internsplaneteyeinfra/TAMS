import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Download, Eye, Loader2, Mountain } from 'lucide-react'

import type { SoilScreening } from '../soilScreening'
import {
  downloadSoilScreeningReport,
  previewSoilScreeningReport,
  type SoilReportOpts,
} from '../downloadSoilScreeningReport'

function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(digits)).toString()
}

/** Soil screening with full depth-wise parameter table (always visible). */
export default function SoilReportCard({
  soil,
  siteLabel,
  onOpenGeotech,
  soilReportOpts,
}: {
  soil?: SoilScreening | null
  siteLabel: string
  onOpenGeotech?: () => void
  soilReportOpts?: SoilReportOpts | null
}) {
  const [showAllLayers, setShowAllLayers] = useState(true)
  const [reportBusy, setReportBusy] = useState(false)

  const runReport = async (mode: 'preview' | 'download') => {
    if (!soilReportOpts?.soil) return
    setReportBusy(true)
    try {
      if (mode === 'preview') previewSoilScreeningReport(soilReportOpts)
      else downloadSoilScreeningReport(soilReportOpts)
    } finally {
      setReportBusy(false)
    }
  }

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

  const layers = soil.layers ?? []

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
        <p className="text-[9px] text-[#0f766e] font-mono">
          {soil.provider} · {layers.length} depth layer(s)
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase text-[#0f766e]">Soil parameters by depth</p>
        <button
          type="button"
          onClick={() => setShowAllLayers((v) => !v)}
          className="inline-flex items-center gap-1 text-[9px] font-bold text-[#66727a] hover:text-[#0f766e]"
        >
          {showAllLayers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showAllLayers ? 'Hide table' : 'Show all'}
        </button>
      </div>

      {showAllLayers && (
        <div className="overflow-x-auto max-h-64 overflow-y-auto rounded border border-slate-200">
          <table className="w-full min-w-[640px] text-[9px] border-collapse">
            <thead className="sticky top-0 bg-[#ecfdf5]">
              <tr className="text-left">
                <th className="p-1.5 border border-slate-200">Depth</th>
                <th className="p-1.5 border border-slate-200">Sand %</th>
                <th className="p-1.5 border border-slate-200">Silt %</th>
                <th className="p-1.5 border border-slate-200">Clay %</th>
                <th className="p-1.5 border border-slate-200">ρb g/cc</th>
                <th className="p-1.5 border border-slate-200">pH</th>
                <th className="p-1.5 border border-slate-200">CF %</th>
                <th className="p-1.5 border border-slate-200">SOC g/kg</th>
              </tr>
            </thead>
            <tbody>
              {layers.map((L) => (
                <tr key={L.depthLabel} className="odd:bg-white even:bg-slate-50/80">
                  <td className="p-1.5 border border-slate-200 font-bold whitespace-nowrap">
                    {L.depthLabel}
                  </td>
                  <td className="p-1.5 border border-slate-200 font-mono">{fmt(L.sandPct)}</td>
                  <td className="p-1.5 border border-slate-200 font-mono">{fmt(L.siltPct)}</td>
                  <td className="p-1.5 border border-slate-200 font-mono">{fmt(L.clayPct)}</td>
                  <td className="p-1.5 border border-slate-200 font-mono">{fmt(L.bulkDensityGcc, 2)}</td>
                  <td className="p-1.5 border border-slate-200 font-mono">{fmt(L.ph, 2)}</td>
                  <td className="p-1.5 border border-slate-200 font-mono">{fmt(L.coarseFragPct)}</td>
                  <td className="p-1.5 border border-slate-200 font-mono">
                    {fmt(L.organicCarbonGkg ?? null)}
                  </td>
                </tr>
              ))}
              {!layers.length && (
                <tr>
                  <td colSpan={8} className="p-2 text-center text-[#66727a]">
                    No depth layers returned
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={!soilReportOpts?.soil || reportBusy}
          onClick={() => void runReport('preview')}
          className="inline-flex items-center justify-center gap-1 h-8 rounded-lg border border-[#0f766e]/40 text-[#0f766e] text-[10px] font-black hover:bg-[#ecfdf5] disabled:opacity-50"
        >
          {reportBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
          Preview HTML
        </button>
        <button
          type="button"
          disabled={!soilReportOpts?.soil || reportBusy}
          onClick={() => void runReport('download')}
          className="inline-flex items-center justify-center gap-1 h-8 rounded-lg border border-[#0f766e]/40 text-[#0f766e] text-[10px] font-black hover:bg-[#ecfdf5] disabled:opacity-50"
        >
          {reportBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Download HTML
        </button>
      </div>

      <p className="text-[10px] text-[#66727a] leading-snug">
        Values are GIS-modelled (SoilGrids), not laboratory measurements. Full investigation Word
        report and annexures are in the <strong className="text-[#0f766e]">Geotech</strong> tab.
      </p>
      {onOpenGeotech && (
        <button
          type="button"
          onClick={onOpenGeotech}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#0f766e] text-white text-[11px] font-black hover:bg-[#0d9488]"
        >
          <Mountain className="h-3.5 w-3.5" />
          Geotech · full soil summary &amp; download
        </button>
      )}
    </article>
  )
}
