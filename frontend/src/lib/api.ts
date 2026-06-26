const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'

type FetchInit = Parameters<typeof fetch>[1]

export async function fetchApi<T>(path: string, init?: FetchInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `Failed to fetch ${path}`)
  }
  const json = await res.json()
  return json.data as T
}

export interface AssetGeometry {
  type: 'LineString' | 'Polygon'
  coordinates: number[][] | number[][][]
}

export interface Asset {
  id: string
  name: string
  asset_type: 'tower' | 'line' | 'substation'
  latitude: number
  longitude: number
  health_score?: string
  status?: string
  description?: string
  metadata?: Record<string, unknown>
  geometry?: AssetGeometry
}

export interface Alert {
  id: string
  asset_id: string
  title: string
  priority: string
  alert_type: string
  status: string
  message?: string
}

export interface WorkflowStage {
  stage: string
  status: string
  summary: string
}

export interface MonitoringRunResult {
  run_id: string
  status: string
  assets_monitored: number
  scenes_acquired: number
  alerts_generated: string[]
  stages: WorkflowStage[]
}

export interface WorkflowDefinition {
  name: string
  stages: Array<{ id: string; name: string }>
}

export async function runMonitoringCycle(assetIds?: string[]): Promise<MonitoringRunResult> {
  return fetchApi<MonitoringRunResult>('/monitoring/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset_ids: assetIds ?? [],
      sources: ['sentinel-2', 'sentinel-1'],
      generate_alerts: true,
    }),
  })
}

export async function getWorkflow(): Promise<WorkflowDefinition> {
  return fetchApi<WorkflowDefinition>('/monitoring/workflow')
}

export async function acknowledgeAlert(alertId: string): Promise<Alert> {
  return fetchApi<Alert>(`/alerts/${alertId}/acknowledge`, { method: 'PATCH' })
}
