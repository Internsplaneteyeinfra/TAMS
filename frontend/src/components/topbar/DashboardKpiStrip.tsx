import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertTriangle,
  Boxes,
  BrainCircuit,
  ChevronDown,
  ClipboardList,
  Radar,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import type { Alert, WorkOrder } from '@/lib/api'
import AnimatedNumber from '@/components/ui/AnimatedNumber'

const OPEN_WO_STATUSES = new Set(['Draft', 'Approved', 'Scheduled', 'Assigned', 'InProgress'])

interface DashboardKpiStripProps {
  assetsCount: number
  activeAlertsCount: number
  criticalAlertsCount: number
  openWorkOrders?: number
  coveragePct?: number
  placeLabel?: string
  aiDetections24h?: number
  runs24h?: number
  kmlHint?: string
  alerts?: Alert[]
  workOrders?: WorkOrder[]
  onSelectAsset?: (id: string) => void
  onOpenMission?: () => void
  /** Explorer = read-only KPIs (no dropdown overlays over the map). */
  interactionMode?: 'explorer' | 'operations'
}

type Glow = 'emerald' | 'amber' | 'red' | 'cyan' | 'indigo' | 'slate' | 'blue'
type KpiDropdownKind = 'active' | 'critical' | 'workorders' | null

interface DropdownAnchor {
  top: number
  left: number
  width: number
}

