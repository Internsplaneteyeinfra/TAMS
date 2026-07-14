import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  MonitoringChange,
  MonitoringDetection,
  MonitoringRunResult,
  MonitoredAssetSummary,
  WorkflowStage,
} from '@/lib/api'

interface MonitoringResultModalProps {
  open: boolean
  result: MonitoringRunResult | null
  error?: string | null
  onClose: () => void
  /** Select asset on dashboard map and close this report */
  onViewAsset?: (assetId: string) => void
}

const HOVER_DELAY_MS = 2000

const STAGE_EMOJI: Record<string, string> = {
  acquire: '📡',
  detect: '🔭',
  compare: '🪐',
  alert: '☄️',
  complete: '🚀',
  default: '🛰️',
}

const DETECTION_LABEL: Record<string, string> = {
  tower: 'Tower structure',
  power_line: 'Power line corridor',
  substation: 'Substation yard',
  vegetation: 'Vegetation encroachment',
  construction: 'Construction activity',
  thermal_anomaly: 'Thermal hotspot',
  flood: 'Flood inundation',
  landslide: 'Landslide / slope risk',
  missing_asset: 'Missing asset signature',
}

function stageEmoji(stageId: string): string {
  const key = stageId.toLowerCase()
  for (const [k, emoji] of Object.entries(STAGE_EMOJI)) {
    if (key.includes(k)) return emoji
  }
  return STAGE_EMOJI.default
}

function stageStatusEmoji(status: string): string {
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'success') return '✅'
  if (s === 'failed' || s === 'error') return '❌'
  if (s === 'running' || s === 'in_progress') return '⏳'
  if (s === 'skipped') return '⏭️'
  return '⚪'
}

