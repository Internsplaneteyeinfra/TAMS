/**
 * Professional Transmission Tower Geotechnical Investigation Report (.DOCX).
 * Visual/structure inspired by consultancy Word reports — data remains provenance-honest.
 * Does NOT affect production suitability scoring.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  PageBreak,
  convertInchesToTwip,
} from 'docx'

import type { GeotechnicalIntelligence, GeoDataStatus, ProvenanceValue } from '../types'
import {
  buildGeotechReportData,
  type GeotechDocxInput,
  type ValidatedGeotechnicalReportData,
} from './buildGeotechReportData'
import { fmtCoord, fmtCoordDms, provenanceDisplay, statusLabel as fmtStatusLabel } from './reportFormatting'
import {
  SOIL_TEST_HEADERS,
  buildPerBoreholeSoilTables,
  resolveGroundWaterTableDisplay,
} from './reportSoilTestTables'
import {
  buildDynamicScopeIntro,
  buildDynamicMethodologyNote,
  buildInvestigationLocationLines,
} from './reportDynamicScope'

const PAGE_W = 11906 // A4 portrait width (twips)
const PAGE_H = 16838 // A4 height
const MARGIN = convertInchesToTwip(0.55)
const CONTENT_W = PAGE_W - MARGIN * 2
const LANDSCAPE_W = PAGE_H
const LANDSCAPE_H = PAGE_W
const CONTENT_LW = LANDSCAPE_W - MARGIN * 2

const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: thin, bottom: thin, left: thin, right: thin }

export type { GeotechDocxInput } from './buildGeotechReportData'

function statusLabel(s: GeoDataStatus | string | undefined): string {
  return fmtStatusLabel(s)
}

function cellText(v: unknown, status?: GeoDataStatus): string {
  if (v == null || v === '') {
    return statusLabel(status || 'NO_DATA')
  }
  if (typeof v === 'object' && v !== null && 'low' in v && 'high' in v) {
    const r = v as { low: number; high: number }
    return `${r.low}–${r.high}`
  }
  return String(v)
}

function pVal(p: ProvenanceValue<unknown> | undefined): string {
  return provenanceDisplay(p)
}

function p(text: string, opts?: { bold?: boolean; center?: boolean; size?: number; spaceAfter?: number; italic?: boolean }) {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opts?.spaceAfter ?? 120, line: 276 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italic,
        size: opts?.size ?? 20, // 10 pt
        font: 'Times New Roman',
      }),
    ],
  })
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Times New Roman' })],
  })
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Times New Roman' })],
  })
}

function h3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text, bold: true, size: 20, font: 'Times New Roman' })],
  })
}

function monoLine(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60, line: 276 },
    children: [
      new TextRun({ text: label.padEnd(36, ' '), font: 'Courier New', size: 18 }),
      new TextRun({ text: '=  ', font: 'Courier New', size: 18 }),
      new TextRun({ text: value, font: 'Courier New', size: 18 }),
    ],
  })
}

function cell(
  text: string,
  width: number,
  opts?: { bold?: boolean; center?: boolean; shade?: string; size?: number }
) {
  const size = opts?.size ?? 14
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts?.shade ? { fill: opts.shade } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({
            text: text.length > 90 ? `${text.slice(0, 87)}…` : text,
            bold: opts?.bold,
            size,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  })
}

function simpleTable(
  headers: string[],
  rows: string[][],
  colWidths: number[],
  opts?: { contentWidth?: number; fontSize?: number }
) {
  const tw = opts?.contentWidth ?? CONTENT_W
  const fs = opts?.fontSize ?? 14
  const head = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      cell(h, colWidths[i], { bold: true, center: true, shade: 'D9E2F3', size: fs })
    ),
  })
  const body = rows.map(
    (r) =>
      new TableRow({
        children: r.map((c, i) => cell(c, colWidths[i], { center: true, size: fs })),
      })
  )
  return new Table({
    width: { size: tw, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [head, ...body],
  })
}

/** Equal-ish column widths for Transmission-line 20-column soil table (landscape). */
function soilTestColWidths(total: number, n: number): number[] {
  const base = Math.floor(total / n)
  const widths = Array.from({ length: n }, () => base)
  widths[widths.length - 1] += total - base * n
  // Prefer slightly wider Remarks + Depth
  if (n >= 20) {
    widths[0] += 120
    widths[18] += 280
    widths[19] += 80
    widths[5] = Math.max(widths[5] - 80, 280)
    widths[6] = Math.max(widths[6] - 80, 280)
    widths[7] = Math.max(widths[7] - 80, 280)
  }
  return widths
}

function kvTable(rows: Array<[string, string, string?]>, contentWidth = CONTENT_W) {
  const w1 = Math.floor(contentWidth * 0.35)
  const w2 = Math.floor(contentWidth * 0.35)
  const w3 = contentWidth - w1 - w2
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [w1, w2, w3],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell('Parameter', w1, { bold: true, shade: 'D9E2F3' }),
          cell('Value / Status', w2, { bold: true, shade: 'D9E2F3' }),
          cell('Remarks', w3, { bold: true, shade: 'D9E2F3' }),
        ],
      }),
      ...rows.map(
        ([a, b, c]) =>
          new TableRow({
            children: [cell(a, w1), cell(b, w2), cell(c || '', w3)],
          })
      ),
    ],
  })
}

function reportIdFor(geo: GeotechnicalIntelligence): string {
  const d = new Date(geo.generatedAt || Date.now())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const lat = Math.abs(geo.location.lat).toFixed(3).replace('.', '')
  return `TAMS-GEO-${y}${m}${day}-${lat}`
}

function classLabel(c: string): string {
  return c.replace(/_/g, ' ')
}

function layerRoman(i: number): string {
  return ['I', 'II', 'III', 'IV'][i] || String(i + 1)
}

/** Build DOCX ArrayBuffer for browser or Node. */
export async function buildGeotechInvestigationDocx(input: GeotechDocxInput): Promise<Blob | Buffer> {
  const reportData = buildGeotechReportData(input)
  return buildDocxFromValidatedData(reportData, input)
}

