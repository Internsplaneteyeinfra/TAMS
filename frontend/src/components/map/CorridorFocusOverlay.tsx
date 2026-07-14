import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { CorridorDirectionBrief } from '@/lib/corridorDirection'

const AUTO_CLOSE_MS = 2000

type CorridorFocusOverlayProps = {
  brief: CorridorDirectionBrief | null
  /** Bumps when the same corridor is re-focused so the card reappears. */
  showToken: number
  onClose?: () => void
}

/**
 * Floating corridor card above map chrome (search, intel, bars).
 * Auto-closes after 2s; user can close earlier with ×.
 */
export default function CorridorFocusOverlay({
  brief,
  showToken,
  onClose,
}: CorridorFocusOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!brief || showToken <= 0) {
      setVisible(false)
      return
    }
    setVisible(true)
    const t = window.setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, AUTO_CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [brief?.assetId, showToken, onClose, brief])

  if (!mounted || !brief || !visible) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-start justify-center pointer-events-none pt-[max(5.5rem,12vh)] px-4"
      role="dialog"
      aria-modal="false"
      aria-label="Corridor location"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-cyan-500/40 bg-[#0a1020]/98 shadow-2xl shadow-black/50 backdrop-blur-md tams-corridor-focus-in">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-400">
              Corridor location
            </p>
            <p className="mt-0.5 truncate text-[13px] font-extrabold text-slate-50">{brief.name}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVisible(false)
              onClose?.()
            }}
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/80 p-1.5 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200 transition-colors"
            aria-label="Close corridor location"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-black/80 px-3 py-2.5">
            <span className="text-lg leading-none" aria-hidden>
              🧭
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Direction</p>
              <p className="font-mono text-sm font-extrabold tracking-wide text-cyan-400">{brief.flow}</p>
            </div>
          </div>

          <dl className="grid gap-2 text-[11px]">
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-slate-400">A · Start</dt>
              <dd className="font-mono font-bold text-slate-100">{brief.startLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-slate-400">B · End</dt>
              <dd className="font-mono font-bold text-slate-100">{brief.endLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-slate-400">Voltage</dt>
              <dd className="font-mono font-bold text-slate-100">{brief.voltageLabel}</dd>
            </div>
            {brief.lengthLabel && (
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-slate-400">Length</dt>
                <dd className="font-mono font-bold text-slate-100">{brief.lengthLabel}</dd>
              </div>
            )}
          </dl>

          <p className="text-[10px] leading-snug text-slate-500">
            Cyan corridor with black border on the map. Markers{' '}
            <span className="font-bold text-cyan-400">A</span> and{' '}
            <span className="font-bold text-cyan-400">B</span> mark start and end. Closes in 2s or
            tap ×.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
