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
        className: 'text-[#126b79] border-[#27856b]/40 bg-[#dff0e8]',
        Icon: CheckCircle2,
      }
    case 'skip_existing':
      return {
        label: 'Cannot place',
        className: 'text-[#c75b50] border-[#c75b50]/40 bg-[#f8e4e1]',
        Icon: XCircle,
      }
    case 'too_close':
      return {
        label: 'Cannot place',
        className: 'text-[#b97816] border-[#b97816]/40 bg-[#f6ead1]',
        Icon: AlertTriangle,
      }
    default:
      return {
        label: 'Review',
        className: 'text-[#126b79] border-[#17879a]/40 bg-white/70',
        Icon: AlertTriangle,
      }
  }
}

export default function CorridorPlacementPanel({ advice }: { advice: CorridorPlacementAdvice | null }) {
  const [open, setOpen] = useState(true)
  if (!advice) return null

  return (
    <div className="rounded-xl border border-[rgba(51,65,85,0.16)] bg-[rgba(248,247,241,0.96)] overflow-hidden text-[#263238]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-white/60"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#263238]">
          <MapPinned className="w-3.5 h-3.5 text-[#17879a]" />
          Tower placement · can / cannot
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold text-[#263238]">
          {advice.canPlaceCount}/{advice.plannedCount} OK
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 border-t border-[rgba(51,65,85,0.12)] space-y-2.5 pt-2">
          <p className="text-[11px] text-[#263238] leading-relaxed">{advice.summary}</p>

          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg border border-[#27856b]/30 bg-[#dff0e8] px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#126b79]">Can place</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.canPlaceCount}</p>
            </div>
            <div className="rounded-lg border border-[#c75b50]/30 bg-[#f8e4e1] px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#c75b50]">Already there</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.skipExistingCount}</p>
            </div>
            <div className="rounded-lg border border-[#b97816]/30 bg-[#f6ead1] px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#b97816]">Too close</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.tooCloseCount}</p>
            </div>
            <div className="rounded-lg border border-[#17879a]/30 bg-white/80 px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#126b79]">Review</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.reviewCount}</p>
            </div>
          </div>

          <div className="rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2.5 py-2 text-[10px] text-[#263238] leading-snug">
            <p className="font-bold text-[#263238] uppercase tracking-wide mb-0.5">
              Spacing rule ({advice.voltageLabel})
            </p>
            <p>
              Min <span className="font-bold">{advice.minSpanM} m</span> · usual{' '}
              <span className="font-bold">{advice.rulingSpanM} m</span> · max{' '}
              <span className="font-bold">{advice.maxSpanM} m</span> · ROW ~{advice.rowWidthM} m
            </p>
            <p className="mt-1 text-[#263238]">{advice.rulesSummary}</p>
          </div>

          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            {advice.items.map((item) => {
              const style = verdictStyle(item.verdict)
              const Icon = style.Icon
              return (
                <li
                  key={`pad-${item.index}`}
                  className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/70 px-2.5 py-2 text-[11px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-black text-[#263238]">
                      T{item.index}{' '}
                      <span className="text-[#263238] font-semibold tabular-nums">
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
                  <p className="text-[#263238] mt-1 leading-snug">{item.reason}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
