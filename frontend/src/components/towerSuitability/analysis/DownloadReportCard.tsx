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
    <article className="ts-glass ts-card-in p-2 w-full">
      <button
        type="button"
        onClick={run}
        disabled={state === 'generating'}
        className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#17879a] text-white text-[11px] font-black hover:bg-[#126b79] disabled:opacity-60"
      >
        {state === 'generating' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {state === 'idle' && 'Download report'}
        {state === 'generating' && 'Generating…'}
        {state === 'complete' && 'Downloaded'}
        {state === 'failed' && 'Failed'}
      </button>
    </article>
  )
}
