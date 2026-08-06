const CONFIGURED_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'

// Optional absolute overrides only. Unset = same origin the UI was opened on.
const LOCAL_API_OVERRIDE = process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL || ''
const HOSTED_API_OVERRIDE = process.env.NEXT_PUBLIC_HOSTED_API_BASE_URL || ''

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

function isPrivateHost(host: string): boolean {
  if (isLoopbackHost(host)) return true
  if (host.startsWith('192.168.') || host.startsWith('10.')) return true
  const match = host.match(/^172\.(\d+)\./)
  if (!match) return false
  const second = Number(match[1])
  return second >= 16 && second <= 31
}

function resolveApiBase(): string {
  if (CONFIGURED_BASE && !CONFIGURED_BASE.startsWith('/')) {
    return CONFIGURED_BASE.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (isPrivateHost(host) && LOCAL_API_OVERRIDE) {
      return LOCAL_API_OVERRIDE.replace(/\/$/, '')
    }
    if (!isPrivateHost(host) && HOSTED_API_OVERRIDE) {
      return HOSTED_API_OVERRIDE.replace(/\/$/, '')
    }
  }

  return CONFIGURED_BASE || '/api/v1'
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
  /** Rated / nominal voltage from DB column when present. */
  voltage_level_kv?: number | null
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
  started_at?: string
  completed_at?: string
  output?: Record<string, unknown>
}

export interface MonitoringDetection {
  detection_type?: string
  asset_id?: string
  confidence?: number
  severity?: string
  latitude?: number | null
  longitude?: number | null
  details?: Record<string, unknown>
}

export interface MonitoringChange {
  change_type?: string
  asset_id?: string
  severity?: string
  confidence?: number
  description?: string
}

export interface MonitoredAssetSummary {
  id: string
  name: string
  asset_type?: string
  latitude?: number
  longitude?: number
  health_score?: string
  voltage_kv?: number | string | null
}

export interface MonitoringRunResult {
  run_id: string
  status: string
  started_at?: string
  completed_at?: string | null
  assets_monitored: number
  scenes_acquired: number
  alerts_generated: string[]
  stages: WorkflowStage[]
  detections_count?: number
  detections?: MonitoringDetection[]
  changes?: MonitoringChange[]
  monitored_assets?: MonitoredAssetSummary[]
}

export interface WorkflowDefinition {
  name: string
  stages: Array<{ id: string; name: string }>
}

export interface RegionAssetStats {
  towers: number
  lines: number
  substations: number
  total: number
  line_km?: number
  source?: string
}

export async function fetchGisStats(placeId: string): Promise<RegionAssetStats> {
  const params = new URLSearchParams({ place_id: placeId })
  return fetchApi<RegionAssetStats>(`/gis/stats?${params}`)
}

export async function fetchGisPlaceStats(): Promise<Record<string, { total: number }>> {
  return fetchApi<Record<string, { total: number }>>('/gis/stats/places')
}

export interface GisTowersResult {
  assets: Asset[]
  truncated: boolean
  total: number
  limit: number
  source?: string
}

export async function fetchGisTowers(
  bbox: string,
  state?: string,
  limit = 5000,
  signal?: AbortSignal
): Promise<GisTowersResult> {
  const params = new URLSearchParams({ bbox, limit: String(limit) })
  if (state) params.set('state', state)
  const res = await fetch(`${getApiBase()}/gis/towers?${params}`, { signal })
  if (!res.ok) throw new Error('Failed to load towers')
  const json = await res.json()
  const payload = json.data ?? json
  const features = payload?.features ?? []
  const assets = features.map((f: { id: string; properties: Record<string, unknown>; geometry: { coordinates: number[] } }) => {
    const meta = (f.properties.metadata as Record<string, unknown>) ?? {}
    const voltageLevel =
      typeof f.properties.voltage_level_kv === 'number'
        ? f.properties.voltage_level_kv
        : meta.voltage_kv != null
          ? Number(meta.voltage_kv)
          : null
    return {
      id: String(f.id ?? f.properties.asset_id),
      name: String(f.properties.name ?? 'Tower'),
      asset_type: 'tower' as const,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      health_score: String(f.properties.health_score ?? 'healthy'),
      status: 'active',
      voltage_level_kv: Number.isFinite(voltageLevel as number) ? (voltageLevel as number) : null,
      metadata: {
        ...meta,
        ...(voltageLevel != null && Number.isFinite(voltageLevel) && meta.voltage_kv == null
          ? { voltage_kv: voltageLevel }
          : {}),
      },
    }
  })
  const total = typeof payload?.total === 'number' ? payload.total : assets.length
  const truncated =
    typeof payload?.truncated === 'boolean' ? payload.truncated : assets.length >= limit
  return {
    assets,
    truncated,
    total,
    limit,
    source: typeof payload?.source === 'string' ? payload.source : undefined,
  }
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

export async function fetchMonitoringRuns(limit = 50): Promise<MonitoringRunResult[]> {
  const res = await fetchApi<{ runs: MonitoringRunResult[]; count: number }>(
    `/monitoring/runs?limit=${limit}`
  )
  return res?.runs ?? []
}

/** Count detections on a run (API may omit detections_count). */
export function monitoringDetectionCount(run: MonitoringRunResult): number {
  if (typeof run.detections_count === 'number') return run.detections_count
  return run.detections?.length ?? 0
}

/** Summarize satellite pipeline activity for the KPI strip. */
export function summarizeMonitoringKpis(
  runs: MonitoringRunResult[],
  latest?: MonitoringRunResult | null
): { detections24h: number; runs24h: number; scenes24h: number } {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const byId = new Map<string, MonitoringRunResult>()
  for (const run of runs) {
    if (run?.run_id) byId.set(run.run_id, run)
  }
  if (latest?.run_id) byId.set(latest.run_id, latest)

  let detections24h = 0
  let runs24h = 0
  let scenes24h = 0
  for (const run of byId.values()) {
    const started = run.started_at ? Date.parse(run.started_at) : Date.now()
    if (!Number.isFinite(started) || started < cutoff) continue
    runs24h += 1
    detections24h += monitoringDetectionCount(run)
    scenes24h += run.scenes_acquired ?? 0
  }
  return { detections24h, runs24h, scenes24h }
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

export interface TowerGroundImportResult {
  source_name: string
  import_batch_id: string
  parsed: number
  inserted: number
  skipped: number
}

export async function importTowerGroundKml(file: File): Promise<TowerGroundImportResult> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${getApiBase()}/assets/import/tower-ground-kml`, {
    method: 'POST',
    body,
  })
  return parseApiResponse<TowerGroundImportResult>(res, '/assets/import/tower-ground-kml')
}

export interface StateKmlImportResult {
  state: string
  source_total: number
  lines: number
  substations: number
  towers: number
  inserted: number
  skipped: number
}

export async function importStateKmlPack(
  state?: string,
  includeTowers = true
): Promise<StateKmlImportResult> {
  const params = new URLSearchParams({ include_towers: String(includeTowers) })
  if (state) params.set('state', state)
  const res = await fetch(`${getApiBase()}/assets/import/state-kml?${params}`, {
    method: 'POST',
  })
  return parseApiResponse<StateKmlImportResult>(res, '/assets/import/state-kml')
}
