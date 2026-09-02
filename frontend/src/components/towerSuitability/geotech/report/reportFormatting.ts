/**
 * Centralized engineering report formatting — consistent precision across sections.
 */

import type { GeoDataStatus, ProvenanceValue } from '../types'

export const FMT = {
  latLon: 6,
  depth: 2,
  percent: 2,
  capacity: 2,
  resistivity: 0,
} as const

export function fmtCoord(v: number, digits = FMT.latLon): string {
  if (!Number.isFinite(v)) return '—'
  return Number(v.toFixed(digits)).toString()
}

export function fmtLat(v: number): string {
  const abs = Math.abs(v)
  const hem = v >= 0 ? 'N' : 'S'
  return `${fmtCoord(abs)}° ${hem}`
}

export function fmtLon(v: number): string {
  const abs = Math.abs(v)
  const hem = v >= 0 ? 'E' : 'W'
  return `${fmtCoord(abs)}° ${hem}`
}

/** DMS format as in reference Transmission-line report (e.g. 23°26'45.97"N). */
export function fmtLatDms(v: number): string {
  const hem = v >= 0 ? 'N' : 'S'
  const abs = Math.abs(v)
  const d = Math.floor(abs)
  const mf = (abs - d) * 60
  const m = Math.floor(mf)
  const s = (mf - m) * 60
  return `${d}°${m}'${s.toFixed(2)}"${hem}`
}

export function fmtLonDms(v: number): string {
  const hem = v >= 0 ? 'E' : 'W'
  const abs = Math.abs(v)
  const d = Math.floor(abs)
  const mf = (abs - d) * 60
  const m = Math.floor(mf)
  const s = (mf - m) * 60
  return `${d}°${m}'${s.toFixed(2)}"${hem}`
}

export function fmtCoordDms(lat: number, lon: number): string {
  return `${fmtLatDms(lat)}  ${fmtLonDms(lon)}`
}

/** Short IS class for tables — "CH (IS 1498..." → "CH". */
export function shortIsSoilClass(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  const v = value.trim()
  const m = v.match(/^([A-Z]{1,3}(?:-[A-Z]{1,2})?)/i)
  if (m) return m[1].toUpperCase()
  const token = v.split(/[\s(]/)[0]
  return token.length <= 6 ? token : v.slice(0, 8)
}

/** Plain numeric cell for Transmission-line tables — numbers only, no (MOD)/(CORR) tags. */
export function reportTableNumber(
  p: ProvenanceValue<number | null> | undefined,
  digits?: number
): string {
  if (!p || p.value == null || !Number.isFinite(p.value as number)) return '—'
  if (digits != null) return String(Number(Number(p.value).toFixed(digits)))
  return String(p.value)
}

/** Plain text cell for Transmission-line tables. */
export function reportTableText(p: ProvenanceValue<string | null> | undefined): string {
  if (!p?.value) return '—'
  return shortIsSoilClass(String(p.value))
}

export function fmtDepth(v: number | null | undefined, digits = FMT.depth): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(digits)).toString()
}

export function fmtPercent(v: number | null | undefined, digits = FMT.percent): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(digits)).toString()
}

export function fmtCapacity(v: number | null | undefined, digits = FMT.capacity): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(digits)).toString()
}

export function statusLabel(s: GeoDataStatus | string | undefined): string {
  if (!s) return 'NO DATA'
  const map: Record<string, string> = {
    MEASURED: 'MEASURED',
    MODELLED: 'MODELLED',
    DERIVED: 'DERIVED',
    CALCULATED: 'CALCULATED',
    ESTIMATED: 'ESTIMATED',
    NO_DATA: 'NO DATA',
    FIELD_TEST_REQUIRED: 'FIELD TEST REQUIRED',
    OUT_OF_RANGE: 'OUT OF RANGE',
    INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
    GIS_DERIVED: 'GIS DERIVED',
    SATELLITE_DERIVED: 'SATELLITE DERIVED',
    ENGINEERING_CORRELATED: 'ENGINEERING CORRELATED',
    MODEL_PREDICTED: 'MODEL PREDICTED',
    DEPTH_MODELLED_ESTIMATE: 'DEPTH MODELLED ESTIMATE',
    REQUIRES_ADDITIONAL_VERIFIED_INPUT: 'REQUIRES ADDITIONAL VERIFIED INPUT',
  }
  return map[s] || String(s).replace(/_/g, ' ')
}

