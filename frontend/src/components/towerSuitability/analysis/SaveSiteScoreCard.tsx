import React, { useState } from 'react'
import { Database, Loader2, CheckCircle2 } from 'lucide-react'

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export default function SaveSiteScoreCard({
  disabled,
  onSave,
}: {
  disabled?: boolean
  onSave: () => Promise<void> | void
}) {
  const [state, setState] = useState<SaveState>('idle')
  const [err, setErr] = useState<string | null>(null)

  const run = async () => {
    setState('saving')
    setErr(null)
    try {
      await onSave()
      setState('saved')
    } catch (e) {
      setState('failed')
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <article className="ts-glass ts-card-in p-3.5 w-[min(280px,calc(100vw-5.5rem))]">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#66727a]">Save site score</p>
      <p className="mt-1 text-[11px] text-[#66727a] leading-snug">
        Store this analysis in the database — view later under Geotech → Saved site scores
      </p>
      <button
        type="button"
        onClick={() => void run()}
        disabled={disabled || state === 'saving'}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg border border-[#17879a]/40 bg-[#e8f6f8] text-[#126b79] text-[11px] font-black hover:bg-[#dff0e8] disabled:opacity-50"
      >
        {state === 'saving' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === 'saved' ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Database className="h-3.5 w-3.5" />
        )}
        {state === 'idle' && 'Save to database'}
        {state === 'saving' && 'Saving…'}
        {state === 'saved' && 'Saved'}
        {state === 'failed' && 'Retry save'}
      </button>
      {err && <p className="mt-1.5 text-[10px] text-[#c75b50] leading-snug">{err}</p>}
    </article>
  )
}
