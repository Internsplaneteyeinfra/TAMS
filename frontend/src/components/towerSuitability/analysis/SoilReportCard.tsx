import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Eye, Loader2, X } from 'lucide-react'

import {
  buildSoilScreeningReportHtml,
  downloadSoilScreeningReport,
  type SoilReportOpts,
} from '../downloadSoilScreeningReport'
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
  const [previewOpts, setPreviewOpts] = useState<SoilReportOpts | null>(null)
  const [readyOpts, setReadyOpts] = useState<SoilReportOpts | null>(reportOpts)
  const preloadOnce = useRef(false)

  useEffect(() => {
    setReadyOpts(reportOpts)
    if (reportOpts?.soil) preloadOnce.current = false
  }, [reportOpts])

  // Keep report data ready so Preview opens instantly.
  useEffect(() => {
    if (readyOpts?.soil || preloadOnce.current) return
    preloadOnce.current = true
    let cancelled = false
    setBusy(true)
    void onGenerate()
      .then((opts) => {
        if (!cancelled && opts?.soil) setReadyOpts(opts)
      })
      .catch(() => {
        if (!cancelled) preloadOnce.current = false
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [onGenerate, readyOpts?.soil])

  const previewHtml = useMemo(
    () => (previewOpts?.soil ? buildSoilScreeningReportHtml(previewOpts) : ''),
    [previewOpts]
  )

  useEffect(() => {
    if (!previewOpts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpts(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewOpts])

  const openPreview = async () => {
    if (readyOpts?.soil) {
      setPreviewOpts(readyOpts)
      return
    }
    setBusy(true)
    try {
      const opts = await onGenerate()
      if (!opts?.soil) return
      setReadyOpts(opts)
      setPreviewOpts(opts)
    } finally {
      setBusy(false)
    }
  }

  const runDownload = () => {
    const opts = previewOpts ?? readyOpts
    if (!opts?.soil) return
    downloadSoilScreeningReport(opts)
  }

  const canOpen = Boolean(soil || reportOpts?.soil || readyOpts?.soil)

  return (
    <>
      <article className="ts-glass ts-card-in p-2 w-full space-y-2">
        <button
          type="button"
          onClick={() => void openPreview()}
          disabled={busy && !canOpen}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#0f766e] text-white text-[11px] font-black hover:bg-[#0d9488] disabled:opacity-50"
          title="Preview soil report full screen"
        >
          {busy && !readyOpts?.soil ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          Preview soil report
        </button>
        <button
          type="button"
          onClick={runDownload}
          disabled={!readyOpts?.soil && !previewOpts?.soil}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg border border-[#0f766e] text-[#0f766e] text-[11px] font-black hover:bg-[#ecfdf5] disabled:opacity-50"
          title="Download soil report to this device"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </article>

      {previewOpts &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[5000] flex flex-col bg-[#0b1720]/60 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Soil report preview"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700/80 bg-[#0e172a] px-4 py-3 text-white shadow-lg">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wider text-teal-300">Soil report</p>
                <p className="truncate text-[12px] text-slate-300">{previewOpts.siteLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={runDownload}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-[11px] font-black text-white hover:bg-[#0d9488]"
                  title="Download soil report to this device"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpts(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                  aria-label="Close preview"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-[#e8eef2] p-3 sm:p-5">
              <iframe
                title="Soil report preview"
                className="h-full w-full rounded-xl border border-slate-300 bg-white shadow-xl"
                srcDoc={previewHtml}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
