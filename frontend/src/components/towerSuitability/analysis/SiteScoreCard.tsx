import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import type { SuitabilityResult } from '../scoring'
import { liveStatusCounts } from '../liveSignalStatus'

function verdictCopy(result: SuitabilityResult): string {
  if (result.signals.nearbyPower?.powerNetworkVerdict === 'unknown') return 'DATA UNAVAILABLE'
  if (result.signals.nearbyPower?.powerNetworkVerdict === 'no') return 'NOT SUITABLE'
  if (result.signals.nearbyPower?.powerNetworkVerdict === 'yes') return 'GOOD SUITABILITY'
  if (result.verdict === 'preferred') return 'GOOD SUITABILITY'
  if (result.verdict === 'unsuitable') return 'UNSUITABLE'
  return 'CONDITIONAL REVIEW'
}

export default function SiteScoreCard({
  result,
  expandable = true,
}: {
  result: SuitabilityResult
  expandable?: boolean
}) {
  const [shown, setShown] = useState(0)
  const [open, setOpen] = useState(true)
  const counts = liveStatusCounts(result.signals)

  useEffect(() => {
    const target = result.finalScore
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(target)
      return
    }
    setShown(0)
    const start = performance.now()
    const dur = 280
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setShown(target * t)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [result.finalScore])

  const conf = result.confidencePct

  return (
    <article className="ts-glass ts-card-in p-3 w-full" aria-label="Site suitability score">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        disabled={!expandable}
      >
        <p className="text-[10px] font-black uppercase tracking-wider text-[#66727a]">Site suitability</p>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[15px] font-black tabular-nums text-[#263238]">{shown.toFixed(1)}</span>
          {expandable ? (
            open ? (
              <ChevronUp className="h-3.5 w-3.5 text-[#66727a]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-[#66727a]" />
            )
          ) : null}
        </span>
      </button>
      {open && (
        <>
          <p className="mt-1.5 text-[2.1rem] leading-none font-black tabular-nums text-[#263238]">
            {shown.toFixed(1)}
            <span className="text-base font-bold text-[#66727a]"> / 10</span>
          </p>
          <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-[#27856b]">● {verdictCopy(result)}</p>
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] font-bold text-[#66727a]">
              <span>Confidence</span>
              <span className="tabular-nums">{conf}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-[#d9ded4] overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-[#17879a]" style={{ width: `${Math.max(0, Math.min(100, conf))}%` }} />
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-[#66727a]">
            {counts.live} live · {counts.fallback} estimated · {counts.na} missing
          </p>
        </>
      )}
    </article>
  )
}
