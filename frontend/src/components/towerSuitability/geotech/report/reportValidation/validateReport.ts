/**
 * Report Validation Engine — validation-first gate before DOCX export.
 */

import { classifyIS1498FromInputs } from '../../soilClassification'
import { ALL_SBC_DEPTHS_M } from '../../sbc/types'
import type { GeotechnicalIntelligence, ProvenanceValue, SoilLayerParameters } from '../../types'
import type { PhaseIReportBundle } from '../../../towerPlanning/types'
import {
  CONSTRUCTION_APPROVAL_PATTERNS,
  HARDCODED_LOCATION_PATTERNS,
  HARDCODED_STATE_PATTERN,
  PLACEHOLDER_CELL_PATTERNS,
} from '../reportFormatting'
import type { ReportLocationInfo, ReportSectionFlags, ValidatedGeotechnicalReportData } from '../buildGeotechReportData'
import type { ReportValidationIssue, ReportValidationResult } from './types'

const GRAIN_SIZE_TOLERANCE_PCT = 2.5
const PI_TOLERANCE = 0.6
const PILE_DIAMETERS_MM = [450, 600] as const
const PILE_DEPTHS_M = [1.0, 1.5, 2.0] as const

function issue(
  code: string,
  severity: ReportValidationIssue['severity'],
  message: string,
  section?: string
): ReportValidationIssue {
  return { code, severity, message, section }
}

function valNum(p: ProvenanceValue<number | null> | undefined): number | null {
  const v = p?.value
  return v != null && Number.isFinite(v) ? v : null
}

function validatePiConsistency(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const layers = geo.soilLayerParameters ?? []
  for (const L of layers) {
    const ll = valNum(L.liquidLimit)
    const pl = valNum(L.plasticLimit)
    const pi = valNum(L.plasticityIndex)
    if (ll == null || pl == null || pi == null) continue
    const expected = ll - pl
    if (Math.abs(pi - expected) > PI_TOLERANCE) {
      issues.push(
        issue(
          'PI_INCONSISTENT',
          'critical',
          `PI (${pi}) ≠ LL − PL (${ll} − ${pl} = ${expected}) at depth ${L.reportDepth}`,
          'Soil Profile'
        )
      )
    }
  }
  for (const r of geo.soilTestSummary?.records ?? []) {
    const ll = valNum(r.liquidLimit)
    const pl = valNum(r.plasticLimit)
    const pi = valNum(r.plasticityIndex)
    if (ll == null || pl == null || pi == null) continue
    const expected = ll - pl
    if (Math.abs(pi - expected) > PI_TOLERANCE) {
      issues.push(
        issue(
          'PI_INCONSISTENT',
          'critical',
          `Soil test summary PI mismatch at ${r.boreholeId} ${r.layerDepthLabel}`,
          'Soil Test Summary'
        )
      )
    }
  }
}

function validateGrainSize(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const check = (L: SoilLayerParameters, label: string) => {
    const g = valNum(L.gravelPct) ?? 0
    const sa = valNum(L.sandPct) ?? 0
    const si = valNum(L.siltPct) ?? 0
    const cl = valNum(L.clayPct) ?? 0
    if (sa === 0 && si === 0 && cl === 0 && g === 0) return
    const sum = g + sa + si + cl
    if (Math.abs(sum - 100) > GRAIN_SIZE_TOLERANCE_PCT) {
      issues.push(
        issue(
          'GRAIN_SIZE_SUM',
          'warning',
          `DATA CONSISTENCY WARNING: grain fractions sum to ${sum.toFixed(1)}% (expected ≈100%) at ${label}`,
          'Soil Profile'
        )
      )
    }
  }
  for (const L of geo.soilLayerParameters ?? []) {
    check(L, L.reportDepth)
  }
}

function validateClassification(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  for (const L of geo.soilLayerParameters ?? []) {
    const g = valNum(L.gravelPct)
    const sa = valNum(L.sandPct)
    const si = valNum(L.siltPct)
    const cl = valNum(L.clayPct)
    const ll = valNum(L.liquidLimit)
    const pi = valNum(L.plasticityIndex)
    const cls = L.soilClassification.value
    if (g == null || sa == null || si == null || cl == null || ll == null || pi == null || !cls) continue
    const expected = classifyIS1498FromInputs(g, sa, si, cl, ll, pi)
    if (expected.value && cls !== expected.value) {
      issues.push(
        issue(
          'CLASSIFICATION_DRIFT',
          'warning',
          `IS classification "${cls}" differs from authoritative engine "${expected.value}" at ${L.reportDepth}`,
          'Soil Classification'
        )
      )
    }
  }
}

