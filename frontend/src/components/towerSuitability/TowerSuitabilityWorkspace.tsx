/**
 * Tower Site Suitability workspace — solar-style flow for transmission pads.
 * Upload / click → analyzing → full report with Accepted / Rejected.
 * KML geometries drawn as map outlines.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileUp,
  Lightbulb,
  Loader2,
  MapPinned,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react'

import {
  collectSiteSignals,
  DEMO_NIRONA,
  parseKmlDocument,
  type KmlFeature,
} from './fetchSiteSignals'
import { downloadSuitabilityReport } from './downloadSuitabilityReport'
import {
  buildSuitabilitySuggestions,
  scoreSiteSignals,
  type SuitabilityResult,
  type SuitabilityVerdict,
} from './scoring'

const MapPane = dynamic(() => import('./TowerSuitabilityMap'), { ssr: false })

function decisionFromVerdict(v: SuitabilityVerdict): {
  label: 'Accepted' | 'Rejected' | 'Review'
  color: string
  bg: string
  border: string
} {
  if (v === 'preferred') {
    return {
      label: 'Accepted',
      color: '#34d399',
      bg: 'rgba(52,211,153,0.14)',
      border: 'rgba(52,211,153,0.5)',
    }
  }
  if (v === 'unsuitable') {
    return {
      label: 'Rejected',
      color: '#f87171',
      bg: 'rgba(248,113,113,0.14)',
      border: 'rgba(248,113,113,0.5)',
    }
  }
  return {
    label: 'Review',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.14)',
    border: 'rgba(251,191,36,0.5)',
  }
}

export default function TowerSuitabilityWorkspace() {
  const [lat, setLat] = useState(DEMO_NIRONA.lat)
  const [lon, setLon] = useState(DEMO_NIRONA.lon)
  const [siteLabel, setSiteLabel] = useState('Click map or upload KML')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState({ message: '', percent: 0 })
  const [result, setResult] = useState<SuitabilityResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kmlFeatures, setKmlFeatures] = useState<KmlFeature[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const analyzeSeq = useRef(0)

  const runAnalyze = useCallback(async (nextLat: number, nextLon: number, label?: string) => {
    const seq = ++analyzeSeq.current
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setSuggestionsOpen(false)
    setLat(nextLat)
    setLon(nextLon)
    if (label) setSiteLabel(label)
    setProgress({ message: 'Fetching satellite & OSM signals…', percent: 8 })
    try {
      const signals = await collectSiteSignals(nextLat, nextLon, (message, percent) => {
        if (seq !== analyzeSeq.current) return
        setProgress({ message, percent })
      })
      if (seq !== analyzeSeq.current) return
      const scored = scoreSiteSignals(signals)
      setProgress({ message: 'Finalizing weighted score…', percent: 100 })
      setResult(scored)
      setSuggestionsOpen(false)
    } catch (e) {
      if (seq !== analyzeSeq.current) return
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      if (seq === analyzeSeq.current) setAnalyzing(false)
    }
  }, [])

  const onMapPick = useCallback(
    (nextLat: number, nextLon: number) => {
      setKmlFeatures([])
      const label = `Pad ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`
      void runAnalyze(nextLat, nextLon, label)
    },
    [runAnalyze]
  )

  const onKml = async (file: File) => {
    const text = await file.text()
    const parsed = parseKmlDocument(text)
    if (!parsed) {
      setError('Could not read KML geometry. Use Point, LineString, or Polygon placemarks.')
      return
    }
    setKmlFeatures(parsed.features)
    const label = file.name.replace(/\.kml$/i, '')
    await runAnalyze(parsed.focus.lat, parsed.focus.lon, label)
  }

  const decision = result ? decisionFromVerdict(result.verdict) : null
  const weightedSum = useMemo(() => {
    if (!result) return 0
    return result.factors.reduce((s, f) => s + f.score * f.weight, 0)
  }, [result])
  const suggestions = useMemo(
    () => (result ? buildSuitabilitySuggestions(result) : null),
    [result]
  )

  const onDownloadReport = useCallback(() => {
    if (!result || !suggestions) return
    downloadSuitabilityReport({
      siteLabel,
      lat,
      lon,
      result,
      suggestions,
      kmlOutlineCount: kmlFeatures.length,
    })
  }, [result, suggestions, siteLabel, lat, lon, kmlFeatures.length])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#060B17] text-slate-200">
      <header className="shrink-0 h-12 border-b border-slate-800/80 bg-[#0e172a] flex items-center gap-3 px-4 z-30">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Grid Command
        </Link>
        <div className="h-5 w-px bg-slate-700" />
        <div className="flex items-center gap-2 min-w-0">
          <MapPinned className="w-4 h-4 text-cyan-300 shrink-0" />
          <h1 className="text-base font-semibold text-white tracking-tight truncate">
            Tower Site Suitability
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {kmlFeatures.length > 0 && (
            <span className="hidden sm:inline text-xs text-cyan-300/90 font-semibold">
              KML · {kmlFeatures.length} outline{kmlFeatures.length === 1 ? '' : 's'}
            </span>
          )}
          <button
            type="button"
            disabled={analyzing}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/10 bg-slate-950/60 text-xs font-bold text-slate-200 hover:border-cyan-500/40 disabled:opacity-50"
          >
            <FileUp className="w-3.5 h-3.5" />
            Upload KML
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".kml,application/vnd.google-earth.kml+xml,text/xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onKml(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {analyzing && (
        <div className="shrink-0 z-30 border-b border-cyan-500/25 bg-cyan-950/40 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-cyan-100">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            <span className="font-semibold">Analyzing…</span>
            <span className="text-cyan-200/90 truncate">{progress.message}</span>
            <span className="ml-auto tabular-nums text-cyan-200 font-semibold">
              {progress.percent}%
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="shrink-0 z-30 px-4 py-2.5 bg-red-950/80 border-b border-red-500/30 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="relative flex-1 min-h-[44vh] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
          <MapPane
            lat={lat}
            lon={lon}
            result={result}
            kmlFeatures={kmlFeatures}
            onPick={onMapPick}
          />

          {/* Left: Suggestions beside +/- zoom, then Download + factor cards below */}
          {result && suggestions && (
            <div className="absolute top-2.5 bottom-2.5 left-2.5 z-[1100] flex flex-col items-stretch gap-2 w-[min(360px,calc(100%-1rem))] max-h-[calc(100%-1.25rem)] pointer-events-none">
              {/* Suggestions beside +/- zoom */}
              <div className="pointer-events-auto flex items-start gap-2 shrink-0">
                <div className="w-[38px] shrink-0" aria-hidden />
                <button
                  type="button"
                  onClick={() => setSuggestionsOpen((v) => !v)}
                  className={`inline-flex items-center gap-2 h-[62px] px-3.5 rounded-xl border text-sm font-bold shadow-xl transition-colors ${
                    suggestionsOpen
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-amber-500 text-slate-950 border-amber-300 hover:bg-amber-400'
                  }`}
                  title="Why not 10/10 — and how to improve"
                >
                  <Lightbulb className="w-4 h-4" />
                  Suggestions
                  <span className="text-xs font-black tabular-nums px-1.5 py-0.5 rounded-md bg-black/15">
                    −{suggestions.remainingToPerfect.toFixed(1)}
                  </span>
                </button>
              </div>

              {suggestionsOpen && (
                <div
                  role="dialog"
                  aria-label="Suitability improvement suggestions"
                  className="pointer-events-auto shrink-0 max-h-[min(28vh,240px)] w-full rounded-2xl border border-slate-600/80 bg-[#0e172a] shadow-2xl overflow-hidden flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-amber-500/10 to-transparent shrink-0">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-300" />
                        How to make this pad suitable
                      </p>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{suggestions.summary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSuggestionsOpen(false)}
                      className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                      aria-label="Close suggestions"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-4 py-3 grid grid-cols-3 gap-2 text-xs border-b border-slate-800/80 shrink-0">
                    <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-2.5 py-2">
                      <p className="text-slate-500">Current</p>
                      <p className="text-base font-black text-white tabular-nums">
                        {suggestions.currentScore.toFixed(1)}
                        <span className="text-slate-500 text-xs font-bold"> / 10</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 border border-amber-500/30 px-2.5 py-2">
                      <p className="text-amber-500/90">Remaining</p>
                      <p className="text-base font-black text-amber-300 tabular-nums">
                        {suggestions.remainingToPerfect.toFixed(1)}
                        <span className="text-amber-500/80 text-xs font-bold">
                          {' '}
                          ({suggestions.remainingPct}%)
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-2.5 py-2">
                      <p className="text-slate-500">To Accepted</p>
                      <p className="text-base font-black text-cyan-300 tabular-nums">
                        {suggestions.pointsToAccepted > 0
                          ? `+${suggestions.pointsToAccepted.toFixed(1)}`
                          : 'Met ✓'}
                      </p>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                    {suggestions.items.length === 0 ? (
                      <p className="text-sm text-slate-400">No material gaps left on screening factors.</p>
                    ) : (
                      suggestions.items.map((item, idx) => (
                        <div
                          key={item.factorId}
                          className="rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-white">
                              <span className="text-slate-500 font-semibold mr-1.5">{idx + 1}.</span>
                              {item.factorLabel}
                            </p>
                            <span className="text-xs font-black tabular-nums text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-md px-1.5 py-0.5">
                              −{item.gapPoints.toFixed(2)} pts
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Score {item.currentScore.toFixed(1)} / {item.maxScore}
                          </p>
                          <p className="text-sm text-slate-300 mt-2 leading-snug">
                            <span className="text-red-300/90 font-semibold">Why not ideal: </span>
                            {item.whyNotIdeal}
                          </p>
                          <p className="text-sm text-emerald-200/90 mt-1.5 leading-snug">
                            <span className="text-emerald-400 font-semibold">Improve: </span>
                            {item.howToImprove}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onDownloadReport}
                className="pointer-events-auto shrink-0 self-start inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-cyan-400/50 bg-cyan-500 text-slate-950 text-sm font-bold shadow-xl hover:bg-cyan-400 transition-colors"
                title="Download full suitability report pamphlet"
              >
                <Download className="w-4 h-4" />
                Download Report
              </button>

              {/* Factor details — flush left, stretches to bottom of map */}
              <div className="pointer-events-auto flex-1 min-h-0 w-full flex flex-col rounded-2xl border border-slate-600/80 bg-[#0e172a] shadow-2xl overflow-hidden">
                <div className="shrink-0 px-4 py-2.5 border-b border-slate-800 bg-[#0e172a]">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                    Factor details
                  </p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
                  {result.factors.map((f) => (
                    <div
                      key={`left-note-${f.id}`}
                      className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3.5 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-50">{f.label}</p>
                        <p className="text-sm font-mono text-cyan-300 shrink-0 text-right">
                          {f.rawLabel}
                        </p>
                      </div>
                      <p className="text-sm text-slate-400 mt-1.5 leading-snug">{f.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!result && !analyzing && (
            <div className="absolute bottom-3 left-3 z-10 pointer-events-none rounded-lg border border-slate-700/70 bg-[#0e172a]/90 px-3 py-2 text-sm text-slate-300">
              Click map or upload KML — outlines draw on the satellite map
            </div>
          )}
        </div>

        <aside className="w-full lg:w-[440px] xl:w-[480px] shrink-0 flex flex-col bg-[#0a1220] min-h-0 max-h-[56vh] lg:max-h-none overflow-hidden">
          <div className="shrink-0 border-b border-slate-800 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Analysis report
                </p>
                <p className="text-base font-semibold text-white truncate mt-1">{siteLabel}</p>
                <p className="text-sm text-slate-400 font-mono mt-1">
                  {lat.toFixed(5)}, {lon.toFixed(5)}
                </p>
              </div>

              {decision && result ? (
                <div
                  className="shrink-0 rounded-xl border px-3.5 py-2.5 text-right min-w-[132px]"
                  style={{
                    color: decision.color,
                    background: decision.bg,
                    borderColor: decision.border,
                  }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    {decision.label === 'Accepted' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : decision.label === 'Rejected' ? (
                      <XCircle className="w-4 h-4" />
                    ) : null}
                    <span className="text-sm font-black tracking-wide">{decision.label}</span>
                  </div>
                  <p className="text-3xl font-black tabular-nums text-white mt-1.5 leading-none">
                    {result.finalScore.toFixed(1)}
                    <span className="text-sm text-slate-400 font-bold"> / 10</span>
                  </p>
                </div>
              ) : analyzing ? (
                <div className="shrink-0 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 font-semibold">
                  Calculating…
                </div>
              ) : (
                <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-500">
                  No result yet
                </div>
              )}
            </div>

            {result && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSuggestionsOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-bold transition-colors ${
                    suggestionsOpen
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-amber-500/15 text-amber-200 border-amber-500/40 hover:bg-amber-500/25'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Suggestions
                  <span className="tabular-nums">−{suggestions?.remainingToPerfect.toFixed(1)}</span>
                </button>
                <button
                  type="button"
                  onClick={onDownloadReport}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-100 text-xs font-bold hover:bg-cyan-500/25 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Report
                </button>
              </div>
            )}

            {result && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-2.5 py-2">
                  <p className="text-slate-500">Weighted Σ</p>
                  <p className="font-bold text-cyan-300 tabular-nums text-base">
                    {weightedSum.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-2.5 py-2">
                  <p className="text-slate-500">Rule</p>
                  <p className="font-bold text-slate-100 leading-snug">≥7 Acc · &lt;4.5 Rej</p>
                </div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-2.5 py-2">
                  <p className="text-slate-500">Confidence</p>
                  <p className="font-bold text-slate-100 tabular-nums text-base">
                    ~{result.confidencePct}%
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {!result && !analyzing && (
              <p className="text-sm text-slate-400 leading-relaxed">
                Upload a KML (points, lines, or polygons). Outlines appear on the map, then the
                full score report with Accepted / Rejected shows here.
              </p>
            )}

            {analyzing && !result && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 text-center">
                <Loader2 className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
                <p className="text-base font-semibold text-white mt-3">Building report…</p>
                <p className="text-sm text-slate-500 mt-1">{progress.message}</p>
              </div>
            )}

            {result && (
              <>
                <div className="rounded-lg border border-amber-500/25 bg-amber-950/25 px-3.5 py-3 text-sm text-amber-100 leading-relaxed flex gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{result.disclaimer}</span>
                </div>

                <div>
                  <p className="text-sm font-bold text-white mb-2">
                    Score calculation (Σ score × weight)
                  </p>
                  <div className="rounded-lg border border-slate-800 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-bold">Factor</th>
                          <th className="text-right px-3 py-2.5 font-bold">Value</th>
                          <th className="text-right px-3 py-2.5 font-bold">Score</th>
                          <th className="text-right px-3 py-2.5 font-bold">Wt</th>
                          <th className="text-right px-3 py-2.5 font-bold">Contrib</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.factors.map((f) => {
                          const contrib = f.score * f.weight
                          return (
                            <tr key={f.id} className="border-t border-slate-800/80">
                              <td className="px-3 py-2.5 text-slate-100">
                                <div className="font-semibold">{f.label}</div>
                                <div className="text-xs text-slate-500">{f.source}</div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                                {f.rawLabel}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                                  f.score >= 7
                                    ? 'text-emerald-400'
                                    : f.score >= 4.5
                                      ? 'text-amber-400'
                                      : 'text-red-400'
                                }`}
                              >
                                {f.score.toFixed(1)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-400">
                                {(f.weight * 100).toFixed(0)}%
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-cyan-300 tabular-nums">
                                {contrib.toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="border-t border-slate-600 bg-slate-950/80">
                          <td className="px-3 py-3 font-bold text-white text-base" colSpan={4}>
                            Final weighted score
                          </td>
                          <td className="px-3 py-3 text-right font-black text-white text-lg tabular-nums">
                            {result.finalScore.toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
