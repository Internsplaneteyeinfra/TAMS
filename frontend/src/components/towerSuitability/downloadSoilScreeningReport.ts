import type { GeotechnicalIntelligence } from './geotech'
import type { SoilScreening } from './soilScreening'
import type { SiteSignals } from './scoring'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** File name: SoilReport-(location).html */
export function soilReportFileName(siteLabel: string): string {
  const loc =
    siteLabel
      .trim()
      .replace(/[^\w\s\-.,()]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 60)
      .trim() || 'Unknown'
  return `SoilReport-(${loc}).html`
}

export type SoilReportOpts = {
  siteLabel: string
  lat: number
  lon: number
  soil: SoilScreening
  signals?: SiteSignals | null
  fieldGeotechNote?: string
  geotechnicalIntelligence?: GeotechnicalIntelligence
}

function geotechSectionsHtml(geo: GeotechnicalIntelligence): string {
  const plan = geo.boreholeInvestigationPlan
  const planRows = plan?.points
    .map(
      (p) =>
        `<tr><td>${esc(p.boreholeId)}</td><td>${p.latitude.toFixed(5)}</td><td>${p.longitude.toFixed(5)}</td>` +
        `<td>${p.recommendedInvestigationDepthM.toFixed(1)} m</td><td>${esc(p.selectionReason)}</td></tr>`
    )
    .join('')

  const profileRows = geo.soilProfile
    .map(
      (row) =>
        `<tr><td>${esc(row.reportDepthLabel)}</td><td>${row.sandPct.value ?? '—'}</td>` +
        `<td>${row.siltPct.value ?? '—'}</td><td>${row.clayPct.value ?? '—'}</td>` +
        `<td>${row.dryDensityGcc.value ?? '—'}</td><td>${esc(String(row.usdaTexture.value ?? '—'))}</td></tr>`
    )
    .join('')

  const eng = geo.engineeringParameterEstimation
  const sbcStatus = geo.sbcEngineAnalysis?.calculationStatus ?? geo.sbcAnalysis.calculationStatus
  const pileStatus = geo.pileEngineAnalysis?.calculationStatus ?? '—'

  return `
<h2>6. Recommended geotechnical investigation plan</h2>
${
  plan
    ? `<p class="meta">${esc(plan.analysisSummary)}</p>
<table>
<thead><tr><th>BH ID</th><th>Lat</th><th>Lon</th><th>Depth</th><th>Reason</th></tr></thead>
<tbody>${planRows}</tbody>
</table>`
    : '<p class="meta">No investigation geometry — point site assumed.</p>'
}

<h2>7. Engineering soil profile (0–2 m, SoilGrids)</h2>
<table>
<thead><tr><th>Depth</th><th>Sand %</th><th>Silt %</th><th>Clay %</th><th>ρd</th><th>Texture</th></tr></thead>
<tbody>${profileRows}</tbody>
</table>

<h2>8. Engineering parameters &amp; calculations (screening)</h2>
<p class="meta">
  Unit weight γ: <strong>${eng.gammaKnM3.value ?? '—'}</strong> ${eng.gammaKnM3.unit ?? ''} (${eng.gammaKnM3.status})<br/>
  Friction φ: <strong>${eng.phiDeg.value ?? '—'}</strong> ${eng.phiDeg.unit ?? ''} (${eng.phiDeg.status})<br/>
  Cohesion c: <strong>${eng.cohesionKpa.value ?? '—'}</strong> (${eng.cohesionKpa.status})<br/>
  IS 6403 SBC status: <strong>${esc(sbcStatus)}</strong><br/>
  Pile analysis status: <strong>${esc(String(pileStatus))}</strong>
</p>
<div class="note">
  SoilGrids / GEE provide <strong>modelled</strong> texture, density, and indicative ranges.
  IS 6403 net SBC and pile capacities need verified c–φ (or SPT-backed correlation) — shown as
  FIELD TEST REQUIRED / INSUFFICIENT DATA when cohesion is not defensible, not because GIS failed.
</div>

<h2>9. Soil verdict summary</h2>
<p class="meta">${esc(geo.soilVerdictAnalysis?.overall.summary ?? geo.limitations?.[0] ?? 'See Word report for full verdict.')}</p>
`
}

/** Build on-screen / downloadable soil screening HTML. */
export function buildSoilScreeningReportHtml(opts: SoilReportOpts): string {
  const { siteLabel, lat, lon, soil, signals, fieldGeotechNote, geotechnicalIntelligence } = opts
  const title = `Soil & Geotech Screening — ${siteLabel}`
  const layers = soil.layers
    .map(
      (L) =>
        `<tr><td>${esc(L.depthLabel)}</td><td>${L.sandPct ?? '—'}</td><td>${L.siltPct ?? '—'}</td>` +
        `<td>${L.clayPct ?? '—'}</td><td>${L.bulkDensityGcc ?? '—'}</td>` +
        `<td>${L.ph ?? '—'}</td><td>${L.coarseFragPct ?? '—'}</td></tr>`
    )
    .join('')

  const geotechHtml = geotechnicalIntelligence ? geotechSectionsHtml(geotechnicalIntelligence) : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1a1a1a;max-width:900px}