function validateSbcDepths(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const depths = new Set((geo.sbcAnalysis.byDepth ?? []).map((d) => d.depthM))
  for (const d of ALL_SBC_DEPTHS_M) {
    if (!depths.has(d)) {
      issues.push(
        issue(
          'SBC_DEPTH_MISSING',
          'warning',
          `SBC depth matrix missing ${d.toFixed(1)} m row`,
          'SBC Analysis'
        )
      )
    }
  }
  for (const row of geo.sbcAnalysis.byDepth ?? []) {
    if (row.depthM > 2.0 && row.dataBasis !== 'ENGINEERING_DEPTH_EXTRAPOLATION') {
      issues.push(
        issue(
          'SBC_EXTRAPOLATION_LABEL',
          'warning',
          `Depth ${row.depthM} m should be labelled as engineering depth extrapolation`,
          'SBC Analysis'
        )
      )
    }
  }
  if (
    geo.sbcAnalysis.calculationStatus === 'CALCULATED' &&
    geo.sbcAnalysis.adoptedPreliminary?.status === 'CALCULATED' &&
    geo.sbcAnalysis.adoptedPreliminary?.value == null
  ) {
    issues.push(
      issue(
        'SBC_FABRICATED',
        'critical',
        'SBC marked CALCULATED but no governing value present',
        'SBC Analysis'
      )
    )
  }
}

function validatePileMatrix(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const piles = geo.pileAnalysis
  for (const dia of PILE_DIAMETERS_MM) {
    const key = `${dia}mm` as '450mm' | '600mm'
    if (!piles[key]) {
      issues.push(issue('PILE_DIAMETER', 'critical', `Missing pile diameter ${dia} mm`, 'Pile Analysis'))
      continue
    }
    for (const dep of PILE_DEPTHS_M) {
      const dk = `${dep.toFixed(1)}m` as '1.0m' | '1.5m' | '2.0m'
      if (!piles[key][dk]) {
        issues.push(
          issue('PILE_COMBO', 'critical', `Missing pile combination ${dia} mm × ${dep} m`, 'Pile Analysis')
        )
      }
    }
  }
  for (const dia of PILE_DIAMETERS_MM) {
    const key = `${dia}mm` as '450mm' | '600mm'
    for (const dep of PILE_DEPTHS_M) {
      const dk = `${dep.toFixed(1)}m` as '1.0m' | '1.5m' | '2.0m'
      const cell = piles[key]?.[dk]
      if (!cell) continue
      const lat = cell.lateral
      if (
        lat?.status === 'CALCULATED' &&
        lat.value != null &&
        geo.pileEngineAnalysis?.calculationStatus !== 'CALCULATED'
      ) {
        issues.push(
          issue(
            'PILE_LATERAL_FABRICATED',
            'critical',
            `Lateral capacity appears calculated without verified tower loads at ${dia}×${dep}`,
            'Pile Analysis'
          )
        )
      }
    }
  }
}

function validateProvenance(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const check = (p: ProvenanceValue<unknown> | undefined, label: string) => {
    if (!p) return
    if (p.status === 'MEASURED' && /model|gis|soilgrids|correlat|estimated|predicted/i.test(p.method || p.source || '')) {
      issues.push(
        issue(
          'PROVENANCE_MEASURED',
          'critical',
          `${label}: MODELLED/CORRELATED source must not be labelled MEASURED`,
          'Provenance'
        )
      )
    }
  }
  for (const L of geo.soilProfile) {
    check(L.sandPct, `Sand at ${L.reportDepth}`)
    check(L.siltPct, `Silt at ${L.reportDepth}`)
    check(L.clayPct, `Clay at ${L.reportDepth}`)
  }
  check(geo.resistivityAnalysis.estimated, 'Earth resistivity')
}

function validateLocation(
  location: ReportLocationInfo,
  textSamples: string[],
  issues: ReportValidationIssue[]
): void {
  const allowGujarat =
    location.state?.toLowerCase().includes('gujarat') ||
    location.areaLabel?.toLowerCase().includes('gujarat')
  for (const text of textSamples) {
    for (const pat of HARDCODED_LOCATION_PATTERNS) {
      if (pat.test(text)) {
        issues.push(
          issue(
            'HARDCODED_LOCATION',
            'critical',
            `Hardcoded example location detected in report text: "${text.slice(0, 80)}"`,
            'Location'
          )
        )
      }
    }
    if (!allowGujarat && HARDCODED_STATE_PATTERN.test(text)) {
      issues.push(
        issue(
          'HARDCODED_STATE',
          'critical',
          'Hardcoded Gujarat reference without matching project location',
          'Location'
        )
      )
    }
  }
}

function validateConstructionClaims(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const verdict = geo.soilVerdictAnalysis
  const texts = [
    verdict?.overall.status ?? '',
    ...(verdict?.designStageDecisions?.map((d) => `${d.stage} ${d.decision} ${d.explanation}`) ?? []),
    ...(geo.limitations ?? []),
  ]
  const gisOnly = !geo.fieldInvestigationMatch.matched
  if (!gisOnly) return
  for (const t of texts) {
    for (const pat of CONSTRUCTION_APPROVAL_PATTERNS) {
      if (pat.test(t)) {
        issues.push(
          issue(
            'CONSTRUCTION_CLAIM',
            'critical',
            'GIS-only report must not claim construction or final design approval',
            'Soil Verdict'
          )
        )
      }
    }
  }
}