function formatCoord(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return 'Location derived from asset corridor'
  }
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`
}

function detectionWhere(d: MonitoringDetection): string {
  const parts: string[] = []
  if (d.asset_id) parts.push(`Asset ${d.asset_id}`)
  parts.push(formatCoord(d.latitude, d.longitude))
  return parts.join(' · ')
}

function detectionWhat(d: MonitoringDetection): string {
  const type = d.detection_type || 'unknown'
  const label = DETECTION_LABEL[type] || type.replace(/_/g, ' ')
  const conf = d.confidence != null ? `${Math.round(d.confidence * 100)}% confidence` : 'confidence pending'
  const sev = d.severity ? `${d.severity} severity` : ''
  return [label, conf, sev].filter(Boolean).join(' · ')
}

function stageHoverDetail(
  stage: WorkflowStage,
  detections: MonitoringDetection[],
  changes: MonitoringChange[],
  alerts: string[],
  assetsMonitored: number,
  scenesAcquired: number
): { title: string; lines: string[] } {
  const id = stage.stage.toLowerCase()
  const out = stage.output || {}

  if (id.includes('acquire')) {
    const sources = out.sources && typeof out.sources === 'object' ? out.sources : null
    const sourceLines = sources
      ? Object.entries(sources as Record<string, { count?: number; catalog?: string }>).map(
          ([src, meta]) =>
            `${src}: ${meta.count ?? 0} scene(s)${meta.catalog ? ` via ${meta.catalog}` : ''}`
        )
      : []
    return {
      title: 'Acquire — imagery sources',
      lines: [
        `Pulled ${scenesAcquired} satellite scene(s) for ${assetsMonitored} monitored asset(s).`,
        typeof out.bbox === 'string' ? `Search bbox: ${out.bbox}` : 'BBox built from selected corridor assets.',
        ...sourceLines.slice(0, 4),
        stage.summary,
      ].filter(Boolean),
    }
  }

  if (id.includes('detect')) {
    const byType: Record<string, number> = {}
    for (const d of detections) {
      const t = d.detection_type || 'unknown'
      byType[t] = (byType[t] || 0) + 1
    }
    const top = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, n]) => `${DETECTION_LABEL[t] || t}: ${n}`)
    const sample = detections.slice(0, 3).map((d) => `• ${detectionWhat(d)} @ ${detectionWhere(d)}`)
    return {
      title: 'Detect — AI findings',
      lines: [
        `${detections.length} detection(s) across watched assets.`,
        ...top,
        ...(sample.length ? ['Examples:', ...sample] : ['No sample detections in this run.']),
        stage.summary,
      ],
    }
  }

  if (id.includes('compare')) {
    const sample = changes.slice(0, 3).map((c) => {
      const where = c.asset_id ? `Asset ${c.asset_id}` : 'corridor'
      return `• ${c.change_type || 'change'} on ${where}${c.description ? ` — ${c.description}` : ''}`
    })
    return {
      title: 'Compare — change vs baseline',
      lines: [
        'Compared current observations vs historical baseline.',
        `${changes.length} change finding(s).`,
        ...(sample.length ? sample : ['No material changes vs last baseline.']),
        stage.summary,
      ],
    }
  }

  if (id.includes('alert')) {
    return {
      title: 'Alert — escalations',
      lines: [
        `${alerts.length} alert(s) raised for field follow-up.`,
        ...(alerts.length
          ? alerts.slice(0, 5).map((aid) => `• Alert ID ${aid}`)
          : ['No new alerts — corridor stable vs thresholds.']),
        stage.summary,
      ],
    }
  }

  return {
    title: 'Complete — pipeline status',
    lines: [
      'Satellite & AI pipeline finished — results ready for dashboard and work orders.',
      `Assets watched: ${assetsMonitored}`,
      `Scenes: ${scenesAcquired} · Detections: ${detections.length} · Changes: ${changes.length} · Alerts: ${alerts.length}`,
      stage.summary,
    ],
  }
}

export default function MonitoringResultModal({
  open,
  result,
  error,
  onClose,
  onViewAsset,
}: MonitoringResultModalProps) {
  const [mounted, setMounted] = useState(false)
  const [activePanel, setActivePanel] = useState<'assets' | 'detections' | 'alerts' | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) setActivePanel(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const detections = result?.detections ?? []
  const changes = result?.changes ?? []
  const alertIds = result?.alerts_generated ?? []
  const stages = result?.stages ?? []
  const detectionCount = result?.detections_count ?? detections.length
  const isError = Boolean(error) || result?.status === 'failed'

  const monitoredAssets: MonitoredAssetSummary[] = useMemo(() => {
    if (result?.monitored_assets?.length) return result.monitored_assets
    // Fallback: unique assets referenced by detections
    const seen = new Set<string>()
    const list: MonitoredAssetSummary[] = []
    for (const d of detections) {
      if (!d.asset_id || seen.has(d.asset_id)) continue
      seen.add(d.asset_id)
      list.push({
        id: d.asset_id,
        name: d.asset_id,
        asset_type: d.detection_type === 'power_line' ? 'line' : d.detection_type === 'substation' ? 'substation' : 'tower',
        latitude: d.latitude ?? undefined,
        longitude: d.longitude ?? undefined,
      })
    }
    return list
  }, [result?.monitored_assets, detections])

  const handleViewAsset = (assetId: string) => {
    onViewAsset?.(assetId)
    onClose()
  }

  const detectionSummary = useMemo(() => {
    const byType: Record<string, number> = {}
    for (const d of detections) {
      const t = d.detection_type || 'unknown'
      byType[t] = (byType[t] || 0) + 1
    }
    return Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [detections])

  if (!open || !mounted) return null

  const node = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="monitoring-result-title"
    >
      <button
        type="button"
        aria-label="Dismiss pipeline report"
        className="absolute inset-0 border-0 cursor-default bg-[#020617]/70 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-700 bg-[#0b1220] shadow-2xl overflow-visible max-h-[min(88vh,720px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 w-full shrink-0 bg-slate-600" />

        <div className="p-5 sm:p-6 overflow-y-auto scrollbar-thin overflow-x-visible">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">
                Satellite &amp; AI Pipeline
              </p>
              <h2 id="monitoring-result-title" className="text-lg sm:text-xl font-bold text-white leading-snug flex items-start gap-2">
                <EmojiMark>{isError ? '🌑' : '🛰️'}</EmojiMark>
                <span>
                  {isError
                    ? 'Satellite and AI pipeline execution interrupted'
                    : 'Satellite and AI pipeline Execution complete'}
                </span>
              </h2>
              {result?.run_id && (
                <p className="mt-1.5 text-[11px] font-mono text-slate-500">Run ID · {result.run_id}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-500 transition flex items-center justify-center text-sm font-bold shrink-0"
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {isError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <p className="font-semibold mb-1">Execution failed</p>
              <p className="text-red-300/90 text-[13px] leading-relaxed">
                {error || result?.stages?.[0]?.summary || 'The monitoring cycle failed. Please try again.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <ResultStat
                  emoji="🗼"
                  label="Assets watched"
                  value={result?.assets_monitored ?? monitoredAssets.length}
                  active={activePanel === 'assets'}
                  onClick={() => setActivePanel((p) => (p === 'assets' ? null : 'assets'))}
                  tip={{
                    title: 'Assets in this run',
                    lines: [
                      'Click to open the watched-asset list.',
                      'Use View to jump to that asset on the map — this report closes automatically.',
                    ],
                  }}
                />
                <ResultStat
                  emoji="📸"
                  label="Scenes captured"
                  value={result?.scenes_acquired ?? 0}
                  tip={{
                    title: 'Satellite scenes',
                    lines: [
                      `${result?.scenes_acquired ?? 0} scene(s) from Sentinel / Landsat (or reference fallback).`,
                      'See Acquire step for source breakdown.',
                    ],
                  }}
                />
                <ResultStat
                  emoji="🎫"
                  label="Alerts raised"
                  value={alertIds.length}
                  highlight={alertIds.length > 0}
                  active={activePanel === 'alerts'}
                  onClick={() => setActivePanel((p) => (p === 'alerts' ? null : 'alerts'))}
                  tip={{
                    title: 'Alerts escalated',
                    lines:
                      alertIds.length > 0
                        ? ['Click to list alert IDs from this run.', ...alertIds.slice(0, 4).map((id) => `• ${id}`)]
                        : ['No threshold breaches — no new alerts this pass.'],
                  }}
                />
              </div>

              {activePanel === 'assets' && (
                <div className="mb-3 rounded-lg border border-slate-600 bg-slate-950 p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Watched assets ({monitoredAssets.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setActivePanel(null)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-300"
                    >
                      Close list
                    </button>
                  </div>
                  {monitoredAssets.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-3 text-center">No asset list returned for this run.</p>
                  ) : (
                    <ul className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                      {monitoredAssets.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-900 border border-slate-800"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-slate-100 truncate">{a.name}</p>
                            <p className="text-[9px] text-slate-500 font-mono truncate">
                              {(a.asset_type || 'asset').toUpperCase()}
                              {a.voltage_kv != null ? ` · ${a.voltage_kv} kV` : ''}
                              {' · '}
                              {a.id}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleViewAsset(a.id)}
                            className="shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-900 hover:bg-white transition"
                          >
                            View
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activePanel === 'alerts' && (
                <div className="mb-3 rounded-lg border border-slate-600 bg-slate-950 p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Alerts from this run
                    </p>
                    <button
                      type="button"
                      onClick={() => setActivePanel(null)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-300"
                    >
                      Close list
                    </button>
                  </div>
                  {alertIds.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-3 text-center">No alerts generated.</p>
                  ) : (
                    <ul className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                      {alertIds.map((id) => (
                        <li key={id} className="px-2 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-200">
                          {id}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mb-3 flex flex-wrap gap-1.5">
                {detectionCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivePanel((p) => (p === 'detections' ? null : 'detections'))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                      activePanel === 'detections'
                        ? 'bg-slate-800 border-slate-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <EmojiMark>🔭</EmojiMark> {detectionCount} AI detections
                  </button>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-900 border border-emerald-800/50 text-emerald-200">
                  <EmojiMark>🛰️</EmojiMark> Satellite and AI pipeline Execution complete
                </span>
              </div>

              {(activePanel === 'detections' || (!activePanel && detections.length > 0)) && detections.length > 0 && (
                <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950/80 p-2.5 space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Findings — View opens asset on map
                  </p>
                  {detections.slice(0, 12).map((d, i) => (
                    <div
                      key={`${d.asset_id}-${d.detection_type}-${i}`}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-[10px]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-200 font-semibold truncate">
                          {DETECTION_LABEL[d.detection_type || ''] || d.detection_type || 'Finding'}
                        </p>
                        <p className="text-slate-500 font-mono truncate">
                          {d.asset_id || formatCoord(d.latitude, d.longitude)}
                        </p>
                      </div>
                      {d.asset_id ? (
                        <button
                          type="button"
                          onClick={() => handleViewAsset(d.asset_id!)}
                          className="shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-900 hover:bg-white transition"
                        >
                          View
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin pr-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Pipeline steps — hover 2s for detail
                </p>
                {stages.length === 0 ? (
                  <p className="text-sm text-slate-400 py-3 text-center">No stage details returned.</p>
                ) : (
                  stages.map((stage, i) => {
                    const tip = stageHoverDetail(
                      stage,
                      detections,
                      changes,
                      alertIds,
                      result?.assets_monitored ?? 0,
                      result?.scenes_acquired ?? 0
                    )
                    return (
                      <HoverTip key={`${stage.stage}-${i}`} title={tip.title} lines={tip.lines}>
                        <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:border-slate-600 transition">
                          <EmojiMark className="mt-0.5">{stageEmoji(stage.stage)}</EmojiMark>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] font-semibold text-slate-100 capitalize truncate">
                                {stage.stage.replace(/_/g, ' ')}
                              </p>
                              <span className="text-[11px] shrink-0" aria-hidden>
                                {stageStatusEmoji(stage.status)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{stage.summary}</p>
                          </div>
                        </div>
                      </HoverTip>
                    )
                  })
                )}
              </div>
            </>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg bg-slate-100 hover:bg-white text-slate-900 text-sm font-semibold transition"
            >
              {isError ? 'Close' : 'Got it · Back to map'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

/** Static emoji — slight scale on hover only, no bounce/motion loops. */
function EmojiMark({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block text-lg leading-none transition-transform duration-150 hover:scale-125 ${className}`}
      aria-hidden
    >
      {children}
    </span>
  )
}

