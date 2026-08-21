import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileSearch, Loader2, X } from 'lucide-react'

import {
  buildSoilScreeningReportHtml,
  downloadSoilScreeningReport,
  type SoilReportOpts,
} from '../downloadSoilScreeningReport'
import type { SoilScreening } from '../soilScreening'

type UiState = 'idle' | 'generating' | 'ready' | 'failed'

export default function SoilReportCard({
  soil,
  siteLabel,
  reportOpts,
  onGenerate,
}: {
  soil?: SoilScreening | null
  siteLabel: string
  reportOpts: SoilReportOpts | null
  onGenerate: () => Promise<SoilReportOpts>
}) {
  const [state, setState] = useState<UiState>('idle')
  const [open, setOpen] = useState(false)
  const [previewOpts, setPreviewOpts] = useState<SoilReportOpts | null>(null)

  const activeOpts = previewOpts || reportOpts

  const html = useMemo(() => {
    if (!activeOpts?.soil) return null
    return buildSoilScreeningReportHtml(activeOpts)
  }, [activeOpts])

  const runGenerate = async () => {
    setState('generating')
    try {
      const opts = await onGenerate()
      setPreviewOpts(opts)
      setState('ready')
      setOpen(true)
    } catch {
      setState('failed')
    }
  }

  const runDownload = () => {
    const opts = activeOpts
    if (!opts?.soil) return
    downloadSoilScreeningReport(opts)
  }

  const conf = soil?.confidencePct
  const canDownload = !!activeOpts?.soil
  const label = activeOpts?.siteLabel || siteLabel

  const modal =
    open && html && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/45 p-3"
            role="dialog"
            aria-modal="true"
            aria-label="Soil report"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
          >
            <div className="relative flex h-[min(92vh,900px)] w-[min(920px,96vw)] flex-col overflow-hidden rounded-xl bg-[#f8f7f1] shadow-2xl border border-[rgba(51,65,85,0.2)]">
              <div className="flex items-center gap-2 border-b border-[rgba(51,65,85,0.12)] bg-white/90 px-3 py-2.5 shrink-0">
                <p className="min-w-0 flex-1 truncate text-[13px] font-black text-[#263238]">
                  SoilReport-({label})
                </p>
                <button
                  type="button"
                  title="Download SoilReport-(location)"
                  onClick={runDownload}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#0f766e]/30 text-[#0f766e] hover:bg-[#ecfdf5]"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Close"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(51,65,85,0.2)] text-[#66727a] hover:bg-[#f1f5f9]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe
                title={`SoilReport-(${label})`}
                srcDoc={html}
                className="min-h-0 flex-1 w-full border-0 bg-white"
              />
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <article className="ts-glass ts-card-in p-3.5 w-[min(280px,calc(100vw-5.5rem))]">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#66727a] flex items-center gap-1.5">
          <FileSearch className="h-3.5 w-3.5 text-[#0f766e]" />
          Soil screening report
        </p>
        <p className="mt-1 text-[11px] text-[#66727a] leading-snug">
          Open GIS soil for <span className="font-semibold text-[#263238]">{siteLabel}</span>
          {conf != null ? ` · ~${conf}% confidence` : ''}
        </p>
        {soil && (
          <p className="mt-1 text-[11px] text-[#263238] leading-snug">
            {soil.textureClass} · SBC ~{soil.indicativeSbcTm2.low}–{soil.indicativeSbcTm2.high} T/m²
            (screening)
          </p>
        )}
        <div className="mt-2.5 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => void runGenerate()}
            disabled={state === 'generating'}
            className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg border border-[#0f766e]/40 bg-[#ecfdf5] text-[#0f766e] text-[11px] font-black hover:bg-[#d1fae5] disabled:opacity-60"
          >
            {state === 'generating' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSearch className="h-3.5 w-3.5" />
            )}
            {state === 'generating' ? 'Generating…' : '1 · Generate soil report'}
          </button>
          <button
            type="button"
            onClick={runDownload}
            disabled={!canDownload}
            className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#0f766e] text-white text-[11px] font-black hover:bg-[#0d9488] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            2 · Download soil report
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[#66727a] leading-snug">
          Generate opens on-screen. Download saves as SoilReport-(location).html
        </p>
      </article>
      {modal}
    </>
  )
}
