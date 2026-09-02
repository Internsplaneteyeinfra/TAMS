import React, { useState } from 'react'

import type { GeotechnicalIntelligence } from '../geotech'

function fmt(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(d)).toString()
}

export default function PileAnalysisPanel({ geo }: { geo: GeotechnicalIntelligence }) {
  const engine = geo.pileEngineAnalysis
  const [bhIdx, setBhIdx] = useState(0)
  const [diaMm, setDiaMm] = useState<450 | 600>(450)
  const [depthM, setDepthM] = useState<1.0 | 1.5 | 2.0>(1.5)

  if (!engine?.byBorehole.length) {
    return (
      <section className="ts-glass rounded-lg p-2.5">
        <p className="text-[10px] font-black uppercase text-[#0f766e]">Pile Analysis (Phase F)</p>
        <p className="text-[11px] text-[#66727a] mt-1">{geo.pileAnalysis.message}</p>
      </section>
    )
  }

  const bh = engine.byBorehole[bhIdx] ?? engine.byBorehole[0]
  const cell =
    bh.byDiameter[`${diaMm}mm`][`${depthM.toFixed(1)}m` as '1.0m' | '1.5m' | '2.0m']

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

      <div className="flex flex-wrap gap-2 text-[9px]">
        <label className="font-bold">
          Diameter:{' '}
          <select
            value={diaMm}
            onChange={(e) => setDiaMm(Number(e.target.value) as 450 | 600)}
            className="ml-1 rounded border px-1 py-0.5"
          >
            <option value={450}>450 mm</option>
            <option value={600}>600 mm</option>
          </select>
        </label>
        <label className="font-bold">
          Depth:{' '}
          <select
            value={depthM}
            onChange={(e) => setDepthM(Number(e.target.value) as 1.0 | 1.5 | 2.0)}
            className="ml-1 rounded border px-1 py-0.5"
          >
            <option value={1.0}>1.0 m</option>
            <option value={1.5}>1.5 m</option>
            <option value={2.0}>2.0 m</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Safe Vertical', cell.verticalCapacity.safe_T.value, 'T'],
          ['Safe Uplift', cell.upliftCapacity.safe_T.value, 'T'],
          ['Safe Lateral', cell.lateralCapacity.safe_T.value, 'T'],
        ].map(([label, val, unit]) => (
          <div key={label as string} className="ts-glass rounded-lg p-2 border border-[#0f766e]/20">
            <p className="text-[8px] font-black uppercase text-[#66727a]">{label}</p>
            <p className="text-[14px] font-mono font-black">
              {val != null ? `${val} ${unit}` : '—'}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-[#66727a]">
        Soil condition: <span className="font-bold">{cell.soilCondition}</span> · Confidence:{' '}
        {cell.confidencePct ?? '—'}% · {bh.message}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[8px] border-collapse">
          <thead>
            <tr className="bg-[#ecfdf5] text-left">
              <th className="p-1 border">Diameter</th>
              <th className="p-1 border">Depth</th>
              <th className="p-1 border">Vertical</th>
              <th className="p-1 border">Uplift</th>
              <th className="p-1 border">Lateral</th>
              <th className="p-1 border">Conf.</th>
              <th className="p-1 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {bh.matrix.map((c) => (
              <tr key={`${c.diameterMm}-${c.depthM}`}>
                <td className="p-1 border font-bold">{c.diameterMm} mm</td>
                <td className="p-1 border">{c.depthM} m</td>
                <td className="p-1 border font-mono">{fmt(c.verticalCapacity.safe_T.value)}</td>
                <td className="p-1 border font-mono">{fmt(c.upliftCapacity.safe_T.value)}</td>
                <td className="p-1 border font-mono">—</td>
                <td className="p-1 border">{c.confidencePct ?? '—'}%</td>
                <td className="p-1 border text-[7px]">{c.calculationStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Layer Profile
        </summary>
        <table className="w-full text-[7px] border-collapse mt-1">
          <thead>
            <tr className="bg-[#ecfdf5]">
              <th className="p-1 border">Layer</th>
              <th className="p-1 border">Type</th>
              <th className="p-1 border">c</th>
              <th className="p-1 border">φ</th>
              <th className="p-1 border">PD</th>
              <th className="p-1 border">Qs contrib</th>
            </tr>
          </thead>
          <tbody>
            {cell.layerCalculations.map((l) => (
              <tr key={`${l.depthFromM}-${l.depthToM}`}>
                <td className="p-1 border">
                  {l.depthFromM}–{l.depthToM} m
                </td>
                <td className="p-1 border">{l.soilCondition}</td>
                <td className="p-1 border">{fmt(l.cTm2.value)}</td>
                <td className="p-1 border">{fmt(l.phiDeg.value)}</td>
                <td className="p-1 border">{fmt(l.overburdenMidTm2.value)}</td>
                <td className="p-1 border">{fmt(l.shaftFrictionContributionT)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Vertical / Uplift Calculation Steps
        </summary>
        <ol className="list-decimal pl-4 text-[8px] text-[#66727a] space-y-0.5 mt-1">
          {cell.steps.map((s) => (
            <li key={s.step}>
              <span className="font-bold text-[#263238]">{s.name}</span>: {s.formula}
              {s.result != null ? ` → ${s.result} ${s.unit}` : ''}
            </li>
          ))}
        </ol>
      </details>

      <details className="ts-glass rounded-lg p-2">
        <summary className="text-[10px] font-black cursor-pointer text-[#17879a]">
          ▼ Validation & Provenance
        </summary>
        <p className="text-[9px] mt-1">{cell.validation.message}</p>
        <p className="text-[9px] text-[#66727a]">{cell.validation.provenanceSummary}</p>
        <p className="text-[9px] text-amber-900">{cell.lateralCapacity.lateralMethodNote}</p>
      </details>
    </section>
  )
}
