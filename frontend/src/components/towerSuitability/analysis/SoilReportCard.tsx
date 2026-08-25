import React, { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

import { downloadSoilScreeningReport, type SoilReportOpts } from '../downloadSoilScreeningReport'
import type { SoilScreening } from '../soilScreening'

export default function SoilReportCard({
  soil,
  reportOpts,
  onGenerate,
}: {
  soil?: SoilScreening | null
  siteLabel: string
  reportOpts: SoilReportOpts | null
  onGenerate: () => Promise<SoilReportOpts>
}) {
  const [busy, setBusy] = useState(false)

  const runDownload = async () => {
    setBusy(true)
    try {
      const opts = reportOpts?.soil ? reportOpts : await onGenerate()
      if (!opts?.soil) return
      downloadSoilScreeningReport(opts)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="ts-glass ts-card-in p-2 w-full">
      <button
        type="button"
        onClick={() => void runDownload()}
        disabled={busy || (!soil && !reportOpts?.soil)}
        className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#0f766e] text-white text-[11px] font-black hover:bg-[#0d9488] disabled:opacity-50"
        title="Download soil report"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Download soil report
      </button>
    </article>
  )
}
