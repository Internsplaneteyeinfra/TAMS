/**
 * Tower / transmission-pad site suitability — screening only.
 * Uses open satellite-derived & OSM signals (no lab / borehole).
 * Claimed accuracy band: ~65–80% for site ranking, not foundation design.
 */

import type { NearbyPowerSupply } from './nearbyPowerSupply'

export type SuitabilityVerdict = 'preferred' | 'conditional' | 'unsuitable'

export interface FactorResult {
  id: string
  label: string
  weight: number
  rawLabel: string
  score: number // 0–10
  note: string
  source: string
  live?: boolean
}

export interface SiteSignals {
  lat: number
  lon: number
  elevationM: number | null
  slopeDeg: number | null
  roadKm: number | null
  waterKm: number | null
  buildingKm: number | null
  towerKm: number | null
  substationKm: number | null
  windMs: number | null
  landCoverHint: 'barren' | 'vegetation' | 'built' | 'water' | 'unknown'
  fetchedAt?: string
  liveOk?: {
    dem: boolean
    road: boolean
    water: boolean
    settlement: boolean
    grid: boolean
    wind: boolean
    landcover: boolean
    geotech?: boolean
    soilScreening?: boolean
  }
  /** True when Overpass failed and Photon geocode fallback was used. */
  usedFallback?: {
    water?: boolean
    settlement?: boolean
    grid?: boolean
  }
  /** Nearest substations/plants and voltage classes from live TAMS + OSM. */
  nearbyPower?: NearbyPowerSupply
  /** Nearest field geotech investigation from TAMS /geotech (within max radius). */
  geotech?: {
    id: string
    site_code: string
    site_name: string
    distance_km: number
    adopted_sbc_tm2?: number
    design_depth_m?: number
    governing_cbr_pct?: number
    adopted_resistivity_ohm_m?: number
    groundwater_note?: string
    recommended_pile?: string
  } | null
  /** Open GIS soil screening (SoilGrids) — not lab accuracy. */
  soilScreening?: import('./soilScreening').SoilScreening | null
  /** Human place label from Nominatim when available. */
  placeLabel?: string | null
}

