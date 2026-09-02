'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, RefreshCw, X } from 'lucide-react'

import type { GeotechnicalIntelligence } from '../geotech'
import type { SiteSignals } from '../scoring'
import type { TowerCandidate } from '../towerPlanning/types'
import { buildFullGeotechAnalysisHtml } from './buildFullGeotechAnalysisHtml'
import { buildGeminiGeoSummary, geminiReportCacheKey } from './buildGeminiGeoSummary'
import {
  fetchCachedGeminiGeotechReport,
  generateGeminiGeotechReport,
  type GeminiGeotechReportResult,
} from '@/lib/geotechApi'

function readSessionCache(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionCache(key: string, html: string): void {
  try {
    sessionStorage.setItem(key, html)
  } catch {
    /* quota / private mode */
  }
}

export default function FullGeotechAnalysisModal({
  open,
  onClose,
  siteLabel,
  lat,
  lon,
  geo,
  signals,
  towerCandidates,
  powerChecked,
}: {
  open: boolean
  onClose: () => void
  siteLabel: string
  lat: number
  lon: number
  geo: GeotechnicalIntelligence
  signals?: SiteSignals | null
  towerCandidates?: TowerCandidate[]
  powerChecked?: boolean
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Pick<GeminiGeotechReportResult, 'cached' | 'source' | 'place_label'>>({})

  const placeLabel =
    signals?.placeLabel ||
    (geo.location.placeLabel.value as string) ||
    siteLabel ||
    `${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E`

  const loadReport = async (force = false) => {
    const cacheKey = geminiReportCacheKey(lat, lon)
    setLoading(true)
    setError(null)

    if (!force) {
      const sessionHit = readSessionCache(cacheKey)
      if (sessionHit) {
        setHtml(sessionHit)
        setMeta({ cached: true, source: 'cache', place_label: placeLabel })
        setLoading(false)
        return
      }
    }

    try {
      if (!force) {
        const cached = await fetchCachedGeminiGeotechReport(lat, lon)
        if (cached?.html) {
          writeSessionCache(cacheKey, cached.html)
          setHtml(cached.html)
          setMeta({
            cached: true,
            source: 'cache',
            place_label: cached.place_label ?? placeLabel,
          })
          setLoading(false)
          return
        }
      }

      const region =
        (geo.location.landCover.value as string) ||
        signals?.placeLabel ||
        undefined

      const result = await generateGeminiGeotechReport({
        latitude: lat,
        longitude: lon,
        place_label: placeLabel,
        region,
        geo_summary: buildGeminiGeoSummary(geo, lat, lon, placeLabel, signals),
        force,
      })

      writeSessionCache(cacheKey, result.html)
      setHtml(result.html)
      setMeta({
        cached: result.cached,
        source: result.source ?? (result.cached ? 'cache' : 'gemini'),
        place_label: result.place_label ?? placeLabel,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gemini report unavailable'
      setError(msg)
      const fallback = buildFullGeotechAnalysisHtml({
        siteLabel: placeLabel,
        lat,
        lon,
        geo,
        signals,
        towerCandidates,
        powerChecked,
      })
      setHtml(fallback)
      setMeta({ cached: false, source: 'local', place_label: placeLabel })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadReport(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when coordinates or geo version changes
  }, [open, lat, lon, geo.version, geo.generatedAt])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const sourceLabel =
    meta.source === 'gemini'
      ? 'AI report (Gemini)'
      : meta.source === 'cache'
        ? 'Cached report (same coordinates)'
        : meta.source === 'local'
          ? 'Local GIS report (Gemini unavailable)'
          : 'Report'

  return createPortal(
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="relative flex flex-col w-[min(960px,calc(100vw-2rem))] max-h-[90vh] rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">Full geotechnical analysis</p>
            <p className="text-[10px] text-slate-500 truncate">
              {meta.place_label ?? placeLabel} · {sourceLabel}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title="Regenerate (calls Gemini — uses tokens)"
              onClick={() => void loadReport(true)}
              disabled={loading}
              className="rounded-lg p-1.5 hover:bg-slate-200 disabled:opacity-50"
              aria-label="Regenerate report"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-200" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {loading && !html ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-slate-600">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-sm">Generating report for {placeLabel}…</p>
            <p className="text-[10px] text-slate-400">Same coordinates reuse cached report — no repeat Gemini call</p>
          </div>
        ) : (
          <>
            {error ? (
              <p className="px-4 py-2 text-[11px] text-amber-800 bg-amber-50 border-b border-amber-100">{error}</p>
            ) : null}
            <iframe
              title="Full geotechnical analysis"
              srcDoc={html ?? ''}
              className="flex-1 w-full min-h-[70vh] border-0 bg-white"
              sandbox="allow-same-origin"
            />
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
