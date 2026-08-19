import React from 'react'

import type { SuitabilityResult } from '../scoring'

export default function ScoreBreakdownPanel({ result }: { result: SuitabilityResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-[#66727a]">
            <th className="pb-2 font-black">Factor</th>
            <th className="pb-2 font-black text-right">Value</th>
            <th className="pb-2 font-black text-right">Score</th>
            <th className="pb-2 font-black text-right">Weight</th>
            <th className="pb-2 font-black text-right">Contrib</th>
          </tr>
        </thead>
        <tbody>
          {result.factors.map((f) => {
            const contrib = f.score * f.weight
            return (
              <tr key={f.id} className="border-t border-[rgba(51,65,85,0.12)]">
                <td className="py-2 pr-2 text-[#263238] font-semibold">
                  {f.label}
                  <div className="text-[10px] font-normal text-[#66727a]">
                    {f.live !== false ? 'Live · ' : ''}
                    {f.source}
                  </div>
                </td>
                <td className="py-2 text-right font-mono text-[#66727a]">{f.rawLabel}</td>
                <td className="py-2 text-right font-black tabular-nums text-[#17879a]">{f.score.toFixed(1)}</td>
                <td className="py-2 text-right text-[#66727a]">{(f.weight * 100).toFixed(0)}%</td>
                <td className="py-2 text-right font-mono tabular-nums text-[#263238]">{contrib.toFixed(2)}</td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-[rgba(51,65,85,0.2)]">
            <td className="py-3 font-black text-[#263238]" colSpan={4}>
              Final site score
            </td>
            <td className="py-3 text-right font-black tabular-nums text-[#263238]">
              {result.finalScore.toFixed(1)} / 10
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
