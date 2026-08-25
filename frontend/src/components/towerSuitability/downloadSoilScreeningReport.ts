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
}

/** Build on-screen / downloadable soil screening HTML. */
export function buildSoilScreeningReportHtml(opts: SoilReportOpts): string {
  const { siteLabel, lat, lon, soil, signals, fieldGeotechNote } = opts
  const title = `Soil Report — ${siteLabel}`
  const layers = soil.layers
    .map(
      (L) =>
        `<tr><td>${esc(L.depthLabel)}</td><td>${L.sandPct ?? '—'}</td><td>${L.siltPct ?? '—'}</td>` +
        `<td>${L.clayPct ?? '—'}</td><td>${L.bulkDensityGcc ?? '—'}</td>` +
        `<td>${L.ph ?? '—'}</td><td>${L.coarseFragPct ?? '—'}</td></tr>`
    )
    .join('')

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
  <span class="badge-warn">Confidence ~${soil.confidencePct}%</span><br/>
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

<h2>2. Depth-wise properties</h2>
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
<p class="meta">${esc(
    fieldGeotechNote ||
      (signals?.geotech
        ? `${signals.geotech.site_code} · SBC ${signals.geotech.adopted_sbc_tm2 ?? '—'} T/m² @ ${
            signals.geotech.design_depth_m ?? '—'
          } m · ${signals.geotech.distance_km.toFixed(2)} km away`
        : 'No field investigation within 5 km. Enter lab data at /geotech to raise confidence.')
  )}</p>

<p class="meta" style="margin-top:28px;color:#64748b">TAMS Tower Suitability · SoilReport-(${esc(siteLabel)})</p>
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