/**
 * Shows a fully visible fixed tooltip after 8s of continuous hover.
 * Placed in the viewport so nothing is clipped by the modal/overflow.
 */
function HoverTip({
  children,
  title,
  lines,
}: {
  children: React.ReactNode
  title: string
  lines: string[]
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; place: 'above' | 'below' } | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const placeTip = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const tipW = Math.min(320, window.innerWidth - 24)
    const tipH = 200
    const pad = 12
    let left = rect.left + rect.width / 2 - tipW / 2
    left = Math.max(pad, Math.min(left, window.innerWidth - tipW - pad))

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const place: 'above' | 'below' =
      spaceBelow >= tipH + pad || spaceBelow >= spaceAbove ? 'below' : 'above'

    const top =
      place === 'below'
        ? Math.min(rect.bottom + 8, window.innerHeight - tipH - pad)
        : Math.max(pad, rect.top - tipH - 8)

    setPos({ top, left, place })
    setVisible(true)
  }, [])

  const onEnter = () => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      placeTip()
    }, HOVER_DELAY_MS)
  }

  const onLeave = () => {
    clearTimer()
    setVisible(false)
    setPos(null)
  }

  useEffect(() => () => clearTimer(), [clearTimer])

  return (
    <div
      ref={anchorRef}
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      {children}
      {visible &&
        pos &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[10050] pointer-events-none"
            style={{ top: pos.top, left: pos.left, width: Math.min(320, window.innerWidth - 24) }}
          >
            <div className="rounded-lg border border-slate-600 bg-[#111827] p-3 shadow-xl text-left">
              <p className="text-[11px] font-bold text-slate-100 mb-1.5">{title}</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {lines.filter(Boolean).map((line, i) => (
                  <li key={i} className="text-[11px] leading-snug text-slate-300">
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[9px] text-slate-500 uppercase tracking-wide">
                Hold hover · detail after 2s
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

function ResultStat({
  emoji,
  label,
  value,
  highlight,
  active,
  onClick,
  tip,
}: {
  emoji: string
  label: string
  value: number
  highlight?: boolean
  active?: boolean
  onClick?: () => void
  tip: { title: string; lines: string[] }
}) {
  const body = (
    <div
      className={`rounded-lg border p-2.5 text-center transition w-full ${
        active
          ? 'border-slate-400 bg-slate-800'
          : highlight
            ? 'border-amber-700/60 bg-amber-950/30'
            : 'border-slate-700 bg-slate-900/80'
      } ${onClick ? 'hover:border-slate-500 cursor-pointer' : ''}`}
    >
      <div className="mb-1 flex justify-center">
        <EmojiMark>{emoji}</EmojiMark>
      </div>
      <p className="text-base font-bold text-white tabular-nums">{value}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 mt-0.5">{label}</p>
      {onClick && (
        <p className="text-[8px] font-semibold text-cyan-400/80 mt-1 uppercase tracking-wide">
          {active ? 'Hide list' : 'Click to list'}
        </p>
      )}
    </div>
  )

  if (onClick) {
    return (
      <HoverTip title={tip.title} lines={tip.lines}>
        <button type="button" onClick={onClick} className="w-full text-left">
          {body}
        </button>
      </HoverTip>
    )
  }

  return (
    <HoverTip title={tip.title} lines={tip.lines}>
      {body}
    </HoverTip>
  )
}
