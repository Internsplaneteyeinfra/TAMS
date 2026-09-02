import React, { useState } from 'react'

import type { GeotechnicalIntelligence, GeoDataStatus, ProvenanceValue } from '../geotech'

function StatusBadge({ status }: { status: GeoDataStatus }) {
  const colors: Record<string, string> = {
    MEASURED: 'bg-emerald-100 text-emerald-800',
    CALCULATED: 'bg-violet-100 text-violet-800',
    MODEL_PREDICTED: 'bg-sky-100 text-sky-800',
    ENGINEERING_CORRELATED: 'bg-purple-100 text-purple-800',
    FIELD_TEST_REQUIRED: 'bg-rose-100 text-rose-800',
    INSUFFICIENT_DATA: 'bg-slate-100 text-slate-600',
    NO_DATA: 'bg-slate-100 text-slate-600',
  }
  const label =
    status === 'FIELD_TEST_REQUIRED'
      ? 'FIELD TEST REQUIRED'
      : status === 'INSUFFICIENT_DATA'
        ? 'INSUFFICIENT DATA'
        : status.replace(/_/g, ' ')
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
        colors[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </span>
  )
}

function fmt(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(d)).toString()
}

export default function SbcAnalysisPanel({
  geo,
}: {
  geo: GeotechnicalIntelligence
}) {
  const engine = geo.sbcEngineAnalysis
  const legacy = geo.sbcAnalysis
  const [bhIdx, setBhIdx] = useState(0)

  if (!engine?.byBorehole.length) {
    return (
      <section className="ts-glass rounded-lg p-2.5">
        <p className="text-[10px] font-black uppercase text-[#0f766e]">SBC Analysis (Phase E)</p>
        <p className="text-[11px] text-[#66727a] mt-1">{legacy.message}</p>
        <StatusBadge status="INSUFFICIENT_DATA" />
      </section>
    )
  }

  const bh = engine.byBorehole[bhIdx] ?? engine.byBorehole[0]

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {engine.byBorehole.map((b, i) => (
          <button
            key={b.boreholeId}
            type="button"
            onClick={() => setBhIdx(i)}
            className={`px-2 py-1 rounded text-[9px] font-black ${
              i === bhIdx ? 'bg-[#0f766e] text-white' : 'bg-white/60 border border-slate-200'
            }`}
          >
            {b.boreholeId}
          </button>
        ))}
      </div>

      <div className="ts-glass rounded-lg p-2.5 space-y-2 border border-[#0f766e]/25">
        <p className="text-[10px] font-black uppercase text-[#0f766e]">SBC Analysis — {bh.boreholeId}</p>
        <p className="text-[9px] text-[#66727a]">
          Proposed GIS Investigation Point · {bh.latitude.toFixed(5)}, {bh.longitude.toFixed(5)}
        </p>

        <div className="grid grid-cols-2 gap-2 text-[9px]">
          <div>
            <p className="text-[#66727a] font-bold uppercase">Recommended foundation depth</p>
            <p className="text-[13px] font-mono font-black">{fmt(bh.recommendedFoundationDepthM)} m</p>
          </div>
          <div>
            <p className="text-[#66727a] font-bold uppercase">Net safe bearing capacity</p>
            <p className="text-[13px] font-mono font-black">
              {bh.netSafeBearingCapacityTm2.value != null
                ? `${bh.netSafeBearingCapacityTm2.value} T/m²`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-[#66727a] font-bold uppercase">Governing condition</p>
            <p className="text-[11px] font-bold">{bh.governingCondition}</p>
          </div>
          <div>
            <p className="text-[#66727a] font-bold uppercase">Confidence</p>
            <p className="text-[11px] font-mono">{bh.confidencePct ?? '—'}%</p>
          </div>
        </div>
        <p className="text-[9px] text-[#66727a]">{bh.dataBasisSummary}</p>
        <p className="text-[10px]">{bh.message}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[8px] border-collapse">
          <thead>
            <tr className="bg-[#ecfdf5] text-left">
              <th className="p-1 border border-slate-200">Depth</th>
              <th className="p-1 border border-slate-200">Net SBC</th>
              <th className="p-1 border border-slate-200">Source</th>
              <th className="p-1 border border-slate-200">Basis</th>
              <th className="p-1 border border-slate-200">Gov.</th>
              <th className="p-1 border border-slate-200">Conf.</th>
            </tr>
          </thead>
          <tbody>
            {bh.byDepth.map((row) => (
              <tr
                key={row.depthM}
                className={
                  row.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION' ? 'bg-amber-50/80' : undefined
                }
              >
                <td className="p-1 border border-slate-200 font-bold">{row.depthM} m</td>
                <td className="p-1 border border-slate-200 font-mono">
                  {row.netSafeBearingCapacityTm2.value != null
                    ? `${row.netSafeBearingCapacityTm2.value}`
                    : '—'}
                </td>
                <td className="p-1 border border-slate-200">{row.sourceTypeLabel}</td>
                <td className="p-1 border border-slate-200 text-[7px]">
                  {row.dataBasis === 'PRIMARY_GEOSPATIAL_MODEL'
                    ? '0–2 m GIS model'
                    : '2–4 m extrapolation'}
                </td>
                <td className="p-1 border border-slate-200">{row.governingCondition}</td>
                <td className="p-1 border border-slate-200">{row.confidencePct ?? '—'}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[8px] text-amber-900">
        0.0–2.0 m = PRIMARY GEOSPATIAL SOIL MODEL · 2.0–4.0 m = ENGINEERING DEPTH EXTRAPOLATION (highlighted)
      </p>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Design Parameters
        </summary>
        <div className="mt-1 space-y-0.5 text-[9px]">
          {Object.entries(bh.designParameters).map(([k, p]) => (
            <p key={k}>
              <span className="font-bold">{k}:</span> {String((p as { value: unknown }).value ?? '—')}{' '}
              <StatusBadge status={(p as { source: GeoDataStatus }).source} />
            </p>
          ))}
        </div>
      </details>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Bearing Capacity Calculation
        </summary>
        <ol className="mt-1 list-decimal pl-4 text-[8px] text-[#66727a] space-y-0.5">
          {(bh.byDepth.find((d) => d.depthM === bh.recommendedFoundationDepthM)?.steps ?? []).map(
            (s) => (
              <li key={s.step}>
                <span className="font-bold text-[#263238]">{s.name}</span>: {s.formula}
                {s.result != null ? ` → ${s.result} ${s.unit}` : ''}
              </li>
            )
          )}
        </ol>
      </details>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Depth Correction
        </summary>
        <table className="w-full text-[8px] border-collapse mt-1">
          <thead>
            <tr className="bg-[#ecfdf5]">
              <th className="p-1 border">Depth</th>
              <th className="p-1 border">Base SBC</th>
              <th className="p-1 border">Depth Factor</th>
              <th className="p-1 border">Corrected</th>
            </tr>
          </thead>
          <tbody>
            {bh.byDepth.map((d) => (
              <tr key={d.depthM}>
                <td className="p-1 border">{d.depthM} m</td>
                <td className="p-1 border font-mono">{fmt(d.depthCorrection.baseSbcTm2)}</td>
                <td className="p-1 border font-mono">{fmt(d.depthCorrection.depthFactor, 3)}</td>
                <td className="p-1 border font-mono">{fmt(d.depthCorrection.correctedSbcTm2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Size Correction (1.0 m × 1.0 m reference)
        </summary>
        <p className="text-[9px] mt-1">{bh.sizeCorrection.explanation}</p>
        <p className="text-[9px] font-mono">
          Factor: {bh.sizeCorrection.sizeCorrectionFactor ?? '—'} · Corrected:{' '}
          {bh.sizeCorrection.correctedSbcTm2 ?? '—'} T/m²
        </p>
      </details>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Validation & Provenance
        </summary>
        <p className="text-[9px] mt-1">{bh.validation.message}</p>
        <p className="text-[9px] text-[#66727a]">{bh.validation.provenanceSummary}</p>
        {bh.validation.missingParameters.length > 0 && (
          <p className="text-[9px] text-rose-800">
            Missing: {bh.validation.missingParameters.join(', ')}
          </p>
        )}
      </details>
    </section>
  )
}
