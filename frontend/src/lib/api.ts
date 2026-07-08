const CONFIGURED_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'

// Hosted backend (Railway). Used automatically when the app is served from a
// non-local host and no absolute API base was provided at build time.
const HOSTED_BACKEND_BASE = 'https://web-production-3cc0c.up.railway.app/api/v1'

function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const isLocal = host === 'localhost' || host === '127.0.0.1'
    if (!isLocal && CONFIGURED_BASE.startsWith('/')) {
      return HOSTED_BACKEND_BASE
    }
  }
  return CONFIGURED_BASE
}

export function getApiBase(): string {
  return resolveApiBase()
}

type FetchInit = Parameters<typeof fetch>[1]

async function parseApiResponse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || `Failed to fetch ${path}`)
  }
  const json = await res.json()
  return json.data as T
}

export async function fetchApi<T>(path: string, init?: FetchInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, init)
  return parseApiResponse<T>(res, path)
}

export async function postApi<T>(path: string, body: unknown, init?: FetchInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  })
  return parseApiResponse<T>(res, path)
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
  confidence?: number
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

export async function acknowledgeAlarm(alarmId: string, notes?: string): Promise<Alert> {
  return postApi<Alert>(`/alarms/${alarmId}/acknowledge`, { notes: notes || 'Acknowledged from UI' })
}

export interface WorkOrder {
  id: string
  work_order_number: string
  asset_id?: string
  asset_code?: string
  maintenance_type: string
  priority: string
  status: string
  description?: string
  assigned_crew?: string
  progress_pct?: number
}

export interface MaintenanceDashboard {
  open_work_orders: number
  pm_compliance_pct: number
}

export async function getWorkOrders(pageSize = 20): Promise<WorkOrder[]> {
  return fetchApi<WorkOrder[]>(`/workorders?page_size=${pageSize}`)
}

export async function getMaintenanceDashboard(): Promise<MaintenanceDashboard> {
  return fetchApi<MaintenanceDashboard>('/dashboard/maintenance')
}

export async function createAsset(body: Record<string, unknown>): Promise<Asset> {
  return postApi<Asset>('/assets', body)
}
