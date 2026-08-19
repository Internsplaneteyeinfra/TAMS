import React from 'react'

import type { SuitabilityResult } from '../scoring'

export default function FactorsPanel({ result }: { result: SuitabilityResult }) {
  return (
    <div className="space-y-3">
      {result.factors.map((f) => {
        const na = f.rawLabel.toUpperCase() === 'N/A'
        const pct = na ? 0 : Math.max(0, Math.min(100, (f.score / 10) * 100))
        return (
          <div key={f.id}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-bold text-[#263238]">{f.label}</p>
              <p className="text-[12px] font-black tabular-nums text-[#17879a]">{na ? 'N/A' : f.score.toFixed(1)}</p>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-[#d9ded4] overflow-hidden" aria-hidden>
              <div className="h-full rounded-full bg-[#17879a]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-0.5 text-[10px] text-[#66727a]">{f.rawLabel}</p>
          </div>
        )
      })}
    </div>
  )
}
