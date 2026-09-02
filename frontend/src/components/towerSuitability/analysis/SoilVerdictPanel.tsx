import React, { useState } from 'react'

import type { GeotechnicalIntelligence } from '../geotech'
import { formatVerdictLabel } from '../geotech/verdict'

const COLOR_STYLES: Record<string, string> = {
  GREEN: 'border-emerald-300 bg-emerald-50/80',
  YELLOW: 'border-amber-300 bg-amber-50/80',
  ORANGE: 'border-orange-300 bg-orange-50/80',
  RED: 'border-rose-300 bg-rose-50/80',
  GREY: 'border-slate-300 bg-slate-50/80',
}

const CONF_STYLES: Record<string, string> = {
  HIGH: 'text-emerald-800',
  MODERATE: 'text-sky-800',
  LOW: 'text-amber-900',
  VERY_LOW: 'text-rose-800',
}

function Collapsible({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
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

function DimensionCard({
  label,
  verdict,
}: {
  label: string
  verdict: NonNullable<GeotechnicalIntelligence['soilVerdictAnalysis']>['dimensions']['foundation']
}) {
  return (
    <div className={`rounded-lg border p-2 ${COLOR_STYLES[verdict.color] ?? COLOR_STYLES.GREY}`}>
      <p className="text-[9px] font-black uppercase text-[#66727a]">{label}</p>
      <p className="text-[11px] font-black">{formatVerdictLabel(verdict.status)}</p>
      <p className={`text-[9px] font-bold ${CONF_STYLES[verdict.confidence]}`}>
        Confidence: {verdict.confidence}
      </p>
      <p className="text-[8px] text-[#66727a] mt-0.5">{verdict.requiredNextAction}</p>
    </div>
  )
}

export default function SoilVerdictPanel({ geo }: { geo: GeotechnicalIntelligence }) {
  const v = geo.soilVerdictAnalysis
  const [traceOpen, setTraceOpen] = useState(false)

  if (!v) {
    return (
      <section className="ts-glass rounded-lg p-2.5">
        <p className="text-[10px] font-black uppercase text-[#0f766e]">Soil Verdict (Phase H)</p>
        <p className="text-[11px] text-[#66727a] mt-1">Verdict analysis unavailable.</p>
      </section>
    )
  }

  const { overall, dimensions } = v

  return (
    <section className="space-y-3">
      {/* Overall status */}
      <div
        className={`ts-glass rounded-lg p-3 border-2 ${COLOR_STYLES[overall.color] ?? COLOR_STYLES.GREY}`}
      >
        <p className="text-[10px] font-black uppercase text-[#66727a]">Overall Soil Verdict</p>
        <p className="text-[16px] font-black mt-1">{formatVerdictLabel(overall.status)}</p>
        <div className="flex flex-wrap gap-3 mt-2 text-[9px]">
          <span className={`font-bold ${CONF_STYLES[overall.confidence]}`}>
            Confidence: {overall.confidence}
          </span>
          <span className="font-bold text-[#66727a]">
            Investigation: {overall.investigationUrgency.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-[9px] text-[#263238] mt-2 leading-snug">{overall.explanation}</p>
        <p className="text-[8px] text-amber-900 mt-1 italic">
          Preliminary verdict — not final design approval. Evidence provenance governs all conclusions.
        </p>
      </div>

      {/* What we know / don't know */}
      <div className="grid grid-cols-2 gap-2">
        <div className="ts-glass rounded-lg p-2 border border-emerald-200/60">
          <p className="text-[9px] font-black uppercase text-emerald-900">What we know</p>
          {v.whatWeKnow.measured.length > 0 && (
            <div className="mt-1">
              <p className="text-[8px] font-bold text-emerald-800">Measured</p>
              {v.whatWeKnow.measured.map((x) => (
                <p key={x} className="text-[8px] font-mono">
                  {x}
                </p>
              ))}
            </div>
          )}
          {v.whatWeKnow.correlated.length > 0 && (
            <div className="mt-1">
              <p className="text-[8px] font-bold text-purple-800">Correlated</p>
              {v.whatWeKnow.correlated.slice(0, 4).map((x) => (
                <p key={x} className="text-[8px] font-mono">
                  {x}
                </p>
              ))}
            </div>
          )}
          {v.whatWeKnow.modelled.length > 0 && (
            <div className="mt-1">
              <p className="text-[8px] font-bold text-sky-800">Modelled</p>
              {v.whatWeKnow.modelled.slice(0, 4).map((x) => (
                <p key={x} className="text-[8px] font-mono">
                  {x}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="ts-glass rounded-lg p-2 border border-rose-200/60">
          <p className="text-[9px] font-black uppercase text-rose-900">What we do not know</p>
          <ul className="mt-1 space-y-0.5">
            {v.whatWeDoNotKnow.slice(0, 8).map((x) => (
              <li key={x} className="text-[8px] text-rose-900">
                • {x}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Engineering assessments */}
      <div>
        <p className="text-[10px] font-black uppercase mb-1">Engineering assessments</p>
        <div className="grid grid-cols-2 gap-1.5">
          <DimensionCard label="Foundation" verdict={dimensions.foundation} />
          <DimensionCard label="Pile" verdict={dimensions.pile} />
          <DimensionCard label="Access road / CBR" verdict={dimensions.accessRoad} />
          <DimensionCard label="Earthing" verdict={dimensions.earthing} />
          <DimensionCard label="Groundwater" verdict={dimensions.groundwater} />
          <DimensionCard label="Soil data confidence" verdict={dimensions.soilDataConfidence} />
        </div>
      </div>

      {/* Investigation priorities */}
      <div className="ts-glass rounded-lg p-2.5">
        <p className="text-[10px] font-black uppercase">Investigation required</p>
        {v.investigationPriorities.length === 0 ? (
          <p className="text-[9px] text-[#66727a]">No immediate investigation indicated.</p>
        ) : (
          <div className="space-y-1.5 mt-1">
            {v.investigationPriorities.map((p) => (
              <div key={p.priority} className="border border-slate-200 rounded p-1.5 text-[8px]">
                <p className="font-black">
                  PRIORITY {p.priority} — {p.investigationType}{' '}
                  <span
                    className={
                      p.mandate === 'MANDATORY' ? 'text-rose-700' : 'text-amber-800'
                    }
                  >
                    ({p.mandate})
                  </span>
                </p>
                <p className="text-[#66727a]">{p.reason}</p>
                <p className="font-mono text-[7px] mt-0.5">Affects: {p.affectedDecision}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conflicts */}
      {v.conflicts.length > 0 && (
        <div className="ts-glass rounded-lg p-2.5 border border-orange-300">
          <p className="text-[10px] font-black uppercase text-orange-900">Conflicts detected</p>
          {v.conflicts.map((c) => (
            <div key={c.id} className="mt-1 text-[8px] border-t border-orange-200 pt-1">
              <p className="font-black text-orange-900">
                [{c.severity}] {c.affectedModules.join(', ')}
              </p>
              <p>{c.explanation}</p>
              <p className="text-[#66727a] italic">Resolution: {c.requiredResolution}</p>
            </div>
          ))}
        </div>
      )}

      {/* Design stage decisions */}
      <div className="ts-glass rounded-lg p-2.5">
        <p className="text-[10px] font-black uppercase">Next decision — design stage</p>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {v.designStageDecisions.map((d) => (
            <div key={d.stage} className="text-[8px] border border-slate-200 rounded p-1">
              <p className="font-black">{d.stage.replace(/_/g, ' ')}</p>
              <p
                className={`font-bold ${
                  d.decision === 'STOP' || d.decision === 'NOT_ASSESSABLE'
                    ? 'text-rose-700'
                    : d.decision === 'CONDITIONAL_GO'
                      ? 'text-amber-800'
                      : 'text-emerald-800'
                }`}
              >
                {d.decision.replace(/_/g, ' ')}
              </p>
              <p className="text-[#66727a]">{d.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      <Collapsible title="View evidence trace">
        <button
          type="button"
          onClick={() => setTraceOpen(!traceOpen)}
          className="text-[8px] font-bold text-[#0f766e] mb-1"
        >
          {traceOpen ? 'Hide' : 'Show'} full evidence list
        </button>
        {traceOpen && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...v.evidenceSummary.measured, ...v.evidenceSummary.correlated, ...v.evidenceSummary.modelled].map(
              (e, i) => (
                <p key={`${e.phase}-${e.parameter}-${i}`} className="text-[7px] font-mono">
                  {e.phase} · {e.parameter} = {String(e.value)} [{e.provenance}] → {e.decisionImpact}
                </p>
              )
            )}
          </div>
        )}
        {v.validationGates.filter((g) => !g.passed).map((g) => (
          <p key={g.parameter} className="text-[8px] text-rose-700">
            GATE FAIL: {g.module} — {g.message}
          </p>
        ))}
      </Collapsible>
    </section>
  )
}
