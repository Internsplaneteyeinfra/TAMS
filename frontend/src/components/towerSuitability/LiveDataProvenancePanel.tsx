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
import { liveStatusBySource, liveStatusCounts, type SignalFetchStatus } from './liveSignalStatus'

function LiveStatusDot({ ok }: { ok: boolean | undefined }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400/80'}`}
      title={ok ? 'Fetched successfully' : 'Missing or API failed'}
    />
  )
}

function statusLabel(status: SignalFetchStatus): { text: string; className: string; dot: string } {
  if (status === 'live') {
    return { text: 'LIVE', className: 'text-[#27856b] bg-[#dff0e8]', dot: 'bg-[#27856b]' }
  }
  if (status === 'fallback') {
    return { text: 'FALLBACK', className: 'text-[#b97816] bg-[#f6ead1]', dot: 'bg-[#b97816]' }
  }
  if (status === 'failed') {
    return { text: 'FAILED', className: 'text-[#c75b50] bg-[#f8e4e1]', dot: 'bg-[#c75b50]' }
  }
  return { text: 'N/A', className: 'text-[#66727a] bg-[#d9ded4]', dot: 'bg-[#66727a]' }
}

export default function LiveDataProvenancePanel({
  signals,
  hasTowerPlan,
  embedded = false,
}: {
  signals?: SiteSignals | null
  hasTowerPlan?: boolean
  embedded?: boolean
}) {
  const [open, setOpen] = useState(true)
  const liveOk = signals?.liveOk
  const byId = liveStatusBySource(signals)
  const counts = liveStatusCounts(signals)

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
    geotech: liveOk?.geotech || liveOk?.soilScreening,
  }

  const liveCount = Object.values(liveStatus).filter(Boolean).length
  const totalLive = SUITABILITY_LIVE_SOURCES.length

  const body = (
    <div className={embedded ? 'space-y-3' : 'px-3.5 pb-3.5 space-y-3 border-t border-slate-800'}>
      {!embedded && (
        <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
          Suitability score uses <strong className="text-emerald-300">live open APIs</strong> at your
          coordinates. Tower/voltage spacing uses <strong className="text-amber-300">CEA/utility planning
          bands</strong> — not live satellite classification. We do not invent values when APIs fail.
        </p>
      )}

      {embedded && signals && (
        <p className="text-[12px] font-bold text-[#263238]">
          {counts.live} of {counts.total} signals live
        </p>
      )}

      <div>
        {!embedded && (
          <p className="text-[10px] font-black uppercase text-emerald-400/90 mb-1.5">
            Live at analyze time
          </p>
        )}
        <ul className="space-y-1.5">
          {SUITABILITY_LIVE_SOURCES.map((src) => {
            const badge = kindBadge(src.kind)
            const ok = signals ? liveStatus[src.id] : undefined
            const status = byId[src.id] ?? 'na'
            const st = statusLabel(status)
            return (
              <li
                key={src.id}
                className={
                  embedded
                    ? 'rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/45 px-2.5 py-2 text-[11px]'
                    : 'rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2 text-[11px]'
                }
              >
                <div className="flex items-start gap-2">
                  {signals && !embedded && <LiveStatusDot ok={ok} />}
                  {embedded && <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${st.dot}`} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={embedded ? 'font-bold text-[#263238]' : 'font-bold text-slate-100'}>
                        {src.label}
                      </span>
                      {embedded ? (
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${st.className}`}>
                          {st.text}
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badge.className}`}
                        >
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <p className={embedded ? 'text-[#66727a] mt-0.5' : 'text-slate-500 mt-0.5'}>{src.provider}</p>
                    {!embedded && <p className="text-slate-400 mt-0.5">{src.whatYouSee}</p>}
                    {signals?.usedFallback &&
                      ((src.id === 'water' && signals.usedFallback.water) ||
                        (src.id === 'settlement' && signals.usedFallback.settlement) ||
                        (src.id === 'grid' && signals.usedFallback.grid)) && (
                        <p className={embedded ? 'text-[#b97816] mt-0.5 font-semibold' : 'text-amber-400/90 mt-0.5 font-semibold'}>
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
        <p className={`text-[10px] font-black uppercase mb-1.5 ${embedded ? 'text-[#17879a]' : 'text-cyan-400/90'}`}>
          Map (visual)
        </p>
        {MAP_VISUAL_SOURCES.map((src) => (
          <p key={src.id} className={`text-[11px] leading-snug ${embedded ? 'text-[#66727a]' : 'text-slate-400'}`}>
            <span className={embedded ? 'text-[#263238] font-semibold' : 'text-slate-200 font-semibold'}>{src.label}:</span>{' '}
            {src.whatYouSee} {src.limits}
          </p>
        ))}
      </div>

      {hasTowerPlan && (
        <div>
          <p className={`text-[10px] font-black uppercase mb-1.5 ${embedded ? 'text-[#b97816]' : 'text-amber-400/90'}`}>
            Planning reference (not live satellite)
          </p>
          {PLANNING_ONLY_SOURCES.map((src) => (
            <p key={src.id} className={`text-[11px] leading-snug mb-1 ${embedded ? 'text-[#66727a]' : 'text-slate-400'}`}>
              <span className={embedded ? 'text-[#b97816] font-semibold' : 'text-amber-200 font-semibold'}>{src.label}:</span>{' '}
              {src.whatYouSee}
            </p>
          ))}
        </div>
      )}

      <div
        className={
          embedded
            ? 'rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/40 px-2.5 py-2'
            : 'rounded-lg border border-slate-700/60 bg-slate-900/30 px-2.5 py-2'
        }
      >
        <p
          className={`text-[10px] font-black uppercase mb-1 flex items-center gap-1 ${
            embedded ? 'text-[#66727a]' : 'text-slate-500'
          }`}
        >
          <ShieldAlert className="w-3 h-3" />
          Not available live in this build
        </p>
        <ul className={`text-[10px] space-y-0.5 ${embedded ? 'text-[#66727a]' : 'text-slate-500'}`}>
          {NOT_IN_THIS_BUILD.map((s) => (
            <li key={s.id}>
              · {s.label} — {s.limits}
            </li>
          ))}
        </ul>
      </div>

      {signals?.fetchedAt && (
        <p className={`text-[10px] tabular-nums ${embedded ? 'text-[#66727a]' : 'text-slate-500'}`}>
          Last live fetch: {new Date(signals.fetchedAt).toLocaleString()}
        </p>
      )}
    </div>
  )

  if (embedded) return body

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
      {open && body}
    </div>
  )
}
