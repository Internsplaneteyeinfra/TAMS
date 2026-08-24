/**
 * Tower Site Suitability workspace — solar-style flow for transmission pads.
 * Upload / click → analyzing → full report with Accepted / Rejected.
 * KML geometries drawn as map outlines.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Crosshair,
  Navigation,
  Pencil,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react'

import LogoutButton from '@/components/auth/LogoutButton'
import { fetchGisTowers } from '@/lib/api'
import { createSiteScore } from '@/lib/siteScoresApi'
import {
  collectSiteSignals,
  inferOsmLineVoltageKv,
  parseKmlDocument,
  resolveCityStateLabel,
  type KmlFeature,
} from './fetchSiteSignals'
import { downloadSuitabilityReport } from './downloadSuitabilityReport'
import type { SoilReportOpts } from './downloadSoilScreeningReport'
import { fetchSoilScreening } from './soilScreening'
import { downloadKmlFile } from './kmlExport'
import {
  estimateTowerBand,
  planTowersFromKml,
  spanForVoltageKv,
  standardForVoltageKv,
  towerPredictionNote,
  voltageLabel,
  VOLTAGE_OPTIONS_KV,
  type SpanPolicy,
} from './lineTowers'
import SuitabilityHub, { type SuitabilityEntryMode } from './SuitabilityHub'
import {
  DEFAULT_SEARCH_RADIUS_KM,
  SEARCH_RADIUS_OPTIONS_KM,
} from './nearbyPowerSupply'
import { analyzeCorridorPlacement } from './corridorPlacementAdvice'
import {
  buildSuitabilitySuggestions,
  scoreSiteSignals,
  type SuitabilityResult,
} from './scoring'
import type { DrawMode } from './TowerSuitabilityMap'
import type { IntelligencePanel, TowerWorkspaceMode } from './workspaceTypes'
import SiteScoreCard from './analysis/SiteScoreCard'
import SmartSuggestionsCard from './analysis/SmartSuggestionsCard'
import SoilReportCard from './analysis/SoilReportCard'
import DownloadReportCard from './analysis/DownloadReportCard'
import SaveSiteScoreCard from './analysis/SaveSiteScoreCard'
import IntelligenceRail from './analysis/IntelligenceRail'
import IntelligenceDrawer from './analysis/IntelligenceDrawer'
import OverviewPanel from './analysis/OverviewPanel'
import LiveSignalsPanel from './analysis/LiveSignalsPanel'
import FactorsPanel from './analysis/FactorsPanel'
import ControlsPanel from './analysis/ControlsPanel'
import ScoreBreakdownPanel from './analysis/ScoreBreakdownPanel'
import SuggestionsDetailPanel from './analysis/SuggestionsDetailPanel'
import EarthZoomIndia from './EarthZoomIndia'

const MapPane = dynamic(() => import('./TowerSuitabilityMap'), { ssr: false })

const ANALYZE_STAGES = ['DEM', 'OSM', 'Roads', 'Weather', 'Grid', 'Score'] as const
type AnalyzeStage = (typeof ANALYZE_STAGES)[number]

function activeAnalyzeStage(percent: number, message: string, tick: number): AnalyzeStage {
  if (percent >= 96 || /finaliz|score/i.test(message)) return 'Score'
  if (percent >= 88 || /slope|soil|screening/i.test(message)) return 'Grid'
  if (percent >= 78 || /merging|grid|power assets/i.test(message)) return 'Grid'
  if (/kml|resolv|location/i.test(message) && percent < 12) return 'DEM'
  return (['DEM', 'OSM', 'Roads', 'Weather'] as const)[tick % 4]
}

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

/** Shown in the lat/lon boxes only. Map stays on full India until Go / click / GPS. */
const SUGGESTED_START = { lat: 22.9734, lon: 78.6569 }

type PlanningSnapshot = {
  lat: number | null
  lon: number | null
  latInput: string
  lonInput: string
  siteLabel: string
  kmlFeatures: KmlFeature[]
  pendingFocus: { lat: number; lon: number } | null
  kmlFileName: string
}

function SearchRadiusPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (km: number) => void
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-[#263238]">Search radius</p>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
          <button
            key={km}
            type="button"
            title={`Search existing grid within ${km} km of the focus point`}
            onClick={() => onChange(km)}
            className={`h-8 rounded-lg text-[10px] font-black border ${value === km
              ? 'bg-[#17879a] text-white border-[#126b79]'
              : 'bg-white/55 text-[#263238] border-[rgba(51,65,85,0.16)] hover:border-[#17879a]'
              }`}
          >
            {km} km
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-[#263238] leading-snug">
        Ground distance from the start point (not map pixels). 8 km = 8,000 m around the pad — it looks
        large on satellite zoom because a village is only a few km across. The cyan ring is this radius.
        Live TAMS + OSM search existing grid inside it. Max 50 km.
      </p>
    </div>
  )
}

export default function TowerSuitabilityWorkspace() {
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [siteLabel, setSiteLabel] = useState('Set start, draw, or upload KML')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStageTick, setAnalyzeStageTick] = useState(0)
  const [progress, setProgress] = useState({ message: '', percent: 0 })
  const [result, setResult] = useState<SuitabilityResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kmlFeatures, setKmlFeatures] = useState<KmlFeature[]>([])
  const [workspaceMode, setWorkspaceMode] = useState<TowerWorkspaceMode>('planning')
  const [activePanel, setActivePanel] = useState<IntelligencePanel>(null)
  const [focusTick, setFocusTick] = useState(0)
  const [undoStack, setUndoStack] = useState<PlanningSnapshot[]>([])
  const [draftCount, setDraftCount] = useState(0)
  const [undoDraftTick, setUndoDraftTick] = useState(0)
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
  const [earthIntro, setEarthIntro] = useState(false)
  const [earthFlyTo, setEarthFlyTo] = useState<{ lat: number; lon: number } | null>(null)
  const [pendingFocus, setPendingFocus] = useState<{ lat: number; lon: number } | null>(null)
  const [latInput, setLatInput] = useState(String(SUGGESTED_START.lat))
  const [lonInput, setLonInput] = useState(String(SUGGESTED_START.lon))
  const [geoBusy, setGeoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const analyzeSeq = useRef(0)
  const uploadAfterHub = useRef(false)

  const pushPlanningUndo = useCallback(() => {
    setUndoStack((s) =>
      [
        ...s,
        {
          lat,
          lon,
          latInput,
          lonInput,
          siteLabel,
          kmlFeatures,
          pendingFocus,
          kmlFileName,
        },
      ].slice(-30)
    )
  }, [lat, lon, latInput, lonInput, siteLabel, kmlFeatures, pendingFocus, kmlFileName])

  const undoLast = useCallback(() => {
    if (draftCount > 0) {
      setUndoDraftTick((n) => n + 1)
      return
    }
    setUndoStack((s) => {
      if (!s.length) return s
      const prev = s[s.length - 1]
      setLat(prev.lat)
      setLon(prev.lon)
      setLatInput(prev.latInput)
      setLonInput(prev.lonInput)
      setSiteLabel(prev.siteLabel)
      setKmlFeatures(prev.kmlFeatures)
      setPendingFocus(prev.pendingFocus)
      setKmlFileName(prev.kmlFileName)
      setResult(null)
      setWorkspaceMode('planning')
      setActivePanel(null)
      if (prev.lat != null && prev.lon != null) setFocusTick((n) => n + 1)
      return s.slice(0, -1)
    })
  }, [draftCount])

  const runAnalyze = useCallback(async (nextLat: number, nextLon: number, label?: string) => {
    const seq = ++analyzeSeq.current
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setWorkspaceMode('planning')
    setActivePanel(null)
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
      setWorkspaceMode('analysis')
      setActivePanel('overview')
      if (manualVoltageKv == null && scored.signals.nearbyPower?.suggestedVoltageKv != null) {
        const src = scored.signals.nearbyPower.suggestedSource
        setInferredVoltage({
          kv: scored.signals.nearbyPower.suggestedVoltageKv,
          source: src === 'tams' ? 'substation' : src === 'osm' ? 'osm' : 'substation',
        })
      }
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
        pushPlanningUndo()
        setKmlFeatures([])
        setKmlFileName('')
        setInferredVoltage(null)
        setPendingFocus(null)
        const label = `Pad ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`
        void runAnalyze(nextLat, nextLon, label)
        return
      }
      // pin / set start — move projection only
      pushPlanningUndo()
      setLat(nextLat)
      setLon(nextLon)
      setLatInput(nextLat.toFixed(6))
      setLonInput(nextLon.toFixed(6))
      setSiteLabel(`Start ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
      setResult(null)
      setWorkspaceMode('planning')
      setActivePanel(null)
      setPendingFocus(null)
    },
    [drawMode, runAnalyze, pushPlanningUndo]
  )

  const onGeometryDrawn = useCallback(
    (feature: KmlFeature, focus: { lat: number; lon: number }) => {
      pushPlanningUndo()
      setKmlFeatures([feature])
      setKmlFileName(feature.name || (feature.type === 'LineString' ? 'Drawn line' : 'Drawn polygon'))
      setInferredVoltage(null)
      setPendingFocus(focus)
      setLat(focus.lat)
      setLon(focus.lon)
      setLatInput(focus.lat.toFixed(6))
      setLonInput(focus.lon.toFixed(6))
      setResult(null)
      setWorkspaceMode('planning')
      setActivePanel(null)
      setSiteLabel(
        feature.type === 'LineString'
          ? 'Drawn line · save KML or analyze'
          : 'Drawn polygon · save KML or analyze'
      )
      setDrawMode('pin')
    },
    [pushPlanningUndo]
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
    pushPlanningUndo()
    setLat(nextLat)
    setLon(nextLon)
    setLatInput(nextLat.toFixed(6))
    setLonInput(nextLon.toFixed(6))
    setFocusTick((n) => n + 1)
    setSiteLabel(`Start ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
    setResult(null)
    setWorkspaceMode('planning')
    setActivePanel(null)
    setPendingFocus(null)
    setDrawMode('pin')
    if (earthIntro) {
      setEarthFlyTo({ lat: nextLat, lon: nextLon })
    }
  }, [latInput, lonInput, pushPlanningUndo, earthIntro])

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
        pushPlanningUndo()
        setLat(nextLat)
        setLon(nextLon)
        setLatInput(nextLat.toFixed(6))
        setLonInput(nextLon.toFixed(6))
        setSiteLabel(`Live location ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
        setResult(null)
        setWorkspaceMode('planning')
        setActivePanel(null)
        setPendingFocus(null)
        setKmlFeatures([])
        setDrawMode('line')
        setGeoBusy(false)
        if (earthIntro) setEarthFlyTo({ lat: nextLat, lon: nextLon })
      },
      (err) => {
        setGeoBusy(false)
        setError(err.message || 'Could not read live location. Allow location access and retry.')
      },
      { enableHighAccuracy: true, timeout: 20000 }
    )
  }, [pushPlanningUndo, earthIntro])

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
      setError(null)
      setResult(null)
      setWorkspaceMode('planning')
      setActivePanel(null)
      setKmlFeatures([])
      setPendingFocus(null)
      setLat(null)
      setLon(null)
      setLatInput(String(SUGGESTED_START.lat))
      setLonInput(String(SUGGESTED_START.lon))
      setUndoStack([])
      setDraftCount(0)
      setManualVoltageKv(null)
      setInferredVoltage(null)
      if (mode === 'draw') {
        setDrawMode('pin')
        setSiteLabel('Set start with lat/lon or map click, then draw')
        setPhase('work')
        setEarthIntro(true)
        setEarthFlyTo(null)
        return
      }
      setPhase('work')
      if (mode === 'live') {
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
        focus: lat != null && lon != null ? { lat, lon } : undefined,
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
      searchRadiusKm,
    })
  }, [lineTowerPlan, kmlFeatures, result?.signals.nearbyPower?.assets, voltageStandard, searchRadiusKm])

  const mapNearbyAssets = useMemo(() => {
    const base = result?.signals.nearbyPower?.assets ?? []
    const byId = new Map(base.map((a) => [a.id, a]))
    const hints = [
      corridorAdvice?.nearestTower,
      corridorAdvice?.nearestStation,
      corridorAdvice?.powerConnect?.station,
      corridorAdvice?.powerConnect?.towerNearStation,
      corridorAdvice?.powerConnect?.towerNearPad,
    ]
    for (const hint of hints) {
      if (!hint) continue
      if (byId.has(hint.id)) continue
      byId.set(hint.id, {
        id: hint.id,
        name: hint.name,
        kind: hint.kind,
        distanceKm: hint.distanceKm,
        voltageKv: hint.voltageKv,
        voltagesKv: hint.voltageKv != null ? [hint.voltageKv] : [],
        source: 'osm',
        lat: hint.lat,
        lon: hint.lon,
      })
    }
    return [...byId.values()].slice(0, 120)
  }, [
    result?.signals.nearbyPower?.assets,
    corridorAdvice?.nearestTower,
    corridorAdvice?.nearestStation,
    corridorAdvice?.powerConnect,
  ])

  useEffect(() => {
    if (!analyzing) {
      setAnalyzeStageTick(0)
      return
    }
    const id = window.setInterval(() => setAnalyzeStageTick((n) => n + 1), 850)
    return () => window.clearInterval(id)
  }, [analyzing])

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
    const focus =
      pathFeat?.latlngs[Math.floor(pathFeat.latlngs.length / 2)] ||
      (lat != null && lon != null ? ([lat, lon] as [number, number]) : null)
    if (!focus) return
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
    if (!result || !suggestions || lat == null || lon == null) return
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

  const onSaveSiteScore = useCallback(async () => {
    if (!result || lat == null || lon == null) throw new Error('No analysis to save')
    const label =
      result.signals.placeLabel ||
      siteLabel ||
      `${lat.toFixed(5)}, ${lon.toFixed(5)}`
    await createSiteScore({
      site_label: label,
      place_label: result.signals.placeLabel || null,
      latitude: lat,
      longitude: lon,
      final_score: result.finalScore,
      verdict: result.verdict,
      confidence_pct: result.confidencePct,
      voltage_kv: lineTowerPlan?.voltageKv ?? null,
      search_radius_km: searchRadiusKm,
      summary: suggestions?.summary || null,
      factors: result.factors.map((f) => ({
        id: f.id,
        label: f.label,
        score: f.score,
        weight: f.weight,
        rawLabel: f.rawLabel,
        note: f.note,
        source: f.source,
      })),
      result_payload: {
        finalScore: result.finalScore,
        verdict: result.verdict,
        confidencePct: result.confidencePct,
        disclaimer: result.disclaimer,
        fetchedAt: result.fetchedAt || new Date().toISOString(),
        signals: {
          elevationM: result.signals.elevationM,
          slopeDeg: result.signals.slopeDeg,
          roadKm: result.signals.roadKm,
          waterKm: result.signals.waterKm,
          placeLabel: result.signals.placeLabel,
          soilScreening: result.signals.soilScreening
            ? {
              textureClass: result.signals.soilScreening.textureClass,
              confidencePct: result.signals.soilScreening.confidencePct,
              indicativeSbcTm2: result.signals.soilScreening.indicativeSbcTm2,
            }
            : null,
          geotech: result.signals.geotech || null,
          nearbyPower: result.signals.nearbyPower
            ? {
              suggestedVoltageKv: result.signals.nearbyPower.suggestedVoltageKv,
              powerNetworkVerdict: result.signals.nearbyPower.powerNetworkVerdict,
              nearestTower: result.signals.nearbyPower.nearestTower
                ? {
                  name: result.signals.nearbyPower.nearestTower.name,
                  distanceKm: result.signals.nearbyPower.nearestTower.distanceKm,
                  voltageKv: result.signals.nearbyPower.nearestTower.voltageKv,
                }
                : null,
              nearestSubstation: result.signals.nearbyPower.nearestSubstation
                ? {
                  name: result.signals.nearbyPower.nearestSubstation.name,
                  distanceKm: result.signals.nearbyPower.nearestSubstation.distanceKm,
                  voltageKv: result.signals.nearbyPower.nearestSubstation.voltageKv,
                }
                : null,
            }
            : null,
        },
        corridorAdvice: corridorAdvice
          ? {
            voltageLabel: corridorAdvice.voltageLabel,
            canPlaceCount: corridorAdvice.canPlaceCount,
            plannedCount: corridorAdvice.plannedCount,
            lineSuitability: corridorAdvice.lineSuitability,
            powerConnect: corridorAdvice.powerConnect
              ? {
                bestPadIndex: corridorAdvice.powerConnect.bestPadIndex,
                stationToPadKm: corridorAdvice.powerConnect.stationToPadKm,
                confidencePct: corridorAdvice.powerConnect.confidencePct,
                stationName: corridorAdvice.powerConnect.station.name,
              }
              : null,
          }
          : null,
      },
      notes: 'Saved from Tower Suitability workspace',
    })
  }, [
    result,
    lat,
    lon,
    siteLabel,
    lineTowerPlan?.voltageKv,
    searchRadiusKm,
    suggestions?.summary,
    corridorAdvice,
  ])

  const soilReportLabel = useMemo(() => {
    if (lat == null || lon == null) return siteLabel || 'Unknown'
    return (
      result?.signals.placeLabel ||
      (siteLabel && !siteLabel.toLowerCase().includes('set start') ? siteLabel : null) ||
      `${lat.toFixed(5)}, ${lon.toFixed(5)}`
    )
  }, [lat, lon, result?.signals.placeLabel, siteLabel])

  const soilReportOpts = useMemo(() => {
    if (lat == null || lon == null || !result?.signals.soilScreening) return null
    const soil = result.signals.soilScreening
    return {
      siteLabel: soilReportLabel,
      lat,
      lon,
      soil: { ...soil, placeName: soil.placeName || result.signals.placeLabel || undefined },
      signals: result.signals,
    }
  }, [lat, lon, result, soilReportLabel])

  const onGenerateSoilReport = useCallback(async (): Promise<SoilReportOpts> => {
    if (lat == null || lon == null || !result) {
      throw new Error('Analyze a site first')
    }
    const label = soilReportLabel
    let soil = result.signals.soilScreening
    let signals = result.signals
    if (!soil) {
      const place = result.signals.placeLabel || siteLabel
      soil = await fetchSoilScreening(lat, lon, place)
      if (!soil) throw new Error('Soil screening unavailable')
      signals = {
        ...result.signals,
        soilScreening: soil,
        liveOk: {
          dem: result.signals.liveOk?.dem ?? false,
          road: result.signals.liveOk?.road ?? false,
          water: result.signals.liveOk?.water ?? false,
          settlement: result.signals.liveOk?.settlement ?? false,
          grid: result.signals.liveOk?.grid ?? false,
          wind: result.signals.liveOk?.wind ?? false,
          landcover: result.signals.liveOk?.landcover ?? false,
          geotech: result.signals.liveOk?.geotech,
          soilScreening: true,
        },
      }
      setResult({ ...result, signals })
    }
    return {
      siteLabel: label,
      lat,
      lon,
      soil: { ...soil, placeName: soil.placeName || signals.placeLabel || undefined },
      signals,
    }
  }, [lat, lon, result, siteLabel, soilReportLabel])


  const analysisReady = workspaceMode === 'analysis' && !!result && !!suggestions
  const drawerTitle =
    activePanel === 'overview'
      ? 'Analysis overview'
      : activePanel === 'live'
        ? 'Live data signals'
        : activePanel === 'factors'
          ? 'Suitability factors'
          : activePanel === 'controls'
            ? 'Map & analysis controls'
            : activePanel === 'breakdown'
              ? 'Score breakdown'
              : activePanel === 'suggestions'
                ? 'Smart suggestions'
                : ''

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col overflow-hidden ${phase === 'work' ? 'ts-workspace' : 'bg-[#060B17] text-slate-200'
        }`}
    >
      {phase === 'hub' && (
        <SuitabilityHub
          onChoose={onHubChoose}
          onBack={() => {
            window.location.href = '/'
          }}
        />
      )}

      {earthIntro && (
        <EarthZoomIndia
          flyTo={earthFlyTo}
          onComplete={() => {
            setEarthIntro(false)
            setEarthFlyTo(null)
          }}
        />
      )}

      {phase === 'work' && (
        <>
          <header className="shrink-0 h-12 border-b border-[rgba(51,65,85,0.16)] bg-[rgba(248,247,241,0.96)] flex items-center gap-3 px-4 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/favicon.png"
                alt="TAMS"
                width={28}
                height={28}
                className="h-7 w-7 rounded-full object-cover shrink-0"
                onError={(e) => {
                  e.currentTarget.src = '/favicon.svg'
                }}
              />
              <h1 className="text-base font-semibold text-[#263238] tracking-tight truncate">
                Tower Site Suitability
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {kmlFeatures.length > 0 && lineTowerPlan && (
                <span className="hidden md:inline text-xs text-[#b97816] font-semibold">
                  Planning · {lineTowerPlan.towerCount} towers · {voltageLabel(lineTowerPlan.voltageKv)} ·{' '}
                  {lineTowerPlan.spanM} m
                </span>
              )}
              {result && workspaceMode === 'analysis' && (
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMode('planning')
                    setActivePanel(null)
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 text-xs font-bold text-[#263238] hover:border-[#17879a]"
                  aria-label="Edit plan"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Plan
                </button>
              )}
              {result && workspaceMode === 'planning' && (
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceMode('analysis')
                    setActivePanel('overview')
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#17879a] text-xs font-bold text-white hover:bg-[#126b79]"
                >
                  View analysis
                </button>
              )}
              <button
                type="button"
                onClick={undoLast}
                disabled={draftCount === 0 && undoStack.length === 0}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 text-xs font-bold text-[#263238] hover:border-[#17879a] disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo last start or last draw vertex"
                aria-label="Undo last action"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
              </button>
              <LogoutButton variant="light" />
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
            <div className="shrink-0 z-30 border-b border-[#17879a]/25 bg-[#dff0e8] px-4 py-2.5">
              <div className="flex items-center gap-2.5 text-sm text-[#126b79]">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-[#17879a] opacity-60 animate-ping" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-[#17879a]" />
                </span>
                <span className="font-semibold shrink-0">Analyzing</span>
                <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
                  {ANALYZE_STAGES.map((stage) => {
                    const on = stage === activeAnalyzeStage(progress.percent, progress.message, analyzeStageTick)
                    return (
                      <span
                        key={stage}
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${on
                            ? 'bg-[#17879a] text-white shadow-[0_0_0_3px_rgba(23,135,154,0.22)]'
                            : 'bg-white/55 text-[#126b79]/55'
                          }`}
                      >
                        {stage}
                      </span>
                    )
                  })}
                </div>
                <span className="ml-auto tabular-nums font-semibold shrink-0">{progress.percent}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
                <div
                  className="h-full relative overflow-hidden bg-[#17879a] transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                >
                  <span className="pointer-events-none absolute inset-0 ts-analyze-shimmer" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="shrink-0 z-30 px-4 py-2.5 bg-[#f8e4e1] border-b border-[#c75b50]/30 text-sm text-[#c75b50]">
              {error}
            </div>
          )}

          <div className="relative flex-1 min-h-0 overflow-hidden">
            <MapPane
              lat={lat}
              lon={lon}
              result={result}
              kmlFeatures={kmlFeatures}
              plannedTowers={lineTowerPlan?.towers ?? []}
              nearbyAssets={mapNearbyAssets}
              searchRadiusKm={searchRadiusKm}
              placementAdvice={corridorAdvice?.items ?? []}
              voltageKv={lineTowerPlan?.voltageKv ?? null}
              spanM={lineTowerPlan?.spanM}
              corridorLineColor={corridorAdvice?.lineColor ?? '#fbbf24'}
              highlightTowerId={
                corridorAdvice?.powerConnect?.towerNearStation?.id ??
                corridorAdvice?.nearestTower?.id ??
                null
              }
              highlightStationId={
                corridorAdvice?.powerConnect?.station?.id ??
                corridorAdvice?.nearestStation?.id ??
                null
              }
              powerConnect={corridorAdvice?.powerConnect ?? null}
              analyzing={analyzing}
              drawMode={drawMode}
              drawingEnabled={workspaceMode === 'planning' && !analyzing}
              focusTick={focusTick}
              undoDraftTick={undoDraftTick}
              onDraftCountChange={setDraftCount}
              onDrawModeChange={setDrawMode}
              onPick={onMapPick}
              onGeometryDrawn={onGeometryDrawn}
            />

            {workspaceMode === 'planning' && !analyzing && (
              <div
                className={`absolute bottom-3 left-3 pointer-events-none ${earthIntro ? 'z-[5000]' : 'z-[1150]'
                  }`}
              >
                <div className="pointer-events-auto ts-glass ts-glass-see p-3 w-[min(360px,calc(100vw-1.5rem))]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#263238] mb-2">
                    Start projection · lat / lon
                  </p>
                  <div className="mb-2">
                    <SearchRadiusPicker value={searchRadiusKm} onChange={setSearchRadiusKm} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-[#263238] font-bold">
                      Latitude
                      <input
                        value={latInput}
                        onChange={(e) => setLatInput(e.target.value)}
                        placeholder={String(SUGGESTED_START.lat)}
                        inputMode="decimal"
                        className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2 text-xs font-mono text-[#263238]"
                      />
                    </label>
                    <label className="text-[10px] text-[#263238] font-bold">
                      Longitude
                      <input
                        value={lonInput}
                        onChange={(e) => setLonInput(e.target.value)}
                        placeholder={String(SUGGESTED_START.lon)}
                        inputMode="decimal"
                        className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2 text-xs font-mono text-[#263238]"
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#263238] leading-snug">
                    Suggested India centre is filled in. Click <strong>Go to lat/lon</strong> to fly there, or
                    type any coordinates first and then Go.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={applyLatLon}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#17879a] text-xs font-bold text-white hover:bg-[#126b79]"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      Go to lat/lon
                    </button>
                    <button
                      type="button"
                      disabled={geoBusy}
                      onClick={goLiveLocation}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[rgba(51,65,85,0.16)] text-xs font-bold text-[#263238] disabled:opacity-50"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      {geoBusy ? 'Locating…' : 'Live location'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {workspaceMode === 'planning' && pendingFocus && kmlFeatures.length > 0 && !analyzing && (
              <div className="absolute bottom-3 right-3 z-[1150] pointer-events-auto ts-glass p-3 w-[min(360px,calc(100vw-1.5rem))] max-h-[min(70vh,420px)] overflow-y-auto">
                <p className="text-xs font-black text-[#b97816] uppercase tracking-wider">Drawn shape ready</p>
                <p className="text-sm text-[#66727a] mt-1 leading-snug">
                  Pick voltage class (CEA planning bands) — then Save KML or Analyze live suitability.
                </p>
                <label className="mt-2 block text-[10px] font-bold uppercase text-[#66727a]">
                  Line voltage
                  <select
                    value={manualVoltageKv ?? lineTowerPlan?.voltageKv ?? ''}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null
                      setManualVoltageKv(v)
                    }}
                    className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2 text-sm font-bold text-[#263238]"
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
                        ? 'bg-[#b97816] text-white border-[#b97816]'
                        : 'bg-white/55 text-[#263238] border-[rgba(51,65,85,0.16)]'
                        }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {lineTowerPlan && (
                  <p className="mt-2 text-[11px] text-[#66727a] leading-snug">
                    {towerPredictionNote(
                      lineTowerPlan.lengthKm,
                      lineTowerPlan.spanM,
                      lineTowerPlan.towerCount,
                      voltageStandard
                    )}
                  </p>
                )}
                {towerBand && voltageStandard && (
                  <p className="mt-1 text-[10px] text-[#66727a] leading-snug">
                    Band for {voltageStandard.label}: {towerBand.dense} (dense) – {towerBand.ruling}{' '}
                    (ruling) – {towerBand.long} (long) towers · ROW ~{voltageStandard.rowWidthM} m
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={saveDrawnKml}
                    className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-[rgba(51,65,85,0.16)] bg-white/70 text-xs font-bold text-[#263238]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save KML
                  </button>
                  <button
                    type="button"
                    onClick={analyzePendingGeometry}
                    className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#17879a] text-xs font-black text-white hover:bg-[#126b79]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Analyze
                  </button>
                </div>
              </div>
            )}

            {workspaceMode === 'planning' && !result && !analyzing && !pendingFocus && (
              <div className="absolute bottom-[7.5rem] left-3 z-10 pointer-events-none ts-glass px-3 py-2 text-sm text-[#263238] max-w-sm">
                {entryMode === 'live'
                  ? 'Live location set — draw a line or polygon, then Save KML or Analyze'
                  : 'Set start (lat/lon or map click) → Draw line / polygon → Save KML or Analyze'}
              </div>
            )}

            {analysisReady && result && suggestions && (
              <>
                <div className="absolute top-3 left-3 z-[1150] pointer-events-none flex flex-col gap-2 max-h-[calc(100%-1.5rem)] overflow-y-auto pb-16 md:pb-0">
                  <div className="pointer-events-auto">
                    <SiteScoreCard result={result} />
                  </div>
                  <div className="pointer-events-auto">
                    <SmartSuggestionsCard
                      suggestions={suggestions}
                      onViewAll={() => setActivePanel('suggestions')}
                    />
                  </div>
                  <div className="pointer-events-auto">
                    <SoilReportCard
                      soil={result.signals.soilScreening}
                      siteLabel={soilReportLabel}
                      reportOpts={soilReportOpts}
                      onGenerate={onGenerateSoilReport}
                    />
                  </div>
                  <div className="pointer-events-auto">
                    <SaveSiteScoreCard onSave={onSaveSiteScore} />
                  </div>
                  <div className="pointer-events-auto">
                    <DownloadReportCard onDownload={onDownloadReport} />
                  </div>
                </div>

                <div className="hidden md:flex absolute top-1/2 right-3 z-[1160] -translate-y-1/2 pointer-events-none">
                  <IntelligenceRail
                    active={activePanel}
                    onSelect={(id) => setActivePanel((cur) => (cur === id ? null : id))}
                  />
                </div>

                {activePanel && (
                  <div className="absolute z-[1170] pointer-events-none md:top-3 md:bottom-3 md:right-[5.6rem] max-md:left-2 max-md:right-2 max-md:bottom-[4.25rem]">
                    <IntelligenceDrawer title={drawerTitle} onClose={() => setActivePanel(null)}>
                      {activePanel === 'overview' && (
                        <OverviewPanel
                          result={result}
                          suggestions={suggestions}
                          corridorAdvice={corridorAdvice}
                          manualVoltageKv={manualVoltageKv}
                          onManualVoltageKv={setManualVoltageKv}
                          onExploreFactors={() => setActivePanel('factors')}
                          lat={lat}
                          lon={lon}
                        />
                      )}
                      {activePanel === 'live' && (
                        <LiveSignalsPanel signals={result.signals} hasTowerPlan={!!lineTowerPlan} />
                      )}
                      {activePanel === 'factors' && <FactorsPanel result={result} />}
                      {activePanel === 'controls' && (
                        <ControlsPanel
                          searchRadiusKm={searchRadiusKm}
                          onSearchRadiusKm={setSearchRadiusKm}
                          latInput={latInput}
                          lonInput={lonInput}
                          onLatInput={setLatInput}
                          onLonInput={setLonInput}
                          onGoToLocation={applyLatLon}
                          onLiveLocation={goLiveLocation}
                          geoBusy={geoBusy}
                          lineTowerPlan={lineTowerPlan}
                          manualVoltageKv={manualVoltageKv}
                          onManualVoltageKv={setManualVoltageKv}
                          spanPolicy={spanPolicy}
                          onSpanPolicy={setSpanPolicy}
                        />
                      )}
                      {activePanel === 'breakdown' && <ScoreBreakdownPanel result={result} />}
                      {activePanel === 'suggestions' && (
                        <SuggestionsDetailPanel
                          result={result}
                          suggestions={suggestions}
                          corridorAdvice={corridorAdvice}
                          onFocusMap={() => setFocusTick((n) => n + 1)}
                        />
                      )}
                    </IntelligenceDrawer>
                  </div>
                )}

                <div className="md:hidden absolute bottom-2 left-2 right-2 z-[1160] pointer-events-none">
                  <IntelligenceRail
                    active={activePanel}
                    onSelect={(id) => setActivePanel((cur) => (cur === id ? null : id))}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
