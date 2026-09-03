/**
 * Validated Report Data Adapter — single authoritative bridge from Phase A–I to DOCX.
 */

import type { GeotechnicalIntelligence } from '../types'
import type { PhaseIReportBundle } from '../../towerPlanning/types'
import { fmtLat, fmtLon } from './reportFormatting'
import { buildDynamicPurpose } from './reportDynamicScope'
import { validateGeotechReportData } from './reportValidation/validateReport'
import type { ReportValidationResult } from './reportValidation/types'
import { ReportValidationError } from './reportValidation/types'

export type GeotechDocxInput = {
  geo: GeotechnicalIntelligence
  projectName?: string
  clientName?: string
  purpose?: string
  preparedFor?: string
  consultant?: string
  reportId?: string
  /** Phase I bundle — only when tower workflow was executed. */
  phaseI?: PhaseIReportBundle | null
  /** Skip validation (tests only). */
  skipValidation?: boolean
  /** Download format — default matches Transmission line.docx reference. */
  reportFormat?: 'transmission-line' | 'full'
}

export interface ReportLocationInfo {
  latitude: number
  longitude: number
  latitudeDisplay: string
  longitudeDisplay: string
  areaLabel: string | null
  district: string | null
  state: string | null
  coordinateFallback: boolean
  investigationGeometryLabel: string | null
}

export interface ReportSectionFlags {
  includeInvestigationPlan: boolean
  includeSoilTestSummary: boolean
  includeSbc: boolean
  includePile: boolean
  includeCbr: boolean
  includeResistivity: boolean
  includeSoilVerdict: boolean
  includeTowerPlanning: boolean
  includePowerInfrastructure: boolean
  includeSelectedTowerAnalysis: boolean
}

export interface ValidatedGeotechnicalReportData {
  geo: GeotechnicalIntelligence
  metadata: {
    projectName: string
    clientName: string | null
    consultant: string | null
    purpose: string
    reportId: string
    reportTitle: string
    reportSubtitle: string
    classification: string
    dateStr: string
  }
  location: ReportLocationInfo
  phaseI: PhaseIReportBundle | null
  sections: ReportSectionFlags
  validation: ReportValidationResult
  /** Strings scanned for hardcoded location leakage. */
  textSamplesForLocationScan: string[]
}

function parsePlaceLabel(label: string | null | undefined): {
  area: string | null
  district: string | null
  state: string | null
} {
  if (!label?.trim()) return { area: null, district: null, state: null }
  const parts = label.split(/[,·]/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 3) {
    return { area: parts[0], district: parts[1], state: parts[parts.length - 1] }
  }
  if (parts.length === 2) {
    return { area: parts[0], district: null, state: parts[1] }
  }
  return { area: parts[0] ?? null, district: null, state: null }
}

function reportIdFor(geo: GeotechnicalIntelligence): string {
  const d = new Date(geo.generatedAt || Date.now())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const lat = Math.abs(geo.location.lat).toFixed(3).replace('.', '')
  return `TAMS-GEO-${y}${m}${day}-${lat}`
}

function geometryLabel(geo: GeotechnicalIntelligence): string | null {
  const g = geo.boreholeInvestigationPlan?.geometry
  if (!g) return null
  return `${g.type} — ${g.label || g.type}`
}

export function buildGeotechReportData(input: GeotechDocxInput): ValidatedGeotechnicalReportData {
  const geo = input.geo
  const tlFormat = (input.reportFormat ?? 'transmission-line') === 'transmission-line'
  const place = (geo.location.placeLabel.value as string) || null
  const parsed = parsePlaceLabel(place)
  const coordinateFallback = !place?.trim()

  const location: ReportLocationInfo = {
    latitude: geo.location.lat,
    longitude: geo.location.lon,
    latitudeDisplay: fmtLat(geo.location.lat),
    longitudeDisplay: fmtLon(geo.location.lon),
    areaLabel: coordinateFallback ? 'Selected Investigation Coordinates' : parsed.area,
    district: parsed.district,
    state: parsed.state,
    coordinateFallback,
    investigationGeometryLabel: geometryLabel(geo),
  }

  const dateStr = new Date(geo.generatedAt || Date.now()).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const phaseI = input.phaseI ?? null
  const towerWorkflow =
    Boolean(phaseI?.towerCandidates?.length) ||
    Boolean(phaseI?.towerPlanningContext?.planningGeometry) ||
    Boolean(phaseI?.selectedTowerAnalysis)

  const sections: ReportSectionFlags = {
    includeInvestigationPlan: Boolean(geo.boreholeInvestigationPlan),
    includeSoilTestSummary: Boolean(geo.soilTestSummary?.records?.length || geo.soilProfile.length),
    includeSbc: true,
    includePile: true,
    includeCbr: true,
    includeResistivity: true,
    includeSoilVerdict: Boolean(geo.soilVerdictAnalysis),
    includeTowerPlanning: towerWorkflow,
    includePowerInfrastructure: Boolean(phaseI?.powerInfrastructureSummary),
    includeSelectedTowerAnalysis: Boolean(phaseI?.selectedTowerAnalysis),
  }

  const projectName = input.projectName || (tlFormat ? 'Transmission line' : 'Transmission Infrastructure Project')
  const metadata = {
    projectName,
    clientName: input.clientName || input.preparedFor || (tlFormat ? '--------------------------------------' : null),
    consultant: input.consultant || (tlFormat ? 'Planeteye Infra AI' : null),
    purpose: tlFormat
      ? input.purpose || 'Construction of Transmission Tower'
      : input.purpose || buildDynamicPurpose(geo),
    reportId: input.reportId || reportIdFor(geo),
    reportTitle: tlFormat ? 'Geotechnical Investigation Report' : 'GEOSPATIAL GEOTECHNICAL INVESTIGATION REPORT',
    reportSubtitle: tlFormat ? '' : 'Satellite, GIS and Remote Sensing-Based Preliminary Assessment',
    classification: geo.reportClassification.replace(/_/g, ' '),
    dateStr,
  }

  const locationLine = coordinateFallback
    ? `${location.latitudeDisplay}, ${location.longitudeDisplay}`
    : place!

  const textSamplesForLocationScan = [
    locationLine,
    metadata.projectName,
    metadata.purpose,
    geo.boreholeInvestigationPlan?.points?.map((p) => p.selectionReason).join(' ') ?? '',
  ]

  const draft: ValidatedGeotechnicalReportData = {
    geo,
    metadata,
    location,
    phaseI,
    sections,
    validation: {
      passed: true,
      criticalCount: 0,
      warningCount: 0,
      issues: [],
      summary: {} as ReportValidationResult['summary'],
    },
    textSamplesForLocationScan,
  }

  draft.validation = validateGeotechReportData(draft)

  if (!input.skipValidation && !draft.validation.passed) {
    throw new ReportValidationError(draft.validation)
  }

  return draft
}

export { ReportValidationError } from './reportValidation/types'
export { validateGeotechReportData } from './reportValidation/validateReport'
export type { ReportValidationResult } from './reportValidation/types'