async function buildDocxFromValidatedData(
  reportData: ValidatedGeotechnicalReportData,
  input?: GeotechDocxInput
): Promise<Blob | Buffer> {
  const reportFormat = input?.reportFormat ?? 'transmission-line'
  const geo = reportData.geo
  const meta = reportData.metadata
  const loc = reportData.location
  const phaseI = reportData.phaseI
  const validation = reportData.validation

  const location =
    loc.coordinateFallback
      ? `${loc.latitudeDisplay}, ${loc.longitudeDisplay}`
      : (geo.location.placeLabel.value as string) ||
        `${loc.latitudeDisplay}, ${loc.longitudeDisplay}`
  const rid = meta.reportId
  const dateStr = meta.dateStr
  const project = meta.projectName
  const client = meta.clientName || 'NOT PROVIDED IN PROJECT METADATA'
  const consultant = meta.consultant || 'NOT PROVIDED IN PROJECT METADATA'
  const purpose = meta.purpose
  const classification = meta.classification

  const eng = geo.engineeringParameterEstimation
  const sbc = geo.sbcAnalysis
  const settle = geo.settlementAnalysis
  const piles = geo.pileAnalysis

  // ---- Cover ----
  const cover: Paragraph[] = [
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: meta.reportTitle, bold: true, size: 32, font: 'Times New Roman' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: meta.reportSubtitle, bold: true, size: 22, font: 'Times New Roman' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 4 } },
      children: [new TextRun({ text: ' ', size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 120 },
      children: [new TextRun({ text: 'Transmission Tower / Transmission Infrastructure Project', bold: true, size: 24, font: 'Times New Roman' })],
    }),
    p(`Project: ${project}`, { center: true, bold: true, size: 22, spaceAfter: 160 }),
    ...(meta.clientName ? [p(`Client / Agency: ${client}`, { center: true, size: 20, spaceAfter: 80 })] : []),
    ...(meta.consultant ? [p(`Consultant: ${consultant}`, { center: true, size: 20, spaceAfter: 200 })] : []),
    p(`Area: ${loc.areaLabel ?? location}`, { center: true, spaceAfter: 60 }),
    ...(loc.district ? [p(`District: ${loc.district}`, { center: true, spaceAfter: 60 })] : []),
    ...(loc.state ? [p(`State: ${loc.state}`, { center: true, spaceAfter: 60 })] : []),
    p(`Latitude: ${loc.latitudeDisplay}`, { center: true, spaceAfter: 60 }),
    p(`Longitude: ${loc.longitudeDisplay}`, { center: true, spaceAfter: 80 }),
    ...(loc.investigationGeometryLabel
      ? [p(`Investigation Geometry: ${loc.investigationGeometryLabel}`, { center: true, spaceAfter: 60 })]
      : []),
    p(`Purpose: ${purpose}`, { center: true, spaceAfter: 160 }),
    p(`Report Classification: ${classification}`, { center: true, bold: true, spaceAfter: 80 }),
    p(`Report Date: ${dateStr}`, { center: true, spaceAfter: 80 }),
    p(`Report ID: ${rid}`, { center: true, spaceAfter: 200 }),
    p(
      'This document is a geospatial preliminary geotechnical assessment using satellite, GIS, remote sensing, and engineering correlations. Recommended investigation points are planning recommendations — not evidence of completed field boreholes unless explicitly marked MEASURED.',
      { center: true, italic: true, size: 18, spaceAfter: 200 }
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  // ---- TOC ----
  const tocItems = [
    'PART A — Front Matter',
    '1. Executive Summary',
    '2. Scope and Objective of Investigation',
    '3. Site and Geological Context',
    '4. Subsurface Soil Profile',
    'PART B — Engineering Report Body',
    '1. Recommended Geotechnical Investigation Plan',
    '2. Soil Test Summary',
    '2. Engineering Analysis',
    '    2.1 Foundation Design Parameters',
    '    2.2 Adopted Soil Parameters',
    '    2.4 SBC Calculation — Detailed Sample',
    '    2.5 SBC Values for Location',
    '    2.6 SBC Variation with Depth',
    '    2.7 Settlement Check',
    '    2.8 Final Recommended SBC for Design',
    '3. Pile Foundation Analysis and Design',
    '    3.1 Design Parameters',
    '    3.2 Adopted Soil Parameters (Layer-wise)',
    '    3.3 Cross-Sectional Area of Piles',
    '    3.4 Vertical Load Capacity (Detailed Sample)',
    '    3.5 Summary — Vertical Capacity',
    '    3.6 Uplift Capacity (Sample)',
    '    3.7 Uplift Load Capacity Summary',
    '    3.8 Lateral Load Capacity',
    '    3.9 Governing Design Condition',
    '4. California Bearing Ratio (CBR)',
    '5. Earth Resistivity',
    '6. Soil Verdict & Investigation Decision',
    '    6.1 Executive Soil Verdict',
    '    6.2 Evidence Summary',
    '    6.3–6.7 Engineering Assessments',
    '    6.8 Confidence and Uncertainty',
    '    6.9 Conflicting Evidence',
    '    6.10 Investigation Requirements',
    '    6.11 Investigation Priority Plan',
    '    6.12 Design Stage Decision',
    '7. Foundation Recommendation',
    '8. Data Basis and Limitations',
    '9. References',
    ...(reportData.sections.includeTowerPlanning ? ['10. Tower Planning and Suitability'] : []),
    'ANNEXURE A — Depth-wise Soil Data',
    'ANNEXURE B — Source Data and Provenance',
    'ANNEXURE C — Engineering Calculation Sheets',
  ]
  const toc: Paragraph[] = [
    h1('Table of Contents'),
    ...tocItems.map((t) => p(t, { spaceAfter: 60, size: 20 })),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  // ---- §1 Executive Summary ----
  const screen = geo.soilScreeningSummary
  const engEst = geo.engineeringParameterEstimation
  const availInventoryRows: Array<[string, string, string]> = [
    ['SoilGrids texture (0–30 cm)', screen ? pVal(screen.textureClass) : '—', screen ? statusLabel(screen.textureClass.status) : '—'],
    [
      'Indicative SBC (screening)',
      screen?.indicativeSbcTm2.value
        ? `${screen.indicativeSbcTm2.value.low}–${screen.indicativeSbcTm2.value.high} T/m²`
        : '—',
      screen ? statusLabel(screen.indicativeSbcTm2.status) : '—',
    ],
    [
      'Indicative CBR (screening)',
      screen?.indicativeCbrPct.value
        ? `${screen.indicativeCbrPct.value.low}–${screen.indicativeCbrPct.value.high} %`
        : '—',
      screen ? statusLabel(screen.indicativeCbrPct.status) : '—',
    ],
    ['Unit weight γ (prelim.)', pVal(engEst.gammaKnM3), statusLabel(engEst.gammaKnM3.status)],
    ['Friction angle φ (prelim.)', pVal(engEst.phiDeg), statusLabel(engEst.phiDeg.status)],
    ['Cohesion c', pVal(engEst.cohesionKpa), statusLabel(engEst.cohesionKpa.status)],
    ['Elevation', pVal(geo.location.elevationM), statusLabel(geo.location.elevationM.status)],
    ['Slope', pVal(geo.location.slopeDeg), statusLabel(geo.location.slopeDeg.status)],
    ['Nearest road', pVal(geo.siteContext?.roadKm), statusLabel(geo.siteContext?.roadKm?.status || 'NO_DATA')],
    ['Nearest water', pVal(geo.siteContext?.waterKm), statusLabel(geo.siteContext?.waterKm?.status || 'NO_DATA')],
    ['Land cover', pVal(geo.location.landCover), statusLabel(geo.location.landCover.status)],
    ['Screening confidence', screen ? `${pVal(screen.confidencePct)} %` : '—', screen ? 'MODELLED' : '—'],
    ['IS 6403 net SBC', pVal(sbc.adoptedPreliminary), sbc.calculationStatus],
    ['Field investigation', geo.fieldInvestigationMatch.matched ? 'MATCHED' : 'NOT WITHIN 5 km', geo.fieldInvestigationMatch.matched ? 'MEASURED' : 'NO DATA'],
  ]

  const exec: (Paragraph | Table)[] = [
    h1('1. Executive Summary'),
    p(
      `A preliminary geotechnical screening assessment has been prepared for ${location} (${geo.location.lat.toFixed(6)}°N, ${geo.location.lon.toFixed(6)}°E) to 2.0 m depth.`
    ),
    ...(screen
      ? [
          p(
            `Available GIS data for this site: USDA texture "${pVal(screen.textureClass)}", indicative screening SBC ${pVal(screen.indicativeSbcTm2)} T/m², indicative CBR ${pVal(screen.indicativeCbrPct)} %, preliminary φ ${pVal(engEst.phiDeg)}°, unit weight γ ${pVal(engEst.gammaKnM3)} kN/m³. Grain-size fractions and densities are MODELLED from SoilGrids at 0.0–0.5 / 0.5–1.0 / 1.0–1.5 / 1.5–2.0 m (see Soil Test Summary and Annexure A).`,
            { bold: true }
          ),
        ]
      : []),
    p(
      `Laboratory parameters (SPT N, Atterberg limits, soaked CBR, field resistivity, groundwater) are not available from remote sensing and remain FIELD TEST REQUIRED until borehole data are entered at TAMS /geotech. IS 6403 net SBC status: ${sbc.calculationStatus}.`
    ),
    p(
      `Report classification: ${classification}. Data readiness: ${geo.reportReadiness.completionPercentage}% (${geo.reportReadiness.availableParameters}/${geo.reportReadiness.totalParameters} parameters).`,
      { bold: true }
    ),
    h2('1.1 Available Data Inventory (populated for this site)'),
    p(
      'The following parameters are available now from GIS / screening engines. Values marked ESTIMATED or MODELLED are not laboratory MEASURED results.',
      { size: 17 }
    ),
    kvTable(availInventoryRows),
    h2('1.2 Depth-wise Modelled Soil Data (summary)'),
    simpleTable(
      ['Depth (m)', 'Sand %', 'Silt %', 'Clay %', 'Dry dens.', 'Bulk dens.', 'pH', 'USDA', 'Status'],
      geo.soilProfile.map((L) => [
        L.reportDepthLabel,
        L.sandPct.value != null ? String(L.sandPct.value) : 'NO DATA',
        L.siltPct.value != null ? String(L.siltPct.value) : 'NO DATA',
        L.clayPct.value != null ? String(L.clayPct.value) : 'NO DATA',
        L.dryDensityGcc.value != null ? String(L.dryDensityGcc.value) : 'NO DATA',
        L.bulkDensityGcc.value != null ? String(L.bulkDensityGcc.value) : 'NO DATA',
        L.ph.value != null ? String(L.ph.value) : 'NO DATA',
        L.usdaTexture.value != null ? String(L.usdaTexture.value) : 'INSUFFICIENT DATA',
        statusLabel(L.sandPct.status),
      ]),
      [1200, 900, 900, 900, 1000, 1000, 800, 1400, CONTENT_W - 8100]
    ),
    h2('1.3 Parameters Requiring Field / Laboratory Investigation'),
    p(
      'These cannot be obtained from satellites or SoilGrids. They are listed as missing because no borehole record exists within 5 km — not because the system failed to fetch data.',
      { italic: true, size: 17 }
    ),
    simpleTable(
      ['Parameter', 'Why missing', 'How to populate'],
      [
        ['SPT_N_VALUE', 'Requires borehole Standard Penetration Test', 'Enter at TAMS /geotech → soil_layers'],
        ['DIRECT_SHEAR_PARAMETERS (c, φ lab)', 'Requires laboratory shear / triaxial test', '/geotech design_params'],
        ['ATTERBERG_LIMITS (LL, PL, PI)', 'Requires laboratory Atterberg tests (IS 2720)', '/geotech soil_layers'],
        ['SOAKED_CBR', 'Requires laboratory soaked CBR test', '/geotech cbr_by_depth'],
        ['GROUNDWATER_LEVEL', 'Requires field observation during boring', '/geotech groundwater_note'],
        ['FIELD_EARTH_RESISTIVITY', 'Requires Wenner field test (IS 3043)', '/geotech resistivity'],
      ],
      [2200, 3200, CONTENT_W - 5400]
    ),
    p(`Field investigation match: ${geo.fieldInvestigationMatch.reason}`, { size: 17 }),
  ]

  // ---- §2 Scope ----
  const scope: (Paragraph | Table)[] = [
    h1('2. Scope and Objective of Investigation'),
    h2('2.1 Project Description'),
    p(`Project: ${project}. Purpose: ${purpose}. Client: ${client}. Consultant: ${consultant}.`),
    h2('2.2 Location Details'),
    kvTable([
      ['Location', location, ''],
      ['Latitude', `${geo.location.lat.toFixed(6)}°N`, pVal(geo.location.elevationM)],
      ['Longitude', `${geo.location.lon.toFixed(6)}°E`, ''],
      ['Elevation', pVal(geo.location.elevationM), statusLabel(geo.location.elevationM.status)],
      ['Slope', pVal(geo.location.slopeDeg), statusLabel(geo.location.slopeDeg.status)],
      ['Land cover hint', pVal(geo.location.landCover), statusLabel(geo.location.landCover.status)],
    ]),
    h2('2.3 Investigation Points (dynamic — from entered coordinates)'),
    ...buildInvestigationLocationLines(geo).map((line) => p(`• ${line}`, { size: 17, spaceAfter: 60 })),
    h2('2.4 Objective of Investigation'),
    p(buildDynamicScopeIntro(geo, reportData)),
    p(
      'The objective of this screening is to provide location-specific soil and foundation intelligence to support tower suitability decisions, identify data gaps requiring field/laboratory verification, and present preliminary bearing and pile capacity calculations where inputs permit.'
    ),
    h2('2.5 Investigation Methodology'),
    p(buildDynamicMethodologyNote(geo)),
    p(
      'Methodology comprises: (a) point query of ISRIC SoilGrids 2.0 modelled soil properties at the entered latitude/longitude; (b) thickness-weighted aggregation of source depth bands into 0.5 m engineering intervals to 2.0 m; (c) USDA texture derivation and preliminary material description; (d) PR-1 engineering parameter resolution with published correlations where valid; (e) IS 6403-aligned SBC and IS 2911-aligned pile static calculations when c, φ and γ are available; (f) explicit documentation of missing field tests.'
    ),
    h2('2.6 Data Sources and Limitations'),
    p(
      'Primary soil source: ISRIC SoilGrids 2.0 (~250 m resolution, modelled means — not borehole samples). Terrain: Open-Meteo elevation. Context distances and land cover may be drawn from live OSM/OSRM signals when available. SoilGrids source centimetre bands are retained only in Annexure B and are not presented as laboratory depth samples in the main body.'
    ),
  ]

  // ---- §3 Site context ----
  const site: (Paragraph | Table)[] = [
    h1('3. Site and Geological Context'),
    h2('3.1 Site Location'),
    p(`The site is located at ${location}. Coordinates used for all queries are ${geo.location.lat.toFixed(6)}°N, ${geo.location.lon.toFixed(6)}°E.`),
    h2('3.2 Surface Conditions'),
    p(
      `Land cover indication: ${pVal(geo.location.landCover)} (${statusLabel(geo.location.landCover.status)}). This indication is for screening context only and is not a cadastral or geotechnical surface classification.`
    ),
    h2('3.3 GIS and Terrain Context'),
    kvTable([
      ['Elevation', pVal(geo.location.elevationM), statusLabel(geo.location.elevationM.status)],
      ['Local slope (DEM)', pVal(geo.location.slopeDeg), statusLabel(geo.location.slopeDeg.status)],
      ['Field investigation match', geo.fieldInvestigationMatch.matched ? 'Yes' : 'No', geo.fieldInvestigationMatch.reason],
    ]),
  ]

  // ---- §4 Profile ----
  const profileRows = geo.soilProfile.map((L, i) => [
    `Layer ${layerRoman(i)}`,
    `${L.depthFromM.toFixed(1)}–${L.depthToM.toFixed(1)}`,
    String(L.preliminaryMaterialDescription.value || 'Preliminary description unavailable'),
    statusLabel(L.sandPct.status),
  ])
  const profileSec: (Paragraph | Table)[] = [
    h1('4. Subsurface Soil Profile'),
    h2('4.1 Depth-wise Soil Profile'),
    p('Generalised subsoil profile for screening purposes (engineering intervals 0.0–2.0 m):'),
    simpleTable(
      ['Layer', 'Depth Below G.L. (m)', 'Material Description', 'Data Status'],
      profileRows,
      [1400, 2200, CONTENT_W - 1400 - 2200 - 1800, 1800]
    ),
    h2('4.2 Soil Material Description'),
    p(
      'Material descriptions are preliminary modelled texture estimates derived from sand–silt–clay fractions. They are not laboratory-confirmed IS 1498 classifications unless MEASURED plasticity and grading data are available.'
    ),
    h2('4.3 Soil Data Quality'),
    p(
      `Modelled coverage: ${geo.dataQuality.modelledCoverage}%. Estimated coverage: ${geo.dataQuality.estimatedCoverage}%. Measured coverage: ${geo.dataQuality.measuredCoverage}%. Missing critical parameters: ${geo.dataQuality.missingCriticalParameters.join(', ')}.`
    ),
  ]

  // ---- Part B §1 Investigation Plan (Phase A) ----
  const plan = geo.boreholeInvestigationPlan
  const investigationPlanSec: (Paragraph | Table)[] = plan
    ? [
        h1('1. RECOMMENDED GEOTECHNICAL INVESTIGATION PLAN'),
        p(
          'The following are PROPOSED GIS INVESTIGATION POINTS for field verification. They are planning recommendations — not evidence that physical boreholes were drilled or completed.',
          { italic: true, size: 17 }
        ),
        p(
          `Coverage: ${plan.estimatedCoveragePct}% · Recommended spacing: ~${plan.recommendedSpacingM} m · Total points: ${plan.totalPoints}`,
          { size: 18 }
        ),
        simpleTable(
          [
            'S.No.',
            'Investigation Point',
            'Latitude',
            'Longitude',
            'Rec. Depth (m)',
            'Spacing (m)',
            'Coverage Zone',
            'Selection Reason',
            'Confidence %',
            'Status',
          ],
          plan.points.map((pt, i) => [
            String(i + 1),
            pt.boreholeId,
            fmtCoord(pt.latitude),
            fmtCoord(pt.longitude),
            String(pt.recommendedInvestigationDepthM),
            pt.spacingM != null ? String(pt.spacingM) : '—',
            pt.coverageZone,
            pt.selectionReason.length > 60 ? `${pt.selectionReason.slice(0, 57)}…` : pt.selectionReason,
            String(pt.dataConfidencePct),
            pt.status.replace(/_/g, ' '),
          ]),
          [600, 1400, 1400, 1400, 1100, 1000, 1800, 2800, 900, CONTENT_LW - 12400]
        ),
        new Paragraph({ children: [new PageBreak()] }),
      ]
    : []

  // ---- Part B §2 Soil Test Summary (Transmission-line reference format) ----
  const perBhTables = buildPerBoreholeSoilTables(geo)
  const soilCols = soilTestColWidths(CONTENT_LW, SOIL_TEST_HEADERS.length)
  const coordLine = fmtCoordDms(geo.location.lat, geo.location.lon)

  const perBhBlocks: (Paragraph | Table)[] = perBhTables.flatMap((bh) => [
    p(`Location ${bh.locationIndex} –: ${fmtCoordDms(bh.latitude, bh.longitude)}`, { bold: true, size: 19 }),
    simpleTable([...SOIL_TEST_HEADERS], bh.rows, soilCols, {
      contentWidth: CONTENT_LW,
      fontSize: 10,
    }),
    p('', { spaceAfter: 100 }),
  ])

  const soilTest: (Paragraph | Table)[] = [
    h1('1. SOIL TEST SUMMARY'),
    ...perBhBlocks,
  ]

  // ---- §2 Engineering (Transmission line order) ----
  const designDepth = sbc.byDepth?.find((d) => d.depthM === 1.5) || sbc.byDepth?.[0]
  const sbcSteps = designDepth?.steps || []
  const engSec: (Paragraph | Table)[] = [
    h1(`${reportFormat === 'transmission-line' ? '2' : '3'}. ENGINEERING ANALYSIS`),
    h2('3.1 Foundation Design Parameters'),
    kvTable([
      [
        'Foundation Type',
        sbc.foundation?.foundationType || '1.0 m × 1.0 m Isolated Stub Foundation',
        'IS 6403 : 1981',
      ],
      ['Depth of Foundation (Df)', `${designDepth?.depthM ?? 1.5} m`, 'Site / screening condition'],
      ['Allowable Settlement', '25 mm', 'IS 8009 (Part-1)'],
      ['Factor of Safety (shear)', String(sbc.foundation?.fosShear ?? 2.5), 'IS 6403'],
      ['Water Table', resolveGroundWaterTableDisplay(geo), 'Screening / field note'],
      ['Width B / Length L', `${sbc.foundation?.widthM ?? 1.0} m × ${sbc.foundation?.lengthM ?? 1.0} m`, 'Screening default'],
    ]),
    h2('3.2 Adopted Soil Parameters (at 1.5 m depth — screening)'),
    kvTable([
      ['Unit weight γ', pVal(eng.gammaKnM3), statusLabel(eng.gammaKnM3.status)],
      ['Friction angle φ', pVal(eng.phiDeg), statusLabel(eng.phiDeg.status)],
      ['Cohesion c', pVal(eng.cohesionKpa), statusLabel(eng.cohesionKpa.status)],
      ['Texture hint', sbc.soilInputs?.textureHint || pVal(geo.soilProfile[2]?.usdaTexture) || '—', 'MODELLED / ESTIMATED'],
      ['Code reference', sbc.codeReference || 'IS 6403:1981', ''],
    ]),
    p(
      'Note: Adopted c, φ, γ for GIS screening are ESTIMATED or FIELD TEST REQUIRED. They are not borehole MEASURED values unless a matched field investigation is identified.',
      { italic: true, size: 17 }
    ),
    h2('3.3 SBC CALCULATION — DETAILED SAMPLE'),
    p(sbc.message || 'Bearing capacity assessment.'),
    p(`Calculation status: ${sbc.calculationStatus}.`),
    ...(sbc.calculationStatus === 'INSUFFICIENT_DATA'
      ? [
          p(
            'Safe bearing capacity (IS 6403) could not be completed because cohesion (for clayey soils), friction angle, and/or unit weight are unavailable or outside validity. Texture-based indicative SBC shown in Soil Test Summary as (EST*) must not be treated as CALCULATED net safe bearing capacity.',
            { italic: true }
          ),
          ...sbcSteps.map((s) =>
            p(
              `Step ${s.step} — ${s.name}: ${s.formula}${s.notes ? ` (${s.notes})` : ''}`,
              { size: 17 }
            )
          ),
        ]
      : [
          h3(`Calculation sheet — Df = ${designDepth?.depthM ?? 1.5} m`),
          ...sbcSteps.map((s) =>
            p(
              `Step ${s.step} — ${s.name}: ${s.formula}${s.result != null ? `  →  ${s.result} ${s.unit}` : ''}${s.notes ? ` (${s.notes})` : ''}`,
              { size: 17 }
            )
          ),
          p(
            `Adopted preliminary net SBC: ${pVal(sbc.adoptedPreliminary)} (${statusLabel(sbc.adoptedPreliminary?.status)}). Confidence: ${sbc.adoptedPreliminary?.confidence ?? '—'}%.`,
            { bold: true }
          ),
        ]),
    h2('3.4 SBC Values for Location'),
    kvTable([
      ['Location', location, coordLine],
      ['φ (°)', pVal(eng.phiDeg), statusLabel(eng.phiDeg.status)],
      ['c', pVal(eng.cohesionKpa), statusLabel(eng.cohesionKpa.status)],
      ['γ', pVal(eng.gammaKnM3), statusLabel(eng.gammaKnM3.status)],
      [
        'SBC (T/m²)',
        pVal(sbc.adoptedPreliminary) !== 'NO DATA'
          ? pVal(sbc.adoptedPreliminary)
          : 'INSUFFICIENT DATA — see Soil Test Summary (EST*)',
        sbc.calculationStatus,
      ],
    ]),
    h2('3.5 SBC Variation with Depth'),
    p('0.0–2.0 m: PRIMARY GEOSPATIAL SOIL MODEL (Calculated). 2.0–4.0 m: ENGINEERING DEPTH EXTRAPOLATION (Modelled) — not directly observed.'),
    simpleTable(
      ['Depth (m)', 'Net Safe Bearing Capacity (T/m²)', 'Source Type', 'Data Basis', 'Status'],
      (sbc.byDepth || []).map((d) => [
        d.depthM.toFixed(1),
        pVal(d.netSafeBearingCapacityTm2),
        d.sourceTypeLabel || (d.depthM <= 2 ? 'Calculated' : 'Engineering Depth Model'),
        d.dataBasis === 'ENGINEERING_DEPTH_EXTRAPOLATION'
          ? '2.0–4.0 m extrapolation'
          : '0–2.0 m GIS model',
        statusLabel(d.netSafeBearingCapacityTm2?.status || d.calculationStatus),
      ]),
      [1200, 3200, 2200, 2200, CONTENT_W - 8800]
    ),
    h2('3.6 Settlement Check'),
    p(settle.message || 'Settlement assessment.'),
    p(`Calculation status: ${settle.calculationStatus}.`),
    p(`Required inputs: ${(settle.requiredInputs || []).join(', ') || '—'}.`),
    ...(settle.missingInputs?.length
      ? [p(`Missing inputs: ${settle.missingInputs.join(', ')}.`, { italic: true })]
      : []),
    ...(settle.settlementMm?.value != null
      ? [p(`Preliminary elastic settlement: ${pVal(settle.settlementMm)} (${settle.settlementStatus || '—'}).`, { bold: true })]
      : [
          p(
            'Final settlement value is not reported. Tower foundation load / contact pressure and/or soil modulus are required before a numerical settlement can be stated.',
            { italic: true }
          ),
        ]),
    h2('3.7 Final Recommended SBC for Design'),
    ...(sbc.calculationStatus === 'CALCULATED' || sbc.calculationStatus === 'PARTIAL'
      ? [
          p(
            `Preliminary recommended net SBC for screening: ${pVal(sbc.adoptedPreliminary)} T/m² (status ${statusLabel(sbc.adoptedPreliminary?.status)}). Confirm with field shear tests before structural design.`,
            { bold: true }
          ),
        ]
      : [
          ...(geo.soilScreeningSummary
            ? [
                p(
                  `GIS texture screening SBC (ESTIMATED): ${pVal(geo.soilScreeningSummary.indicativeSbcTm2)} T/m² for texture class "${pVal(geo.soilScreeningSummary.textureClass)}". Screening confidence: ${pVal(geo.soilScreeningSummary.confidencePct)}%.`,
                  { bold: true }
                ),
                p(
                  `This is the available planning-range SBC from SoilGrids texture — not IS 6403 CALCULATED net safe bearing capacity.`,
                  { italic: true, size: 17 }
                ),
              ]
            : []),
          p(
            `IS 6403 net SBC: not calculated (${sbc.calculationStatus}). ${sbc.message || 'Cohesion (c) is unavailable for clayey GIS-only sites — laboratory shear testing or SPT-based correlation is required before code-based bearing capacity can be adopted.'}`,
            { italic: true }
          ),
          p(
            'Commission borehole investigation with SPT, Atterberg limits, and direct shear / triaxial testing, or enter existing field data at TAMS /geotech, before final foundation design.',
            { size: 17 }
          ),
        ]),
  ]

  // ---- §3 Piles (Transmission line order) ----
  const pile450_2 = piles['450mm']['2.0m']
  const pileBlocks: (Paragraph | Table)[] = [
    h1(`${reportFormat === 'transmission-line' ? '3' : '4'}. PILE FOUNDATION ANALYSIS & DESIGN`),
    h2('4.1 Design Parameters'),
    kvTable([
      ['Pile Type', 'Cast-in-situ RCC pile (screening)', 'IS 2911 (Part 1)'],
      ['Pile Diameters', '450 mm and 600 mm', 'TAMS tower screening'],
      ['Pile Depths', '1.0 m, 1.5 m, 2.0 m', ''],
      ['FoS Compression', '2.5', 'IS 2911 practice'],
      ['FoS Uplift', '3.0', 'IS 2911 practice'],
      ['Method', piles.method || 'Static c–φ screening', piles.codeReference || ''],
    ]),
    p('SPT N-values are never fabricated. Lateral capacity requires tower shear/moment and pile-head fixity.'),
    p(piles.message || 'Preliminary pile analysis.'),
    h2('4.2 Adopted Soil Parameters (Layer-wise)'),
    simpleTable(
      ['Layer', 'Depth (m)', 'Soil Type', 'c', 'φ (°)', 'γ'],
      geo.soilProfile.map((L, i) => [
        `Layer ${layerRoman(i)}`,
        `${L.depthFromM.toFixed(1)}–${L.depthToM.toFixed(1)}`,
        String(L.usdaTexture.value || L.preliminaryMaterialDescription.value || '—'),
        pVal(eng.cohesionKpa),
        pVal(eng.phiDeg),
        pVal(eng.gammaKnM3),
      ]),
      [1200, 1800, 3200, 1800, 1400, CONTENT_W - 9400]
    ),
    h2('4.3 Cross-Sectional Area of Piles'),
    monoLine('450 mm — Ap = πD²/4', pile450_2.inputs?.Ap_m2 != null ? `${pile450_2.inputs.Ap_m2} m²` : '0.1590 m²'),
    monoLine('600 mm — Ap = πD²/4', piles['600mm']['2.0m'].inputs?.Ap_m2 != null ? `${piles['600mm']['2.0m'].inputs.Ap_m2} m²` : '0.2827 m²'),
    h2('4.4 VERTICAL LOAD CAPACITY (Detailed Sample — 450 mm × 2.0 m)'),
  ]

  {
    const cellP = pile450_2
    pileBlocks.push(
      monoLine('Diameter D', `${(cellP.diameterMm / 1000).toFixed(3)} m`),
      monoLine('Length L', `${cellP.depthM.toFixed(3)} m`),
      monoLine('Calculation status', cellP.calculationStatus)
    )
    if (cellP.inputs) {
      const inp = cellP.inputs
      pileBlocks.push(
        monoLine('Area Ap', inp.Ap_m2 != null ? `${inp.Ap_m2} m²` : '—'),
        monoLine('Perimeter', inp.perimeter_m != null ? `${inp.perimeter_m} m` : '—'),
        monoLine('φ', inp.phi_deg != null ? `${inp.phi_deg}°` : 'INSUFFICIENT DATA'),
        monoLine('c', inp.c_Tm2 != null ? `${inp.c_Tm2} T/m²` : 'INSUFFICIENT DATA'),
        monoLine('γ', inp.gamma_Tm3 != null ? `${inp.gamma_Tm3} T/m³` : 'INSUFFICIENT DATA')
      )
    }
    if (cellP.calculationStatus === 'INSUFFICIENT_DATA' || cellP.calculationStatus === 'FIELD_TEST_REQUIRED') {
      pileBlocks.push(
        p(
          `Calculation could not be completed because the following field parameters are unavailable: ${(cellP.missingParameters || []).join('; ') || 'see data quality'}.`,
          { italic: true }
        )
      )
    } else if (cellP.steps?.length) {
      for (const s of cellP.steps) {
        pileBlocks.push(
          p(`Step ${s.step} — ${s.name}: ${s.formula}${s.result != null ? ` → ${s.result} ${s.unit}` : ''}`, {
            size: 17,
          })
        )
      }
    }
  }

  pileBlocks.push(h2('4.5 Summary — Vertical Capacity'))
  pileBlocks.push(
    simpleTable(
      ['Diameter', 'Depth', 'Safe Vertical (T)', 'Status'],
      (['450mm', '600mm'] as const).flatMap((dia) =>
        (['1.0m', '1.5m', '2.0m'] as const).map((dep) => {
          const c = piles[dia][dep]
          return [
            dia.replace('mm', ' mm'),
            dep.replace('m', ' m'),
            pVal(c.vertical),
            statusLabel(c.vertical.status),
          ]
        })
      ),
      [2200, 2200, 3200, CONTENT_W - 7600]
    )
  )
  pileBlocks.push(h2('4.6 UPLIFT CAPACITY (Sample — 450 mm × 2.0 m)'))
  pileBlocks.push(
    p(
      `Safe uplift: ${pVal(pile450_2.uplift)} (${statusLabel(pile450_2.uplift.status)}). When CALCULATED, uplift uses shaft resistance / FoS uplift per IS 2911 screening form.`,
      { size: 18 }
    )
  )
  pileBlocks.push(h2('4.7 UPLIFT LOAD CAPACITY SUMMARY'))
  pileBlocks.push(
    simpleTable(
      ['Diameter', 'Depth', 'Safe Uplift (T)', 'Status'],
      (['450mm', '600mm'] as const).flatMap((dia) =>
        (['1.0m', '1.5m', '2.0m'] as const).map((dep) => {
          const c = piles[dia][dep]
          return [
            dia.replace('mm', ' mm'),
            dep.replace('m', ' m'),
            pVal(c.uplift),
            statusLabel(c.uplift.status),
          ]
        })
      ),
      [2200, 2200, 3200, CONTENT_W - 7600]
    )
  )
  pileBlocks.push(h2('4.8 LATERAL LOAD CAPACITY'))
  pileBlocks.push(
    simpleTable(
      ['Diameter', 'Depth', 'Lateral Capacity (T)', 'Status'],
      (['450mm', '600mm'] as const).flatMap((dia) =>
        (['1.0m', '1.5m', '2.0m'] as const).map((dep) => {
          const c = piles[dia][dep]
          return [
            dia.replace('mm', ' mm'),
            dep.replace('m', ' m'),
            pVal(c.lateral),
            statusLabel(c.lateral.status),
          ]
        })
      ),
      [2200, 2200, 3600, CONTENT_W - 8000]
    )
  )
  pileBlocks.push(
    h2('4.9 Governing Design Condition for Transmission Tower Foundation'),
    p(
      'Transmission line tower foundations are generally governed by vertical compression, uplift due to wind/conductor imbalance, and lateral wind loads (IS 875 Part 3). GIS screening does not replace structural load combinations or field pile design.',
      { size: 18 }
    )
  )

  // keep detailed per-config sheets after summary (full report only)
  if (reportFormat !== 'transmission-line') {
  pileBlocks.push(h2('4.10 Detailed Configuration Sheets (all diameters × depths)'))
  for (const dia of ['450mm', '600mm'] as const) {
    pileBlocks.push(h3(`Pile Foundation — ${dia.replace('mm', ' mm')} Diameter`))
    for (const dep of ['1.0m', '1.5m', '2.0m'] as const) {
      const cellP = piles[dia][dep]
      pileBlocks.push(h3(`${dia.replace('mm', ' mm')} dia × ${dep.replace('m', ' m')} depth`))
      pileBlocks.push(
        monoLine('Diameter D', `${(cellP.diameterMm / 1000).toFixed(3)} m`),
        monoLine('Length L', `${cellP.depthM.toFixed(3)} m`),
        monoLine('Calculation status', cellP.calculationStatus)
      )
      if (cellP.inputs) {
        const inp = cellP.inputs
        pileBlocks.push(
          monoLine('Area Ap', inp.Ap_m2 != null ? `${inp.Ap_m2} m²` : '—'),
          monoLine('Perimeter', inp.perimeter_m != null ? `${inp.perimeter_m} m` : '—'),
          monoLine('φ', inp.phi_deg != null ? `${inp.phi_deg}°` : 'INSUFFICIENT DATA'),
          monoLine('c', inp.c_Tm2 != null ? `${inp.c_Tm2} T/m²` : 'INSUFFICIENT DATA'),
          monoLine('γ', inp.gamma_Tm3 != null ? `${inp.gamma_Tm3} T/m³` : 'INSUFFICIENT DATA')
        )
      }
      if (cellP.calculationStatus === 'INSUFFICIENT_DATA' || cellP.calculationStatus === 'FIELD_TEST_REQUIRED') {
        pileBlocks.push(
          p(
            `Calculation could not be completed because the following field parameters are unavailable: ${(cellP.missingParameters || []).join('; ') || 'see data quality'}.`,
            { italic: true }
          )
        )
      } else if (cellP.steps?.length) {
        pileBlocks.push(p('A. Vertical Capacity / B. Uplift Capacity — calculation steps:', { bold: true }))
        for (const s of cellP.steps) {
          pileBlocks.push(
            p(`Step ${s.step} — ${s.name}: ${s.formula}${s.result != null ? ` → ${s.result} ${s.unit}` : ''}`, {
              size: 17,
            })
          )
        }
      }
      pileBlocks.push(
        simpleTable(
          ['Capacity', 'Result', 'Status'],
          [
            ['Safe vertical', pVal(cellP.vertical), statusLabel(cellP.vertical.status)],
            ['Safe uplift', pVal(cellP.uplift), statusLabel(cellP.uplift.status)],
            ['Lateral', pVal(cellP.lateral), statusLabel(cellP.lateral.status)],
          ],
          [3500, 3500, CONTENT_W - 7000]
        )
      )
    }
  }
  }


  // ---- §4 CBR ----
  const cbrEng = geo.cbrEngineAnalysis
  const cbrRows = (cbrEng?.byDepth ?? geo.cbrAnalysis.estimatedByDepth.map((row, i) => ({
    reportDepthLabel: row.reportDepth.replace('m', ' m').replace('-', '–'),
    correlatedCbrPct: { value: null, status: row.estimatedCBR.status },
    cbrRangePct: row.estimatedCBR,
    soilClassification: null,
    pi: null,
    method: row.estimatedCBR.method,
    confidencePct: row.estimatedCBR.confidence,
  }))).map((row, i) => {
    const meas = geo.cbrAnalysis.measuredByDepth[i]
    const range = 'cbrRangePct' in row ? row.cbrRangePct?.value : null
    const mid = 'correlatedCbrPct' in row ? row.correlatedCbrPct?.value : null
    const estDisplay =
      mid != null
        ? `${mid}%`
        : range && typeof range === 'object'
          ? `${range.low}–${range.high}%`
          : pVal('cbrRangePct' in row ? row.cbrRangePct : geo.cbrAnalysis.estimatedByDepth[i]?.estimatedCBR)
    return [
      'reportDepthLabel' in row
        ? row.reportDepthLabel
        : geo.cbrAnalysis.estimatedByDepth[i]?.reportDepth.replace('m', ' m').replace('-', '–') ?? '—',
      row.soilClassification ?? '—',
      row.pi != null ? String(row.pi) : '—',
      estDisplay,
      row.method ?? '—',
      row.confidencePct != null ? `${row.confidencePct}%` : '—',
      pVal(meas?.measuredCBR),
      statusLabel(meas?.measuredCBR.status),
    ]
  })
  const cbrSec: (Paragraph | Table)[] = [
    h1(`${reportFormat === 'transmission-line' ? '4' : '5'}. CALIFORNIA BEARING RATIO${reportFormat === 'transmission-line' ? ' (CBR):' : ''}`),
    h2('5.1 Purpose'),
    p(
      'Transmission tower access and construction road assessment. Correlated CBR values support preliminary access route screening — they are not laboratory soaked CBR test results.'
    ),
    h2('5.2 Data Basis'),
    p('Grain size, plasticity index, and IS 1498 classification from the shared Phase C soil profile (SoilGrids + derivation pipeline).'),
    h2('5.3 Soil Profile'),
    p('See Section 1 and Soil Test Summary for depth-wise soil parameters.'),
    h2('5.4 Input Parameters'),
    p('Gravel, sand, silt, clay fractions; soil classification; PI (LL − PL) where calculated from correlated Atterberg limits.'),
    h2('5.5 Correlation Method'),
    p(cbrEng?.byDepth[0]?.method ?? 'Texture-PI engineering correlation for transmission access roads.'),
    p(cbrEng?.byDepth[0]?.correlationReference ?? ''),
    h2('5.6 Depth-wise CBR'),
    simpleTable(
      ['Depth', 'Soil class', 'PI', 'Correlated CBR', 'Method', 'Confidence', 'Measured CBR', 'Measured status'],
      cbrRows,
      [1400, 1600, 800, 1600, 2200, 1000, 1400, CONTENT_W - 10000]
    ),
    h2('5.7 Recommended Design CBR'),
    kvTable([
      ['Recommended design CBR', pVal(cbrEng?.recommendedDesignCbr ?? geo.cbrAnalysis.estimatedByDepth[0]?.estimatedCBR), statusLabel((cbrEng?.recommendedDesignCbr ?? geo.cbrAnalysis.estimatedByDepth[0]?.estimatedCBR)?.status ?? 'NO_DATA')],
      ['Basis', cbrEng?.recommendedDesignBasis ?? 'Conservative correlated screening', ''],
    ]),
    h2('5.8 Validation and Limitations'),
    ...(cbrEng?.validationNotes ?? ['Never label correlated CBR as laboratory soaked CBR.']).map((n) => p(n)),
  ]

  // ---- §5 Resistivity ----
  const resEng = geo.resistivityEngineAnalysis
  const resDepthRows = (resEng?.byDepth ?? []).map((d) => [
    d.depthLabel,
    d.estimatedResistivityOhmM.value != null ? `≈ ${d.estimatedResistivityOhmM.value}` : pVal(d.estimatedResistivityOhmM),
    d.estimatedRangeOhmM.value && typeof d.estimatedRangeOhmM.value === 'object'
      ? `${d.estimatedRangeOhmM.value.low}–${d.estimatedRangeOhmM.value.high}`
      : '—',
    d.basis.replace(/_/g, ' '),
    statusLabel(d.estimatedResistivityOhmM.status),
  ])
  const resSec: (Paragraph | Table)[] = [
    h1(`${reportFormat === 'transmission-line' ? '5' : '6'}. EARTH RESISTIVITY`),
    h2('6.1 Assessment Methodology'),
    p(
      resEng?.assessmentTitle ??
        'Estimated Geospatial Soil Electrical Resistivity Assessment — not an Earth Resistivity Test Result unless field data is uploaded.'
    ),
    h2('6.2 Data Sources'),
    p('Shared Phase C grain size fractions; geospatial soil property datasets (SoilGrids). Moisture, salinity, and temperature are not modelled.'),
    h2('6.3 Geospatial Input Parameters'),
    p('Sand, silt, and clay percentages per depth layer from the validated soil profile.'),
    h2('6.4 Estimated Resistivity Profile'),
    resDepthRows.length > 0
      ? simpleTable(
          ['Depth', 'Estimated ρ (Ω·m)', 'Range (Ω·m)', 'Basis', 'Status'],
          resDepthRows,
          [1800, 2000, 2000, 2400, CONTENT_W - 8200]
        )
      : p('No depth-wise modelled estimates — field Wenner test required.'),
    h2('6.5 Resistivity Recommendation'),
    kvTable([
      ['Site estimate', pVal(resEng?.siteEstimateOhmM ?? geo.resistivityAnalysis.estimated), statusLabel((resEng?.siteEstimateOhmM ?? geo.resistivityAnalysis.estimated).status)],
      ['Estimated range', pVal(resEng?.siteEstimateRangeOhmM ?? geo.resistivityAnalysis.estimated), ''],
      ['Measured (field)', pVal(geo.resistivityAnalysis.measured), statusLabel(geo.resistivityAnalysis.measured.status)],
    ]),
    h2('6.6 Confidence Assessment'),
    p(`Model confidence: ${resEng?.confidencePct ?? '—'}%. Values rounded to avoid false laboratory precision.`),
    h2('6.7 Field Verification Requirements'),
    ...(resEng?.fieldVerificationRequired ?? [
      'Wenner four-electrode field measurement recommended before earthing design.',
    ]).map((r) => p(`• ${r}`)),
    ...(resEng?.validationNotes ?? []).map((n) => p(n)),
  ]

  // ---- §6 Soil Verdict (Phase H) ----
  const verdict = geo.soilVerdictAnalysis
  const verdictSec: (Paragraph | Table)[] = verdict
    ? [
        h1('7. SOIL VERDICT & INVESTIGATION DECISION'),
        h2('7.1 Executive Soil Verdict'),
        kvTable([
          ['Overall verdict', verdict.overall.status.replace(/_/g, ' '), verdict.overall.color],
          ['Confidence', verdict.overall.confidence, ''],
          ['Investigation urgency', verdict.overall.investigationUrgency.replace(/_/g, ' '), ''],
          ['Investigation required', verdict.overall.investigationRequired ? 'Yes' : 'No', ''],
        ]),
        p(verdict.overall.explanation),
        h2('7.2 Evidence Summary'),
        p('Measured evidence:'),
        ...(verdict.whatWeKnow.measured.length
          ? verdict.whatWeKnow.measured.map((x) => p(`• ${x}`))
          : [p('No measured field evidence at this site.')]),
        p('Engineering-correlated evidence:'),
        ...(verdict.whatWeKnow.correlated.length
          ? verdict.whatWeKnow.correlated.slice(0, 6).map((x) => p(`• ${x}`))
          : [p('None.')]),
        p('Modelled / geospatial evidence:'),
        ...(verdict.whatWeKnow.modelled.length
          ? verdict.whatWeKnow.modelled.slice(0, 6).map((x) => p(`• ${x}`))
          : [p('None.')]),
        p('Missing / unknown:'),
        ...verdict.whatWeDoNotKnow.slice(0, 8).map((x) => p(`• ${x}`)),
        h2('7.3 Foundation Assessment'),
        p(`${verdict.dimensions.foundation.status.replace(/_/g, ' ')} — Confidence: ${verdict.dimensions.foundation.confidence}. ${verdict.dimensions.foundation.requiredNextAction}`),
        h2('7.4 Pile Assessment'),
        p(`${verdict.dimensions.pile.status.replace(/_/g, ' ')} — Confidence: ${verdict.dimensions.pile.confidence}. ${verdict.dimensions.pile.requiredNextAction}`),
        h2('7.5 Access Road / CBR Assessment'),
        p(`${verdict.dimensions.accessRoad.status.replace(/_/g, ' ')} — Confidence: ${verdict.dimensions.accessRoad.confidence}. ${verdict.dimensions.accessRoad.requiredNextAction}`),
        h2('7.6 Electrical Earthing / Resistivity Assessment'),
        p(`${verdict.dimensions.earthing.status.replace(/_/g, ' ')} — Confidence: ${verdict.dimensions.earthing.confidence}. ${verdict.dimensions.earthing.requiredNextAction}`),
        h2('7.7 Groundwater Assessment'),
        p(`${verdict.dimensions.groundwater.status.replace(/_/g, ' ')} — ${verdict.dimensions.groundwater.requiredNextAction}`),
        h2('7.8 Confidence and Uncertainty'),
        p(`Overall confidence: ${verdict.overall.confidence}. A positive preliminary verdict does not imply high confidence or final design approval.`),
        h2('7.9 Conflicting Evidence'),
        ...(verdict.conflicts.length
          ? verdict.conflicts.map(
              (c) =>
                p(
                  `[${c.severity}] ${c.explanation} Resolution: ${c.requiredResolution}`
                )
            )
          : [p('No cross-module conflicts detected.')]),
        h2('7.10 Investigation Requirements'),
        ...(verdict.investigationPriorities.length
          ? verdict.investigationPriorities.map(
              (inv) =>
                p(
                  `Priority ${inv.priority} (${inv.mandate}): ${inv.investigationType} — ${inv.reason}`
                )
            )
          : [p('No immediate investigation indicated.')]),
        h2('7.11 Investigation Priority Plan'),
        simpleTable(
          ['Priority', 'Investigation', 'Mandate', 'Affected decision'],
          verdict.investigationPriorities.map((inv) => [
            String(inv.priority),
            inv.investigationType,
            inv.mandate,
            inv.affectedDecision,
          ]),
          [800, 3200, 1400, CONTENT_W - 5400]
        ),
        h2('7.12 Design Stage Decision'),
        simpleTable(
          ['Stage', 'Decision', 'Explanation'],
          verdict.designStageDecisions.map((d) => [
            d.stage.replace(/_/g, ' '),
            d.decision.replace(/_/g, ' '),
            d.explanation,
          ]),
          [2200, 1800, CONTENT_W - 4000]
        ),
        h2('7.13 Engineering Limitations'),
        ...verdict.limitations.map((L) => p(L)),
      ]
    : [
        h1('7. SOIL VERDICT & INVESTIGATION DECISION'),
        p('Soil verdict analysis not available for this report.'),
      ]

  // ---- §10 Tower Planning (Phase I) ----
  const towerSec: (Paragraph | Table)[] = reportData.sections.includeTowerPlanning && phaseI
    ? [
        h1('10. TOWER PLANNING AND SUITABILITY'),
        h2('10.1 Planning Geometry'),
        ...(phaseI.towerPlanningContext.planningGeometry
          ? [
              p(
                `Geometry type: ${phaseI.towerPlanningContext.planningGeometry.type}. ${phaseI.towerPlanningContext.planningGeometry.label || ''}`
              ),
            ]
          : [p('Planning geometry not defined.')]),
        h2('10.2 Power Infrastructure Assessment'),
        ...(reportData.sections.includePowerInfrastructure && phaseI.powerInfrastructureSummary
          ? [
              kvTable([
                ['Infrastructure type', phaseI.powerInfrastructureSummary.infrastructureType, ''],
                ['Nearest label', phaseI.powerInfrastructureSummary.nearestLabel, ''],
                [
                  'Distance',
                  phaseI.powerInfrastructureSummary.distanceKm != null
                    ? `${phaseI.powerInfrastructureSummary.distanceKm} km`
                    : 'NOT DETECTED',
                  '',
                ],
                ['Direction', phaseI.powerInfrastructureSummary.direction || '—', ''],
                ['Source', phaseI.powerInfrastructureSummary.source, ''],
                ['Status', phaseI.powerInfrastructureSummary.status.replace(/_/g, ' '), ''],
                ['Confidence', phaseI.powerInfrastructureSummary.confidence, ''],
              ]),
              p(phaseI.powerInfrastructureSummary.message),
            ]
          : [
              p(
                'POWER INFRASTRUCTURE ASSESSMENT NOT REQUESTED — results appear only after explicit Phase I power infrastructure check.',
                { italic: true }
              ),
            ]),
        h2('10.3 Tower Candidate Generation'),
        ...(phaseI.towerCandidates.length
          ? [
              simpleTable(
                [
                  'Tower ID',
                  'Latitude',
                  'Longitude',
                  'Suitability Score',
                  'Terrain',
                  'Slope',
                  'Accessibility',
                  'Power',
                  'Recommendation',
                ],
                phaseI.towerCandidates.map((c) => [
                  c.id,
                  fmtCoord(c.latitude),
                  fmtCoord(c.longitude),
                  String(c.suitabilityScore),
                  c.terrainScore != null ? String(c.terrainScore) : '—',
                  c.slopeScore != null ? String(c.slopeScore) : '—',
                  c.accessibilityScore != null ? String(c.accessibilityScore) : '—',
                  c.powerInfrastructureStatus.replace(/_/g, ' '),
                  c.recommendation.replace(/_/g, ' '),
                ]),
                [900, 1100, 1100, 1200, 900, 900, 1100, 1400, CONTENT_W - 8600]
              ),
            ]
          : [p('No tower candidates generated.')]),
        ...(reportData.sections.includeSelectedTowerAnalysis && phaseI.selectedTowerAnalysis
          ? [
              h2('10.4 Selected Tower Analysis'),
              kvTable([
                ['Tower ID', phaseI.selectedTowerAnalysis.candidate.id, ''],
                ['Latitude', fmtCoord(phaseI.selectedTowerAnalysis.candidate.latitude), ''],
                ['Longitude', fmtCoord(phaseI.selectedTowerAnalysis.candidate.longitude), ''],
                ['Suitability score', String(phaseI.selectedTowerAnalysis.suitability.overallScore), ''],
                ['Final status', phaseI.selectedTowerAnalysis.finalStatus.replace(/_/g, ' '), ''],
              ]),
              p(
                'Preliminary recommendation only — not approved for construction. Mandatory investigations remain as listed in Section 7.',
                { italic: true, bold: true }
              ),
            ]
          : []),
        h2('10.5 Preliminary Recommendation'),
        p(
          'RECOMMENDED FOR PRELIMINARY ASSESSMENT — tower candidates are GIS-assisted planning suggestions subject to field geotechnical verification.',
          { bold: true }
        ),
      ]
    : []

  // ---- §8 Foundation Recommendation ----
  const recSec: (Paragraph | Table)[] = [
    h1('8. Foundation Recommendation'),
    p(
      `Based on the available ${classification.toLowerCase()}, the following preliminary observations are recorded for engineering guidance only:`
    ),
    p(
      `1. Subsurface screening to 2.0 m indicates modelled soil conditions as summarised in Sections 4–5. Laboratory confirmation is required before final foundation design.`
    ),
    p(
      `2. Net safe bearing capacity: ${
        sbc.calculationStatus === 'INSUFFICIENT_DATA' && screen?.indicativeSbcTm2.value
          ? `IS 6403 not calculated (clay — cohesion required). Use indicative screening SBC ${screen.indicativeSbcTm2.value.low}–${screen.indicativeSbcTm2.value.high} T/m² for preliminary planning only.`
          : sbc.calculationStatus === 'INSUFFICIENT_DATA'
            ? 'not calculated — INSUFFICIENT DATA for IS 6403 inputs.'
            : `preliminary ${pVal(sbc.adoptedPreliminary)} (${statusLabel(sbc.adoptedPreliminary?.status)}).`
      }`
    ),
    p(
      `3. Pile foundations (450 mm / 600 mm): vertical and uplift capacities are reported only where c–φ static inputs exist; otherwise FIELD TEST REQUIRED / INSUFFICIENT DATA. Lateral capacity remains blocked pending structural loads.`
    ),
    p(
      `4. Recommended next field works: SPT or shear testing, Atterberg limits, soaked CBR, groundwater observation, and Wenner resistivity as listed in Section 7.`
    ),
    p('These recommendations do not constitute a sealed structural design certificate.', { bold: true, italic: true }),
  ]

  // ---- §7 Limitations ----
  const limSec: (Paragraph | Table)[] = [
    h1('9. DATA BASIS AND LIMITATIONS'),
    p(
      'This assessment uses available geospatial, satellite, GIS, and modelled data. Recommended investigation points are planning recommendations — not evidence that physical boreholes were drilled. Modelled or correlated parameters are not substitutes for laboratory or field measurements where verification is required. Final foundation design requires appropriate verified site investigation data.'
    ),
    ...(validation.warningCount > 0
      ? [
          h2('9.1 Report Validation Warnings'),
          ...validation.issues
            .filter((i) => i.severity === 'warning')
            .map((i) => p(`• [${i.code}] ${i.message}`, { size: 17 })),
        ]
      : []),
    ...geo.limitations.map((L, i) => p(`${i + 1}. ${L}`)),
    h2('9.2 Missing Critical Data — Resolution Path'),
    simpleTable(
      ['Parameter', 'Current status', 'Resolution'],
      geo.reportReadiness.missingCriticalData.map((param) => [
        param,
        'FIELD TEST REQUIRED / NO DATA',
        'Commission borehole + lab test; enter results at TAMS /geotech, then re-analyze site',
      ]),
      [2200, 2000, CONTENT_W - 4200]
    ),
    p(
      `Data readiness: ${geo.reportReadiness.completionPercentage}% (${geo.reportReadiness.availableParameters}/${geo.reportReadiness.totalParameters} parameters). GIS-modelled parameters (texture, grain size, density, screening SBC/CBR) count as available for screening purposes.`
    ),
  ]

  // ---- §8 References ----
  const refSec: (Paragraph | Table)[] = [
    h1(reportData.sections.includeTowerPlanning ? '11. References' : '10. References'),
    p('1. IS 6403:1981 — Code of practice for determination of bearing capacity of shallow foundations.'),
    p('2. IS 2911 (Part 1/Sec 2):2010 — Design and construction of pile foundations — Bored cast-in-situ piles.'),
    p('3. IS 1498 — Classification and identification of soils for general engineering purposes.'),
    p('4. IS 2720 (relevant parts) — Methods of test for soils.'),
    p('5. IS 3043 — Code of practice for earthing.'),
    p('6. ISRIC SoilGrids 2.0 — Global gridded soil information (modelled properties).'),
    p('7. TAMS Tower Suitability — Geotechnical Intelligence module (GEO-1) calculation sheets.'),
  ]

  // ---- Annexure A ----
  const annA: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    h1('ANNEXURE A — Depth-wise Soil Data'),
    p(
      'Engineering depth intervals used in the main report (metres only). Sand / silt / clay / density values below are MODELLED SoilGrids means — not laboratory sieve or Proctor results.'
    ),
    simpleTable(
      ['Report depth', 'Sand %', 'Silt %', 'Clay %', 'Bulk dens.', 'Dry dens.', 'pH', 'Org. C', 'USDA', 'Status'],
      geo.soilProfile.map((L) => [
        L.reportDepthLabel,
        L.sandPct.value != null ? String(L.sandPct.value) : 'NO DATA',
        L.siltPct.value != null ? String(L.siltPct.value) : 'NO DATA',
        L.clayPct.value != null ? String(L.clayPct.value) : 'NO DATA',
        L.bulkDensityGcc.value != null ? String(L.bulkDensityGcc.value) : 'NO DATA',
        L.dryDensityGcc.value != null ? String(L.dryDensityGcc.value) : 'NO DATA',
        L.ph.value != null ? String(L.ph.value) : 'NO DATA',
        L.organicCarbonGkg.value != null ? String(L.organicCarbonGkg.value) : 'NO DATA',
        L.usdaTexture.value != null ? String(L.usdaTexture.value) : 'INSUFFICIENT DATA',
        statusLabel(L.sandPct.status),
      ]),
      [1200, 900, 900, 900, 1000, 1000, 800, 900, 1400, CONTENT_W - 10000]
    ),
  ]

  // ---- Annexure B ----
  const annB: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    h1('ANNEXURE B — Source Data and Provenance'),
    p(
      'The following centimetre-scale intervals are SoilGrids source dataset bands. They are not laboratory sample depths and must not be confused with the engineering metre intervals in the main report.'
    ),
    simpleTable(
      ['Source depth', 'From (m)', 'To (m)', 'Sand %', 'Silt %', 'Clay %', 'bdod (g/cm³)', 'pH', 'cfvo %'],
      geo.sourceObservations.map((o) => [
        String(o.sourceDepth),
        o.depthFromM.toFixed(2),
        o.depthToM.toFixed(2),
        o.sandPct != null ? String(o.sandPct) : '—',
        o.siltPct != null ? String(o.siltPct) : '—',
        o.clayPct != null ? String(o.clayPct) : '—',
        o.bdodGcc != null ? String(o.bdodGcc) : '—',
        o.ph != null ? String(o.ph) : '—',
        o.coarseFragPct != null ? String(o.coarseFragPct) : '—',
      ]),
      [1400, 900, 900, 1000, 1000, 1000, 1400, 900, CONTENT_W - 9500]
    ),
    p('Aggregation method for report intervals: thickness-weighted mean of overlapping SoilGrids source layers.'),
    p(`Field investigation match: ${geo.fieldInvestigationMatch.reason}`),
  ]

  // ---- Annexure C ----
  const annC: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    h1('ANNEXURE C — Engineering Calculation Sheets'),
    p('This annexure consolidates calculation status for SBC, settlement and piles. Detailed step lists appear in Sections 6–7 when CALCULATED or PARTIAL.'),
    kvTable([
      ['SBC status', sbc.calculationStatus, sbc.codeReference || ''],
      ['Settlement status', settle.calculationStatus, settle.codeReference || ''],
      ['Pile 450 mm × 2.0 m', piles['450mm']['2.0m'].calculationStatus, pVal(piles['450mm']['2.0m'].vertical)],
      ['Pile 600 mm × 2.0 m', piles['600mm']['2.0m'].calculationStatus, pVal(piles['600mm']['2.0m'].vertical)],
    ]),
    ...(geo.soilScreeningSummary
      ? [
          h2('ANNEXURE D — Parameter Availability & How to Obtain Field Data'),
          p(
            'The following table explains why some parameters show FIELD TEST REQUIRED status and how to obtain verified field/laboratory data for final design.'
          ),
          simpleTable(
            ['Parameter', 'Current status', 'How to obtain'],
            [
              ['Sand / Silt / Clay / Density', 'MODELLED (SoilGrids)', 'Automatic from GIS — already in report'],
              [
                'Indicative SBC / CBR',
                geo.soilScreeningSummary
                  ? `${pVal(geo.soilScreeningSummary.indicativeSbcTm2)} / ${pVal(geo.soilScreeningSummary.indicativeCbrPct)}`
                  : 'ESTIMATED',
                'Texture screening table — planning only',
              ],
              ['IS 6403 net SBC', sbc.calculationStatus, 'Lab cohesion (c) + shear for clay; or sand site with drained c′≈0'],
              ['SPT N-value', 'FIELD TEST REQUIRED', 'Borehole SPT (IS 2131) — enter at /geotech'],
              ['Atterberg limits (LL, PL, PI)', 'FIELD TEST REQUIRED', 'Laboratory IS 2720 — /geotech soil_layers'],
              ['Soaked CBR', 'FIELD TEST REQUIRED', 'Laboratory soaked CBR — /geotech cbr_by_depth'],
              ['Groundwater table', 'NO DATA', 'Field observation during boring — /geotech'],
              ['Earth resistivity', 'NO DATA', 'Wenner field test (IS 3043) — /geotech resistivity'],
              ['Field investigation match', geo.fieldInvestigationMatch.matched ? 'MATCHED' : 'NO MATCH', 'Create investigation within 5 km at /geotech'],
            ],
            [2200, 2800, CONTENT_W - 5000]
          ),
        ]
      : []),
    p('— End of Report —', { center: true, bold: true, spaceAfter: 200 }),
  ]

  const landCoverLabel = pVal(geo.location.landCover)
  const regionLabel =
    landCoverLabel !== 'NO DATA' && landCoverLabel.toLowerCase() !== 'unknown'
      ? `${landCoverLabel}${location ? `, ${location}` : ''}`
      : location

  const locationLines =
    perBhTables.length > 0
      ? perBhTables.map(
          (bh) => `Location ${bh.locationIndex} : ${fmtCoordDms(bh.latitude, bh.longitude)}`
        )
      : [`Location 1 : ${coordLine}`]

  const tlCoordDecimal = `${geo.location.lat.toFixed(6)}, ${geo.location.lon.toFixed(6)}`

  const tlCover: Paragraph[] = [
    new Paragraph({ spacing: { after: 240 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        new TextRun({ text: meta.reportTitle, bold: true, size: 32, font: 'Times New Roman' }),
      ],
    }),
    p(`Project: ${project}`, { center: true, bold: true, size: 22, spaceAfter: 120 }),
    p(`Location : ${location}`, { center: true, size: 20, spaceAfter: 60 }),
    p(tlCoordDecimal, { center: true, size: 20, spaceAfter: 120 }),
    p(`Consultant: ${consultant || 'Planeteye Infra AI'}`, { center: true, size: 20, spaceAfter: 200 }),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  const tlScope: Paragraph[] = [
    h1('SCOPE OF WORK'),
    p(`Purpose : ${purpose}`, { size: 20 }),
    p(`Region of Investigation : ${regionLabel}`, { size: 20 }),
    ...locationLines.map((line) => p(line, { size: 19, spaceAfter: 60 })),
    p('Depth of Investigation : 2.0 m (soil testing and foundation assessment)', { size: 19 }),
    p(
      'Scope covers soil test summary and net safe bearing capacity (SBC) for transmission tower construction.',
      { size: 18, spaceAfter: 200 }
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  const tlHeader = new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
        children: [
          new TextRun({
            text: 'Geotechnical Investigation Report',
            bold: true,
            size: 16,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  })

  const commonHeader = new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
        children: [
          new TextRun({
            text: 'TAMS | GEOSPATIAL GEOTECHNICAL INVESTIGATION REPORT',
            bold: true,
            size: 16,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  })
  const commonFooter = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
        spacing: { before: 80 },
        children: [
          new TextRun({ text: `Location: ${location}                         Page `, size: 16, font: 'Times New Roman' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Times New Roman' }),
          new TextRun({ text: ' of ', size: 16, font: 'Times New Roman' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Times New Roman' }),
        ],
      }),
    ],
  })

  const doc =
    reportFormat === 'transmission-line'
      ? new Document({
          creator: 'TAMS Geotechnical Intelligence',
          title: `${meta.reportTitle} — ${location}`,
          description: purpose,
          sections: [
            {
              properties: {
                page: {
                  size: { width: LANDSCAPE_W, height: LANDSCAPE_H },
                  margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
                },
              },
              headers: { default: tlHeader },
              footers: { default: commonFooter },
              children: [
                ...tlCover,
                ...tlScope,
                ...soilTest,
                p('— End of Report —', { center: true, bold: true }),
              ],
            },
          ],
        })
      : new Document({
    creator: 'TAMS Geotechnical Intelligence',
    title: `${meta.reportTitle} — ${location}`,
    description: classification,
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: { default: commonHeader },
        footers: { default: commonFooter },
        children: [...cover, ...toc, ...exec, ...scope, ...site, ...profileSec],
      },
      {
        properties: {
          page: {
            size: { width: LANDSCAPE_W, height: LANDSCAPE_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: { default: commonHeader },
        footers: { default: commonFooter },
        children: [...investigationPlanSec, ...soilTest],
      },
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: { default: commonHeader },
        footers: { default: commonFooter },
        children: [
          ...engSec,
          ...pileBlocks,
          ...cbrSec,
          ...resSec,
          ...verdictSec,
          ...towerSec,
          ...recSec,
          ...limSec,
          ...refSec,
          ...annA,
          ...annB,
          ...annC,
        ],
      },
    ],
  })

  // Packer.toBlob in browser; toBuffer in Node
  if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    return Packer.toBlob(doc)
  }
  return Packer.toBuffer(doc)
}

export function geotechDocxFileName(location: string, transmissionLine = true): string {
  const loc =
    location
      .trim()
      .replace(/[^\w\s\-.,()]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50)
      .trim() || 'Site'
  return transmissionLine ? `Transmission_line_${loc}.docx` : `Geotech_Investigation_Report_${loc}.docx`
}

export async function downloadGeotechInvestigationDocx(input: GeotechDocxInput): Promise<void> {
  const blob = (await buildGeotechInvestigationDocx(input)) as Blob
  const location =
    (input.geo.location.placeLabel.value as string) ||
    `${input.geo.location.lat.toFixed(4)}_${input.geo.location.lon.toFixed(4)}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = geotechDocxFileName(location)
  a.click()
  URL.revokeObjectURL(url)
}