function validatePhaseI(
  flags: ReportSectionFlags,
  phaseI: PhaseIReportBundle | null | undefined,
  issues: ReportValidationIssue[]
): void {
  if (flags.includePowerInfrastructure && !phaseI?.powerInfrastructureSummary) {
    issues.push(
      issue(
        'POWER_WITHOUT_DATA',
        'critical',
        'Power infrastructure section flagged but no Phase I power check data',
        'Tower Planning'
      )
    )
  }
  if (!flags.includePowerInfrastructure && phaseI?.powerInfrastructureSummary) {
    issues.push(
      issue(
        'POWER_UNREQUESTED',
        'warning',
        'Power infrastructure data exists but was not requested for this export',
        'Tower Planning'
      )
    )
  }
  if (flags.includeTowerPlanning && (!phaseI || phaseI.towerCandidates.length === 0)) {
    issues.push(
      issue(
        'TOWER_WITHOUT_DATA',
        'critical',
        'Tower planning section flagged but no Phase I tower candidates',
        'Tower Planning'
      )
    )
  }
}

function validateBhConsistency(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const plan = geo.boreholeInvestigationPlan
  if (!plan?.points?.length) return
  const coordMap = new Map(plan.points.map((p) => [p.boreholeId, { lat: p.latitude, lon: p.longitude }]))
  for (const r of geo.soilTestSummary?.records ?? []) {
    const ref = coordMap.get(r.boreholeId)
    if (!ref) continue
    if (Math.abs(ref.lat - r.latitude) > 1e-5 || Math.abs(ref.lon - r.longitude) > 1e-5) {
      issues.push(
        issue(
          'BH_COORD_MISMATCH',
          'critical',
          `${r.boreholeId} coordinates differ between investigation plan and soil test summary`,
          'Investigation Plan'
        )
      )
    }
  }
}

function validatePlaceholderCells(geo: GeotechnicalIntelligence, issues: ReportValidationIssue[]): void {
  const requiredCalculated = [
    { p: geo.sbcAnalysis.adoptedPreliminary, label: 'Governing SBC', when: geo.sbcAnalysis.calculationStatus === 'CALCULATED' },
  ]
  for (const { p, label, when } of requiredCalculated) {
    if (!when || !p) continue
    const disp = p.value == null ? statusLabel(p.status) : String(p.value)
    if (PLACEHOLDER_CELL_PATTERNS.some((pat) => pat.test(disp))) {
      issues.push(
        issue(
          'PLACEHOLDER_REQUIRED',
          'critical',
          `Required calculable field "${label}" has placeholder value "${disp}"`,
          'Data Quality'
        )
      )
    }
  }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ')
}

export function validateGeotechReportData(
  data: ValidatedGeotechnicalReportData
): ReportValidationResult {
  const issues: ReportValidationIssue[] = []
  const geo = data.geo

  validatePiConsistency(geo, issues)
  validateGrainSize(geo, issues)
  validateClassification(geo, issues)
  validateSbcDepths(geo, issues)
  validatePileMatrix(geo, issues)
  validateProvenance(geo, issues)
  validateLocation(data.location, data.textSamplesForLocationScan, issues)
  validateConstructionClaims(geo, issues)
  validatePhaseI(data.sections, data.phaseI, issues)
  validateBhConsistency(geo, issues)
  validatePlaceholderCells(geo, issues)

  if (!geo.soilProfile.length) {
    issues.push(issue('NO_SOIL_PROFILE', 'critical', 'Soil profile is empty', 'Soil Profile'))
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length

  const summary: ReportValidationResult['summary'] = {
    sections: 'PASS',
    tables: issues.some((i) => i.code.startsWith('PLACEHOLDER')) ? 'FAIL' : 'PASS',
    soilConsistency: issues.some((i) => i.code === 'GRAIN_SIZE_SUM') ? 'WARN' : 'PASS',
    piConsistency: issues.some((i) => i.code === 'PI_INCONSISTENT') ? 'FAIL' : 'PASS',
    grainSize: issues.some((i) => i.code === 'GRAIN_SIZE_SUM') ? 'WARN' : 'PASS',
    sbcConsistency: issues.some((i) => i.code.startsWith('SBC_')) ? 'WARN' : 'PASS',
    pileMatrix: issues.some((i) => i.code.startsWith('PILE_')) ? 'FAIL' : 'PASS',
    provenance: issues.some((i) => i.code === 'PROVENANCE_MEASURED') ? 'FAIL' : 'PASS',
    hardcodedLocation: issues.some((i) => i.code.startsWith('HARDCODED')) ? 'FAIL' : 'PASS',
    fakeData: issues.some((i) => i.code === 'SBC_FABRICATED' || i.code === 'PILE_LATERAL_FABRICATED') ? 'FAIL' : 'PASS',
    constructionClaim: issues.some((i) => i.code === 'CONSTRUCTION_CLAIM') ? 'FAIL' : 'PASS',
  }

  return {
    passed: criticalCount === 0,
    criticalCount,
    warningCount,
    issues,
    summary,
  }
}