export function provenanceDisplay(p: ProvenanceValue<unknown> | undefined): string {
  if (!p) return 'NO DATA'
  if (p.value == null) return statusLabel(p.status)
  if (typeof p.value === 'object' && p.value !== null && 'low' in p && 'high' in p) {
    const r = p.value as { low: number; high: number }
    return `${r.low}–${r.high}`
  }
  return String(p.value)
}

/** Short provenance tag for Transmission-line table cells — never hides the column. */
export function provenanceStatusTag(s: GeoDataStatus | string | undefined): string {
  const map: Record<string, string> = {
    MEASURED: 'MEAS',
    MODELLED: 'MOD',
    MODEL_PREDICTED: 'MOD',
    ENGINEERING_CORRELATED: 'CORR',
    CALCULATED: 'CALC',
    ESTIMATED: 'EST',
    GIS_DERIVED: 'GIS',
    SATELLITE_DERIVED: 'SAT',
    DERIVED: 'DER',
    FIELD_TEST_REQUIRED: 'FTR',
    NO_DATA: 'NO DATA',
    DEPTH_MODELLED_ESTIMATE: 'MOD',
    REFERENCE_CALIBRATED: 'REF',
    PROJECT_DATA: 'PROJ',
  }
  return map[s ?? ''] ?? String(s ?? 'NO DATA').replace(/_/g, ' ')
}

/** Table cell with numeric value + status tag — column always populated. */
export function provenanceCell(
  p: ProvenanceValue<unknown> | undefined,
  digits?: number
): string {
  if (!p) return 'NO DATA'
  if (p.value == null) {
    if (p.status === 'FIELD_TEST_REQUIRED') return 'FTR'
    return statusLabel(p.status)
  }
  if (typeof p.value === 'object' && p.value !== null && 'low' in p && 'high' in p) {
    const r = p.value as { low: number; high: number }
    const mid = digits != null ? Number(((r.low + r.high) / 2).toFixed(digits)) : (r.low + r.high) / 2
    if (p.status === 'MEASURED') return String(mid)
    return `${mid} (${provenanceStatusTag(p.status)})`
  }
  const raw =
    typeof p.value === 'number' && digits != null
      ? Number(Number(p.value).toFixed(digits))
      : p.value
  if (p.status === 'MEASURED') return String(raw)
  return `${raw} (${provenanceStatusTag(p.status)})`
}

/** Structured status when lab/field value is unavailable — never bare N/A. */
export function unavailableEngineeringStatus(
  kind: 'FIELD_TEST_REQUIRED' | 'NOT_DERIVABLE' | 'NOT_PROVIDED'
): string {
  switch (kind) {
    case 'FIELD_TEST_REQUIRED':
      return 'FIELD VERIFICATION REQUIRED'
    case 'NOT_DERIVABLE':
      return 'NOT DIRECTLY DERIVABLE FROM AVAILABLE GEOSPATIAL DATA'
    case 'NOT_PROVIDED':
      return 'NOT PROVIDED IN PROJECT METADATA'
  }
}

export const HARDCODED_LOCATION_PATTERNS = [
  /\bNirona\b/i,
  /\bBhuj\b/i,
  /\bKoppal\b/i,
  /\bSangola\b/i,
] as const

export const HARDCODED_STATE_PATTERN = /\bGujarat\b/i

export const CONSTRUCTION_APPROVAL_PATTERNS = [
  /\bAPPROVED\s+FOR\s+CONSTRUCTION\b/i,
  /\bFINAL\s+CONSTRUCTION\s+APPROVAL\b/i,
  /\bFINAL\s+DESIGN\s+APPROVED\b/i,
] as const

export const PLACEHOLDER_CELL_PATTERNS = [
  /^N\/A$/i,
  /^NA$/i,
  /^Not Available$/i,
  /^-$/,
  /^undefined$/i,
  /^null$/i,
] as const
