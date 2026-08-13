import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Radio, ShieldAlert } from 'lucide-react'

import type { SiteSignals } from './scoring'
import {
  kindBadge,
  MAP_VISUAL_SOURCES,
  NOT_IN_THIS_BUILD,
  PLANNING_ONLY_SOURCES,
  SUITABILITY_LIVE_SOURCES,
} from './liveDataCatalog'

function LiveStatusDot({ ok }: { ok: boolean | undefined }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400/80'}`}
      title={ok ? 'Fetched successfully' : 'Missing or API failed'}
    />
  )
}

export default function LiveDataProvenancePanel({
  signals,
  hasTowerPlan,
}: {
  signals?: SiteSignals | null
  hasTowerPlan?: boolean
}) {
  const [open, setOpen] = useState(true)
  const liveOk = signals?.liveOk

  const liveStatus: Record<string, boolean | undefined> = {
    dem: liveOk?.dem,
    road: liveOk?.road,
    water: liveOk?.water && !signals?.usedFallback?.water,
    settlement: liveOk?.settlement && !signals?.usedFallback?.settlement,
    grid: liveOk?.grid && !signals?.usedFallback?.grid,
    wind: liveOk?.wind,
    landcover: liveOk?.landcover,
    power_supply: signals?.nearbyPower?.liveOk,
    location: true,
  }

  const liveCount = Object.values(liveStatus).filter(Boolean).length
  const totalLive = SUITABILITY_LIVE_SOURCES.length

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-900/60"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-200">
          <Radio className="w-3.5 h-3.5" />
          What is live vs planning?
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
          {signals ? `${liveCount}/${totalLive} live signals OK` : 'Before analyze'}
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
            Suitability score uses <strong className="text-emerald-300">live open APIs</strong> at your
            coordinates. Tower/voltage spacing uses <strong className="text-amber-300">CEA/utility planning
            bands</strong> — not live satellite classification. We do not invent values when APIs fail.
          </p>

          <div>
            <p className="text-[10px] font-black uppercase text-emerald-400/90 mb-1.5">
              Live at analyze time
            </p>
            <ul className="space-y-1.5">
              {SUITABILITY_LIVE_SOURCES.map((src) => {
                const badge = kindBadge(src.kind)
                const ok = signals ? liveStatus[src.id] : undefined
                return (
                  <li
                    key={src.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2 text-[11px]"
                  >
                    <div className="flex items-start gap-2">
                      {signals && <LiveStatusDot ok={ok} />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-100">{src.label}</span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badge.className}`}
                          >
                            {badge.text}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-0.5">{src.provider}</p>
                        <p className="text-slate-400 mt-0.5">{src.whatYouSee}</p>
                        {signals?.usedFallback &&
                          ((src.id === 'water' && signals.usedFallback.water) ||
                            (src.id === 'settlement' && signals.usedFallback.settlement) ||
                            (src.id === 'grid' && signals.usedFallback.grid)) && (
                            <p className="text-amber-400/90 mt-0.5 font-semibold">
                              Overpass failed — weaker Photon fallback used (lower confidence).
                            </p>
                          )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase text-cyan-400/90 mb-1.5">Map (visual)</p>
            {MAP_VISUAL_SOURCES.map((src) => (
              <p key={src.id} className="text-[11px] text-slate-400 leading-snug">
                <span className="text-slate-200 font-semibold">{src.label}:</span> {src.whatYouSee}{' '}
                {src.limits}
              </p>
            ))}
          </div>

          {hasTowerPlan && (
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400/90 mb-1.5">
                Planning reference (not live satellite)
              </p>
              {PLANNING_ONLY_SOURCES.map((src) => (
                <p key={src.id} className="text-[11px] text-slate-400 leading-snug mb-1">
                  <span className="text-amber-200 font-semibold">{src.label}:</span> {src.whatYouSee}
                </p>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-2.5 py-2">
            <p className="text-[10px] font-black uppercase text-slate-500 mb-1 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              Not available live in this build
            </p>
            <ul className="text-[10px] text-slate-500 space-y-0.5">
              {NOT_IN_THIS_BUILD.map((s) => (
                <li key={s.id}>· {s.label} — {s.limits}</li>
              ))}
            </ul>
          </div>

          {signals?.fetchedAt && (
            <p className="text-[10px] text-slate-500 tabular-nums">
              Last live fetch: {new Date(signals.fetchedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
