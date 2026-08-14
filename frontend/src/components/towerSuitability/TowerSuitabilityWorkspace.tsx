/**
 * Tower Site Suitability workspace — solar-style flow for transmission pads.
 * Upload / click → analyzing → full report with Accepted / Rejected.
 * KML geometries drawn as map outlines.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  CheckCircle2,
  Crosshair,
  Download,
  Lightbulb,
  Loader2,
  LogOut,
  MapPinned,
  Navigation,
  Save,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'

import { fetchGisTowers } from '@/lib/api'
import {
  collectSiteSignals,
  DEMO_NIRONA,
  inferOsmLineVoltageKv,
  parseKmlDocument,
  resolveCityStateLabel,
  type KmlFeature,
} from './fetchSiteSignals'
import { downloadSuitabilityReport } from './downloadSuitabilityReport'
import { downloadKmlFile } from './kmlExport'
import {
  estimateTowerBand,
  planTowersFromKml,
  spanForVoltageKv,
  standardForVoltageKv,
  towerPredictionNote,
  voltageLabel,
  voltageSourceLabel,
  VOLTAGE_OPTIONS_KV,
  type SpanPolicy,
} from './lineTowers'
import SuitabilityHub, { type SuitabilityEntryMode } from './SuitabilityHub'
import LiveDataProvenancePanel from './LiveDataProvenancePanel'
import PowerNetworkAnalysisPanel from './PowerNetworkAnalysisPanel'
import {
  DEFAULT_SEARCH_RADIUS_KM,
  SEARCH_RADIUS_OPTIONS_KM,
} from './nearbyPowerSupply'
import CorridorPlacementPanel from './CorridorPlacementPanel'
import { analyzeCorridorPlacement } from './corridorPlacementAdvice'
import {
  buildSuitabilitySuggestions,
  scoreSiteSignals,
  type SuitabilityResult,
  type SuitabilityVerdict,
} from './scoring'
import type { DrawMode } from './TowerSuitabilityMap'

const MapPane = dynamic(() => import('./TowerSuitabilityMap'), { ssr: false })

function isGenericSiteLabel(label: string): boolean {
  const value = label.trim().toLowerCase()
  if (!value) return true
  if (value.startsWith('pad ')) return true
  if (value === 'draw on map or upload kml') return true
  if (value === 'click map or upload kml') return true
  if (value === 'drawn line' || value === 'drawn polygon' || value === 'drawn site') return true
  if (value === 'untitled' || value === 'untitled map' || value === 'my places') return true
  if (value === 'land' || value === 'polygon' || value === 'placemark') return true
  return false
}

/** Shown in UI. Files up to HARD_MAX still parse reliably. */
const KML_MAX_SIZE_LABEL_MB = 5
const KML_HARD_MAX_BYTES = 7 * 1024 * 1024

function SearchRadiusPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (km: number) => void
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-slate-400">Search radius</p>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
          <button
            key={km}
            type="button"
            title={`Search existing grid within ${km} km of the focus point`}
            onClick={() => onChange(km)}
            className={`h-8 rounded-lg text-[10px] font-black border ${value === km
                ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                : 'bg-slate-950 text-slate-300 border-slate-600 hover:border-cyan-400/40'
              }`}
          >
            {km} km
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-500 leading-snug">
        Live TAMS + OSM around the pad. Max 50 km (not 1000 km). Re-analyze after changing.
      </p>
    </div>
  )
}

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
  const [siteLabel, setSiteLabel] = useState('Set start, draw, or upload KML')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState({ message: '', percent: 0 })
  const [result, setResult] = useState<SuitabilityResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kmlFeatures, setKmlFeatures] = useState<KmlFeature[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [kmlFileName, setKmlFileName] = useState('')
  const [inferredVoltage, setInferredVoltage] = useState<{
    kv: number
    source: 'tams' | 'osm' | 'substation'
  } | null>(null)
  /** User-picked class — always wins over auto inference. */
  const [manualVoltageKv, setManualVoltageKv] = useState<number | null>(null)
  const [spanPolicy, setSpanPolicy] = useState<SpanPolicy>('ruling')
  const [searchRadiusKm, setSearchRadiusKm] = useState(DEFAULT_SEARCH_RADIUS_KM)
  const [drawMode, setDrawMode] = useState<DrawMode>('pin')
  const [phase, setPhase] = useState<'hub' | 'work'>('hub')
  const [entryMode, setEntryMode] = useState<SuitabilityEntryMode | null>(null)
  const [pendingFocus, setPendingFocus] = useState<{ lat: number; lon: number } | null>(null)
  const [latInput, setLatInput] = useState(String(DEMO_NIRONA.lat))
  const [lonInput, setLonInput] = useState(String(DEMO_NIRONA.lon))
  const [geoBusy, setGeoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const analyzeSeq = useRef(0)
  const uploadAfterHub = useRef(false)

  const runAnalyze = useCallback(async (nextLat: number, nextLon: number, label?: string) => {
    const seq = ++analyzeSeq.current
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setSuggestionsOpen(false)
    setLat(nextLat)
    setLon(nextLon)
    if (label && !isGenericSiteLabel(label)) setSiteLabel(label)
    setProgress({ message: 'Resolving location…', percent: 5 })
    const placeLabel = await resolveCityStateLabel(nextLat, nextLon)
    if (seq !== analyzeSeq.current) return
    if (placeLabel) {
      setSiteLabel(placeLabel)
    } else if (!label || isGenericSiteLabel(label)) {
      setSiteLabel(`${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
    } else {
      setSiteLabel(label)
    }
    setProgress({ message: 'Fetching satellite & OSM signals…', percent: 8 })
    try {
      const corridor = kmlFeatures.flatMap((f) =>
        f.latlngs.map(([la, lo]) => ({ lat: la, lon: lo }))
      )
      const signals = await collectSiteSignals(
        nextLat,
        nextLon,
        (message, percent) => {
          if (seq !== analyzeSeq.current) return
          setProgress({ message, percent })
        },
        {
          corridor: corridor.length >= 2 ? corridor : undefined,
          searchRadiusKm,
        }
      )
      if (seq !== analyzeSeq.current) return
      const scored = scoreSiteSignals(signals)
      setProgress({ message: 'Finalizing weighted score…', percent: 100 })
      setResult(scored)
      if (manualVoltageKv == null && scored.signals.nearbyPower?.suggestedVoltageKv != null) {
        const src = scored.signals.nearbyPower.suggestedSource
        setInferredVoltage({
          kv: scored.signals.nearbyPower.suggestedVoltageKv,
          source: src === 'tams' ? 'substation' : src === 'osm' ? 'osm' : 'substation',
        })
      }
      setSuggestionsOpen(false)
      setPendingFocus(null)
    } catch (e) {
      if (seq !== analyzeSeq.current) return
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      if (seq === analyzeSeq.current) setAnalyzing(false)
    }
  }, [manualVoltageKv, kmlFeatures, searchRadiusKm])

  const onMapPick = useCallback(
    (nextLat: number, nextLon: number) => {
      if (drawMode === 'point') {
        setKmlFeatures([])
        setKmlFileName('')
        setInferredVoltage(null)
        setPendingFocus(null)
        const label = `Pad ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`
        void runAnalyze(nextLat, nextLon, label)
        return
      }
      // pin / set start — move projection only
      setLat(nextLat)
      setLon(nextLon)
      setLatInput(nextLat.toFixed(6))
      setLonInput(nextLon.toFixed(6))
      setSiteLabel(`Start ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
      setResult(null)
      setPendingFocus(null)
    },
    [drawMode, runAnalyze]
  )

  const onGeometryDrawn = useCallback(
    (feature: KmlFeature, focus: { lat: number; lon: number }) => {
      setKmlFeatures([feature])
      setKmlFileName(feature.name || (feature.type === 'LineString' ? 'Drawn line' : 'Drawn polygon'))
      setInferredVoltage(null)
      setPendingFocus(focus)
      setLat(focus.lat)
      setLon(focus.lon)
      setLatInput(focus.lat.toFixed(6))
      setLonInput(focus.lon.toFixed(6))
      setResult(null)
      setSiteLabel(
        feature.type === 'LineString'
          ? 'Drawn line · save KML or analyze'
          : 'Drawn polygon · save KML or analyze'
      )
      setDrawMode('pin')
    },
    []
  )

  const applyLatLon = useCallback(() => {
    const nextLat = Number(latInput)
    const nextLon = Number(lonInput)
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) {
      setError('Enter valid latitude and longitude numbers.')
      return
    }
    if (nextLat < -90 || nextLat > 90 || nextLon < -180 || nextLon > 180) {
      setError('Latitude must be −90…90 and longitude −180…180.')
      return
    }
    setError(null)
    setLat(nextLat)
    setLon(nextLon)
    setSiteLabel(`Start ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
    setResult(null)
    setPendingFocus(null)
    setDrawMode('pin')
  }, [latInput, lonInput])

  const goLiveLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    setGeoBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = pos.coords.latitude
        const nextLon = pos.coords.longitude
        setLat(nextLat)
        setLon(nextLon)
        setLatInput(nextLat.toFixed(6))
        setLonInput(nextLon.toFixed(6))
        setSiteLabel(`Live location ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
        setResult(null)
        setPendingFocus(null)
        setKmlFeatures([])
        setDrawMode('line')
        setGeoBusy(false)
      },
      (err) => {
        setGeoBusy(false)
        setError(err.message || 'Could not read live location. Allow location access and retry.')
      },
      { enableHighAccuracy: true, timeout: 20000 }
    )
  }, [])

  const analyzePendingGeometry = useCallback(() => {
    if (!kmlFeatures.length || !pendingFocus) return
    const label =
      kmlFeatures[0]?.type === 'LineString'
        ? 'Drawn line corridor'
        : kmlFeatures[0]?.type === 'Polygon'
          ? 'Drawn polygon site'
          : 'Drawn site'
    void runAnalyze(pendingFocus.lat, pendingFocus.lon, label)
  }, [kmlFeatures, pendingFocus, runAnalyze])

  const saveDrawnKml = useCallback(() => {
    if (!kmlFeatures.length) return
    downloadKmlFile(kmlFeatures, `${kmlFileName || 'tams-drawn-site'}.kml`)
  }, [kmlFeatures, kmlFileName])

  const onHubChoose = useCallback(
    (mode: SuitabilityEntryMode) => {
      setEntryMode(mode)
      setPhase('work')
      setError(null)
      setResult(null)
      setKmlFeatures([])
      setPendingFocus(null)
      setManualVoltageKv(null)
      setInferredVoltage(null)
      if (mode === 'draw') {
        setDrawMode('pin')
        setSiteLabel('Set start with lat/lon or map click, then draw')
      } else if (mode === 'live') {
        setDrawMode('line')
        setSiteLabel('Getting live location…')
        // defer GPS until mounted map
        window.setTimeout(() => goLiveLocation(), 200)
      } else {
        setDrawMode('pin')
        setSiteLabel('Upload a KML to analyze')
        uploadAfterHub.current = true
        window.setTimeout(() => fileRef.current?.click(), 250)
      }
    },
    [goLiveLocation]
  )

  const onKml = async (file: File) => {
    if (file.size > KML_HARD_MAX_BYTES) {
      setError(`KML is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max size is ${KML_MAX_SIZE_LABEL_MB} MB.`)
      return
    }
    setError(null)
    setAnalyzing(true)
    setProgress({ message: 'Reading KML…', percent: 4 })
    try {
      const text = await file.text()
      setProgress({ message: 'Parsing KML outlines…', percent: 7 })
      const parsed = parseKmlDocument(text)
      if (!parsed) {
        setAnalyzing(false)
        setError('Could not read KML geometry. Use Point, LineString, or Polygon placemarks.')
        return
      }
      setKmlFeatures(parsed.features)
      const label = file.name.replace(/\.kml$/i, '')
      setKmlFileName(label)
      setPendingFocus(null)
      await runAnalyze(parsed.focus.lat, parsed.focus.lon, label)
    } catch (e) {
      setAnalyzing(false)
      setError(e instanceof Error ? e.message : 'Could not read this KML file.')
    }
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
  const lineTowerPlan = useMemo(
    () =>
      planTowersFromKml(kmlFeatures, {
        voltageKv: manualVoltageKv ?? inferredVoltage?.kv ?? null,
        voltageSource: manualVoltageKv != null ? 'manual' : inferredVoltage?.source,
        spanPolicy,
        extraText: kmlFileName,
        focus: { lat, lon },
      }),
    [kmlFeatures, inferredVoltage, manualVoltageKv, spanPolicy, kmlFileName, lat, lon]
  )

  const voltageStandard = useMemo(
    () => standardForVoltageKv(manualVoltageKv ?? lineTowerPlan?.voltageKv ?? null),
    [manualVoltageKv, lineTowerPlan?.voltageKv]
  )

  const towerBand = useMemo(() => {
    if (!lineTowerPlan || !voltageStandard) return null
    return estimateTowerBand(lineTowerPlan.lengthKm, voltageStandard)
  }, [lineTowerPlan, voltageStandard])

  const corridorAdvice = useMemo(() => {
    if (!lineTowerPlan?.towers?.length) return null
    const pathFeat =
      kmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2) ||
      kmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
    const corridorPath = pathFeat?.latlngs ?? lineTowerPlan.towers.map((t) => [t.lat, t.lon] as [number, number])
    const existing = result?.signals.nearbyPower?.assets ?? []
    return analyzeCorridorPlacement({
      plannedTowers: lineTowerPlan.towers,
      corridorPath,
      existingAssets: existing,
      std: voltageStandard,
      spanM: lineTowerPlan.spanM,
      voltageKv: lineTowerPlan.voltageKv,
    })
  }, [lineTowerPlan, kmlFeatures, result?.signals.nearbyPower?.assets, voltageStandard])

  useEffect(() => {
    if (!kmlFeatures.length) {
      setInferredVoltage(null)
      return
    }
    if (manualVoltageKv != null) return
    let cancelled = false
    const pathFeat =
      kmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2) ||
      kmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3) ||
      kmlFeatures[0]
    const focus = pathFeat?.latlngs[Math.floor(pathFeat.latlngs.length / 2)] || [lat, lon]
    const pad = 0.2
    const bbox = `${focus[1] - pad},${focus[0] - pad},${focus[1] + pad},${focus[0] + pad}`

    const run = async () => {
      try {
        const res = await fetchGisTowers(bbox, undefined, 800)
        if (cancelled) return
        let bestKv: number | null = null
        let bestD = Number.POSITIVE_INFINITY
        for (const tower of res.assets) {
          const kv = tower.voltage_level_kv ?? Number(tower.metadata?.voltage_kv)
          if (!Number.isFinite(kv) || kv <= 0) continue
          const dLat = (tower.latitude - focus[0]) * 111
          const dLon = (tower.longitude - focus[1]) * 111 * Math.cos((focus[0] * Math.PI) / 180)
          const d = Math.hypot(dLat, dLon)
          if (d < bestD) {
            bestD = d
            bestKv = kv
          }
        }
        if (bestKv != null && bestD <= 25) {
          setInferredVoltage({ kv: bestKv, source: 'tams' })
          return
        }
      } catch {
        /* try OSM next */
      }
      if (cancelled) return
      const osmKv = await inferOsmLineVoltageKv(focus[0], focus[1], 8000)
      if (cancelled) return
      setInferredVoltage(osmKv != null ? { kv: osmKv, source: 'osm' } : null)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [kmlFeatures, lat, lon, manualVoltageKv])

  const onDownloadReport = useCallback(() => {
    if (!result || !suggestions) return
    downloadSuitabilityReport({
      siteLabel,
      lat,
      lon,
      result,
      suggestions,
      kmlOutlineCount: kmlFeatures.length,
      towerCount: lineTowerPlan?.towerCount,
      voltageLabel: lineTowerPlan ? voltageLabel(lineTowerPlan.voltageKv) : undefined,
      spanM: lineTowerPlan?.spanM,
    })
  }, [result, suggestions, siteLabel, lat, lon, kmlFeatures.length, lineTowerPlan])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#060B17] text-slate-200">
      {phase === 'hub' && (
        <SuitabilityHub
          onChoose={onHubChoose}
          onBack={() => {
            window.location.href = '/'
          }}
        />
      )}

      {phase === 'work' && (
        <>
          <header className="shrink-0 h-12 border-b border-slate-800/80 bg-[#0e172a] flex items-center gap-3 px-4 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <MapPinned className="w-4 h-4 text-cyan-300 shrink-0" />
              <h1 className="text-base font-semibold text-white tracking-tight truncate">
                Tower Site Suitability
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {kmlFeatures.length > 0 && lineTowerPlan && (
                <span className="hidden md:inline text-xs text-amber-300/90 font-semibold">
                  Planning · {lineTowerPlan.towerCount} towers · {voltageLabel(lineTowerPlan.voltageKv)} ·{' '}
                  {lineTowerPlan.spanM} m
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setPhase('hub')
                  setEntryMode(null)
                  setResult(null)
                  setKmlFeatures([])
                  setPendingFocus(null)
                  setError(null)
                  setManualVoltageKv(null)
                  setInferredVoltage(null)
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-600 bg-slate-950/60 text-xs font-bold text-slate-200 hover:border-cyan-500/40"
                title="Back to start options"
              >
                Start over
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-rose-500/35 bg-rose-500/10 text-xs font-bold text-rose-100 hover:bg-rose-500/20 transition-colors"
                title="Back to module selection"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </Link>
              <input
                ref={fileRef}
                type="file"
                accept=".kml,application/vnd.google-earth.kml+xml,text/xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onKml(f)
                  e.target.value = ''
                  uploadAfterHub.current = false
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
                plannedTowers={lineTowerPlan?.towers ?? []}
                nearbyAssets={result?.signals.nearbyPower?.assets?.slice(0, 80) ?? []}
                searchRadiusKm={searchRadiusKm}
                placementAdvice={corridorAdvice?.items ?? []}
                voltageKv={lineTowerPlan?.voltageKv ?? null}
                spanM={lineTowerPlan?.spanM}
                drawMode={drawMode}
                onDrawModeChange={setDrawMode}
                onPick={onMapPick}
                onGeometryDrawn={onGeometryDrawn}
              />

              {/* Lat/lon + live location controls */}
              <div className="absolute bottom-3 left-3 z-[1150] pointer-events-auto w-[min(360px,calc(100%-1.5rem))] rounded-xl border border-slate-600/80 bg-slate-950/92 p-3 shadow-xl backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Start projection · lat / lon
                </p>
                <div className="mb-2">
                  <SearchRadiusPicker value={searchRadiusKm} onChange={setSearchRadiusKm} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-slate-500 font-bold">
                    Latitude
                    <input
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      className="mt-1 w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500 font-bold">
                    Longitude
                    <input
                      value={lonInput}
                      onChange={(e) => setLonInput(e.target.value)}
                      className="mt-1 w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white"
                    />
                  </label>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={applyLatLon}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Go to lat/lon
                  </button>
                  <button
                    type="button"
                    disabled={geoBusy}
                    onClick={goLiveLocation}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    {geoBusy ? 'Locating…' : 'Live location'}
                  </button>
                </div>
              </div>

              {pendingFocus && kmlFeatures.length > 0 && !analyzing && !result && (
                <div className="absolute bottom-3 right-3 z-[1150] pointer-events-auto w-[min(360px,calc(100%-1.5rem))] rounded-xl border-2 border-amber-400/60 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-md max-h-[min(70vh,420px)] overflow-y-auto">
                  <p className="text-xs font-black text-amber-200 uppercase tracking-wider">Drawn shape ready</p>
                  <p className="text-sm text-slate-300 mt-1 leading-snug">
                    Pick voltage class (CEA planning bands) — then Save KML or Analyze live suitability.
                  </p>
                  <label className="mt-2 block text-[10px] font-bold uppercase text-slate-400">
                    Line voltage
                    <select
                      value={manualVoltageKv ?? lineTowerPlan?.voltageKv ?? ''}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null
                        setManualVoltageKv(v)
                      }}
                      className="mt-1 w-full h-9 rounded-lg border border-amber-400/40 bg-slate-900 px-2 text-sm font-bold text-amber-100"
                    >
                      <option value="">Select kV class…</option>
                      {VOLTAGE_OPTIONS_KV.map((kv) => {
                        const std = standardForVoltageKv(kv)
                        return (
                          <option key={kv} value={kv}>
                            {kv} kV · ruling {std?.rulingSpanM ?? spanForVoltageKv(kv)} m
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'dense' as const, label: 'Dense' },
                        { id: 'ruling' as const, label: 'Ruling' },
                        { id: 'long' as const, label: 'Long' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSpanPolicy(p.id)}
                        className={`h-8 rounded-lg text-[10px] font-black border ${spanPolicy === p.id
                            ? 'bg-amber-400 text-slate-950 border-amber-200'
                            : 'bg-slate-900 text-slate-300 border-slate-600'
                          }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <SearchRadiusPicker value={searchRadiusKm} onChange={setSearchRadiusKm} />
                  </div>
                  {lineTowerPlan && (
                    <p className="mt-2 text-[11px] text-slate-400 leading-snug">
                      {towerPredictionNote(
                        lineTowerPlan.lengthKm,
                        lineTowerPlan.spanM,
                        lineTowerPlan.towerCount,
                        voltageStandard
                      )}
                    </p>
                  )}
                  {towerBand && voltageStandard && (
                    <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                      Band for {voltageStandard.label}: {towerBand.dense} (dense) – {towerBand.ruling}{' '}
                      (ruling) – {towerBand.long} (long) towers · ROW ~{voltageStandard.rowWidthM} m
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={saveDrawnKml}
                      className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-slate-500 bg-slate-900 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save KML
                    </button>
                    <button
                      type="button"
                      onClick={analyzePendingGeometry}
                      className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-cyan-400/50 bg-cyan-500 text-xs font-black text-slate-950 hover:bg-cyan-400"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Analyze
                    </button>
                  </div>
                </div>
              )}

              {/* Left: Suggestions beside +/- zoom, then Download + factor cards below */}
              {result && suggestions && (
                <div
                  className={`absolute top-2.5 bottom-2.5 left-2.5 z-[1100] flex flex-col items-stretch gap-2 max-h-[calc(100%-1.25rem)] pointer-events-none ${suggestionsOpen ? 'w-[min(440px,calc(100%-1rem))]' : 'w-[min(360px,calc(100%-1rem))]'
                    }`}
                >
                  <div className="pointer-events-auto flex items-start gap-2 shrink-0">
                    <div className="w-[38px] shrink-0" aria-hidden />
                    <button
                      type="button"
                      onClick={() => setSuggestionsOpen((v) => !v)}
                      className={`inline-flex items-center gap-2 h-[62px] px-3.5 rounded-xl border text-sm font-bold shadow-xl transition-colors ${suggestionsOpen
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
                      className="pointer-events-auto flex-1 min-h-0 w-full rounded-2xl border border-slate-600/80 bg-[#0e172a] shadow-2xl overflow-hidden flex flex-col"
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

                      {corridorAdvice && (
                        <div className="px-4 py-3 border-b border-slate-800/80 shrink-0 space-y-2 max-h-[35%] overflow-y-auto">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                            Can / cannot place · {corridorAdvice.voltageLabel} · {corridorAdvice.minSpanM}–
                            {corridorAdvice.maxSpanM} m
                          </p>
                          <p className="text-xs text-slate-300 leading-snug">{corridorAdvice.summary}</p>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <p className="text-emerald-300 font-bold">
                              Can place: {corridorAdvice.canPlaceCount}
                            </p>
                            <p className="text-rose-300 font-bold">
                              Cannot place:{' '}
                              {corridorAdvice.skipExistingCount + corridorAdvice.tooCloseCount}
                            </p>
                          </div>
                        </div>
                      )}

                      {suggestions.placementTips && suggestions.placementTips.length > 0 && (
                        <div className="px-4 py-3 border-b border-slate-800/80 shrink-0 space-y-2 max-h-[40%] overflow-y-auto">
                          <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                            Where to place towers · accuracy noted
                            {suggestions.interconnectEase === 'easy' ? ' · Easy power tap' : ''}
                          </p>
                          {suggestions.placementTips.map((tip, idx) => (
                            <div
                              key={`place-${idx}`}
                              className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-sm"
                            >
                              <p className="font-bold text-cyan-100">
                                {idx + 1}. {tip.title}
                              </p>
                              <p className="text-slate-300 mt-1 leading-snug text-xs">{tip.detail}</p>
                              <p className="text-[10px] text-amber-300/90 mt-1 font-semibold">{tip.accuracy}</p>
                            </div>
                          ))}
                        </div>
                      )}

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
                        {result?.disclaimer && (
                          <div className="rounded-lg border border-amber-500/25 bg-amber-950/25 px-3.5 py-3 text-sm text-amber-100 leading-relaxed flex gap-2.5">
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span>{result.disclaimer}</span>
                          </div>
                        )}
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

                  {!suggestionsOpen && (
                    <button
                      type="button"
                      onClick={onDownloadReport}
                      className="pointer-events-auto shrink-0 self-start inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-cyan-400/50 bg-cyan-500 text-slate-950 text-sm font-bold shadow-xl hover:bg-cyan-400 transition-colors"
                      title="Download full suitability report pamphlet"
                    >
                      <Download className="w-4 h-4" />
                      Download Report
                    </button>
                  )}

                  {!suggestionsOpen && (
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
                            <p className="text-[10px] text-slate-500 mt-1">
                              {f.live !== false ? 'Live · ' : ''}
                              {f.source}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!result && !analyzing && !pendingFocus && (
                <div className="absolute bottom-[7.5rem] left-3 z-10 pointer-events-none rounded-lg border border-slate-700/70 bg-[#0e172a]/90 px-3 py-2 text-sm text-slate-300 max-w-sm">
                  {entryMode === 'live'
                    ? 'Live location set — draw a line or polygon, then Save KML or Analyze'
                    : 'Set start (lat/lon or map click) → Draw line / polygon → Save KML or Analyze'}
                </div>
              )}
            </div>

            <aside className="w-full lg:w-[440px] xl:w-[480px] shrink-0 flex flex-col bg-[#0a1220] min-h-0 max-h-[56vh] lg:max-h-none overflow-hidden">
              <div className="shrink-0 border-b border-slate-800 px-4 py-4 space-y-3 max-h-[58%] overflow-y-auto">
                <div className="flex items-stretch gap-2">
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-3">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                      Site suitability · live open data
                    </p>
                    <p className="text-base font-semibold text-white truncate mt-1">{siteLabel}</p>
                    <p className="text-sm text-slate-400 font-mono mt-1">
                      {lat.toFixed(5)}, {lon.toFixed(5)}
                    </p>
                    {result?.fetchedAt && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90 mt-1.5">
                        Live fetch · {new Date(result.fetchedAt).toLocaleTimeString()} · not a govt certificate
                      </p>
                    )}
                    {lineTowerPlan && (
                      <p className="text-xs font-black text-amber-200 mt-2">
                        Planning ref · {lineTowerPlan.towerCount} towers · {voltageLabel(lineTowerPlan.voltageKv)} ·{' '}
                        {lineTowerPlan.spanM} m
                      </p>
                    )}
                  </div>

                  {decision && result ? (
                    <div
                      className="shrink-0 w-[148px] rounded-xl border px-3 py-3 flex flex-col justify-center text-right"
                      style={{
                        color:
                          result.signals.nearbyPower?.powerNetworkVerdict === 'unknown'
                            ? '#fbbf24'
                            : result.signals.nearbyPower?.powerNetworkVerdict === 'no'
                              ? '#f87171'
                              : decision.color,
                        background:
                          result.signals.nearbyPower?.powerNetworkVerdict === 'unknown'
                            ? 'rgba(251,191,36,0.14)'
                            : result.signals.nearbyPower?.powerNetworkVerdict === 'no'
                              ? 'rgba(248,113,113,0.14)'
                              : decision.bg,
                        borderColor:
                          result.signals.nearbyPower?.powerNetworkVerdict === 'unknown'
                            ? 'rgba(251,191,36,0.5)'
                            : result.signals.nearbyPower?.powerNetworkVerdict === 'no'
                              ? 'rgba(248,113,113,0.5)'
                              : decision.border,
                      }}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {result.signals.nearbyPower?.powerNetworkVerdict === 'unknown' ? (
                          <span className="text-[11px] font-black tracking-wide leading-tight">
                            UNKNOWN — DATA UNAVAILABLE
                          </span>
                        ) : result.signals.nearbyPower?.powerNetworkVerdict === 'no' ? (
                          <>
                            <XCircle className="w-4 h-4" />
                            <span className="text-sm font-black tracking-wide">NO — NOT SUITABLE</span>
                          </>
                        ) : result.signals.nearbyPower?.powerNetworkVerdict === 'yes' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-black tracking-wide">YES — SUITABLE</span>
                          </>
                        ) : (
                          <>
                            {decision.label === 'Accepted' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : decision.label === 'Rejected' ? (
                              <XCircle className="w-4 h-4" />
                            ) : null}
                            <span className="text-sm font-black tracking-wide">{decision.label}</span>
                          </>
                        )}
                      </div>
                      <p className="text-3xl font-black tabular-nums text-white mt-1.5 leading-none">
                        {result.finalScore.toFixed(1)}
                        <span className="text-sm text-slate-400 font-bold"> / 10</span>
                      </p>
                      {result.signals.nearbyPower?.suggestedVoltageKv != null && (
                        <p className="text-[11px] font-bold text-slate-300 mt-1.5 text-right">
                          {result.signals.nearbyPower.suggestedVoltageKv} kV
                        </p>
                      )}
                      {result.signals.nearbyPower?.estimatedPracticalConnectionDistanceKm != null && (
                        <p className="text-[10px] text-slate-400 mt-0.5 text-right">
                          ~
                          {result.signals.nearbyPower.estimatedPracticalConnectionDistanceKm < 1
                            ? `${Math.round(
                              result.signals.nearbyPower.estimatedPracticalConnectionDistanceKm * 1000
                            )} m`
                            : `${result.signals.nearbyPower.estimatedPracticalConnectionDistanceKm.toFixed(1)} km`}{' '}
                          connection
                        </p>
                      )}
                    </div>
                  ) : analyzing ? (
                    <div className="shrink-0 w-[148px] rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-sm text-cyan-200 font-semibold flex items-center justify-center text-center">
                      Calculating…
                    </div>
                  ) : (
                    <div className="shrink-0 w-[148px] rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-sm text-slate-500 flex items-center justify-center text-center">
                      No result yet
                    </div>
                  )}
                </div>

                <LiveDataProvenancePanel signals={result?.signals ?? null} hasTowerPlan={!!lineTowerPlan} />

                {result?.signals.nearbyPower && (
                  <PowerNetworkAnalysisPanel supply={result.signals.nearbyPower} result={result} />
                )}

                {corridorAdvice && <CorridorPlacementPanel advice={corridorAdvice} />}

                {lineTowerPlan && (
                  <div className="rounded-xl border-2 border-amber-400 bg-amber-500/15 px-3.5 py-3">
                    <p className="text-xs uppercase tracking-wider text-amber-100 font-black">
                      Tower planning · CEA / utility reference (not live satellite)
                    </p>
                    <p className="text-[10px] text-amber-200/80 mt-1 leading-snug">
                      {voltageSourceLabel(lineTowerPlan.voltageSource)}
                    </p>
                    <label className="mt-2 block text-[10px] font-bold uppercase text-slate-400">
                      Voltage class
                      <select
                        value={manualVoltageKv ?? lineTowerPlan.voltageKv ?? ''}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null
                          setManualVoltageKv(v)
                        }}
                        className="mt-1 w-full h-10 rounded-lg border border-amber-400/50 bg-slate-950 px-2.5 text-sm font-black text-amber-100"
                      >
                        <option value="">Select kV…</option>
                        {VOLTAGE_OPTIONS_KV.map((kv) => {
                          const std = standardForVoltageKv(kv)
                          return (
                            <option key={kv} value={kv}>
                              {kv} kV · {std?.minSpanM}–{std?.maxSpanM} m (ruling {std?.rulingSpanM} m)
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <p className="mt-2 text-[10px] font-bold uppercase text-slate-400">Span policy</p>
                    <div className="mt-1 grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'dense' as const, label: 'Dense', tip: 'min span · more towers' },
                          { id: 'ruling' as const, label: 'Ruling', tip: 'typical planning' },
                          { id: 'long' as const, label: 'Long', tip: 'max span · fewer towers' },
                        ] as const
                      ).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          title={p.tip}
                          onClick={() => setSpanPolicy(p.id)}
                          className={`h-9 rounded-lg text-[11px] font-black border ${spanPolicy === p.id
                              ? 'bg-amber-400 text-slate-950 border-amber-200'
                              : 'bg-slate-950 text-slate-300 border-slate-600 hover:border-amber-400/40'
                            }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2">
                      <SearchRadiusPicker value={searchRadiusKm} onChange={setSearchRadiusKm} />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Towers</p>
                        <p className="text-2xl font-black text-white tabular-nums">{lineTowerPlan.towerCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Voltage</p>
                        <p className="text-base font-black text-amber-200 mt-1">
                          {voltageLabel(lineTowerPlan.voltageKv)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Span</p>
                        <p className="text-base font-black text-white mt-1 tabular-nums">{lineTowerPlan.spanM} m</p>
                      </div>
                    </div>
                    {towerBand && voltageStandard && (
                      <div className="mt-2 rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-2 text-[11px] text-slate-300 leading-snug">
                        <p className="font-bold text-amber-100/90">{voltageStandard.label} planning band</p>
                        <p className="mt-0.5">
                          Towers if dense / ruling / long: <span className="text-white font-black">{towerBand.dense}</span> /{' '}
                          <span className="text-white font-black">{towerBand.ruling}</span> /{' '}
                          <span className="text-white font-black">{towerBand.long}</span>
                        </p>
                        <p className="mt-0.5 text-slate-400">
                          Span {voltageStandard.minSpanM}–{voltageStandard.maxSpanM} m · indicative ROW ~
                          {voltageStandard.rowWidthM} m
                        </p>
                        <p className="mt-1 text-slate-500">{voltageStandard.note}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-300 mt-2 leading-snug">
                      {towerPredictionNote(
                        lineTowerPlan.lengthKm,
                        lineTowerPlan.spanM,
                        lineTowerPlan.towerCount,
                        voltageStandard
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">
                      Screening estimate only — final design needs sag-tension, wind zone, IS 5613 / CEA
                      clearances &amp; utility approval. Not a legal certificate.
                    </p>
                  </div>
                )}

                {result && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSuggestionsOpen((v) => !v)}
                      className={`inline-flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl border text-xs font-bold transition-colors ${suggestionsOpen
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-amber-500/15 text-amber-200 border-amber-500/40 hover:bg-amber-500/25'
                        }`}
                    >
                      <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Suggestions</span>
                      <span className="tabular-nums shrink-0">−{suggestions?.remainingToPerfect.toFixed(1)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onDownloadReport}
                      className="inline-flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-100 text-xs font-bold hover:bg-cyan-500/25 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Download Report</span>
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
                    Suitability score = live DEM, OSM, wind, roads at your coordinates. Tower count/voltage =
                    CEA planning reference on your drawn geometry — not auto-read from satellite pixels. Upload
                    from the start screen only.
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
                                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                      {f.live !== false && (
                                        <span className="text-emerald-400 font-bold">Live</span>
                                      )}
                                      <span>{f.source}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                                    {f.rawLabel}
                                  </td>
                                  <td
                                    className={`px-3 py-2.5 text-right font-bold tabular-nums ${f.score >= 7
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
        </>
      )}
    </div>
  )
}
