/**
 * Monitoring workflow panel — run pipeline and show stage progress
 */

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
  completed: 'bg-tams-success',
  running: 'bg-tams-warning animate-pulse',
  pending: 'bg-gray-500',
  skipped: 'bg-gray-600',
  failed: 'bg-tams-danger',
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
    <div className="space-y-3 px-4 pb-4 border-t border-gray-700 pt-4">
      <div>
        <h2 className="text-lg font-semibold">Monitoring Pipeline</h2>
        <p className="text-gray-400 text-xs mt-1">
          {selectedAssetId
            ? 'Run cycle for selected asset'
            : 'Run full corridor monitoring cycle'}
        </p>
      </div>

      {wf && (
        <div className="text-xs text-gray-400 space-y-1">
          {wf.stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tams-primary flex-shrink-0" />
              <span>{stage.name}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full py-2 px-3 bg-tams-primary hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium transition"
      >
        {mutation.isPending ? 'Running pipeline…' : 'Run Monitoring Cycle'}
      </button>

      {mutation.isError && (
        <p className="text-tams-danger text-xs">{(mutation.error as Error).message}</p>
      )}

      {lastRun && (
        <div className="bg-gray-700 rounded p-3 text-xs space-y-2">
          <p className="font-semibold text-sm">Run {lastRun.run_id}</p>
          <p className="text-gray-400">
            {lastRun.assets_monitored} assets · {lastRun.scenes_acquired} scenes ·{' '}
            {lastRun.alerts_generated.length} new alerts
          </p>
          <div className="space-y-1">
            {lastRun.stages.map((stage) => (
              <div key={stage.stage} className="flex items-start gap-2">
                <span
                  className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${STATUS_COLORS[stage.status] || 'bg-gray-500'}`}
                />
                <div>
                  <p className="font-medium">{STAGE_LABELS[stage.stage] || stage.stage}</p>
                  <p className="text-gray-400">{stage.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
