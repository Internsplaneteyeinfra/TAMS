import { fetchApi, getApiBase, postApi } from '@/lib/api'

export interface GeotechSoilLayer {
  depth_from_m: number
  depth_to_m: number
  gravel_pct?: number
  sand_pct?: number
  silt_pct?: number
  clay_pct?: number
  ll?: number
  pl?: number
  pi?: number
  soil_class?: string
  mdd?: number
  omc?: number
  dry_density?: number
  fsi?: number
  bulk_density?: number
  ucs?: number
  sg?: number
  sbc?: number
  cbr?: number
  remarks?: string
}

export interface GeotechInvestigation {
  id: string
  geotech_id?: string
  site_code: string
  site_name: string
  project_name?: string | null
  client_name?: string | null
  purpose?: string | null
  region?: string | null
  latitude: number
  longitude: number
  investigation_depth_m: number
  groundwater_note?: string | null
  soil_layers?: GeotechSoilLayer[]
  design_params?: Record<string, unknown>
  sbc_by_depth?: Array<{ depth_m: number; sbc_tm2: number; design?: boolean }>
  pile_capacities?: Array<{
    diameter_mm: number
    depth_m: number
    vertical_t: number
    uplift_t: number
    lateral_t: number
  }>
  cbr_by_depth?: Array<{
    depth_from_m: number
    depth_to_m: number
    soil_type?: string
    cbr_pct: number
  }>
  resistivity?: {
    method?: string
    formula?: string
    adopted_ohm_m?: number
    target_earth_resistance_ohm?: number
    earthing_type?: string
    pit_depth_m?: number
    layers?: Array<{
      depth_from_m: number
      depth_to_m: number
      soil_type?: string
      resistivity_ohm_m?: string
    }>
  }
  recommendations?: {
    adopted_sbc_tm2?: number
    design_depth_m?: number
    governing_cbr_pct?: number
    recommended_pile?: string
    settlement_mm?: number
    settlement_status?: string
  }
  remarks?: string | null
  source?: string
}

export interface GeotechNearest {
  id: string
  site_code: string
  site_name: string
  latitude: number
  longitude: number
  distance_km: number
  adopted_sbc_tm2?: number
  design_depth_m?: number
  governing_cbr_pct?: number
  adopted_resistivity_ohm_m?: number
  groundwater_note?: string
  investigation_depth_m?: number
  recommended_pile?: string
  layer_count?: number
  full?: GeotechInvestigation
}

export type GeotechPayload = Omit<GeotechInvestigation, 'id' | 'geotech_id' | 'source'>

export async function fetchGeotechList(pageSize = 100): Promise<GeotechInvestigation[]> {
  return fetchApi<GeotechInvestigation[]>(`/geotech?page_size=${pageSize}`)
}

export async function fetchGeotechNearest(
  lat: number,
  lon: number,
  maxKm = 5
): Promise<GeotechNearest | null> {
  try {
    return await fetchApi<GeotechNearest | null>(
      `/geotech/nearest?lat=${lat}&lon=${lon}&max_km=${maxKm}`
    )
  } catch {
    return null
  }
}

export async function createGeotech(payload: GeotechPayload): Promise<GeotechInvestigation> {
  return postApi<GeotechInvestigation>('/geotech', payload)
}

export async function updateGeotech(
  id: string,
  payload: Partial<GeotechPayload>
): Promise<GeotechInvestigation> {
  const res = await fetch(`${getApiBase()}/geotech/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  return json.data as GeotechInvestigation
}

export async function deleteGeotech(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/geotech/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export function getGeotechReportUrl(id: string): string {
  return `${getApiBase()}/geotech/${id}/report`
}