function MiniSpark({ color = '#34d399' }: { color?: string }) {
  const path = 'M0,14 L4,11 L8,12 L12,7 L16,9 L20,4 L24,6 L28,3 L32,5'
  return (
    <svg viewBox="0 0 32 16" className="tams-spark-draw h-4 w-10 opacity-80" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return n.toLocaleString()
  return String(n)
}

function priorityTone(priority: string) {
  const p = priority.toLowerCase()
  if (p === 'critical') return 'text-red-200 bg-red-600/30 border-red-400/50'
  if (p === 'high') return 'text-orange-200 bg-orange-600/30 border-orange-400/50'
  if (p === 'medium') return 'text-amber-100 bg-amber-600/30 border-amber-400/50'
  return 'text-slate-200 bg-slate-600/30 border-slate-400/50'
}

function statusTone(status: string) {
  const s = status.toLowerCase()
  if (s === 'inprogress') return 'text-cyan-200 bg-cyan-600/30 border-cyan-400/50'
  if (s === 'assigned' || s === 'scheduled') return 'text-indigo-200 bg-indigo-600/30 border-indigo-400/50'
  if (s === 'approved') return 'text-emerald-200 bg-emerald-600/30 border-emerald-400/50'
  return 'text-slate-200 bg-slate-600/30 border-slate-400/50'
}

function woProgress(wo: WorkOrder): number {
  if (typeof wo.progress_pct === 'number') return wo.progress_pct
  const map: Record<string, number> = {
    Draft: 10,
    Approved: 20,
    Scheduled: 35,
    Assigned: 50,
    InProgress: 75,
    Completed: 100,
    Closed: 100,
  }
  return map[wo.status] ?? 40
}

function KpiCard({
  title,
  value,
  trend,
  trendUp = true,
  icon: Icon,
  glow,
  valueClass,
  sparkColor,
  onClick,
  titleAttr,
  expanded = false,
  alertGlow = false,
}: {
  title: string
  value: React.ReactNode
  trend: string
  trendUp?: boolean
  icon: React.ElementType
  glow: Glow
  valueClass: string
  sparkColor: string
  onClick?: () => void
  titleAttr?: string
  expanded?: boolean
  alertGlow?: boolean
}) {
  const glowMap: Record<Glow, string> = {
    emerald: 'hover:shadow-emerald-500/20 hover:border-emerald-500/30',
    amber: 'hover:shadow-amber-500/20 hover:border-amber-500/30',
    red: 'hover:shadow-red-500/25 hover:border-red-500/40 shadow-red-500/10',
    cyan: 'hover:shadow-cyan-500/20 hover:border-cyan-500/30',
    indigo: 'hover:shadow-indigo-500/25 hover:border-indigo-500/40',
    slate: 'hover:shadow-slate-500/10 hover:border-slate-600/40',
    blue: 'hover:shadow-blue-500/20 hover:border-blue-500/30',
  }

  const iconTone: Record<Glow, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
    slate: 'text-slate-300 bg-slate-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  }

  const interactive = Boolean(onClick)

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      title={titleAttr}
      aria-expanded={interactive ? expanded : undefined}
      className={`group relative flex w-full flex-col justify-center rounded-xl border border-white/5 bg-slate-950/50 px-2.5 py-2 text-left backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${glowMap[glow]} ${
        interactive ? 'cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50' : ''
      } ${expanded ? 'border-cyan-500/40 ring-1 ring-cyan-500/20' : ''} ${alertGlow ? 'tams-alert-glow' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${iconTone[glow]}`}>
            <Icon className="h-3 w-3" />
          </span>
          <span className="truncate text-[8px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <MiniSpark color={sparkColor} />
          {interactive && (
            <ChevronDown
              className={`h-3 w-3 text-slate-500 transition-transform duration-200 ease-out ${
                expanded ? 'rotate-180 text-cyan-400' : ''
              }`}
            />
          )}
        </div>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className={`font-mono text-sm font-black ${valueClass}`}>{value}</span>
        <span
          className={`flex items-center gap-0.5 text-[8px] font-bold ${
            trendUp ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {trendUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {trend}
        </span>
      </div>
    </div>
  )
}

function computeAnchor(el: HTMLElement | null): DropdownAnchor | null {
  if (!el || typeof window === 'undefined') return null
  const rect = el.getBoundingClientRect()
  const width = Math.min(440, Math.max(320, rect.width + 48))
  let left = rect.left
  if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12
  if (left < 12) left = 12
  return { top: rect.bottom + 8, left, width }
}

function KpiDropdownOverlay({
  open,
  kind,
  anchor,
  activeAlerts,
  criticalAlerts,
  openWorkOrderItems,
  onClose,
  onSelectAsset,
}: {
  open: boolean
  kind: KpiDropdownKind
  anchor: DropdownAnchor | null
  activeAlerts: Alert[]
  criticalAlerts: Alert[]
  openWorkOrderItems: WorkOrder[]
  onClose: () => void
  onSelectAsset?: (assetId: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [displayKind, setDisplayKind] = useState<KpiDropdownKind>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open && kind) {
      setDisplayKind(kind)
      const t = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(t)
    }
    setVisible(false)
    if (!open) {
      const t = window.setTimeout(() => setDisplayKind(null), 1500)
      return () => window.clearTimeout(t)
    }
  }, [open, kind])

  if (!mounted || !displayKind || !anchor) return null

  const config = {
    active: {
      title: 'Active Alerts',
      emptyLabel: 'No active alerts in this region',
      accent: 'border-amber-400/40',
      headerTone: 'text-amber-300',
      count: activeAlerts.length,
    },
    critical: {
      title: 'Critical Alerts',
      emptyLabel: 'No critical alerts in this region',
      accent: 'border-red-400/40',
      headerTone: 'text-red-300',
      count: criticalAlerts.length,
    },
    workorders: {
      title: 'Open Work Orders',
      emptyLabel: 'No open work orders',
      accent: 'border-indigo-400/40',
      headerTone: 'text-indigo-300',
      count: openWorkOrderItems.length,
    },
  }[displayKind]

  const alerts = displayKind === 'active' ? activeAlerts : displayKind === 'critical' ? criticalAlerts : []

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[4990] bg-black/20 transition-opacity duration-200 ease-out ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label={config.title}
        style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
        className={`fixed z-[5000] overflow-hidden rounded-xl border bg-[#0e172a] shadow-2xl shadow-black/60 transition-all duration-200 ease-out ${config.accent} ${
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-950 px-4 py-2.5">
          <p className={`text-xs font-bold uppercase tracking-wider ${config.headerTone}`}>{config.title}</p>
          <span className="text-xs font-semibold text-slate-300">
            {config.count} item{config.count === 1 ? '' : 's'}
          </span>
        </div>
        <div className="max-h-56 overflow-y-auto p-2">
          {displayKind === 'workorders' ? (
            openWorkOrderItems.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm font-medium text-slate-300">{config.emptyLabel}</p>
            ) : (
              <ul className="space-y-1.5">
                {openWorkOrderItems.map((wo) => {
                  const progress = woProgress(wo)
                  const assetId = wo.asset_id
                  return (
                    <li key={wo.id}>
                      <button
                        type="button"
                        onClick={() => assetId && onSelectAsset?.(assetId)}
                        disabled={!assetId}
                        className="w-full rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-left transition hover:border-cyan-500/40 hover:bg-slate-800 disabled:cursor-default disabled:hover:border-slate-700/80 disabled:hover:bg-slate-900/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-mono text-sm font-bold leading-snug text-white">{wo.work_order_number}</p>
                          <span
                            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityTone(
                              wo.priority
                            )}`}
                          >
                            {wo.priority}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                          <span className="font-semibold text-slate-200">{wo.maintenance_type}</span>
                          {wo.description ? ` — ${wo.description}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(
                              wo.status
                            )}`}
                          >
                            {wo.status}
                          </span>
                          {wo.assigned_crew ? (
                            <span className="text-[11px] text-slate-400">Crew: {wo.assigned_crew}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {progress}% complete
                          {wo.asset_code || assetId ? ` · ${wo.asset_code || assetId}` : ''}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : alerts.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm font-medium text-slate-300">{config.emptyLabel}</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => onSelectAsset?.(alert.asset_id)}
                    className="w-full rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-left transition hover:border-cyan-500/40 hover:bg-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-snug text-white">{alert.title}</p>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityTone(
                          alert.priority
                        )}`}
                      >
                        {alert.priority}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                      <span className="font-semibold text-slate-200">{alert.alert_type}</span>
                      {alert.message ? ` — ${alert.message}` : ''}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{alert.asset_id}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

export default function DashboardKpiStrip({
  assetsCount,
  activeAlertsCount,
  criticalAlertsCount,
  openWorkOrders,
  coveragePct = 0,
  placeLabel,
  aiDetections24h = 0,
  runs24h = 0,
  kmlHint,
  alerts = [],
  workOrders = [],
  onSelectAsset,
  onOpenMission,
  interactionMode = 'operations',
}: DashboardKpiStripProps) {
  const isExplorer = interactionMode === 'explorer'
  const [openDropdown, setOpenDropdown] = useState<KpiDropdownKind>(null)
  const [anchor, setAnchor] = useState<DropdownAnchor | null>(null)
  const activeCardRef = useRef<HTMLDivElement>(null)
  const criticalCardRef = useRef<HTMLDivElement>(null)
  const workOrdersCardRef = useRef<HTMLDivElement>(null)

  const cardRefs: Record<Exclude<KpiDropdownKind, null>, React.RefObject<HTMLDivElement | null>> = {
    active: activeCardRef,
    critical: criticalCardRef,
    workorders: workOrdersCardRef,
  }

  const openAlerts = useMemo(() => alerts.filter((a) => a.status === 'open'), [alerts])
  const criticalAlerts = useMemo(
    () =>
      openAlerts.filter(
        (a) => a.priority.toLowerCase() === 'critical' || a.priority.toLowerCase() === 'high'
      ),
    [openAlerts]
  )
  const openWorkOrderItems = useMemo(
    () => workOrders.filter((wo) => OPEN_WO_STATUSES.has(wo.status)),
    [workOrders]
  )

  const toggleDropdown = (kind: Exclude<KpiDropdownKind, null>) => {
    if (isExplorer) return
    setOpenDropdown((prev) => {
      const next = prev === kind ? null : kind
      if (next) {
        setAnchor(computeAnchor(cardRefs[kind].current))
      } else {
        setAnchor(null)
      }
      return next
    })
  }

  useEffect(() => {
    if (isExplorer) {
      setOpenDropdown(null)
      setAnchor(null)
    }
  }, [isExplorer])

  const closeDropdown = () => {
    setOpenDropdown(null)
    window.setTimeout(() => setAnchor(null), 220)
  }

  useEffect(() => {
    if (!openDropdown) return
    const updateAnchor = () => {
      setAnchor(computeAnchor(cardRefs[openDropdown].current))
    }
    updateAnchor()
    window.addEventListener('resize', updateAnchor)
    window.addEventListener('scroll', updateAnchor, true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', updateAnchor)
      window.removeEventListener('scroll', updateAnchor, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [openDropdown])

  return (
    <div className="space-y-1">
      {placeLabel && (
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
          Region: <span className="text-blue-400">{placeLabel}</span>
          {kmlHint ? <span className="ml-2 normal-case tracking-normal text-slate-600">· {kmlHint}</span> : null}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <KpiCard
          title="Monitored Assets"
          value={<AnimatedNumber value={assetsCount} format={formatCount} />}
          trend="KML"
          icon={Boxes}
          glow="emerald"
          valueClass="text-white"
          sparkColor="#34d399"
          titleAttr="Total towers + lines + substations from KML for this region"
        />

        <div ref={activeCardRef}>
          <KpiCard
            title="Active Alerts"
            value={<AnimatedNumber value={activeAlertsCount} format={formatCount} />}
            trend={activeAlertsCount > 0 ? 'Live' : 'Clear'}
            trendUp={activeAlertsCount === 0}
            icon={AlertTriangle}
            glow="amber"
            valueClass="text-amber-400"
            sparkColor="#fbbf24"
            onClick={isExplorer ? undefined : () => toggleDropdown('active')}
            expanded={!isExplorer && openDropdown === 'active'}
            alertGlow={activeAlertsCount > 0}
            titleAttr={
              isExplorer
                ? 'Select a state to drill into active alerts'
                : 'Show active alerts for this region'
            }
          />
        </div>

        <div ref={criticalCardRef}>
          <KpiCard
            title="Critical Alerts"
            value={<AnimatedNumber value={criticalAlertsCount} format={formatCount} />}
            trend={criticalAlertsCount > 0 ? 'Action' : 'OK'}
            trendUp={criticalAlertsCount === 0}
            icon={ShieldCheck}
            glow="red"
            valueClass="text-red-500"
            sparkColor="#f87171"
            onClick={isExplorer ? undefined : () => toggleDropdown('critical')}
            expanded={!isExplorer && openDropdown === 'critical'}
            alertGlow={criticalAlertsCount > 0}
            titleAttr={
              isExplorer
                ? 'Select a state to drill into critical alerts'
                : 'Show critical / high priority alerts'
            }
          />
        </div>

        <KpiCard
          title="Coverage %"
          value={
            <>
              <AnimatedNumber value={coveragePct} integer={false} format={(n) => n.toFixed(1)} />%
            </>
          }
          trend="Live"
          icon={Radar}
          glow="cyan"
          valueClass="text-cyan-300"
          sparkColor="#22d3ee"
          titleAttr="Share of loaded corridor assets that are online"
        />
        <KpiCard
          title="AI Detections"
          value={<AnimatedNumber value={aiDetections24h} format={formatCount} />}
          trend="24h"
          icon={BrainCircuit}
          glow="indigo"
          valueClass="text-indigo-400"
          sparkColor="#a78bfa"
          onClick={isExplorer ? undefined : onOpenMission}
          titleAttr="Satellite + AI findings from monitoring runs in the last 24 hours"
        />
        <KpiCard
          title="Runs (24H)"
          value={<AnimatedNumber value={runs24h} format={formatCount} />}
          trend="Sat"
          icon={Activity}
          glow="blue"
          valueClass="text-white"
          sparkColor="#60a5fa"
          onClick={isExplorer ? undefined : onOpenMission}
          titleAttr="Satellite monitoring pipeline executions in the last 24 hours"
        />
        <div ref={workOrdersCardRef}>
          <KpiCard
            title="Work Orders"
            value={
              openWorkOrders != null ? <AnimatedNumber value={openWorkOrders} format={formatCount} /> : '—'
            }
            trend={openWorkOrders && openWorkOrders > 0 ? 'Open' : 'Hold'}
            trendUp={!openWorkOrders}
            icon={ClipboardList}
            glow="slate"
            valueClass="text-white"
            sparkColor="#94a3b8"
            onClick={isExplorer ? undefined : () => toggleDropdown('workorders')}
            expanded={!isExplorer && openDropdown === 'workorders'}
            titleAttr={
              isExplorer
                ? 'Select a state to review work orders'
                : 'Show open maintenance work orders'
            }
          />
        </div>
      </div>

      {!isExplorer && (
      <KpiDropdownOverlay
        open={openDropdown !== null}
        kind={openDropdown}
        anchor={anchor}
        activeAlerts={openAlerts}
        criticalAlerts={criticalAlerts}
        openWorkOrderItems={openWorkOrderItems}
        onClose={closeDropdown}
        onSelectAsset={(assetId) => {
          closeDropdown()
          onSelectAsset?.(assetId)
        }}
      />
      )}
    </div>
  )
}
