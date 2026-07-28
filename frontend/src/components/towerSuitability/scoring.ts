/**
 * Tower / transmission-pad site suitability — screening only.
 * Uses open satellite-derived & OSM signals (no lab / borehole).
 * Claimed accuracy band: ~65–80% for site ranking, not foundation design.
 */

export type SuitabilityVerdict = 'preferred' | 'conditional' | 'unsuitable'

export interface FactorResult {
  id: string
  label: string
  weight: number
  rawLabel: string
  score: number // 0–10
  note: string
  source: string
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
}

export interface SuitabilityResult {
  finalScore: number // 0–10
  verdict: SuitabilityVerdict
  confidencePct: number
  factors: FactorResult[]
  signals: SiteSignals
  disclaimer: string
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
    source: 'DEM · Open-Meteo elevation grid',
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
    source: 'DEM · Open-Meteo',
  })

  const road = signals.roadKm
  factors.push({
    id: 'road',
    label: 'Road access',
    weight: 0.14,
    rawLabel: road == null ? 'no OSM road in 25 km' : `${road.toFixed(2)} km`,
    score: road == null ? 3 : thresholdScore(road, 0.5, 8, false),
    note:
      road == null
        ? 'No mapped highway found nearby — treat access as uncertain.'
        : road > 3
          ? 'Distant from mapped roads — construction access risk.'
          : 'Reasonable access for tower erection logistics.',
    source: 'OSRM nearest road',
  })

  const water = signals.waterKm
  factors.push({
    id: 'water',
    label: 'Water / flood buffer',
    weight: 0.16,
    rawLabel: water == null ? 'no water found nearby' : `${water.toFixed(2)} km`,
    score: water == null ? 5 : thresholdScore(water, 0.8, 0.05, true),
    note:
      water == null
        ? 'No nearby water in Photon index — flood proxy incomplete.'
        : water < 0.15
          ? 'Very close to mapped water — flood / scour risk.'
          : 'Acceptable distance from mapped surface water.',
    source: 'Photon · OSM water',
  })

  const building = signals.buildingKm
  factors.push({
    id: 'clearance',
    label: 'Settlement clearance',
    weight: 0.12,
    rawLabel: building == null ? 'no settlement found nearby' : `${building.toFixed(2)} km`,
    score: building == null ? 7 : thresholdScore(building, 0.25, 0.02, true),
    note:
      building == null
        ? 'No mapped building/place nearby — likely open land (verify on imagery).'
        : building < 0.08
          ? 'Close to mapped buildings — ROW / social risk.'
          : 'Clearance from mapped settlements looks workable.',
    source: 'Photon · OSM places',
  })

  const tower = signals.towerKm
  const sub = signals.substationKm
  const corridorDist =
    tower != null && sub != null ? Math.min(tower, sub) : tower ?? sub
  factors.push({
    id: 'corridor',
    label: 'Grid corridor proximity',
    weight: 0.14,
    rawLabel:
      corridorDist == null ? 'no grid asset found nearby' : `${corridorDist.toFixed(2)} km`,
    score: corridorDist == null ? 4 : thresholdScore(corridorDist, 2, 35, false),
    note:
      corridorDist == null
        ? 'No TAMS/Photon power asset nearby — greenfield assumption.'
        : corridorDist < 1
          ? 'Near existing towers/lines — good for extension / tap.'
          : 'Far from mapped grid assets — greenfield corridor cost.',
    source: 'TAMS · Photon power',
  })

  const wind = signals.windMs
  factors.push({
    id: 'wind',
    label: 'Wind exposure',
    weight: 0.06,
    rawLabel: wind == null ? 'n/a' : `${wind.toFixed(1)} m/s`,
    score: wind == null ? 6 : thresholdScore(wind, 4, 12, false),
    note: 'Open-Meteo daily max wind (m/s). Structural design still needs IS wind zone.',
    source: 'Open-Meteo · wind_speed_unit=ms',
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
    note: 'OSM landuse/natural + Nominatim reverse — not a cadastral certificate.',
    source: 'OSM · Nominatim',
  })

  const weightSum = factors.reduce((s, f) => s + f.weight, 0)
  const finalScore = clamp(
    factors.reduce((s, f) => s + f.score * f.weight, 0) / weightSum,
    0,
    10
  )

  let verdict: SuitabilityVerdict = 'conditional'
  if (finalScore >= 7) verdict = 'preferred'
  else if (finalScore < 4.5) verdict = 'unsuitable'

  // Confidence rises when more open signals resolved
  const resolved = [
    signals.elevationM,
    signals.slopeDeg,
    signals.roadKm,
    signals.waterKm,
    signals.buildingKm,
    signals.towerKm ?? signals.substationKm,
    signals.windMs,
  ].filter((v) => v != null).length
  const confidencePct = Math.round(55 + (resolved / 7) * 25) // ~55–80

  return {
    finalScore: Number(finalScore.toFixed(2)),
    verdict,
    confidencePct,
    factors,
    signals,
    disclaimer:
      'Screening score from open satellite DEM + OSM + weather only. Not a substitute for borehole, lab SBC/pile, CBR, or earth-resistivity investigation (~65–80% site-ranking confidence).',
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
}

