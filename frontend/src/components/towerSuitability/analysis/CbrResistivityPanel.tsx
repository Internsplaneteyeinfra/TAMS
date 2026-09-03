import React, { useState } from 'react'

import type { GeotechnicalIntelligence, GeoDataStatus } from '../geotech'

function StatusBadge({ status }: { status: GeoDataStatus }) {
  const colors: Record<string, string> = {
    MEASURED: 'bg-emerald-100 text-emerald-800',
    ENGINEERING_CORRELATED: 'bg-purple-100 text-purple-800',
    MODEL_PREDICTED: 'bg-sky-100 text-sky-800',
    FIELD_TEST_REQUIRED: 'bg-rose-100 text-rose-800',
    NO_DATA: 'bg-slate-100 text-slate-600',
  }
  const label =
    status === 'FIELD_TEST_REQUIRED'
      ? 'FIELD TEST REQUIRED'
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

function fmt(v: number | null | undefined, d = 0): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(d)).toString()
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-2 py-1 text-[9px] font-black uppercase bg-slate-50"
      >
        {open ? '▼' : '▶'} {title}
      </button>
      {open && <div className="p-2 space-y-1">{children}</div>}
    </div>
  )
}

export default function CbrResistivityPanel({
  geo,
  mode = 'both',
}: {
  geo: GeotechnicalIntelligence
  mode?: 'both' | 'cbr' | 'resistivity'
}) {
  const cbr = geo.cbrEngineAnalysis
  const res = geo.resistivityEngineAnalysis
  const showCbr = mode === 'both' || mode === 'cbr'
  const showRes = mode === 'both' || mode === 'resistivity'

  return (
    <section className="space-y-3">
      {showCbr && (
      <div className="ts-glass rounded-lg p-2.5 space-y-2 border border-[#0f766e]/25">
        <p className="text-[10px] font-black uppercase text-[#0f766e]">
          CBR — Transmission Tower Access & Construction Road Assessment
        </p>
        <p className="text-[9px] text-[#66727a]">
          Geospatial engineering CBR estimate — not laboratory soaked CBR.
        </p>

        {cbr ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div>
                <p className="text-[#66727a] font-bold uppercase">Recommended design CBR</p>
                <p className="text-[14px] font-mono font-black">
                  {cbr.recommendedDesignCbr.value != null
                    ? `${cbr.recommendedDesignCbr.value} %`
                    : '—'}
                </p>
                <StatusBadge status={cbr.recommendedDesignCbr.status} />
              </div>
              <div>
                <p className="text-[#66727a] font-bold uppercase">Confidence</p>
                <p className="text-[13px] font-mono">
                  {cbr.byDepth[0]?.confidencePct ?? '—'}%
                </p>
                <p className="text-[8px] text-[#66727a] mt-0.5">Basis: Engineering Correlation</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[8px] border-collapse">
                <thead>
                  <tr className="bg-[#ecfdf5] text-left">
                    <th className="p-1 border border-slate-200">Layer</th>
                    <th className="p-1 border border-slate-200">Soil class</th>
                    <th className="p-1 border border-slate-200">PI</th>
                    <th className="p-1 border border-slate-200">CBR</th>
                    <th className="p-1 border border-slate-200">Method</th>
                    <th className="p-1 border border-slate-200">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {cbr.byDepth.map((row) => {
                    const range = row.cbrRangePct.value
                    const cbrDisplay =
                      row.correlatedCbrPct.value != null
                        ? `${row.correlatedCbrPct.value}%`
                        : range && typeof range === 'object'
                          ? `${range.low}–${range.high}%`
                          : '—'
                    return (
                      <tr key={row.reportDepth}>
                        <td className="p-1 border border-slate-200 font-mono">{row.reportDepthLabel}</td>
                        <td className="p-1 border border-slate-200">{row.soilClassification ?? '—'}</td>
                        <td className="p-1 border border-slate-200 font-mono text-right">
                          {fmt(row.pi)}
                        </td>
                        <td className="p-1 border border-slate-200 font-mono text-right">{cbrDisplay}</td>
                        <td className="p-1 border border-slate-200 text-[7px]">
                          {row.correlatedCbrPct.status === 'FIELD_TEST_REQUIRED'
                            ? 'FIELD TEST REQUIRED'
                            : 'Eng. correlation'}
                        </td>
                        <td className="p-1 border border-slate-200 font-mono text-right">
                          {row.confidencePct ?? '—'}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Collapsible title="Input Parameters">
              {cbr.byDepth[0]?.steps
                .filter((s) => s.step <= 3)
                .map((s) => (
                  <p key={s.step} className="text-[8px] font-mono">
                    {s.name}: {JSON.stringify(s.inputs)}
                  </p>
                ))}
            </Collapsible>
            <Collapsible title="Correlation / Method">
              <p className="text-[8px]">{cbr.byDepth[0]?.method}</p>
              <p className="text-[8px] text-[#66727a]">{cbr.byDepth[0]?.correlationReference}</p>
            </Collapsible>
            <Collapsible title="Step-by-Step Calculation">
              {cbr.byDepth[0]?.steps.map((s) => (
                <p key={s.step} className="text-[8px] font-mono">
                  {s.step}. {s.name}: {s.result ?? '—'} {s.unit}
                </p>
              ))}
            </Collapsible>
            <Collapsible title="Validation">
              {cbr.validationNotes.map((n) => (
                <p key={n} className="text-[8px] text-[#66727a]">
                  • {n}
                </p>
              ))}
            </Collapsible>
            <Collapsible title="Provenance">
              <p className="text-[8px]">Status: {cbr.calculationStatus}</p>
              <p className="text-[8px]">{cbr.message}</p>
            </Collapsible>
          </>
        ) : (
          <p className="text-[10px] text-rose-700">CBR engine analysis unavailable.</p>
        )}
      </div>
      )}

      {showRes && (
      <div className="ts-glass rounded-lg p-2.5 space-y-2 border border-indigo-200/70">
        <p className="text-[10px] font-black uppercase text-indigo-900">
          Estimated Geospatial Soil Electrical Resistivity Assessment
        </p>
        <p className="text-[9px] text-[#66727a]">
          Modelled estimate — not an Earth Resistivity Test Result unless field data uploaded.
        </p>

        {res ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div>
                <p className="text-[#66727a] font-bold uppercase">Estimated resistivity</p>
                <p className="text-[14px] font-mono font-black">
                  {res.siteEstimateRangeOhmM.value &&
                  typeof res.siteEstimateRangeOhmM.value === 'object'
                    ? `${res.siteEstimateRangeOhmM.value.low}–${res.siteEstimateRangeOhmM.value.high} Ω·m`
                    : res.siteEstimateOhmM.value != null
                      ? `≈ ${res.siteEstimateOhmM.value} Ω·m`
                      : '—'}
                </p>
              </div>
              <div>
                <p className="text-[#66727a] font-bold uppercase">Status</p>
                <p className="text-[11px] font-bold">MODELLED ESTIMATE</p>
                <p className="text-[8px] font-mono">Confidence {res.confidencePct ?? '—'}%</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase">Depth profile</p>
              {res.byDepth.map((d) => (
                <div
                  key={d.depthLabel}
                  className="flex justify-between text-[8px] border-b border-slate-100 py-0.5"
                >
                  <span className="font-mono">{d.depthLabel}</span>
                  <span className="font-mono">
                    {d.estimatedResistivityOhmM.value != null
                      ? `≈ ${d.estimatedResistivityOhmM.value} Ω·m`
                      : 'FIELD TEST REQUIRED'}
                  </span>
                  <span className="text-[7px] text-[#66727a]">{d.basis.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>

            <Collapsible title="Input Data Sources">
              <p className="text-[8px]">Shared Phase C grain size fractions (sand, silt, clay).</p>
              <p className="text-[8px]">
                Measured:{' '}
                {res.measured.value != null
                  ? `${res.measured.value} Ω·m (${res.measured.status})`
                  : 'No field Wenner data'}
              </p>
            </Collapsible>
            <Collapsible title="Resistivity Model">
              <p className="text-[8px]">{res.byDepth[0]?.steps[1]?.formula}</p>
            </Collapsible>
            <Collapsible title="Calculation / Estimation Logic">
              {res.byDepth[0]?.steps.map((s) => (
                <p key={s.step} className="text-[8px] font-mono">
                  {s.step}. {s.name}: {s.result ?? '—'}
                </p>
              ))}
            </Collapsible>
            <Collapsible title="Confidence">
              <p className="text-[8px]">Model confidence: {res.confidencePct ?? '—'}%</p>
              {res.validationNotes.map((n) => (
                <p key={n} className="text-[8px] text-[#66727a]">
                  • {n}
                </p>
              ))}
            </Collapsible>
            <Collapsible title="Field Verification Requirements">
              {res.fieldVerificationRequired.map((r) => (
                <p key={r} className="text-[8px] text-rose-800">
                  • {r}
                </p>
              ))}
            </Collapsible>
            {res.groundingRecommendation && (
              <div className="rounded border border-indigo-200 bg-indigo-50/60 p-2 mt-2">
                <p className="text-[9px] font-black uppercase text-indigo-900">Grounding recommendation</p>
                <p className="text-[10px] font-bold">{res.groundingRecommendation.label}</p>
                <p className="text-[9px]">{res.groundingRecommendation.suitability}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-[10px] text-rose-700">Resistivity engine analysis unavailable.</p>
        )}
      </div>
      )}
    </section>
  )
}