export interface SuitabilityResult {
  finalScore: number // 0–10
  verdict: SuitabilityVerdict
  confidencePct: number
  factors: FactorResult[]
  signals: SiteSignals
  disclaimer: string
  fetchedAt?: string
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Linear score: best→10, worst→0 */
function thresholdScore(
  value: number,
  best: number,
  worst: number,
  higherIsBetter: boolean
): number {
  if (!Number.isFinite(value)) return 5
  if (higherIsBetter) {
    if (value >= best) return 10
    if (value <= worst) return 0
    return ((value - worst) / (best - worst)) * 10
  }
  if (value <= best) return 10
  if (value >= worst) return 0
  return ((worst - value) / (worst - best)) * 10
}

export function scoreSiteSignals(signals: SiteSignals): SuitabilityResult {
  const factors: FactorResult[] = []

  const slope = signals.slopeDeg
  factors.push({
    id: 'slope',
    label: 'Terrain slope',
    weight: 0.22,
    rawLabel: slope == null ? 'n/a' : `${slope.toFixed(1)}°`,
    score: slope == null ? 5 : thresholdScore(slope, 5, 18, false),
    note:
      slope != null && slope > 12
        ? 'Steep grade — pad grading / retention likely costly.'
        : 'Favourable pad slope for tower foundation screening.',
    source: 'Live · Open-Meteo DEM',
    live: signals.liveOk?.dem ?? slope != null,
  })

  const elev = signals.elevationM
  let elevScore = 7
  if (elev != null) {
    if (elev < 5) elevScore = 3
    else if (elev > 1800) elevScore = 4
    else if (elev >= 20 && elev <= 800) elevScore = 9
    else elevScore = 7
  }
  factors.push({
    id: 'elevation',
    label: 'Elevation',
    weight: 0.08,
    rawLabel: elev == null ? 'n/a' : `${Math.round(elev)} m`,
    score: elevScore,
    note: 'Screening band for logistics & flood exposure context.',
    source: 'Live · Open-Meteo DEM',
    live: signals.liveOk?.dem ?? elev != null,
  })

  const road = signals.roadKm
  factors.push({
    id: 'road',
    label: 'Road access',
    weight: 0.14,
    rawLabel: road == null ? 'live lookup failed' : `${road.toFixed(2)} km`,
    score: road == null ? 3 : thresholdScore(road, 0.5, 8, false),
    note:
      road == null
        ? 'Live road lookup failed — treat access as uncertain.'
        : road > 3
          ? 'Distant from mapped roads — construction access risk.'
          : 'Reasonable access for tower erection logistics.',
    source: 'Live · OSRM nearest road',
    live: signals.liveOk?.road ?? road != null,
  })

  const water = signals.waterKm
  const waterFallback = signals.usedFallback?.water
  factors.push({
    id: 'water',
    label: 'Water / flood buffer',
    weight: 0.14,
    rawLabel: water == null ? 'live lookup failed' : water >= 7.9 ? '> 8 km' : `${water.toFixed(2)} km`,
    score: water == null ? 5 : thresholdScore(Math.min(water, 8), 0.8, 0.05, true),
    note:
      water == null
        ? 'Live OSM water query failed — flood proxy incomplete.'
        : waterFallback
          ? 'Overpass failed — weaker Photon fallback; verify on imagery.'
          : water < 0.15
            ? 'Very close to mapped water — flood / scour risk.'
            : water >= 7.9
              ? 'No mapped water within 8 km (live OSM).'
              : 'Acceptable distance from mapped surface water.',
    source: waterFallback ? 'Fallback · Photon geocode' : 'Live · OSM Overpass water',
    live: (signals.liveOk?.water ?? water != null) && !waterFallback,
  })

  const building = signals.buildingKm
  const settleFallback = signals.usedFallback?.settlement
  factors.push({
    id: 'clearance',
    label: 'Settlement clearance',
    weight: 0.1,
    rawLabel:
      building == null ? 'live lookup failed' : building >= 3.9 ? '> 4 km' : `${building.toFixed(2)} km`,
    score: building == null ? 6 : thresholdScore(Math.min(building, 4), 0.25, 0.02, true),
    note:
      building == null
        ? 'Live OSM settlement query failed — verify on imagery.'
        : settleFallback
          ? 'Overpass failed — weaker Photon fallback; verify on imagery.'
          : building < 0.08
            ? 'Close to mapped buildings — ROW / social risk.'
            : building >= 3.9
              ? 'No mapped settlement within 4 km (live OSM).'
              : 'Clearance from mapped settlements looks workable.',
    source: settleFallback ? 'Fallback · Photon geocode' : 'Live · OSM Overpass places',
    live: (signals.liveOk?.settlement ?? building != null) && !settleFallback,
  })

  const power = signals.nearbyPower
  const nearestPower = power?.nearest
  const suggestedKv = power?.suggestedVoltageKv
  const powerUnavailable = power != null && !power.dataAvailable

  // Factor: Power connectivity — how close the nearest suitable tower/line/SS is
  {
    const connectDist = nearestPower?.distanceKm ?? null
    let pcs: number
    let note: string
    if (powerUnavailable) {
      pcs = 5 // neutral — missing data is not unsuitability
      note =
        'Power data unavailable (TAMS/OSM). This factor is held neutral — not an engineering rejection.'
    } else if (!nearestPower) {
      pcs = 5
      note = power?.note ?? 'No existing power assets found in search radius.'
    } else {
      pcs = thresholdScore(connectDist!, 0.2, 20, false)
      if (power?.nearestPole && power.nearestPole.distanceKm <= 0.35) pcs = Math.min(10, pcs + 2)
      if (nearestPower.kind === 'tower' && (connectDist ?? 99) <= 2) pcs = Math.min(10, pcs + 1.2)
      if (nearestPower.kind === 'substation') pcs = Math.min(10, pcs + 0.8)
      if (power?.interconnectEase === 'easy') pcs = Math.min(10, pcs + 0.5)
      note = power?.note ?? 'Existing grid asset found nearby.'
    }
    factors.push({
      id: 'power_connectivity',
      label: 'Power connectivity',
      weight: 0.10,
      rawLabel: powerUnavailable
        ? 'data unavailable'
        : nearestPower
          ? `${nearestPower.name} · ${nearestPower.distanceKm.toFixed(1)} km`
          : `none within ${power?.searchRadiusKm ?? 8} km`,
      score: pcs,
      note,
      source: nearestPower
        ? `Live · ${nearestPower.source === 'tams' ? 'TAMS GIS' : 'OSM Overpass'}`
        : 'Live · TAMS + OSM power assets',
      live: power != null && !powerUnavailable,
    })
  }

  // Factor: Voltage suitability — does the available voltage match a useful planning tier?
  {
    const USEFUL_KV = [11, 33, 66, 110, 132, 220, 400, 765]
    const available = power?.availableVoltageKv ?? []
    const matched = available.some((kv) => USEFUL_KV.includes(kv))
    const hasHighVoltage = available.some((kv) => kv >= 33)
    const tag = suggestedKv != null && !nearestPower?.voltageInferred
    let vs: number
    let note: string
    if (powerUnavailable) {
      vs = 5
      note = 'Voltage unknown — power data unavailable. Utility nameplate verification required.'
    } else if (!available.length) {
      vs = 5
      note = 'No voltage tags on nearby assets — do not invent; verify with utility drawings.'
    } else if (tag && hasHighVoltage) {
      vs = 9
      note = `Voltages mapped nearby: ${available.slice(0, 5).join(', ')} kV.`
    } else if (tag) {
      vs = 7
      note = `Voltages mapped nearby: ${available.slice(0, 5).join(', ')} kV.`
    } else if (matched && hasHighVoltage) {
      vs = 7
      note = `Voltages mapped nearby: ${available.slice(0, 5).join(', ')} kV.`
    } else if (matched) {
      vs = 6
      note = `Voltages mapped nearby: ${available.slice(0, 5).join(', ')} kV.`
    } else {
      vs = 5
      note = 'Voltage tags present but outside common planning tiers.'
    }
    const kVLabel = powerUnavailable
      ? 'unavailable'
      : suggestedKv != null
        ? `${suggestedKv} kV`
        : available.length
          ? available.slice(0, 3).join('/') + ' kV'
          : 'unknown'
    factors.push({
      id: 'voltage_suitability',
      label: 'Voltage suitability',
      weight: 0.08,
      rawLabel: kVLabel,
      score: vs,
      note,
      source: nearestPower?.source === 'tams' ? 'Live · TAMS GIS' : 'Live · OSM Overpass power tags',
      live: power != null && !powerUnavailable,
    })
  }

  // Factor: Connection distance — is the estimated corridor run short enough?
  {
    const connKmEst = powerUnavailable
      ? null
      : power?.estimatedPracticalConnectionDistanceKm ??
        power?.connectionDistanceKm ??
        (nearestPower?.distanceKm != null ? nearestPower.distanceKm * 1.2 : null)
    const cds = powerUnavailable || connKmEst == null ? 5 : thresholdScore(connKmEst, 0.3, 15, false)
    factors.push({
      id: 'connection_distance',
      label: 'Connection distance',
      weight: 0.08,
      rawLabel:
        powerUnavailable || connKmEst == null
          ? 'unavailable'
          : connKmEst < 1
            ? `~${(connKmEst * 1000).toFixed(0)} m`
            : `~${connKmEst.toFixed(1)} km`,
      score: cds,
      note: powerUnavailable
        ? 'Connection distance unknown — power data unavailable (neutral score).'
        : connKmEst == null
          ? 'No nearby existing asset — connection distance unknown.'
          : connKmEst <= 0.5
            ? 'Very short connection run — low corridor cost (screening estimate = direct × 1.2).'
            : connKmEst <= 2
              ? 'Short spur to existing grid — manageable connection (screening estimate).'
              : connKmEst <= 8
                ? 'Moderate connection run — multi-tower spur needed (screening estimate).'
                : 'Long connection — significant corridor construction cost (screening estimate).',
      source: 'Live · TAMS + OSM (Haversine × 1.2 practical factor)',
      live: power != null && !powerUnavailable,
    })
  }

  // Factor: Corridor feasibility — route obstacles (water, buildings, terrain)
  {
    const water = signals.waterKm
    const building = signals.buildingKm
    const slope = signals.slopeDeg
    let cf = 8 // start optimistic
    const issues: string[] = []
    if (water != null && water < 0.15) { cf -= 2; issues.push('close water crossing') }
    if (building != null && building < 0.1) { cf -= 2; issues.push('settlement obstruction') }
    if (slope != null && slope > 12) { cf -= 1.5; issues.push('steep terrain') }
    if (slope != null && slope > 18) { cf -= 1; issues.push('very steep grade') }
    cf = clamp(cf, 0, 10)
    factors.push({
      id: 'corridor_feasibility',
      label: 'Corridor feasibility',
      weight: 0.06,
      rawLabel: issues.length ? issues.join(', ') : 'No major obstruction',
      score: cf,
      note: issues.length
        ? `Route may cross: ${issues.join(', ')}. Verify on imagery before corridor design.`
        : 'No major water/settlement/slope obstruction detected on open data for the connection route.',
      source: 'Live · OSM Overpass + Open-Meteo DEM heuristic',
      live: water != null || building != null || slope != null,
    })
  }

  const wind = signals.windMs
  factors.push({
    id: 'wind',
    label: 'Wind exposure',
    weight: 0.06,
    rawLabel: wind == null ? 'n/a' : `${wind.toFixed(1)} m/s`,
    score: wind == null ? 6 : thresholdScore(wind, 4, 12, false),
    note: 'Live Open-Meteo 90-day mean daily max wind (m/s). Structural design still needs IS wind zone.',
    source: 'Live · Open-Meteo archive wind',
    live: signals.liveOk?.wind ?? wind != null,
  })

  let landScore = 6
  let landLabel = 'Unknown'
  switch (signals.landCoverHint) {
    case 'barren':
      landScore = 9
      landLabel = 'Barren / open'
      break
    case 'vegetation':
      landScore = 5
      landLabel = 'Vegetated'
      break
    case 'built':
      landScore = 2
      landLabel = 'Built-up'
      break
    case 'water':
      landScore = 0
      landLabel = 'Water'
      break
    default:
      break
  }
  factors.push({
    id: 'landcover',
    label: 'Land cover hint',
    weight: 0.08,
    rawLabel: landLabel,
    score: landScore,
    note: 'Live OSM landuse/natural around the pad — not a cadastral certificate.',
    source: 'Live · OSM landuse',
    live: signals.liveOk?.landcover ?? signals.landCoverHint !== 'unknown',
  })

  // Factor: Field geotech + open GIS soil screening
  {
    const g = signals.geotech
    const soil = signals.soilScreening
    let gs = 5
    let note =
      'No open soil map or field record yet. Re-run analyze to fetch SoilGrids screening.'
    let raw = 'not on file'
    let live = false
    if (g) {
      const sbc = g.adopted_sbc_tm2
      raw = `${g.site_code} · ${g.distance_km.toFixed(2)} km`
      if (sbc != null && sbc >= 20) gs = 9
      else if (sbc != null && sbc >= 12) gs = 7
      else if (sbc != null) gs = 6
      else gs = 6
      note = `Field geotech on file: SBC ${sbc ?? '—'} T/m² @ ${g.design_depth_m ?? '—'} m · CBR ${
        g.governing_cbr_pct ?? '—'
      }% (~85–95% design confidence after engineer review).`
      live = true
    } else if (soil) {
      raw = `${soil.textureClass} · ~${soil.confidencePct}%`
      gs = Math.max(5, Math.round(soil.confidencePct / 10))
      note = `Open GIS soil (SoilGrids): ${soil.textureClass}. Indicative SBC ${soil.indicativeSbcTm2.low}–${soil.indicativeSbcTm2.high} T/m². Screening confidence ~${soil.confidencePct}% — not a borehole.`
      live = true
    }
    factors.push({
      id: 'geotech',
      label: 'Soil / SBC (open GIS + field)',
      weight: 0.08,
      rawLabel: raw,
      score: gs,
      note,
      source: g
        ? 'Live · TAMS Geotech module'
        : soil
          ? 'Live · ISRIC SoilGrids (open)'
          : 'SoilGrids / TAMS Geotech',
      live: signals.liveOk?.geotech || signals.liveOk?.soilScreening || live,
    })
  }

  const weightSum = factors.reduce((s, f) => s + f.weight, 0)
  const finalScore = clamp(
    factors.reduce((s, f) => s + f.score * f.weight, 0) / weightSum,
    0,
    10
  )

  let verdict: SuitabilityVerdict = 'conditional'
  if (finalScore >= 7) verdict = 'preferred'
  else if (finalScore < 4.5) verdict = 'unsuitable'

  // Confidence rises when more open signals resolved; penalize Photon fallbacks
  const resolved = [
    signals.elevationM,
    signals.slopeDeg,
    signals.roadKm,
    signals.waterKm,
    signals.buildingKm,
    signals.towerKm ?? signals.substationKm,
    signals.windMs,
  ].filter((v) => v != null).length
  const fallbackCount = [
    signals.usedFallback?.water,
    signals.usedFallback?.settlement,
    signals.usedFallback?.grid,
  ].filter(Boolean).length
  let confidencePct = Math.round(55 + (resolved / 7) * 25) // ~55–80
  confidencePct = Math.max(45, confidencePct - fallbackCount * 5)

  return {
    finalScore: Number(finalScore.toFixed(2)),
    verdict,
    confidencePct,
    factors,
    signals,
    disclaimer: '',
    fetchedAt: signals.fetchedAt || new Date().toISOString(),
  }
}

export function verdictLabel(v: SuitabilityVerdict): string {
  if (v === 'preferred') return 'Preferred pad'
  if (v === 'unsuitable') return 'Unsuitable (screen)'
  return 'Conditional — investigate'
}

export function verdictColor(v: SuitabilityVerdict): string {
  if (v === 'preferred') return '#34d399'
  if (v === 'unsuitable') return '#f87171'
  return '#fbbf24'
}

export interface ImprovementSuggestion {
  factorId: string
  factorLabel: string
  currentScore: number
  maxScore: number
  /** Points this factor could still add to the 0–10 final score (score gap × weight) */
  gapPoints: number
  whyNotIdeal: string
  howToImprove: string
}

export interface SuitabilitySuggestions {
  currentScore: number
  remainingToPerfect: number
  remainingPct: number
  targetAccepted: number
  pointsToAccepted: number
  items: ImprovementSuggestion[]
  summary: string
  /** Factors we could not score (missing live data). */
  couldNotCheck?: string[]
  /** Where to place / how to tap existing towers — with accuracy notes */
  placementTips?: Array<{ title: string; detail: string; accuracy: string }>
  interconnectEase?: 'easy' | 'moderate' | 'hard'
}

const IMPROVE_COPY: Record<
  string,
  { why: (f: FactorResult, s: SiteSignals) => string; how: (f: FactorResult, s: SiteSignals) => string }
> = {
  slope: {
    why: (f) => (f.score >= 9 ? 'Pad slope is already good.' : `Ground is steep (${f.rawLabel}).`),
    how: () => 'Flatten the pad or shift a few metres to flatter ground.',
  },
  elevation: {
    why: (f) => (f.score >= 9 ? 'Height is in a workable band.' : `Height ${f.rawLabel} is too low or too high.`),
    how: () => 'Avoid floodplains and very high sites without a road.',
  },
  road: {
    why: (f) => (f.score >= 8 ? 'Road access is good.' : `Road is far (${f.rawLabel}).`),
    how: () => 'Add an access track or move closer to an existing road.',
  },
  water: {
    why: (f) => (f.score >= 8 ? 'Water distance is OK.' : `Too close to water (${f.rawLabel}).`),
    how: () => 'Move upslope and raise the foundation.',
  },
  clearance: {
    why: (f) => (f.score >= 8 ? 'Buildings are far enough.' : `Houses/buildings nearby (${f.rawLabel}).`),
    how: () => 'Increase setback or pick a more open pad.',
  },
  power_connectivity: {
    why: (_f, s) => {
      if (!s.nearbyPower?.dataAvailable) return 'Grid map was not available.'
      const p = s.nearbyPower?.nearest
      if (!p) return 'No mapped line, tower, or substation nearby.'
      return `Nearest grid is ${p.distanceKm.toFixed(1)} km (${p.name}).`
    },
    how: () => 'Steer the corridor toward the nearest tower or substation.',
  },
  voltage_suitability: {
    why: (f, s) =>
      !s.nearbyPower?.dataAvailable
        ? 'Voltage could not be read.'
        : f.score >= 8
          ? `Nearby voltage (~${s.nearbyPower?.suggestedVoltageKv ?? '?'} kV) fits.`
          : 'Nearby voltage does not match this line class.',
    how: () => 'Match kV to the nearby line, or change class in Controls.',
  },
  connection_distance: {
    why: (f) => (f.score >= 8 ? 'Tap distance is short.' : `Long tap (${f.rawLabel}) raises cost.`),
    how: () => 'Move closer to the existing corridor.',
  },
  corridor_feasibility: {
    why: (f) => (f.score >= 8 ? 'Route looks clear.' : `Obstacles on route (${f.rawLabel}).`),
    how: () => 'Avoid water and settlements; use open land.',
  },
  wind: {
    why: (f) => (f.score >= 8 ? 'Wind is moderate.' : `Higher wind (${f.rawLabel}).`),
    how: () => 'Use a stronger foundation for the local wind zone.',
  },
  landcover: {
    why: (f) => (f.score >= 8 ? 'Ground cover is workable.' : `Cover is ${f.rawLabel}.`),
    how: () => 'Use open / barren land, not built-up or water.',
  },
}

/** Build “remaining to 10” + per-factor improvement tips for the Suggestions popup. */
export function buildSuitabilitySuggestions(result: SuitabilityResult): SuitabilitySuggestions {
  const currentScore = result.finalScore
  const remainingToPerfect = Number(Math.max(0, 10 - currentScore).toFixed(2))
  const remainingPct = Number(((remainingToPerfect / 10) * 100).toFixed(1))
  const targetAccepted = 7
  const pointsToAccepted = Number(Math.max(0, targetAccepted - currentScore).toFixed(2))

  const items: ImprovementSuggestion[] = result.factors
    .map((f) => {
      const gapScore = Math.max(0, 10 - f.score)
      const gapPoints = Number((gapScore * f.weight).toFixed(3))
      const copy = IMPROVE_COPY[f.id]
      return {
        factorId: f.id,
        factorLabel: f.label,
        currentScore: f.score,
        maxScore: 10,
        gapPoints,
        whyNotIdeal: copy ? copy.why(f, result.signals) : f.note,
        howToImprove: copy ? copy.how(f, result.signals) : 'Shift the pad or add engineering controls.',
      }
    })
    .filter((i) => i.gapPoints >= 0.05)
    .sort((a, b) => b.gapPoints - a.gapPoints)

  const couldNotCheck = result.factors
    .filter((f) => f.live === false || /n\/a|unavailable|unknown|no data/i.test(`${f.rawLabel} ${f.note}`))
    .map((f) => f.label)

  let summary: string
  const ease = result.signals.nearbyPower?.interconnectEase
  const nearTw = result.signals.nearbyPower?.nearestTower
  if (nearTw && nearTw.distanceKm <= 2) {
    summary = `Grid is close (~${nearTw.distanceKm.toFixed(1)} km). ${
      remainingToPerfect >= 0.15 ? `Still ${remainingToPerfect.toFixed(1)} pts below 10.` : 'Score is strong.'
    }`
  } else if (remainingToPerfect < 0.15) {
    summary = 'Score is essentially 10/10 on this screening.'
  } else if (currentScore >= targetAccepted) {
    summary = `Pass (≥7). ${remainingToPerfect.toFixed(1)} pts left to a perfect 10.`
  } else {
    summary = `Need +${pointsToAccepted.toFixed(1)} to pass (≥7). Biggest gaps first.`
  }

  return {
    currentScore,
    remainingToPerfect,
    remainingPct,
    targetAccepted,
    pointsToAccepted,
    items,
    summary,
    couldNotCheck,
    placementTips: result.signals.nearbyPower?.placementTips,
    interconnectEase: ease,
  }
}

