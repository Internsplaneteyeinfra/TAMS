/**
 * Self-contained landscape HTML for Transmission-line geotechnical report.
 * Print → Save as PDF (Ctrl+P) for archival — matches trimmed DOCX scope.
 */

import type { GeotechDocxInput } from './buildGeotechReportData'
import { buildGeotechReportData } from './buildGeotechReportData'
import { fmtCoordDms } from './reportFormatting'
import { SOIL_TEST_HEADERS, buildPerBoreholeSoilTables } from './reportSoilTestTables'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tableHtml(headers: string[], rows: string[][]): string {
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join('')
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')
  return `<table class="data"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`
}

function safeFilename(label: string): string {
  const base = label
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)
  return base || 'Site'
}

export function buildTransmissionLineReportHtml(input: GeotechDocxInput): string {
  const reportData = buildGeotechReportData(input)
  const geo = reportData.geo
  const meta = reportData.metadata
  const loc = reportData.location

  const place =
    (geo.location.placeLabel.value as string) ||
    `${loc.latitudeDisplay}, ${loc.longitudeDisplay}`
  const coordDecimal = `${geo.location.lat.toFixed(6)}, ${geo.location.lon.toFixed(6)}`
  const project = meta.projectName
  const consultant = meta.consultant || 'Planeteye Infra AI'
  const purpose = meta.purpose
  const regionLabel = place

  const perBh = buildPerBoreholeSoilTables(geo)
  const locationLines =
    perBh.length > 0
      ? perBh.map((bh) => `Location ${bh.locationIndex} : ${fmtCoordDms(bh.latitude, bh.longitude)}`)
      : [`Location 1 : ${fmtCoordDms(geo.location.lat, geo.location.lon)}`]

  const soilBlocks = perBh
    .map((bh) => {
      const title = `Location ${bh.locationIndex} –: ${fmtCoordDms(bh.latitude, bh.longitude)}`
      return `<h3 class="loc">${esc(title)}</h3>${tableHtml([...SOIL_TEST_HEADERS], bh.rows)}`
    })
    .join('')

  const when = new Date().toLocaleString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(meta.reportTitle)} — ${esc(place)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
      color: #111;
      margin: 0;
      padding: 16px 20px;
      line-height: 1.35;
    }
    .cover { text-align: center; margin-bottom: 28px; page-break-after: always; }
    .cover h1 { font-size: 18pt; margin: 0 0 12px; }
    .cover p { margin: 6px 0; }
    h2.section { font-size: 13pt; margin: 20px 0 10px; page-break-after: avoid; }
    h3.loc { font-size: 10pt; font-weight: bold; margin: 14px 0 6px; }
    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    table.data th, table.data td {
      border: 1px solid #333;
      padding: 3px 4px;
      text-align: center;
      vertical-align: middle;
    }
    table.data th { background: #d9e2f3; font-weight: bold; }
    table.data td:nth-child(19), table.data td:nth-child(20) { font-size: 6.5pt; }
    .scope p { margin: 4px 0; }
    .end { text-align: center; font-weight: bold; margin-top: 24px; }
    .print-hint {
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      padding: 8px 12px;
      font-size: 9pt;
      margin-bottom: 16px;
      border-radius: 4px;
    }
    @media print {
      .print-hint { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <p class="print-hint">Landscape report · Use <strong>Ctrl+P</strong> → <strong>Save as PDF</strong> · ${esc(when)}</p>

  <div class="cover">
    <h1>${esc(meta.reportTitle)}</h1>
    <p><strong>Project:</strong> ${esc(project)}</p>
    <p><strong>Location :</strong> ${esc(place)}</p>
    <p>${esc(coordDecimal)}</p>
    <p><strong>Consultant:</strong> ${esc(consultant)}</p>
  </div>

  <div class="scope">
    <h2 class="section">SCOPE OF WORK</h2>
    <p>Purpose : ${esc(purpose)}</p>
    <p>Region of Investigation : ${esc(regionLabel)}</p>
    ${locationLines.map((l) => `<p>${esc(l)}</p>`).join('')}
    <p>Depth of Investigation : 2.0 m (soil testing and foundation assessment)</p>
    <p>Scope covers soil test summary and net safe bearing capacity (SBC) for transmission tower construction.</p>
  </div>

  <h2 class="section">1. SOIL TEST SUMMARY</h2>
  ${soilBlocks}

  <p class="end">— End of Report —</p>
</body>
</html>`
}

export function transmissionLinePdfFileName(location: string): string {
  return `Transmission_line_${safeFilename(location)}.html`
}

/** Download landscape HTML; open print dialog for Save as PDF. */
export function downloadTransmissionLineReport(
  input: GeotechDocxInput,
  opts?: { openPrint?: boolean }
): void {
  const html = buildTransmissionLineReportHtml(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const location =
    (input.geo.location.placeLabel.value as string) ||
    `${input.geo.location.lat.toFixed(4)}_${input.geo.location.lon.toFixed(4)}`

  if (opts?.openPrint !== false && typeof window !== 'undefined') {
    const w = window.open(url, '_blank')
    if (w) {
      w.addEventListener('load', () => {
        setTimeout(() => w.print(), 400)
      })
    }
  }

  const a = document.createElement('a')
  a.href = url
  a.download = transmissionLinePdfFileName(location)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
