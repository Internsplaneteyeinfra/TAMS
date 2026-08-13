import React, { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, MapPinned, XCircle, AlertTriangle } from 'lucide-react'

import type { CorridorPlacementAdvice, PlacementVerdict } from './corridorPlacementAdvice'

function verdictStyle(v: PlacementVerdict): {
  label: string
  className: string
  Icon: typeof CheckCircle2
} {
  switch (v) {
    case 'place':
      return {
        label: 'Can place',
        className: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
        Icon: CheckCircle2,
      }
    case 'skip_existing':
      return {
        label: 'Cannot place',
        className: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
        Icon: XCircle,
      }
    case 'too_close':
      return {
        label: 'Cannot place',
        className: 'text-amber-200 border-amber-500/40 bg-amber-500/10',
        Icon: AlertTriangle,
      }
    default:
      return {
        label: 'Review',
        className: 'text-cyan-200 border-cyan-500/40 bg-cyan-500/10',
        Icon: AlertTriangle,
      }
  }
}

export default function CorridorPlacementPanel({ advice }: { advice: CorridorPlacementAdvice | null }) {
  const [open, setOpen] = useState(true)
  if (!advice) return null

  return (
    <div className="rounded-xl border border-amber-400/50 bg-amber-950/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-amber-950/30"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-100">
          <MapPinned className="w-3.5 h-3.5" />
          Tower placement · can / cannot
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
          {advice.canPlaceCount}/{advice.plannedCount} OK
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 border-t border-amber-500/20 space-y-2.5 pt-2">
          <p className="text-[11px] text-slate-300 leading-relaxed">{advice.summary}</p>

          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-emerald-400/90">Can place</p>
              <p className="text-lg font-black text-white tabular-nums">{advice.canPlaceCount}</p>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-rose-300/90">Already there</p>
              <p className="text-lg font-black text-white tabular-nums">{advice.skipExistingCount}</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-amber-300/90">Too close</p>
              <p className="text-lg font-black text-white tabular-nums">{advice.tooCloseCount}</p>
            </div>
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-cyan-300/90">Review</p>
              <p className="text-lg font-black text-white tabular-nums">{advice.reviewCount}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700/80 bg-slate-950/50 px-2.5 py-2 text-[10px] text-slate-400 leading-snug">
            <p className="font-bold text-amber-100/90 uppercase tracking-wide mb-0.5">
              Spacing rule ({advice.voltageLabel})
            </p>
            <p>
              Min <span className="text-white font-bold">{advice.minSpanM} m</span> · usual{' '}
              <span className="text-white font-bold">{advice.rulingSpanM} m</span> · max{' '}
              <span className="text-white font-bold">{advice.maxSpanM} m</span> · ROW ~{advice.rowWidthM} m
            </p>
            <p className="mt-1 text-slate-500">{advice.rulesSummary}</p>
          </div>

          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            {advice.items.map((item) => {
              const style = verdictStyle(item.verdict)
              const Icon = style.Icon
              return (
                <li
                  key={`pad-${item.index}`}
                  className="rounded-lg border border-slate-700/70 bg-slate-950/40 px-2.5 py-2 text-[11px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-black text-white">
                      T{item.index}{' '}
                      <span className="text-slate-500 font-semibold tabular-nums">
                        at {Math.round(item.chainageM)} m
                      </span>
                    </p>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${style.className}`}
                    >
                      <Icon className="w-3 h-3" />
                      {style.label}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-1 leading-snug">{item.reason}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
