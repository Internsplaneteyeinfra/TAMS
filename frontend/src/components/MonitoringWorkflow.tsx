/**
 * Monitoring workflow panel — run pipeline and show stage progress
 */

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Check, AlertCircle } from 'lucide-react'

import {
  getWorkflow,
  runMonitoringCycle,
  type MonitoringRunResult,
  type WorkflowDefinition,
} from '@/lib/api'

const STAGE_LABELS: Record<string, string> = {
  acquire: 'Acquire Imagery',
  detect: 'Asset Detection',
  compare: 'Change Detection',
  alert: 'Generate Alerts',
  complete: 'Complete',
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-400 text-emerald-400',
  running: 'bg-amber-400 animate-pulse text-amber-400',
  pending: 'bg-slate-500 text-slate-500',
  skipped: 'bg-slate-600 text-slate-600',
  failed: 'bg-red-400 text-red-400',
}

const STATUS_DOT_BG: Record<string, string> = {
  completed: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
  running: 'bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.6)]',
  pending: 'bg-slate-600',
  skipped: 'bg-slate-700',
  failed: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
}

export default function MonitoringWorkflow({
  selectedAssetId,
}: {
  selectedAssetId?: string | null
}) {
  const queryClient = useQueryClient()
  const [lastRun, setLastRun] = useState<MonitoringRunResult | null>(null)

  const { data: workflow } = useQuery({
    queryKey: ['workflow'],
    queryFn: getWorkflow,
  })

  const mutation = useMutation({
    mutationFn: () =>
      runMonitoringCycle(selectedAssetId ? [selectedAssetId] : undefined),
    onSuccess: (result) => {
      setLastRun(result)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  const wf = workflow as WorkflowDefinition | undefined

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Monitoring Pipeline</h2>
        <p className="text-gray-500 text-xs mt-1 leading-relaxed">
          {selectedAssetId
            ? 'Run automated CV detection for the selected asset corridor'
            : 'Execute full satellite monitoring cycle across the Right of Way'}
        </p>
      </div>

      {wf && (
        <div className="text-[11px] text-slate-400 bg-gray-900 border border-gray-800 rounded-lg p-2.5 space-y-1.5">
          <p className="font-semibold text-gray-500 uppercase tracking-wide text-[9px] mb-1">Pipeline Stages</p>
          {wf.stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              <span className="font-medium text-slate-300">{stage.name}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full py-2 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-gray-800 disabled:to-gray-800 disabled:text-slate-500 disabled:opacity-50 active:scale-[0.98] transition-all text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-md shadow-indigo-600/5"
      >
        {mutation.isPending ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-transparent rounded-full animate-spin" />
            Running pipeline…
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Monitoring Cycle
          </>
        )}
      </button>

      {mutation.isError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{(mutation.error as Error).message}</span>
        </div>
      )}

      {lastRun && (
        <div className="bg-gray-850 border border-gray-800 rounded-xl p-3.5 text-xs space-y-3.5 shadow-md">
          <div className="flex justify-between items-center pb-2 border-b border-gray-800">
            <span className="font-bold text-slate-200">Run: {lastRun.run_id}</span>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold uppercase">
              {lastRun.status}
            </span>
          </div>
          
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Monitored <span className="font-semibold text-slate-200">{lastRun.assets_monitored}</span> assets using <span className="font-semibold text-slate-200">{lastRun.scenes_acquired}</span> satellite scenes, triggering <span className="font-semibold text-slate-200">{lastRun.alerts_generated.length}</span> new warnings.
          </p>

          <div className="space-y-3">
            {lastRun.stages.map((stage) => (
              <div key={stage.stage} className="flex items-start gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 border border-gray-900 ${STATUS_DOT_BG[stage.status] || 'bg-gray-500'}`}
                />
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-200 text-[11px]">{STAGE_LABELS[stage.stage] || stage.stage}</p>
                  <p className="text-gray-500 text-[10px] leading-normal">{stage.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

