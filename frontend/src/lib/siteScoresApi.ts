import { fetchApi, getApiBase, postApi } from '@/lib/api'

export interface SiteScoreFactor {
  id?: string
  label?: string
  score?: number
  weight?: number
  rawLabel?: string
  note?: string
  source?: string
}

export interface SavedSiteScore {
  id: string
  score_id?: string
  site_label: string
  place_label?: string | null
  latitude: number
  longitude: number
  final_score: number
  verdict: string
  confidence_pct?: number | null
  voltage_kv?: number | null
  search_radius_km?: number | null
  summary?: string | null
  result_payload?: Record<string, unknown> | null
  factors?: SiteScoreFactor[] | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  source?: string
}

export type SiteScoreCreatePayload = {
  site_label: string
  place_label?: string | null
  latitude: number
  longitude: number
  final_score: number
  verdict: string
  confidence_pct?: number | null
  voltage_kv?: number | null
  search_radius_km?: number | null
  summary?: string | null
  result_payload?: Record<string, unknown> | null
  factors?: SiteScoreFactor[] | null
  notes?: string | null
}

export async function fetchSiteScores(pageSize = 100, q?: string): Promise<SavedSiteScore[]> {
  const qs = new URLSearchParams({ page_size: String(pageSize), page: '1' })
  if (q?.trim()) qs.set('q', q.trim())
  return fetchApi<SavedSiteScore[]>(`/site-scores?${qs.toString()}`)
}

export async function fetchSiteScore(id: string): Promise<SavedSiteScore> {
  return fetchApi<SavedSiteScore>(`/site-scores/${id}`)
}

export async function createSiteScore(payload: SiteScoreCreatePayload): Promise<SavedSiteScore> {
  return postApi<SavedSiteScore>('/site-scores', payload)
}

export async function deleteSiteScore(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/site-scores/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}
