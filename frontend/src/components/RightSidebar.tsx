import React, { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  UserCheck,
} from 'lucide-react'
import {
  runMonitoringCycle,
  acknowledgeAlert,
  type Alert,
  type Asset,
} from '@/lib/api'

interface RightSidebarProps {
  assets: Asset[]
  alerts: Alert[]
  selectedAssetId?: string | null
  onSelectAsset: (id: string) => void
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertOctagon className="w-3.5 h-3.5 text-red-400" />,
  high: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />,
  medium: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  low: <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />,
}

// Static mock Work Orders for utility realism
const MOCK_WORK_ORDERS = [
  {
    id: 'WO-8041',
    team: 'Crew Alpha (HV)',
    task: 'Phase B Bushing Replacement',
    priority: 'critical',
    eta: '45 mins',
    progress: 75,
  },
  {
    id: 'WO-8045',
    team: 'Crew Delta (ROW)',
    task: 'Conductor Clearance Trim',
    priority: 'high',
    eta: '2.5 hrs',
    progress: 30,
  },
  {
    id: 'WO-7998',
    team: 'Crew Gamma',
    task: 'Tower 42 Foundation Seal',
    priority: 'medium',
    eta: '12.0 hrs',
    progress: 85,
  },
]

export default function RightSidebar({
  assets,
  alerts,
  selectedAssetId,
  onSelectAsset,
}: RightSidebarProps) {
  const queryClient = useQueryClient()
  const [pipelineProgress, setPipelineProgress] = React.useState(0)
  const [activeStage, setActiveStage] = React.useState<number | null>(null)

  const mutation = useMutation({
    mutationFn: () => runMonitoringCycle(selectedAssetId ? [selectedAssetId] : undefined),
    onMutate: () => {
      setPipelineProgress(0)
      setActiveStage(1)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  // Simulated progress bar animation
  React.useEffect(() => {
    if (mutation.isPending) {
      const timer = setInterval(() => {
        setPipelineProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer)
            setActiveStage(null)
            return 100
          }
          const next = prev + 8
          if (next > 85) setActiveStage(5)
          else if (next > 65) setActiveStage(4)
          else if (next > 45) setActiveStage(3)
          else if (next > 20) setActiveStage(2)
          return next
        })
      }, 150)
      return () => clearInterval(timer)
    }
  }, [mutation.isPending])

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  // Filter alerts grouped by priority
  const groupedAlerts = useMemo(() => {
    const open = alerts.filter((a) => a.status === 'open')
    return {
      critical: open.filter((a) => a.priority === 'critical' || a.priority === 'high'),
      medium: open.filter((a) => a.priority === 'medium'),
      low: open.filter((a) => a.priority === 'low'),
    }
  }, [alerts])

  return (
    <div className="w-90 bg-slate-950 border-l border-slate-800 flex flex-col min-h-0 h-full overflow-hidden select-none">
      
      {/* SECTION 1: Pipeline Control & Workflow */}
      <div className="p-4 border-b border-slate-900 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Satellite & AI Pipeline</h2>
          <span className="text-[10px] text-slate-500 font-mono">Speed: 4.8 GB/s</span>
        </div>

        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:from-slate-900 disabled:to-slate-900 disabled:text-slate-500 disabled:opacity-50 active:scale-[0.98] transition-all text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 border border-blue-500/20 shadow-lg shadow-blue-500/5"
        >
          {mutation.isPending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" />
              Acquiring Copernicus L1B Data ({pipelineProgress}%)
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Execute Satellite Monitoring Cycle
            </>
          )}
        </button>

        {/* 6 Pipeline Stages */}
        <div className="space-y-1.5 pt-1.5">
          {[
            { id: 1, name: 'Satellite Data Acquisition', desc: 'Copernicus Sentinel STAC download' },
            { id: 2, name: 'AI Feature Extraction', desc: 'Tower detection & canopy segmentation' },
            { id: 3, name: 'Change Detection Model', desc: 'Bands ratio & structural displacement' },
            { id: 4, name: 'Risk Analytics Model', desc: 'Overlaying weather indices' },
            { id: 5, name: 'Alert Generation Engine', desc: 'Dispatching critical warnings' },
            { id: 6, name: 'Work Order Dispatcher', desc: 'Resource assignment & crew alert' },
          ].map((stage) => {
            const isCompleted = mutation.isSuccess || (pipelineProgress > 0 && activeStage !== null && stage.id < activeStage)
            const isRunning = mutation.isPending && activeStage === stage.id

            return (
              <div
                key={stage.id}
                className={`p-2 rounded-lg border text-left flex items-start gap-2.5 transition-all duration-200 ${
                  isRunning
                    ? 'bg-blue-950/20 border-blue-500/30'
                    : isCompleted
                    ? 'bg-emerald-950/5 border-emerald-500/10 opacity-70'
                    : 'bg-slate-900/30 border-slate-900/60 opacity-40'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : isRunning ? (
                  <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mt-0.5 flex-shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-400 mt-0.5 flex-shrink-0">
                    {stage.id}
                  </span>
                )}
                <div className="flex-1 space-y-0.5">
                  <div className="flex justify-between items-center">
                    <p className="text-[11px] font-bold text-slate-200 leading-none">{stage.name}</p>
                    {isRunning && <span className="text-[9px] text-blue-400 font-bold font-mono">ACTIVE</span>}
                  </div>
                  <p className="text-[9px] text-slate-500">{stage.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-slate-900">
        
        {/* SECTION 2: Alert Center */}
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alert Center</h2>
            <div className="flex gap-1.5 text-[9px] font-bold">
              <span className="text-red-400 bg-red-400/10 border border-red-500/20 px-1.5 py-0.2 rounded font-mono">
                {groupedAlerts.critical.length} Critical
              </span>
              <span className="text-amber-400 bg-amber-400/10 border border-amber-500/20 px-1.5 py-0.2 rounded font-mono">
                {groupedAlerts.medium.length + groupedAlerts.low.length} Warning
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
            {alerts.filter((a) => a.status === 'open').length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs border border-slate-900 rounded-xl">
                No active grid alerts
              </div>
            ) : (
              alerts
                .filter((a) => a.status === 'open')
                .map((alert) => {
                  const assetName = assets.find((as) => as.id === alert.asset_id)?.name || alert.asset_id
                  return (
                    <div
                      key={alert.id}
                      className="p-3 bg-slate-900 border border-slate-850 rounded-xl flex items-start gap-2.5"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {SEVERITY_ICONS[alert.priority] || SEVERITY_ICONS.medium}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-200 text-xs">{alert.title}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.2 rounded border uppercase font-mono ${
                            SEVERITY_COLORS[alert.priority] || SEVERITY_COLORS.medium
                          }`}>
                            {alert.priority}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Asset: {assetName}</p>
                        <p className="text-[10px] text-slate-500 leading-normal">{alert.message}</p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-white rounded text-[9px] font-bold border border-slate-700 transition"
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => onSelectAsset(alert.asset_id)}
                            className="px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded text-[9px] font-bold border border-blue-500/20 transition"
                          >
                            Locate
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>

        {/* SECTION 3: Work Orders */}
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Maintenance dispatches</h2>
            <span className="text-[10px] text-slate-500 font-mono">3 Active Crews</span>
          </div>

          <div className="space-y-2">
            {MOCK_WORK_ORDERS.map((wo) => (
              <div
                key={wo.id}
                className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold">{wo.id}</span>
                    <h4 className="text-xs font-extrabold text-white leading-tight">{wo.task}</h4>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${
                    SEVERITY_COLORS[wo.priority] || SEVERITY_COLORS.medium
                  }`}>
                    {wo.priority}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 font-medium">
                  <div className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>{wo.team}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>ETA: {wo.eta}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>Task Progress</span>
                    <span>{wo.progress}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${wo.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
