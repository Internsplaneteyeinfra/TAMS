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
  Upload,
} from 'lucide-react'

import LogoutButton from '@/components/auth/LogoutButton'
import { fetchGisTowers } from '@/lib/api'
import {
  collectSiteSignals,
  inferOsmLineVoltageKv,
  resolveCityStateLabel,
  type KmlFeature,
} from './fetchSiteSignals'
import { downloadSuitabilityReport } from './downloadSuitabilityReport'
import { prebuildGeotechDocx, isGeotechDocxCached, invalidateGeotechDocxCache, warmGeotechDocxModules, defaultGeotechDocxInput, type GeotechDocxInput, ReportValidationError } from './geotech'
import { parseInvestigationGeometry } from './geotech/boreholePlanning'
import { downloadKmlFile } from './kmlExport'
import { parseKmlOrKmzFile } from './readKmlOrKmz'
import {
  estimateTowerBand,
  planTowersFromKml,
  spanForVoltageKv,
  standardForVoltageKv,
  towerPredictionNote,
  voltageLabel,
  planningVoltageKv,
  DEFAULT_PLANNING_VOLTAGE_KV,
  VOLTAGE_OPTIONS_KV,
  type SpanPolicy,
} from './lineTowers'
import TowerAssetDetailCard, { type SelectedTowerDetail } from './TowerAssetDetailCard'
import SuitabilityHub, { type SuitabilityEntryMode } from './SuitabilityHub'
import {
  DEFAULT_SEARCH_RADIUS_KM,
  findNearbyPowerSupply,
  SEARCH_RADIUS_OPTIONS_KM,
  type NearbyPowerSupply,
} from './nearbyPowerSupply'
import { analyzeCorridorPlacement, type PlacementVerdict } from './corridorPlacementAdvice'
import {
  buildConnectionOverlay,
  connectionKeyFor,
  type TowerConnectionOverlay,
} from './towerConnection'
import { fetchDrivingRoute, fetchNearestRoad } from './osrmRouting'
import {
  buildSuitabilitySuggestions,
  scoreSiteSignals,
  type SuitabilityResult,
} from './scoring'
import type { DrawMode } from './TowerSuitabilityMap'
import type { IntelligencePanel, TowerWorkspaceMode } from './workspaceTypes'
import SoilReportCard from './analysis/SoilReportCard'
import GeotechIntelligencePanel from './analysis/GeotechIntelligencePanel'
import StartLocationBar from './analysis/StartLocationBar'
import type { TowerPlanningPanelProps } from './analysis/TowerPlanningPanel'
import IntelligenceRail from './analysis/IntelligenceRail'
import IntelligenceDrawer from './analysis/IntelligenceDrawer'
import OverviewPanel from './analysis/OverviewPanel'
import LiveSignalsPanel from './analysis/LiveSignalsPanel'
import FactorsPanel from './analysis/FactorsPanel'
import ControlsPanel from './analysis/ControlsPanel'
import ScoreBreakdownPanel from './analysis/ScoreBreakdownPanel'
import SuggestionsDetailPanel from './analysis/SuggestionsDetailPanel'
import EarthZoomIndia from './EarthZoomIndia'
import { parseStartCoordinates } from './parseCoordinates'
import {
  analyzeTowerCandidate,
  attachPlanningGeometry,
  buildTowerPlanningContext,
  buildPhaseIReportBundle,
  suggestTowerLocations,
  summarizePowerInfrastructure,
  type TowerCandidate,
  type TowerCandidateAnalysis,
  type TowerPlanningContext,
  kmlFeaturesToInvestigationGeometry,
  planningCorridorFromKml,
} from './towerPlanning'
import { buildProjectAnalysisContext, type ProjectAnalysisContext } from './projectAnalysisContext'

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
  const [selectedTowerDetail, setSelectedTowerDetail] = useState<SelectedTowerDetail | null>(null)
  const [focusedPadIndex, setFocusedPadIndex] = useState<number | null>(null)
  const [verdictFilter, setVerdictFilter] = useState<PlacementVerdict | null>(null)
  const [padFocusTick, setPadFocusTick] = useState(0)
  const [connectionOverlay, setConnectionOverlay] = useState<TowerConnectionOverlay | null>(null)
  const [geotechDocxReady, setGeotechDocxReady] = useState(false)
  const [geotechDocxBuilding, setGeotechDocxBuilding] = useState(false)
  /** Phase I — investigation geometry snapshot preserved after soil analyze */
  const [investigationKmlSnapshot, setInvestigationKmlSnapshot] = useState<KmlFeature[]>([])
  const [planningKmlFeatures, setPlanningKmlFeatures] = useState<KmlFeature[]>([])
  const [planningDrawMode, setPlanningDrawMode] = useState<'line' | 'polygon' | null>(null)
  const [phaseIPowerChecked, setPhaseIPowerChecked] = useState(false)
  const [phaseIPowerLoading, setPhaseIPowerLoading] = useState(false)
  const [phaseIPowerRaw, setPhaseIPowerRaw] = useState<NearbyPowerSupply | null>(null)
  const [phaseIPowerSummary, setPhaseIPowerSummary] = useState<ReturnType<typeof summarizePowerInfrastructure> | null>(null)
  /** Auto-loaded grid assets during pre-analyze planning (kV + line selected). */
  const [planningPowerRaw, setPlanningPowerRaw] = useState<NearbyPowerSupply | null>(null)
  const [planningPowerLoading, setPlanningPowerLoading] = useState(false)
  const planningPowerSeq = useRef(0)
  const [padRoadAccess, setPadRoadAccess] = useState<
    Array<{ index: number; lat: number; lon: number; roadLat: number; roadLon: number; km: number }>
  >([])
  const [phaseITowerCandidates, setPhaseITowerCandidates] = useState<TowerCandidate[]>([])
  const [selectedPhaseICandidateId, setSelectedPhaseICandidateId] = useState<string | null>(null)
  const [phaseITowerAnalysis, setPhaseITowerAnalysis] = useState<TowerCandidateAnalysis | null>(null)
  const [phaseITowerAnalysisLoading, setPhaseITowerAnalysisLoading] = useState(false)
  const [drawMode, setDrawMode] = useState<DrawMode>('pin')
  const [phase, setPhase] = useState<'hub' | 'work'>('hub')
  const [entryMode, setEntryMode] = useState<SuitabilityEntryMode | null>(null)
  const [earthIntro, setEarthIntro] = useState(false)
  const [earthFlyTo, setEarthFlyTo] = useState<{ lat: number; lon: number } | null>(null)
  const earthIntroRef = useRef(false)
  earthIntroRef.current = earthIntro
  const [pendingFocus, setPendingFocus] = useState<{ lat: number; lon: number } | null>(null)
  /** Keep the same KML; only kV / span (tower projections) may change. */
  const [kmlLocked, setKmlLocked] = useState(false)
  const [latInput, setLatInput] = useState(String(SUGGESTED_START.lat))
  const [lonInput, setLonInput] = useState(String(SUGGESTED_START.lon))
  const [startCoordsLocked, setStartCoordsLocked] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [highlightedBoreholeId, setHighlightedBoreholeId] = useState<string | null>(null)
  const [boreholeFocusTick, setBoreholeFocusTick] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const analyzeSeq = useRef(0)
  const uploadAfterHub = useRef(false)
  const pendingAnalyzeRef = useRef<{ lat: number; lon: number; label: string } | null>(null)

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
      setStartCoordsLocked(prev.lat != null && prev.lon != null)
      if (prev.lat != null && prev.lon != null) setFocusTick((n) => n + 1)
      return s.slice(0, -1)
    })
  }, [draftCount])

  const handleBoreholeSelect = useCallback((boreholeId: string | null) => {
    setHighlightedBoreholeId(boreholeId)
    if (boreholeId) setBoreholeFocusTick((n) => n + 1)
  }, [])

  const cancelDrawnGeometry = useCallback(() => {
    undoLast()
  }, [undoLast])

  const runAnalyze = useCallback(async (nextLat: number, nextLon: number, label?: string) => {
    const seq = ++analyzeSeq.current
    setAnalyzing(true)
    setError(null)
    setKmlLocked(false)
    setResult(null)
    setGeotechDocxReady(false)
    setGeotechDocxBuilding(false)
    invalidateGeotechDocxCache()
    warmGeotechDocxModules()
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
      const pathFeat =
        kmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2) ||
        kmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
      const corridor = pathFeat
        ? pathFeat.latlngs.map(([la, lo]) => ({ lat: la, lon: lo }))
        : undefined
      const signals = await collectSiteSignals(
        nextLat,
        nextLon,
        (message, percent) => {
          if (seq !== analyzeSeq.current) return
          setProgress({ message, percent })
        },
        {
          corridor: corridor && corridor.length >= 2 ? corridor : undefined,
          searchRadiusKm,
        }
      )
      if (seq !== analyzeSeq.current) return
      // Production scorer frozen — geotechnicalIntelligence is attached additively after scoring.
      const scored = scoreSiteSignals(signals)
      const { buildGeotechnicalIntelligence } = await import('./geotech')
      const polyFeat = kmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
      const lineFeat = kmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2)
      const investigationGeometry = polyFeat
        ? parseInvestigationGeometry({
            type: 'polygon',
            coordinates: polyFeat.latlngs.map(([la, lo]) => ({ lat: la, lon: lo })),
          })
        : lineFeat
          ? parseInvestigationGeometry({
              type: 'line',
              coordinates: lineFeat.latlngs.map(([la, lo]) => ({ lat: la, lon: lo })),
            })
          : parseInvestigationGeometry({
              type: 'point',
              coordinates: [{ lat: nextLat, lon: nextLon }],
            })
      const geotechnicalIntelligence = buildGeotechnicalIntelligence(signals, {
        investigationGeometry,
      })
      setProgress({ message: 'Finalizing weighted score…', percent: 100 })
      setResult({ ...scored, geotechnicalIntelligence })
      setInvestigationKmlSnapshot([...kmlFeatures])
      setPlanningKmlFeatures([])
      setPhaseIPowerChecked(false)
      setPhaseIPowerRaw(null)
      setPhaseIPowerSummary(null)
      setPlanningPowerRaw(null)
      setPhaseITowerCandidates([])
      setSelectedPhaseICandidateId(null)
      setPhaseITowerAnalysis(null)
      setGeotechDocxBuilding(true)
      void prebuildGeotechDocx(geotechnicalIntelligence).then((entry) => {
        if (seq === analyzeSeq.current) {
          setGeotechDocxBuilding(false)
          if (entry) setGeotechDocxReady(true)
        }
      })
      setWorkspaceMode('analysis')
      setActivePanel('overview')
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
      setStartCoordsLocked(true)
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
      if (planningDrawMode && result?.geotechnicalIntelligence) {
        setPlanningKmlFeatures([feature])
        setPlanningDrawMode(null)
        setPhaseIPowerChecked(false)
        setPhaseIPowerRaw(null)
        setPhaseIPowerSummary(null)
        setPhaseITowerCandidates([])
        setSelectedPhaseICandidateId(null)
        setPhaseITowerAnalysis(null)
        setDrawMode('pin')
        setWorkspaceMode('analysis')
        setActivePanel('geotech')
        return
      }
      pushPlanningUndo()
      setKmlFeatures([feature])
      setKmlLocked(false)
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
    [pushPlanningUndo, result?.geotechnicalIntelligence, planningDrawMode]
  )

  const applyLatLon = useCallback(() => {
    const parsed = parseStartCoordinates(latInput, lonInput)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    const { lat: nextLat, lon: nextLon, format } = parsed
    setError(null)
    pushPlanningUndo()
    setLat(nextLat)
    setLon(nextLon)
      setLatInput(nextLat.toFixed(6))
      setLonInput(nextLon.toFixed(6))
      setStartCoordsLocked(true)
      setFocusTick((n) => n + 1)
    setSiteLabel(
      format === 'utm'
        ? `Start ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)} (from N/E)`
        : `Start ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`
    )
    setResult(null)
    setWorkspaceMode('planning')
    setActivePanel(null)
    setPendingFocus(null)
    setDrawMode('pin')
    if (earthIntroRef.current) {
      // Stop globe spin and zoom onto India / typed target for drawing on land
      setEarthFlyTo({ lat: nextLat, lon: nextLon })
    }
  }, [latInput, lonInput, pushPlanningUndo])

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
        setStartCoordsLocked(true)
        setSiteLabel(`Live location ${nextLat.toFixed(5)}, ${nextLon.toFixed(5)}`)
        setResult(null)
        setWorkspaceMode('planning')
        setActivePanel(null)
        setPendingFocus(null)
        setKmlFeatures([])
        setDrawMode('line')
        setGeoBusy(false)
        if (earthIntroRef.current) setEarthFlyTo({ lat: nextLat, lon: nextLon })
      },
      (err) => {
        setGeoBusy(false)
        setError(err.message || 'Could not read live location. Allow location access and retry.')
      },
      { enableHighAccuracy: true, timeout: 20000 }
    )
  }, [pushPlanningUndo])

  const analyzePendingGeometry = useCallback(() => {
    const focus =
      pendingFocus ??
      (lat != null && lon != null ? { lat, lon } : null)
    if (!kmlFeatures.length || !focus) return
    const label =
      kmlFeatures[0]?.type === 'LineString'
        ? 'Drawn line corridor'
        : kmlFeatures[0]?.type === 'Polygon'
          ? 'Drawn polygon site'
          : 'Drawn site'
    void runAnalyze(focus.lat, focus.lon, label)
  }, [kmlFeatures, pendingFocus, lat, lon, runAnalyze])

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
      setKmlLocked(false)
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
        earthIntroRef.current = true
        setEarthIntro(true)
        setEarthFlyTo(null)
        return
      }
      if (mode === 'live') {
        setDrawMode('line')
        setSiteLabel('Getting live location…')
        setPhase('work')
        earthIntroRef.current = true
        setEarthIntro(true)
        setEarthFlyTo(null)
        window.setTimeout(() => goLiveLocation(), 200)
        return
      }
      setPhase('work')
      setDrawMode('pin')
      setSiteLabel('Upload a KML or KMZ to analyze')
      earthIntroRef.current = true
      setEarthIntro(true)
      setEarthFlyTo(null)
      pendingAnalyzeRef.current = null
      uploadAfterHub.current = true
      window.setTimeout(() => fileRef.current?.click(), 400)
    },
    [goLiveLocation]
  )

  const onKml = async (file: File) => {
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.kml') && !lower.endsWith('.kmz')) {
      setError('Upload a .kml or .kmz file.')
      return
    }
    if (file.size > KML_HARD_MAX_BYTES) {
      setError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max size is ${KML_MAX_SIZE_LABEL_MB} MB.`
      )
      return
    }
    setError(null)
    const flyThenAnalyze = earthIntroRef.current
    if (!flyThenAnalyze) {
      setAnalyzing(true)
      setProgress({ message: lower.endsWith('.kmz') ? 'Reading KMZ…' : 'Reading KML…', percent: 4 })
    }
    try {
      if (!flyThenAnalyze) setProgress({ message: 'Parsing corridor outlines…', percent: 7 })
      const parsed = await parseKmlOrKmzFile(file)
      if (!parsed) {
        if (!flyThenAnalyze) setAnalyzing(false)
        setError('Could not read KML/KMZ geometry. Use Point, LineString, or Polygon placemarks.')
        return
      }
      setKmlFeatures(parsed.features)
      setKmlLocked(false)
      const label = file.name.replace(/\.(kml|kmz)$/i, '')
      setKmlFileName(label)
      setPendingFocus(null)
      setLat(parsed.focus.lat)
      setLon(parsed.focus.lon)
      setLatInput(parsed.focus.lat.toFixed(6))
      setLonInput(parsed.focus.lon.toFixed(6))
      if (earthIntroRef.current) {
        pendingAnalyzeRef.current = {
          lat: parsed.focus.lat,
          lon: parsed.focus.lon,
          label,
        }
        setEarthFlyTo({ lat: parsed.focus.lat, lon: parsed.focus.lon })
        return
      }
      await runAnalyze(parsed.focus.lat, parsed.focus.lon, label)
    } catch (e) {
      setAnalyzing(false)
      setError(e instanceof Error ? e.message : 'Could not read this KML/KMZ file.')
    }
  }

  const suggestions = useMemo(
    () => (result ? buildSuitabilitySuggestions(result) : null),
    [result]
  )
  const lineTowerPlan = useMemo(
    () =>
      planTowersFromKml(kmlFeatures, {
        voltageKv:
          manualVoltageKv ??
          inferredVoltage?.kv ??
          DEFAULT_PLANNING_VOLTAGE_KV,
        voltageSource: manualVoltageKv != null ? 'manual' : inferredVoltage?.source,
        spanPolicy,
        extraText: kmlFileName,
        focus: lat != null && lon != null ? { lat, lon } : undefined,
      }),
    [kmlFeatures, inferredVoltage, manualVoltageKv, spanPolicy, kmlFileName, lat, lon]
  )

  const displayVoltageKv = useMemo(
    () =>
      planningVoltageKv(
        manualVoltageKv,
        inferredVoltage?.kv ?? null,
        lineTowerPlan?.voltageKv ?? null
      ),
    [manualVoltageKv, inferredVoltage, lineTowerPlan?.voltageKv]
  )

  const voltageStandard = useMemo(
    () => standardForVoltageKv(manualVoltageKv ?? lineTowerPlan?.voltageKv ?? null),
    [manualVoltageKv, lineTowerPlan?.voltageKv]
  )

  const towerBand = useMemo(() => {
    if (!lineTowerPlan || !voltageStandard) return null
    return estimateTowerBand(lineTowerPlan.lengthKm, voltageStandard)
  }, [lineTowerPlan, voltageStandard])

  const activeNearbyPower = useMemo(() => {
    if (phaseIPowerChecked && phaseIPowerRaw) return phaseIPowerRaw
    if (planningPowerRaw) return planningPowerRaw
    return null
  }, [phaseIPowerChecked, phaseIPowerRaw, planningPowerRaw])

  const showNearbyGrid = useMemo(
    () => (result?.geotechnicalIntelligence ? phaseIPowerChecked : displayVoltageKv != null),
    [result?.geotechnicalIntelligence, phaseIPowerChecked, displayVoltageKv]
  )

  const corridorAdvice = useMemo(() => {
    if (!lineTowerPlan?.towers?.length) return null
    const pathFeat =
      kmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2) ||
      kmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
    const corridorPath = pathFeat?.latlngs ?? lineTowerPlan.towers.map((t) => [t.lat, t.lon] as [number, number])
    const existing = activeNearbyPower?.assets ?? []
    return analyzeCorridorPlacement({
      plannedTowers: lineTowerPlan.towers,
      corridorPath,
      existingAssets: existing,
      std: voltageStandard,
      spanM: lineTowerPlan.spanM,
      voltageKv: displayVoltageKv,
      searchRadiusKm,
    })
  }, [
    lineTowerPlan,
    kmlFeatures,
    activeNearbyPower?.assets,
    voltageStandard,
    searchRadiusKm,
    manualVoltageKv,
    displayVoltageKv,
  ])

  const mapNearbyAssets = useMemo(() => {
    const phaseIMode = Boolean(result?.geotechnicalIntelligence && phaseIPowerChecked)
    if (!phaseIMode && displayVoltageKv == null) return []
    const base = activeNearbyPower?.assets ?? []
    const byId = new Map(base.map((a) => [a.id, a]))
    const hints = [
      ...(corridorAdvice?.nearestTowersTop5 ?? []),
      ...(corridorAdvice?.nearestStationsTop3 ?? []),
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
    return [...byId.values()]
  }, [
    activeNearbyPower?.assets,
    corridorAdvice?.nearestTower,
    corridorAdvice?.nearestStation,
    corridorAdvice?.powerConnect,
    manualVoltageKv,
    lineTowerPlan?.voltageKv,
    displayVoltageKv,
    corridorAdvice?.nearestTowersTop5,
    corridorAdvice?.nearestStationsTop3,
    phaseIPowerChecked,
    result?.geotechnicalIntelligence,
  ])

  const corridorPathForMap = useMemo(() => {
    const pathFeat =
      kmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2) ||
      kmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
    if (pathFeat?.latlngs.length) {
      return pathFeat.latlngs.map(([la, lo]) => ({ lat: la, lon: lo }))
    }
    return (lineTowerPlan?.towers ?? []).map((t) => ({ lat: t.lat, lon: t.lon }))
  }, [kmlFeatures, lineTowerPlan?.towers])

  const adviceByIndex = useMemo(() => {
    const m = new Map<number, NonNullable<typeof corridorAdvice>['items'][number]>()
    for (const item of corridorAdvice?.items ?? []) {
      m.set(item.index, item)
    }
    return m
  }, [corridorAdvice?.items])

  const loadRoadRoute = useCallback((overlay: TowerConnectionOverlay) => {
    void fetchDrivingRoute(overlay.from, overlay.to).then((route) => {
      setConnectionOverlay((prev) =>
        prev?.key === overlay.key
          ? {
              ...prev,
              roadKm: route?.km ?? null,
              roadCoords: route?.coordinates ?? [],
              roadLoading: false,
            }
          : prev
      )
    })
  }, [])

  const applyTowerSelection = useCallback(
    (detail: SelectedTowerDetail | null) => {
      if (!detail) {
        setSelectedTowerDetail(null)
        setConnectionOverlay(null)
        return
      }

      const key = connectionKeyFor(detail)
      if (connectionOverlay?.key === key) {
        if (connectionOverlay.showRoad) {
          setConnectionOverlay({ ...connectionOverlay, showRoad: false })
        } else {
          setConnectionOverlay(null)
        }
        setSelectedTowerDetail(detail)
        return
      }

      const advice =
        detail.kind === 'planned'
          ? detail.advice ?? adviceByIndex.get(detail.index)
          : undefined
      const overlay = buildConnectionOverlay(
        detail,
        advice,
        lineTowerPlan?.towers ?? [],
        corridorPathForMap,
        mapNearbyAssets
      )
      setSelectedTowerDetail(detail)
      if (detail.kind === 'planned') {
        setFocusedPadIndex(detail.index)
      } else {
        setFocusedPadIndex(null)
      }
      if (overlay) {
        setConnectionOverlay(overlay)
        loadRoadRoute(overlay)
      } else {
        setConnectionOverlay(null)
      }
    },
    [connectionOverlay, adviceByIndex, lineTowerPlan?.towers, loadRoadRoute, corridorPathForMap, mapNearbyAssets]
  )

  const handleMapBackgroundClick = useCallback(() => {
    if (selectedTowerDetail) {
      setSelectedTowerDetail(null)
      setConnectionOverlay(null)
    }
  }, [selectedTowerDetail])

  useEffect(() => {
    if (!showNearbyGrid) {
      if (!result?.geotechnicalIntelligence) {
        setPlanningPowerRaw(null)
      }
      return
    }
    if (phaseIPowerChecked && phaseIPowerRaw) return
    if (displayVoltageKv == null) return
    if (corridorPathForMap.length < 2) return
    if (lat == null || lon == null) return

    const seq = ++planningPowerSeq.current
    const mid = corridorPathForMap[Math.floor(corridorPathForMap.length / 2)] ?? { lat, lon }
    setPlanningPowerLoading(true)
    void findNearbyPowerSupply(mid.lat, mid.lon, searchRadiusKm, { corridor: corridorPathForMap })
      .then((raw) => {
        if (seq !== planningPowerSeq.current) return
        setPlanningPowerRaw(raw)
      })
      .finally(() => {
        if (seq === planningPowerSeq.current) setPlanningPowerLoading(false)
      })
  }, [
    showNearbyGrid,
    phaseIPowerChecked,
    phaseIPowerRaw,
    displayVoltageKv,
    corridorPathForMap,
    searchRadiusKm,
    lat,
    lon,
    result?.geotechnicalIntelligence,
  ])

  useEffect(() => {
    const towers = lineTowerPlan?.towers ?? []
    if (!towers.length) {
      setPadRoadAccess([])
      return
    }
    let cancelled = false
    const run = async () => {
      const out: typeof padRoadAccess = []
      for (const t of towers) {
        if (cancelled) return
        const hit = await fetchNearestRoad(t.lat, t.lon)
        if (hit) {
          out.push({
            index: t.index,
            lat: t.lat,
            lon: t.lon,
            roadLat: hit.lat,
            roadLon: hit.lon,
            km: hit.km,
          })
        }
      }
      if (!cancelled) setPadRoadAccess(out)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [lineTowerPlan?.towers])

  const handleSelectPad = useCallback(
    (index: number) => {
      const item = adviceByIndex.get(index)
      const tower = lineTowerPlan?.towers.find((t) => t.index === index)
      if (!tower) return
      setFocusedPadIndex(index)
      setPadFocusTick((n) => n + 1)
      applyTowerSelection({
        kind: 'planned',
        index,
        lat: tower.lat,
        lon: tower.lon,
        voltageKv: displayVoltageKv,
        spanM: lineTowerPlan?.spanM,
        advice: item,
        isBestPad: corridorAdvice?.powerConnect?.bestPadIndex === index,
      })
    },
    [adviceByIndex, lineTowerPlan, displayVoltageKv, corridorAdvice?.powerConnect?.bestPadIndex, applyTowerSelection]
  )

  const handleToggleConnection = useCallback(() => {
    if (!connectionOverlay) return
    if (connectionOverlay.showRoad) {
      setConnectionOverlay({ ...connectionOverlay, showRoad: false })
    } else {
      const next = { ...connectionOverlay, showRoad: true, roadLoading: !connectionOverlay.roadCoords?.length }
      setConnectionOverlay(next)
      if (!connectionOverlay.roadCoords?.length) loadRoadRoute(next)
    }
  }, [connectionOverlay, loadRoadRoute])

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

  const towerPlanningContext = useMemo((): TowerPlanningContext | null => {
    const geo = result?.geotechnicalIntelligence
    if (!geo || lat == null || lon == null) return null
    const invGeom = kmlFeaturesToInvestigationGeometry(
      investigationKmlSnapshot.length ? investigationKmlSnapshot : kmlFeatures,
      { lat, lon }
    )
    const base = buildTowerPlanningContext(geo, { lat, lon }, invGeom)
    const planGeom = kmlFeaturesToInvestigationGeometry(planningKmlFeatures)
    return attachPlanningGeometry(base, planGeom)
  }, [result?.geotechnicalIntelligence, lat, lon, investigationKmlSnapshot, kmlFeatures, planningKmlFeatures])

  const projectAnalysisContext = useMemo((): ProjectAnalysisContext | null => {
    const geo = result?.geotechnicalIntelligence
    if (!geo || lat == null || lon == null) return null
    const invGeom = kmlFeaturesToInvestigationGeometry(
      investigationKmlSnapshot.length ? investigationKmlSnapshot : kmlFeatures,
      { lat, lon }
    )
    const selected = phaseITowerCandidates.find((c) => c.id === selectedPhaseICandidateId) ?? null
    return buildProjectAnalysisContext({
      geo,
      lat,
      lon,
      investigationGeometry: invGeom,
      parameterCompleteness: geo.parameterCompleteness ?? null,
      foundationRecommendation: geo.foundationRecommendation ?? null,
      powerChecked: phaseIPowerChecked,
      powerRaw: phaseIPowerRaw,
      powerSummary: phaseIPowerSummary,
      towerCandidates: phaseITowerCandidates,
      selectedTowerCandidate: selected,
      towerAnalysis: phaseITowerAnalysis,
      siteSignals: result?.signals ?? null,
    })
  }, [
    result?.geotechnicalIntelligence,
    lat,
    lon,
    investigationKmlSnapshot,
    kmlFeatures,
    phaseIPowerChecked,
    phaseIPowerRaw,
    phaseIPowerSummary,
    phaseITowerCandidates,
    selectedPhaseICandidateId,
    phaseITowerAnalysis,
    result?.signals,
  ])

  const geotechDocxInput = useMemo((): GeotechDocxInput | null => {
    const geo = projectAnalysisContext?.geotechnicalIntelligence ?? result?.geotechnicalIntelligence
    if (!geo || lat == null || lon == null) return null
    const invGeom = kmlFeaturesToInvestigationGeometry(
      investigationKmlSnapshot.length ? investigationKmlSnapshot : kmlFeatures,
      { lat, lon }
    )
    const planGeom = kmlFeaturesToInvestigationGeometry(planningKmlFeatures)
    const phaseI = buildPhaseIReportBundle({
      geo,
      investigationCenter: { lat, lon },
      investigationGeometry: invGeom,
      planningGeometry: planGeom,
      powerChecked: phaseIPowerChecked,
      powerSummary: phaseIPowerSummary,
      towerCandidates: phaseITowerCandidates,
      selectedTowerAnalysis: phaseITowerAnalysis,
    })
    return { ...defaultGeotechDocxInput(geo), phaseI }
  }, [
    projectAnalysisContext,
    result?.geotechnicalIntelligence,
    lat,
    lon,
    investigationKmlSnapshot,
    kmlFeatures,
    planningKmlFeatures,
    phaseIPowerChecked,
    phaseIPowerSummary,
    phaseITowerCandidates,
    phaseITowerAnalysis,
  ])

  const displayKmlFeatures = useMemo(() => {
    if (investigationKmlSnapshot.length > 0) return investigationKmlSnapshot
    return kmlFeatures
  }, [investigationKmlSnapshot, kmlFeatures])

  const phaseIPlannedTowers = useMemo(() => {
    if (phaseITowerCandidates.length > 0) {
      return phaseITowerCandidates.map((c) => ({
        lat: c.latitude,
        lon: c.longitude,
        index: c.index,
        chainageM: 0,
      }))
    }
    return lineTowerPlan?.towers ?? []
  }, [phaseITowerCandidates, lineTowerPlan?.towers])

  const handleCreateTransmissionLine = useCallback(() => {
    setPlanningDrawMode('line')
    setWorkspaceMode('planning')
    setDrawMode('line')
    setKmlLocked(false)
    setActivePanel('geotech')
  }, [])

  const handleCreateInvestigationArea = useCallback(() => {
    setPlanningDrawMode('polygon')
    setWorkspaceMode('planning')
    setDrawMode('polygon')
    setKmlLocked(false)
    setActivePanel('geotech')
  }, [])

  const handleCheckTowerSuitability = useCallback(() => {
    setActivePanel('geotech')
  }, [])

  const handleCheckPhaseIPower = useCallback(async () => {
    if (lat == null || lon == null) return
    const kmlForPower = planningKmlFeatures.length
      ? planningKmlFeatures
      : investigationKmlSnapshot.length
        ? investigationKmlSnapshot
        : kmlFeatures
    if (!kmlForPower.length) return
    const corridor = planningCorridorFromKml(kmlForPower) ?? [{ lat, lon }]
    const mid = corridor[Math.floor(corridor.length / 2)] ?? { lat, lon }
    setPhaseIPowerLoading(true)
    try {
      const raw = await findNearbyPowerSupply(mid.lat, mid.lon, searchRadiusKm, { corridor })
      setPhaseIPowerRaw(raw)
      setPhaseIPowerSummary(summarizePowerInfrastructure(raw, mid.lat, mid.lon, searchRadiusKm))
      setPhaseIPowerChecked(true)
      setPhaseITowerCandidates([])
      setSelectedPhaseICandidateId(null)
      setPhaseITowerAnalysis(null)
    } finally {
      setPhaseIPowerLoading(false)
    }
  }, [planningKmlFeatures, investigationKmlSnapshot, kmlFeatures, lat, lon, searchRadiusKm])

  const handleGenerateTowerSuggestions = useCallback(() => {
    const geo = result?.geotechnicalIntelligence
    const kmlForTowers = planningKmlFeatures.length ? planningKmlFeatures : investigationKmlSnapshot
    if (!geo || !phaseIPowerChecked || !phaseIPowerSummary || !kmlForTowers.length) return
    const { candidates } = suggestTowerLocations({
      planningKmlFeatures: kmlForTowers,
      geo,
      power: phaseIPowerRaw,
      powerSummary: phaseIPowerSummary,
      searchRadiusKm,
      voltageKv: displayVoltageKv,
      baseSuitability: result ?? undefined,
    })
    setPhaseITowerCandidates(candidates)
  }, [
    result,
    phaseIPowerChecked,
    phaseIPowerSummary,
    phaseIPowerRaw,
    planningKmlFeatures,
    investigationKmlSnapshot,
    searchRadiusKm,
    displayVoltageKv,
  ])

  const handleSelectPhaseICandidate = useCallback(
    async (candidate: TowerCandidate) => {
      const geo = result?.geotechnicalIntelligence
      if (!geo) return
      setSelectedPhaseICandidateId(candidate.id)
      setFocusedPadIndex(candidate.index)
      setPadFocusTick((n) => n + 1)
      setPhaseITowerAnalysisLoading(true)
      try {
        const analysis = await analyzeTowerCandidate({
          candidate,
          geotechnicalIntelligence: geo,
          corridor: planningCorridorFromKml(planningKmlFeatures),
          searchRadiusKm,
        })
        setPhaseITowerAnalysis(analysis)
      } finally {
        setPhaseITowerAnalysisLoading(false)
      }
    },
    [result?.geotechnicalIntelligence, planningKmlFeatures, searchRadiusKm]
  )

  const towerPlanningPanelProps: TowerPlanningPanelProps | null = useMemo(() => {
    const geo = result?.geotechnicalIntelligence
    if (!geo?.soilVerdictAnalysis || !towerPlanningContext) return null
    return {
      geo,
      context: towerPlanningContext,
      planningGeometryReady: planningKmlFeatures.length > 0 || investigationKmlSnapshot.length > 0,
      powerChecked: phaseIPowerChecked,
      powerLoading: phaseIPowerLoading,
      powerSummary: phaseIPowerSummary,
      searchRadiusKm,
      onSearchRadiusKm: setSearchRadiusKm,
      towerCandidates: phaseITowerCandidates,
      selectedCandidateId: selectedPhaseICandidateId,
      towerAnalysis: phaseITowerAnalysis,
      towerAnalysisLoading: phaseITowerAnalysisLoading,
      onCreateTransmissionLine: handleCreateTransmissionLine,
      onCreateInvestigationArea: handleCreateInvestigationArea,
      onCheckTowerSuitability: handleCheckTowerSuitability,
      onCheckPowerInfrastructure: handleCheckPhaseIPower,
      onGenerateTowerSuggestions: handleGenerateTowerSuggestions,
      onSelectCandidate: handleSelectPhaseICandidate,
    }
  }, [
    result?.geotechnicalIntelligence,
    towerPlanningContext,
    planningKmlFeatures.length,
    investigationKmlSnapshot.length,
    phaseIPowerChecked,
    phaseIPowerLoading,
    phaseIPowerSummary,
    searchRadiusKm,
    phaseITowerCandidates,
    selectedPhaseICandidateId,
    phaseITowerAnalysis,
    phaseITowerAnalysisLoading,
    handleCreateTransmissionLine,
    handleCreateInvestigationArea,
    handleCheckTowerSuitability,
    handleCheckPhaseIPower,
    handleGenerateTowerSuggestions,
    handleSelectPhaseICandidate,
  ])

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
      voltageLabel: lineTowerPlan ? voltageLabel(displayVoltageKv) : undefined,
      spanM: lineTowerPlan?.spanM,
    })
  }, [result, suggestions, siteLabel, lat, lon, kmlFeatures.length, lineTowerPlan])

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
      geotechnicalIntelligence: result.geotechnicalIntelligence ?? undefined,
    }
  }, [lat, lon, result, soilReportLabel])

  useEffect(() => {
    if (!geotechDocxInput) {
      setGeotechDocxReady(false)
      setGeotechDocxBuilding(false)
      return
    }
    if (isGeotechDocxCached(geotechDocxInput)) {
      setGeotechDocxReady(true)
      setGeotechDocxBuilding(false)
      return
    }
    setGeotechDocxBuilding(true)
    setGeotechDocxReady(false)
    let cancelled = false
    void prebuildGeotechDocx(geotechDocxInput)
      .then((entry) => {
        if (!cancelled) {
          setGeotechDocxBuilding(false)
          if (entry) setGeotechDocxReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) setGeotechDocxBuilding(false)
      })
    return () => {
      cancelled = true
    }
  }, [geotechDocxInput])

  const analysisReady = workspaceMode === 'analysis' && !!result && !!suggestions
  const drawerTitle =
    activePanel === 'soil'
      ? 'Soil screening'
      : activePanel === 'geotech'
        ? 'Geotechnical intelligence'
        : activePanel === 'suggestions'
          ? 'Suggestions'
          : activePanel === 'overview'
            ? 'Analysis overview'
            : activePanel === 'live'
              ? 'Live data signals'
              : activePanel === 'factors'
                ? 'Suitability factors'
                : activePanel === 'controls'
                  ? 'Setup'
                  : activePanel === 'breakdown'
                    ? 'Score breakdown'
                    : ''

  const showStartLocation =
    workspaceMode === 'planning' && !analyzing && entryMode !== 'upload'

  const startLocationPanel = showStartLocation ? (
    <StartLocationBar
      latInput={latInput}
      lonInput={lonInput}
      onLatInput={setLatInput}
      onLonInput={setLonInput}
      coordsLocked={startCoordsLocked}
      onEditCoords={() => setStartCoordsLocked(false)}
      onGoToLocation={applyLatLon}
      onLiveLocation={goLiveLocation}
      geoBusy={geoBusy}
    />
  ) : null

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
          caption={
            entryMode === 'live'
              ? 'Keeps rotating until GPS lock — or press Go (slows over India)'
              : entryMode === 'upload'
                ? 'Keeps rotating until your KML/KMZ is read, then flies to the corridor'
                : 'Keeps rotating until you press Go — slows over India land, then zooms for drawing'
          }
          onComplete={() => {
            setEarthIntro(false)
            earthIntroRef.current = false
            setEarthFlyTo(null)
            const pending = pendingAnalyzeRef.current
            pendingAnalyzeRef.current = null
            if (pending) void runAnalyze(pending.lat, pending.lon, pending.label)
          }}
        />
      )}

      {earthIntro && startLocationPanel && (
        <div className="fixed top-4 left-1/2 z-[5000] w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 pointer-events-auto">
          <div className="ts-glass ts-glass-see p-3 shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#17879a] mb-2">
              Enter start coordinates
            </p>
            {startLocationPanel}
            <p className="mt-2 text-[10px] text-[#66727a] leading-snug">
              Type lat/lon (or UTM N/E), then press <strong>Go to Site</strong> to land on the map and start
              drawing. Pick search radius from the draw toolbar after you land.
            </p>
          </div>
        </div>
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
              <h1 className="text-base font-bold text-[#0f172a] tracking-tight truncate">
                Tower Site Suitability
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {kmlFeatures.length > 0 && lineTowerPlan && (
                <span className="hidden md:inline text-xs text-[#b97816] font-semibold">
                  Planning · {lineTowerPlan.towerCount} towers · {voltageLabel(displayVoltageKv)} ·{' '}
                  {lineTowerPlan.spanM} m
                </span>
              )}
              {result && workspaceMode === 'analysis' && (
                <button
                  type="button"
              onClick={() => {
                setWorkspaceMode('planning')
                setActivePanel(null)
                setKmlLocked(true)
                if (lat != null && lon != null) {
                  setPendingFocus({ lat, lon })
                }
              }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 text-xs font-bold text-[#0f172a] hover:border-[#17879a]"
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
                    setKmlLocked(false)
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#17879a] text-xs font-bold text-white hover:bg-[#126b79]"
                >
                  View analysis
                </button>
              )}
              <button
                type="button"
                onClick={undoLast}
                disabled={kmlLocked || (draftCount === 0 && undoStack.length === 0)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 text-xs font-bold text-[#0f172a] hover:border-[#17879a] disabled:opacity-40 disabled:cursor-not-allowed"
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
                accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/zip,text/xml"
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
            <div
              className={
                earthIntro
                  ? 'fixed top-4 left-1/2 z-[5001] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl bg-[#f8e4e1] px-4 py-2.5 text-sm text-[#c75b50] shadow-lg'
                  : 'shrink-0 z-30 px-4 py-2.5 bg-[#f8e4e1] border-b border-[#c75b50]/30 text-sm text-[#c75b50]'
              }
            >
              {error}
            </div>
          )}

          <div className="relative flex-1 min-h-0 overflow-hidden">
            <MapPane
              lat={lat}
              lon={lon}
              result={result}
              kmlFeatures={displayKmlFeatures}
              planningKmlFeatures={planningKmlFeatures}
              plannedTowers={phaseIPlannedTowers}
              nearbyAssets={mapNearbyAssets}
              searchRadiusKm={searchRadiusKm}
              placementAdvice={corridorAdvice?.items ?? []}
              voltageKv={displayVoltageKv}
              spanM={lineTowerPlan?.spanM}
              corridorLineColor={corridorAdvice?.lineColor ?? '#fbbf24'}
              corridorPath={corridorPathForMap}
              showNearbyGrid={showNearbyGrid}
              onMapBackgroundClick={handleMapBackgroundClick}
              padRoadAccess={padRoadAccess}
              onTowerSelect={
                phaseITowerCandidates.length > 0
                  ? (detail) => {
                      if (detail?.kind === 'planned') {
                        const c = phaseITowerCandidates.find((x) => x.index === detail.index)
                        if (c) void handleSelectPhaseICandidate(c)
                      }
                    }
                  : applyTowerSelection
              }
              candidateIdByIndex={
                phaseITowerCandidates.length > 0
                  ? Object.fromEntries(phaseITowerCandidates.map((c) => [c.index, c.id]))
                  : null
              }
              candidateColorByIndex={
                phaseITowerCandidates.length > 0
                  ? Object.fromEntries(
                      phaseITowerCandidates.map((c) => [c.index, c.colorHex ?? '#22c55e'])
                    )
                  : null
              }
              highlightTowerId={corridorAdvice?.nearestTower?.id ?? null}
              highlightStationId={
                corridorAdvice?.nearestStation?.id ??
                corridorAdvice?.powerConnect?.station?.id ??
                null
              }
              corridorNearestTower={corridorAdvice?.nearestTower ?? null}
              corridorNearestStation={corridorAdvice?.nearestStation ?? null}
              corridorPowerLoading={phaseIPowerLoading || planningPowerLoading}
              powerConnect={corridorAdvice?.powerConnect ?? null}
              roadNearest={result?.signals.roadNearest ?? null}
              analyzing={analyzing}
              drawMode={drawMode}
              drawingEnabled={
                (workspaceMode === 'planning' && !analyzing && !kmlLocked) ||
                (planningDrawMode != null && !!result?.geotechnicalIntelligence)
              }
              focusTick={focusTick}
              padFocusTick={padFocusTick}
              focusedPadIndex={focusedPadIndex}
              verdictFilter={verdictFilter}
              connectionOverlay={connectionOverlay}
              undoDraftTick={undoDraftTick}
              onDraftCountChange={setDraftCount}
              onDrawModeChange={setDrawMode}
              onPick={onMapPick}
              onGeometryDrawn={onGeometryDrawn}
              startLocationSlot={!earthIntro ? startLocationPanel : null}
              chromeElevated={earthIntro}
              onSearchRadiusKm={setSearchRadiusKm}
              geometryPending={
                workspaceMode === 'planning' &&
                kmlFeatures.length > 0 &&
                !analyzing &&
                !!(pendingFocus || kmlLocked)
              }
              onGeometryCancel={cancelDrawnGeometry}
              highlightBoreholeId={highlightedBoreholeId}
              onBoreholeSelect={handleBoreholeSelect}
              boreholeFocusTick={boreholeFocusTick}
              geometryActionSlot={
                workspaceMode === 'planning' &&
                kmlFeatures.length > 0 &&
                !analyzing &&
                (pendingFocus || kmlLocked) ? (
                  <div className="ts-glass ts-glass-see p-2.5 flex flex-col items-center gap-2 shadow-lg">
                    <p className="text-[10px] font-bold text-[#66727a] text-center">
                      Shape ready — Save KML or Analyze site · click map to cancel
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveDrawnKml}
                        className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-[rgba(51,65,85,0.16)] bg-white/70 text-xs font-bold text-[#263238]"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save KML
                      </button>
                      <button
                        type="button"
                        onClick={analyzePendingGeometry}
                        className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-[#17879a] text-xs font-black text-white hover:bg-[#126b79]"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze site
                      </button>
                    </div>
                  </div>
                ) : null
              }
            />

            {selectedTowerDetail && (
              <TowerAssetDetailCard
                detail={selectedTowerDetail}
                connection={connectionOverlay}
                onToggleConnection={connectionOverlay ? handleToggleConnection : undefined}
                onClose={() => {
                  setSelectedTowerDetail(null)
                  setConnectionOverlay(null)
                }}
              />
            )}

            {earthIntro && entryMode === 'upload' && !earthFlyTo && (
              <div className="absolute bottom-6 left-1/2 z-[5000] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 pointer-events-auto">
                <div className="ts-glass ts-glass-see p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#263238]">
                    Upload KML / KMZ
                  </p>
                  <p className="mt-1 text-xs text-[#263238] leading-snug">
                    Pick neighbor voltage, then upload. Only matching nearby towers stay on the map with suitability.
                  </p>
                  <label className="mt-2 block text-left text-[10px] font-bold uppercase tracking-wider text-[#0f172a]">
                    Neighbor towers kV
                    <select
                      value={manualVoltageKv ?? ''}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null
                        setManualVoltageKv(v)
                      }}
                      className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/80 px-2 text-xs font-bold text-[#263238]"
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
                  <button
                    type="button"
                    onClick={() => {
                      if (manualVoltageKv == null) {
                        setError('Select neighbor towers kV before uploading.')
                        return
                      }
                      setError(null)
                      fileRef.current?.click()
                    }}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#17879a] text-xs font-bold text-white hover:bg-[#126b79]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Choose KML / KMZ file
                  </button>
                </div>
              </div>
            )}


            {workspaceMode === 'planning' &&
              !result &&
              !analyzing &&
              !pendingFocus &&
              !kmlLocked &&
              !earthIntro && (
              <div className="absolute bottom-[7.5rem] left-3 z-10 pointer-events-none ts-glass px-3 py-2 text-sm text-[#263238] max-w-sm">
                {entryMode === 'live'
                  ? 'Live location set — draw a line or polygon, then Save KML or Analyze'
                  : 'Set start (lat/lon or map click) → Draw line / polygon → Save KML or Analyze'}
              </div>
            )}

            {analysisReady && result && suggestions && (
              <>
                <div className="hidden md:flex absolute top-3 right-3 z-[1160] pointer-events-none">
                  <IntelligenceRail
                    active={activePanel}
                    geotechBuilding={geotechDocxBuilding}
                    onSelect={(id) => setActivePanel((cur) => (cur === id ? null : id))}
                  />
                </div>

                {activePanel && (
                  <div className="absolute z-[1170] pointer-events-none md:top-3 md:bottom-3 md:right-[5.6rem] max-md:left-2 max-md:right-2 max-md:bottom-[4.25rem]">
                    <IntelligenceDrawer title={drawerTitle} onClose={() => setActivePanel(null)}>
                      {activePanel === 'soil' && (
                        <SoilReportCard
                          soil={result.signals.soilScreening}
                          siteLabel={soilReportLabel}
                          onOpenGeotech={() => setActivePanel('geotech')}
                        />
                      )}
                      {activePanel === 'geotech' && (
                        <GeotechIntelligencePanel
                          geo={result.geotechnicalIntelligence}
                          geotechDocxInput={geotechDocxInput}
                          docxReady={geotechDocxReady}
                          docxBuilding={geotechDocxBuilding}
                          soilReportOpts={soilReportOpts}
                          towerPlanning={towerPlanningPanelProps}
                          soilScreening={result.signals.soilScreening}
                          selectedBoreholeId={highlightedBoreholeId}
                          onSelectBorehole={handleBoreholeSelect}
                          siteSignals={result.signals}
                          siteLat={lat ?? result.signals.lat}
                          siteLon={lon ?? result.signals.lon}
                          siteLabel={siteLabel}
                          towerCandidates={phaseITowerCandidates}
                          powerChecked={phaseIPowerChecked}
                        />
                      )}
                      {activePanel === 'suggestions' && (
                        <SuggestionsDetailPanel
                          suggestions={suggestions}
                          corridorAdvice={corridorAdvice}
                          onFocusMap={() => setFocusTick((n) => n + 1)}
                        />
                      )}
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
                          focusedPadIndex={focusedPadIndex}
                          verdictFilter={verdictFilter}
                          onVerdictFilter={setVerdictFilter}
                          onSelectPad={handleSelectPad}
                          powerLoading={phaseIPowerLoading}
                          powerDiagnostics={activeNearbyPower?.diagnostics ?? null}
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
                          lineTowerPlan={lineTowerPlan}
                          manualVoltageKv={manualVoltageKv}
                          onManualVoltageKv={setManualVoltageKv}
                          spanPolicy={spanPolicy}
                          onSpanPolicy={setSpanPolicy}
                          showCorridorPlanning={
                            Boolean(result.geotechnicalIntelligence) && kmlFeatures.length > 0
                          }
                          voltageStandard={voltageStandard}
                          towerBand={towerBand}
                        />
                      )}
                      {activePanel === 'breakdown' && <ScoreBreakdownPanel result={result} />}
                    </IntelligenceDrawer>
                  </div>
                )}

                <div className="md:hidden absolute bottom-2 left-2 right-2 z-[1160] pointer-events-none">
                  <IntelligenceRail
                    active={activePanel}
                    geotechBuilding={geotechDocxBuilding}
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
