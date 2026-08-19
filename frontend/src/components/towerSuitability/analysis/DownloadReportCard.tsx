import React, { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

type ReportUiState = 'idle' | 'generating' | 'complete' | 'failed'

export default function DownloadReportCard({ onDownload }: { onDownload: () => void }) {
  const [state, setState] = useState<ReportUiState>('idle')

  const run = () => {
    setState('generating')
    try {
      onDownload()
      setState('complete')
    } catch {
      setState('failed')
    }
  }

  return (
    <article className="ts-glass ts-card-in p-3.5 w-[min(280px,calc(100vw-5.5rem))]">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#66727a]">Download report</p>
      <p className="mt-1 text-[11px] text-[#66727a] leading-snug">Complete analysis, scoring and map data</p>
      <button
        type="button"
        onClick={run}
        disabled={state === 'generating'}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#17879a] text-white text-[11px] font-black hover:bg-[#126b79] disabled:opacity-60"
      >
        {state === 'generating' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {state === 'idle' && 'Download Report'}
        {state === 'generating' && 'Generating…'}
        {state === 'complete' && 'Complete'}
        {state === 'failed' && 'Failed'}
      </button>
    </article>
  )
}