const IMPROVE_COPY: Record<
  string,
  { why: (f: FactorResult, s: SiteSignals) => string; how: (f: FactorResult, s: SiteSignals) => string }
> = {
  slope: {
    why: (f) =>
      f.score >= 9
        ? 'Slope is already strong for a tower pad.'
        : `Current slope score ${f.score.toFixed(1)}/10 (${f.rawLabel}) — steeper grades raise grading and foundation cost.`,
    how: () =>
      'Cut/fill to flatten the pad (<~5–8°), add retaining where needed, or shift the tower a short distance to flatter ground.',
  },
  elevation: {
    why: (f) =>
      f.score >= 9
        ? 'Elevation is within a favourable logistics band.'
        : `Elevation ${f.rawLabel} scores ${f.score.toFixed(1)}/10 — very low (flood) or very high (access) sites lose points.`,
    how: () =>
      'Prefer pads ~20–800 m AMSL when possible; avoid floodplains and extreme highland without access roads.',
  },
  road: {
    why: (f) =>
      f.score >= 8
        ? 'Road access is already favourable.'
        : `Access is weak (${f.rawLabel}, score ${f.score.toFixed(1)}) — distant or unmapped roads slow erection & maintenance.`,
    how: () =>
      'Build/upgrade an access track to the pad, use existing ROW roads, or relocate closer to a highway/track before construction.',
  },
  water: {
    why: (f) =>
      f.score >= 8
        ? 'Water buffer looks acceptable on open data.'
        : `Water/flood factor is ${f.score.toFixed(1)}/10 (${f.rawLabel}) — proximity to channels raises scour & flood risk.`,
    how: () =>
      'Move the pad upslope away from water, raise foundation level, add drainage/bunds, and confirm HFL with local records.',
  },
  clearance: {
    why: (f) =>
      f.score >= 8
        ? 'Settlement clearance is acceptable on mapped data.'
        : `Clearance score ${f.score.toFixed(1)}/10 (${f.rawLabel}) — nearby buildings increase social / ROW conflict.`,
    how: () =>
      'Increase setback from settlements, negotiate ROW, or pick an alternate angle tower location with more open buffer.',
  },
  corridor: {
    why: (f) =>
      f.score >= 8
        ? 'Grid proximity supports corridor connection.'
        : `Corridor score ${f.score.toFixed(1)}/10 (${f.rawLabel}) — far from lines/substations raises greenfield cost.`,
    how: () =>
      'Align toward existing transmission corridors or substations, or plan a shorter spur/tap instead of a long isolated spur.',
  },
  wind: {
    why: (f) =>
      f.score >= 8
        ? 'Wind exposure is moderate on Open-Meteo screening.'
        : `Wind score ${f.score.toFixed(1)}/10 (${f.rawLabel}) — higher exposure needs stronger structures / foundations.`,
    how: () =>
      'Use IS wind-zone design, higher foundation stiffness, and confirm with local wind data; micro-siting in sheltered terrain can help.',
  },
  landcover: {
    why: (f) =>
      f.score >= 8
        ? 'Land cover hint favours open / buildable ground.'
        : `Land cover is “${f.rawLabel}” (score ${f.score.toFixed(1)}) — vegetation/built/water reduces pad readiness.`,
    how: () =>
      'Clear/permit vegetation legally, avoid built-up parcels, or relocate to barren/open land with clear ownership.',
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
        howToImprove: copy ? copy.how(f, result.signals) : 'Improve this factor with engineering controls or relocate the pad.',
      }
    })
    .filter((i) => i.gapPoints >= 0.05)
    .sort((a, b) => b.gapPoints - a.gapPoints)

  let summary: string
  if (remainingToPerfect < 0.15) {
    summary = 'Score is essentially at the screening ceiling (10/10). Focus next on field geotech (BH, SBC, resistivity).'
  } else if (currentScore >= targetAccepted) {
    summary = `Accepted on screening, but ${remainingToPerfect.toFixed(1)} points short of a perfect 10. Closing the gaps below improves robustness.`
  } else {
    summary = `Need +${pointsToAccepted.toFixed(1)} points to reach Accepted (≥7). Biggest losses are listed first — fix those to make the tower pad more suitable.`
  }

  return {
    currentScore,
    remainingToPerfect,
    remainingPct,
    targetAccepted,
    pointsToAccepted,
    items,
    summary,
  }
}

