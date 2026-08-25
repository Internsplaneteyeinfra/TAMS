import React, { useEffect, useState } from 'react'
import {
  Crosshair,
  ZoomIn,
  MapPin,
  Satellite,
  CloudSun,
  Radio,
  Activity,
  Wifi,
  Database,
  Server,
  Cpu,
  HardDrive,
  Navigation,
  BrainCircuit,
} from 'lucide-react'

import type { MapStatusSnapshot } from '@/types/mapStatus'

type IndicatorStatus = 'ok' | 'warning' | 'critical'

interface BottomStatusBarProps {
  mapStatus: MapStatusSnapshot
  selectedAssetName?: string | null
  gridStatus?: 'ok' | 'warning' | 'critical'
  connectionStatus?: 'connected' | 'degraded' | 'offline'
  satellitePass?: string
  weatherSummary?: string | null
  feedStatus?: string
}

function StatusDot({ status }: { status: IndicatorStatus }) {
  const colors = {
    ok: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  }
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[status]}`} />
}

function SystemIndicator({
  icon: Icon,
  label,
  status,
  value,
  tickKey,
}: {
  icon: React.ElementType
  label: string
  status: IndicatorStatus
  value?: string
  tickKey?: string | number
}) {
  return (
    <div className="flex items-center gap-1 min-w-0 shrink-0" title={`${label}: ${status}`}>
      <Icon className="w-3 h-3 text-slate-600 shrink-0" />
      <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">{label}</span>
      <StatusDot status={status} />
      {value && (
        <span key={tickKey ?? value} className="tams-metric-tick text-[9px] font-mono text-slate-400 ml-0.5">
          {value}
        </span>
      )}
    </div>
  )
}

function Divider() {
  return <div className="h-3.5 w-px bg-slate-700/80 shrink-0" />
}

export default function BottomStatusBar({
  mapStatus,
  selectedAssetName,
  gridStatus = 'ok',
  connectionStatus = 'connected',
  satellitePass = '4.5 hrs ago',
  weatherSummary,
  feedStatus = 'Active',
}: BottomStatusBarProps) {
  const [now, setNow] = useState(() => new Date())
  const [latency, setLatency] = useState(42)
  const [cpuPct, setCpuPct] = useState(18)
  const [memPct, setMemPct] = useState(42)

  useEffect(() => {
    const t = window.setInterval(() => {
      try {
        setNow(new Date())
        // Subtle simulated telemetry tick — no network, no lag
        setLatency((v) => Math.max(28, Math.min(96, v + (Math.random() > 0.5 ? 2 : -2))))
        setCpuPct((v) => Math.max(12, Math.min(48, v + (Math.random() > 0.5 ? 1 : -1))))
        setMemPct((v) => Math.max(30, Math.min(62, v + (Math.random() > 0.5 ? 1 : -1))))
      } catch {
        /* ignore */
      }
    }, 15000)
    return () => window.clearInterval(t)
  }, [])

  const coordinates =
    mapStatus.coordinates != null
      ? `${mapStatus.coordinates.lat.toFixed(4)}, ${mapStatus.coordinates.lng.toFixed(4)}`
      : '—'

  const zoomLabel =
    mapStatus.zoom != null ? `Lvl ${mapStatus.zoom.toFixed(1)}` : mapStatus.viewMode === '3d' ? 'Globe' : '—'

  const gridIndicator: IndicatorStatus =
    gridStatus === 'ok' ? 'ok' : gridStatus === 'warning' ? 'warning' : 'critical'

  const wsIndicator: IndicatorStatus =
    connectionStatus === 'connected' ? 'ok' : connectionStatus === 'degraded' ? 'warning' : 'critical'

  const refreshLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const tick = refreshLabel

  return (
    <footer
      className="shrink-0 h-8 border-t border-white/10 bg-[#0a1020]/90 backdrop-blur-xl flex items-center px-3 gap-2 overflow-x-auto scrollbar-thin select-none"
      aria-label="System status bar"
    >
      <SystemIndicator icon={Crosshair} label="Coords" status="ok" value={coordinates} tickKey={coordinates} />
      <Divider />
      <SystemIndicator icon={ZoomIn} label="Zoom" status="ok" value={zoomLabel} tickKey={zoomLabel} />
      <Divider />
      <SystemIndicator
        icon={MapPin}
        label="Asset"
        status={selectedAssetName ? 'ok' : 'warning'}
        value={selectedAssetName ?? 'None'}
        tickKey={selectedAssetName ?? 'none'}
      />
      <Divider />
      <SystemIndicator icon={Cpu} label="CPU" status="ok" value={`${cpuPct}%`} tickKey={`cpu-${cpuPct}`} />
      <Divider />
      <SystemIndicator icon={HardDrive} label="Memory" status="ok" value={`${memPct}%`} tickKey={`mem-${memPct}`} />
      <Divider />
      <SystemIndicator icon={Wifi} label="Network" status={wsIndicator} value={`${latency}ms`} tickKey={`lat-${latency}`} />
      <Divider />
      <SystemIndicator icon={Server} label="API" status="ok" />
      <Divider />
      <SystemIndicator icon={Database} label="Database" status="ok" />
      <Divider />
      <SystemIndicator icon={Navigation} label="Map" status="ok" />
      <Divider />
      <SystemIndicator icon={Satellite} label="Satellite" status="ok" value={satellitePass} />
      <Divider />
      <SystemIndicator icon={CloudSun} label="Weather" status="ok" value={weatherSummary ?? '26°C'} />
      <Divider />
      <SystemIndicator icon={BrainCircuit} label="AI" status="ok" />
      <Divider />
      <SystemIndicator icon={Radio} label="GPS" status="ok" />
      <Divider />
      <SystemIndicator icon={Activity} label="Grid" status={gridIndicator} value={gridStatus.toUpperCase()} />
      <Divider />
      <span key={tick} className="tams-metric-tick text-[9px] font-mono text-slate-500 shrink-0">
        {refreshLabel}
      </span>
      <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 tams-breathe" />
        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">
          {feedStatus} · {mapStatus.viewMode === '3d' ? '3D Globe' : '2D Map'}
        </span>
      </div>
    </footer>
  )
}
