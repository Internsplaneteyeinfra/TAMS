/**
 * Professional full geotechnical analysis HTML — single popup source (same data as tabs/DOCX).
 */

import type { GeotechnicalIntelligence } from '../geotech'
import type { SiteSignals } from '../scoring'
import type { TowerCandidate } from '../towerPlanning/types'
import { buildDynamicPurpose } from '../geotech/report/reportDynamicScope'
import { fmtCoordDms } from '../geotech/report/reportFormatting'
import {
  SOIL_TEST_HEADERS,
  buildPerBoreholeSoilTables,
  resolveGroundWaterTableDisplay,
} from '../geotech/report/reportSoilTestTables'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Safe numeric provenance display for HTML tables. */
function pv(p: { value?: number | null } | null | undefined): string {
  const v = p?.value
  return v != null && Number.isFinite(v) ? String(v) : '—'
}

export type FullAnalysisHtmlInput = {
  projectName?: string
  siteLabel: string
  lat: number
  lon: number
  geo: GeotechnicalIntelligence
  signals?: SiteSignals | null
  towerCandidates?: TowerCandidate[]
  powerChecked?: boolean
}

export function buildFullGeotechAnalysisHtml(input: FullAnalysisHtmlInput): string {
  const { geo, signals, siteLabel, lat, lon } = input
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const plan = geo.boreholeInvestigationPlan
  const verdict = geo.soilVerdictAnalysis?.overall

  const bhRows =
    plan?.points
      .map(
        (p) =>
          `<tr><td>${esc(p.boreholeId)}</td><td>${p.latitude.toFixed(6)}</td><td>${p.longitude.toFixed(6)}</td>` +
          `<td>${p.recommendedInvestigationDepthM.toFixed(1)} m</td><td>${esc(p.selectionReason)}</td></tr>`
      )
      .join('') ?? ''

  const profileRows = geo.soilProfile
    .map(
      (r) =>
        `<tr><td>${esc(r.reportDepthLabel ?? '—')}</td><td>${pv(r.gravelPct)}</td><td>${pv(r.sandPct)}</td>` +
        `<td>${pv(r.siltPct)}</td><td>${pv(r.clayPct)}</td><td>${esc(String(r.isSoilClassification?.value ?? '—'))}</td></tr>`
    )
    .join('')

  const gwt = resolveGroundWaterTableDisplay(geo)
  const perBh = buildPerBoreholeSoilTables(geo)
  const perBhHtml = perBh
    .map(
      (bh) =>
        `<h3>${esc(bh.boreholeId)} — Location ${bh.locationIndex}</h3>` +
        `<p><strong>Location ${bh.locationIndex} —:</strong> ${esc(fmtCoordDms(bh.latitude, bh.longitude))}</p>` +
        `<table><thead><tr>${SOIL_TEST_HEADERS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
        `<tbody>${bh.rows
          .map(
            (row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`
          )
          .join('')}</tbody></table>`
    )
    .join('')

  const sbcRows = (geo.sbcEngineAnalysis?.siteSummary.byDepth ?? geo.sbcAnalysis?.byDepth ?? [])
    .map(
      (d: { depthM: number; netSafeBearingCapacityTm2?: { value?: number | null }; governingCondition?: string }) =>
        `<tr><td>${d.depthM} m</td><td>${d.netSafeBearingCapacityTm2?.value ?? '—'}</td><td>${esc(String(d.governingCondition ?? '—'))}</td></tr>`
    )
    .join('')

  const pileMatrix = geo.pileEngineAnalysis?.siteSummary.matrix ?? []
  const pileRows = pileMatrix
    .slice(0, 12)
    .map(
      (p) =>
        `<tr><td>${p.diameterMm} mm</td><td>${p.depthM} m</td><td>${p.verticalCapacity?.safe_T ?? '—'}</td>` +
        `<td>${p.upliftCapacity?.safe_T ?? '—'}</td><td>${p.lateralCapacity?.safe_T ?? '—'}</td></tr>`
    )
    .join('')

  const enrich = signals?.enrichment
  const water = enrich?.water
  const waterSection = water
    ? `<p>Nearest water: <strong>${water.nearestDistanceM != null ? Math.round(water.nearestDistanceM) + ' m' : '—'}</strong> · Risk: ${water.waterRisk} · Drainage: ${esc(water.drainageDirection)}</p>`
    : signals?.waterKm != null
      ? `<p>Nearest water (screening): <strong>${Math.round(signals.waterKm * 1000)} m</strong></p>`
      : '<p>Water distance resolved via multi-source GIS fusion.</p>'

  const flood = enrich?.flood
  const floodSection = flood
    ? `<p>Flood susceptibility score: <strong>${flood.score}/100</strong> (${flood.risk})</p>` +
      `<p>${esc(flood.reasoning)}</p><p><em>${esc(flood.liveForecastStatus)}</em></p>`
    : '<p>Flood screening from terrain + rainfall proxy.</p>'

  const towerRows = (input.towerCandidates ?? [])
    .map(
      (t) =>
        `<tr><td style="color:${t.colorHex ?? '#333'}">${esc(t.id)}</td><td>${t.latitude.toFixed(6)}</td>` +
        `<td>${t.longitude.toFixed(6)}</td><td>${t.suitabilityScore}/100</td><td>${t.recommendedKv ?? '—'} kV</td>` +
        `<td>${esc(t.recommendedTowerType ?? '—')}</td><td>${esc(t.recommendedFoundation ?? '—')}</td></tr>`
    )
    .join('')

  const powerSection =
    input.powerChecked && signals?.nearbyPower
      ? `<p>Nearest asset: ${esc(signals.nearbyPower.nearest?.name ?? '—')} · ${signals.nearbyPower.nearest?.distanceKm?.toFixed(2) ?? '—'} km</p>`
      : '<p><em>Power infrastructure shown only after explicit user check.</em></p>'

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>TAMS Geotechnical Investigation — ${esc(siteLabel)}</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;margin:0;padding:24px;color:#1e293b;background:#f8fafc;line-height:1.45}
h1{font-size:1.25rem;margin:0 0 4px}h2{font-size:1rem;margin:24px 0 8px;color:#0f766e;border-bottom:2px solid #99f6e4;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
th{background:#ecfdf5}.meta{font-size:12px;color:#64748b}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8}
</style></head><body>
<h1>Geospatial Geotechnical Investigation Report</h1>
<p class="meta">Satellite + GIS + Remote Sensing Based Engineering Assessment</p>
<div class="meta"><p><strong>Purpose:</strong> ${esc(buildDynamicPurpose(geo))}</p>
<p><strong>Location:</strong> ${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E · ${esc(signals?.placeLabel ?? siteLabel)}</p>
<p><strong>Analysis:</strong> ${esc(dateStr)} · Classification: ${esc(geo.reportClassification.replace(/_/g, ' '))}</p></div>

<h2>1. Proposed investigation points</h2>
<table><thead><tr><th>ID</th><th>Lat</th><th>Lon</th><th>Depth</th><th>Reason</th></tr></thead><tbody>${bhRows || '<tr><td colspan="5">Plan generated on analyze</td></tr>'}</tbody></table>

<h2>2. Soil test summary (Transmission-line — one table per BH)</h2>
<p>GWT screening: <strong>${esc(gwt)}</strong></p>
${perBhHtml || '<p>Run analyze to populate soil tables.</p>'}

<h2>3. Soil profile (0–2 m)</h2>
<table><thead><tr><th>Layer</th><th>Gravel%</th><th>Sand%</th><th>Silt%</th><th>Clay%</th><th>Class</th></tr></thead><tbody>${profileRows}</tbody></table>

<h2>4. SBC analysis</h2>
<table><thead><tr><th>Depth</th><th>Governing SBC (kPa)</th><th>Mode</th></tr></thead><tbody>${sbcRows || '<tr><td colspan="3">See SBC tab</td></tr>'}</tbody></table>

<h2>5. Pile foundation (screening matrix)</h2>
<table><thead><tr><th>Ø</th><th>Depth</th><th>Vertical kN</th><th>Uplift kN</th><th>Lateral kN</th></tr></thead><tbody>${pileRows || '<tr><td colspan="5">See pile tab</td></tr>'}</tbody></table>

<h2>6. Water analysis</h2>${waterSection}

<h2>7. Flood analysis</h2>${floodSection}

<h2>8. Settlement clearance</h2>
<p>Nearest settlement: <strong>${enrich?.settlement?.nearestSettlementM != null ? Math.round(enrich.settlement.nearestSettlementM) + ' m' : signals?.buildingKm != null ? Math.round(signals.buildingKm * 1000) + ' m' : '—'}</strong> · Impact: ${enrich?.settlement?.towerImpact ?? 'GOOD'}</p>

<h2>9. Power infrastructure</h2>${powerSection}

<h2>10. Tower recommendations</h2>
<table><thead><tr><th>ID</th><th>Lat</th><th>Lon</th><th>Score</th><th>kV</th><th>Type</th><th>Foundation</th></tr></thead>
<tbody>${towerRows || '<tr><td colspan="7"><em>Generate tower candidates after soil verdict + power check.</em></td></tr>'}</tbody></table>

<h2>11. Final verdict</h2>
<p><span class="badge">${esc(String(verdict?.status ?? 'SCREENING'))}</span></p>
<p>${esc(String(verdict?.summary ?? geo.soilVerdictAnalysis?.overall.explanation ?? 'See soil verdict panel.'))}</p>
<p class="meta">GIS-derived / engineering-correlated values — not field or laboratory measurements unless explicitly tagged.</p>
</body></html>`
}