h1{font-size:20px;margin:0 0 6px} h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #0f766e;padding-bottom:4px}
.meta{font-size:13px;line-height:1.55} .badge{display:inline-block;background:#0f766e;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:6px}
.badge-warn{background:#b45309} .note{background:#fff7ed;border:1px solid #fdba74;padding:10px 12px;border-radius:8px;font-size:12px;margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0 14px}
th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left} th{background:#ecfdf5}
@media print{body{margin:12px}}
</style></head><body>
<h1>${esc(title)}</h1>
<p class="meta">
  <span class="badge-warn">Confidence ~${soil.confidencePct}%</span>
  <span class="badge">ISRIC SoilGrids / GEE</span><br/>
  <strong>Location:</strong> ${esc(siteLabel)}<br/>
  <strong>Coordinates:</strong> ${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E<br/>
  Generated: ${esc(new Date().toLocaleString())}
</p>

<h2>1. Soil texture summary (0–30 cm average)</h2>
<p class="meta">
  Texture class: <strong>${esc(soil.textureClass)}</strong><br/>
  Indicative SBC (screening): <strong>${soil.indicativeSbcTm2.low}–${soil.indicativeSbcTm2.high} T/m²</strong><br/>
  Indicative CBR (screening): <strong>${soil.indicativeCbrPct.low}–${soil.indicativeCbrPct.high}%</strong><br/>
  Report confidence: <strong>~${soil.confidencePct}%</strong> — ${esc(soil.confidenceNote)}
</p>

<h2>2. Depth-wise properties (SoilGrids)</h2>
<table>
<thead><tr><th>Depth</th><th>Sand %</th><th>Silt %</th><th>Clay %</th><th>Bulk dens. (g/cm³)</th><th>pH</th><th>Coarse frag. %</th></tr></thead>
<tbody>${layers}</tbody>
</table>

<h2>3. Site context (live suitability signals)</h2>
<p class="meta">
  Elevation: ${signals?.elevationM != null ? `${Math.round(signals.elevationM)} m` : '—'}
  · Slope: ${signals?.slopeDeg != null ? `${signals.slopeDeg.toFixed(1)}°` : '—'}
  · Road: ${signals?.roadKm != null ? `${signals.roadKm.toFixed(2)} km` : '—'}
  · Water: ${signals?.waterKm != null ? `${signals.waterKm.toFixed(2)} km` : '—'}
</p>

<h2>4. Field geotech (if available)</h2>
${
  signals?.geotech
    ? `<p class="meta"><strong>Nearest field record:</strong> ${esc(signals.geotech.site_code)} · SBC ${signals.geotech.adopted_sbc_tm2 ?? '—'} T/m² @ ${signals.geotech.design_depth_m ?? '—'} m · ${signals.geotech.distance_km.toFixed(2)} km away</p>`
    : `<div class="note">
  <strong>No borehole investigation in TAMS database within 5 km.</strong><br/>
  This does <em>not</em> mean soil data is unavailable — Sections 1–3 above contain live GIS model data for this site.<br/>
  <strong>Available now (GIS):</strong> texture <strong>${esc(soil.textureClass)}</strong>,
  SBC screening <strong>${soil.indicativeSbcTm2.low}–${soil.indicativeSbcTm2.high} T/m²</strong>,
  CBR screening <strong>${soil.indicativeCbrPct.low}–${soil.indicativeCbrPct.high}%</strong>,
  sand/silt/clay and density to 2.0 m (Table §2).<br/>
  <strong>To unlock MEASURED values</strong> (SPT, LL/PL/PI, soaked CBR, resistivity, IS 6403 SBC for clay):
  create a field investigation at <strong>/geotech</strong> for these coordinates, then re-run Analyze.
</div>`
}

<h2>5. What requires physical testing (cannot come from GIS)</h2>
<table>
<thead><tr><th>Parameter</th><th>Status</th><th>How to obtain</th></tr></thead>
<tbody>
<tr><td>SPT N-value</td><td>FIELD TEST REQUIRED</td><td>Borehole SPT — enter at /geotech</td></tr>
<tr><td>Atterberg limits (LL, PL, PI)</td><td>FIELD TEST REQUIRED</td><td>Lab IS 2720 — /geotech soil_layers</td></tr>
<tr><td>Soaked CBR</td><td>FIELD TEST REQUIRED</td><td>Lab test — /geotech cbr_by_depth</td></tr>
<tr><td>Cohesion c (for clay IS 6403)</td><td>FIELD TEST REQUIRED</td><td>Direct shear / triaxial — /geotech</td></tr>
<tr><td>Groundwater table</td><td>NO DATA</td><td>Field observation during boring</td></tr>
<tr><td>Earth resistivity</td><td>NO DATA</td><td>Wenner test IS 3043 — /geotech</td></tr>
</tbody>
</table>

${geotechHtml}

<p class="meta" style="margin-top:28px;color:#64748b">TAMS Tower Suitability · ${esc(fieldGeotechNote ?? 'GIS screening + geotechnical intelligence')}</p>
</body></html>`
}

export function downloadSoilScreeningReport(opts: SoilReportOpts) {
  const html = buildSoilScreeningReportHtml(opts)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = soilReportFileName(opts.siteLabel)
  a.click()
  URL.revokeObjectURL(url)
}
