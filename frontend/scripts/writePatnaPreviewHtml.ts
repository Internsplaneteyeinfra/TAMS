/**
 * Write static HTML page previews of the Patna DOCX structure for visual review.
 * These mirror the Word document hierarchy — not the old dashboard soil HTML.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../sample-reports/previews')
fs.mkdirSync(outDir, { recursive: true })

const css = `
@page { size: A4; margin: 18mm; }
body { font-family: "Times New Roman", Times, serif; color: #111; font-size: 11pt; line-height: 1.45; max-width: 210mm; margin: 0 auto; padding: 18mm; background: #fff; }
.header { border-bottom: 1px solid #000; font-size: 9pt; font-weight: bold; padding-bottom: 4px; margin-bottom: 18px; }
.footer { border-top: 1px solid #000; font-size: 9pt; margin-top: 24px; padding-top: 4px; display:flex; justify-content:space-between; }
h1 { font-size: 14pt; margin: 1.2em 0 0.5em; }
h2 { font-size: 12pt; margin: 1em 0 0.4em; }
.cover-title { text-align:center; font-size: 18pt; font-weight: bold; margin-top: 40px; letter-spacing: 0.02em; }
.cover-sub { text-align:center; font-size: 14pt; font-weight: bold; margin-top: 28px; }
.rule { border-bottom: 2px solid #000; width: 70%; margin: 12px auto 28px; }
.center { text-align:center; }
.meta { margin: 8px 0; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 10px 0 16px; }
th, td { border: 1px solid #000; padding: 4px 5px; vertical-align: top; }
th { background: #d9e2f3; }
.mono { font-family: "Courier New", monospace; font-size: 10pt; white-space: pre-wrap; }
.page { page-break-after: always; min-height: 240mm; }
.note { font-style: italic; font-size: 10pt; }
`

const cover = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cover — Patna</title><style>${css}</style></head><body>
<div class="page">
  <div class="header">TAMS | TRANSMISSION TOWER GEOTECHNICAL INVESTIGATION REPORT</div>
  <p class="cover-title">GEOTECHNICAL INVESTIGATION REPORT</p>
  <div class="rule"></div>
  <p class="cover-sub">FOR PROPOSED TRANSMISSION TOWER</p>
  <p class="cover-sub" style="font-size:12pt;margin-top:10px">TOWER SUITABILITY ANALYSIS</p>
  <p class="center meta" style="margin-top:36px"><b>Project:</b> Transmission line</p>
  <p class="center meta"><b>Client:</b> TAMS Tower Suitability</p>
  <p class="center meta"><b>Consultant:</b> Planeteye Infra AI</p>
  <p class="center meta" style="margin-top:28px"><b>Project Location:</b> Patna, Bihar</p>
  <p class="center meta"><b>Coordinates:</b> 25.594100°N, 85.137600°E</p>
  <p class="center meta" style="margin-top:28px"><b>Report Classification:</b> GIS BASED PRELIMINARY SCREENING</p>
  <p class="center meta"><b>Report Date:</b> 27 August 2026</p>
  <p class="center meta"><b>Report ID:</b> TAMS-GEO-PATNA-SAMPLE</p>
  <p class="center note" style="margin-top:40px;max-width:85%;margin-left:auto;margin-right:auto">This document is a GIS-based preliminary geotechnical screening report. It is not a substitute for borehole investigation unless MEASURED field data are identified herein.</p>
  <div class="footer"><span>Location: Patna, Bihar</span><span>Page 1</span></div>
</div>
</body></html>`

const soil = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Soil Summary — Patna</title><style>${css}</style></head><body>
<div class="page">
  <div class="header">TAMS | TRANSMISSION TOWER GEOTECHNICAL INVESTIGATION REPORT</div>
  <h1>5. Soil Test Summary</h1>
  <p>Depth intervals are engineering metres only (0.0–2.0 m). Source centimetre bands appear only in Annexure B.</p>
  <table>
    <thead><tr><th>Sr.</th><th>Depth (m)</th><th>Gravel %</th><th>Sand %</th><th>Silt %</th><th>Clay %</th><th>Dry Dens.</th><th>Bulk Dens.</th><th>USDA Texture</th><th>Data Status</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>0.0–0.5</td><td>FIELD TEST REQUIRED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>Clay loam (typ.)</td><td>MODELLED</td></tr>
      <tr><td>2</td><td>0.5–1.0</td><td>FIELD TEST REQUIRED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>…</td><td>MODELLED</td></tr>
      <tr><td>3</td><td>1.0–1.5</td><td>FIELD TEST REQUIRED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>…</td><td>MODELLED</td></tr>
      <tr><td>4</td><td>1.5–2.0</td><td>FIELD TEST REQUIRED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>…</td><td>MODELLED</td></tr>
    </tbody>
  </table>
  <p class="note">LL, PL, PI, MDD, OMC, FSI, UCS, SG, SPT N, soaked CBR and field resistivity remain FIELD TEST REQUIRED. No fabricated zeros.</p>
  <h2>4.1 Depth-wise Soil Profile</h2>
  <table>
    <thead><tr><th>Layer</th><th>Depth Below G.L. (m)</th><th>Material Description</th><th>Data Status</th></tr></thead>
    <tbody>
      <tr><td>Layer I</td><td>0.0–0.5</td><td>Preliminary modelled texture estimate</td><td>MODELLED</td></tr>
      <tr><td>Layer II</td><td>0.5–1.0</td><td>Preliminary modelled texture estimate</td><td>MODELLED</td></tr>
      <tr><td>Layer III</td><td>1.0–1.5</td><td>Preliminary modelled texture estimate</td><td>MODELLED</td></tr>
      <tr><td>Layer IV</td><td>1.5–2.0</td><td>Preliminary modelled texture estimate</td><td>MODELLED</td></tr>
    </tbody>
  </table>
  <div class="footer"><span>Location: Patna, Bihar</span><span>Page —</span></div>
</div>
</body></html>`

const sbc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SBC — Patna</title><style>${css}</style></head><body>
<div class="page">
  <div class="header">TAMS | TRANSMISSION TOWER GEOTECHNICAL INVESTIGATION REPORT</div>
  <h1>6.2 Bearing Capacity Analysis</h1>
  <p>Code reference: IS 6403:1981. Calculation status for this Patna GIS-only sample: <b>INSUFFICIENT_DATA</b>.</p>
  <h2>Input Parameters</h2>
  <div class="mono">Foundation Size (B)        = 1.00 m
Foundation Depth (Df)      = 1.00–2.00 m (screening)
Unit Weight (γ)            = ESTIMATED from SoilGrids bdod (where available)
Angle of Friction (φ)      = ESTIMATED from texture mid-range (where available)
Cohesion (c)               = FIELD TEST REQUIRED (clayey soil — not fabricated)</div>
  <p class="note" style="margin-top:16px">Calculation could not be completed because cohesion for clayey soils is unavailable from GIS. Texture-based indicative SBC ranges are not promoted to CALCULATED net safe bearing capacity.</p>
  <table>
    <thead><tr><th>Depth Df (m)</th><th>Net Safe Bearing Capacity (T/m²)</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>0.5</td><td>INSUFFICIENT DATA</td><td>INSUFFICIENT DATA</td></tr>
      <tr><td>1.0</td><td>INSUFFICIENT DATA</td><td>INSUFFICIENT DATA</td></tr>
      <tr><td>1.5</td><td>INSUFFICIENT DATA</td><td>INSUFFICIENT DATA</td></tr>
      <tr><td>2.0</td><td>INSUFFICIENT DATA</td><td>INSUFFICIENT DATA</td></tr>
    </tbody>
  </table>
  <div class="footer"><span>Location: Patna, Bihar</span><span>Page —</span></div>
</div>
</body></html>`

const pile = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pile — Patna</title><style>${css}</style></head><body>
<div class="page">
  <div class="header">TAMS | TRANSMISSION TOWER GEOTECHNICAL INVESTIGATION REPORT</div>
  <h1>7.1 Pile Foundation — 450 mm Diameter</h1>
  <h2>450 mm dia × 2.0 m depth</h2>
  <div class="mono">Diameter D                 = 0.450 m
Length L                   = 2.000 m
Calculation status         = INSUFFICIENT_DATA</div>
  <p class="note" style="margin-top:14px">Calculation could not be completed because the following field parameters are unavailable:</p>
  <ol>
    <li>LAYER_COHESION_c (clayey soil)</li>
    <li>SPT_N_VALUE (never fabricated)</li>
    <li>TOWER_LATERAL_LOAD / PILE_HEAD_FIXITY (for lateral)</li>
  </ol>
  <table>
    <thead><tr><th>Capacity</th><th>Result</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>Safe vertical</td><td>INSUFFICIENT DATA</td><td>INSUFFICIENT DATA</td></tr>
      <tr><td>Safe uplift</td><td>INSUFFICIENT DATA</td><td>INSUFFICIENT DATA</td></tr>
      <tr><td>Lateral</td><td>FIELD TEST REQUIRED</td><td>FIELD TEST REQUIRED</td></tr>
    </tbody>
  </table>
  <p>C. Lateral Capacity: FIELD TEST REQUIRED — tower lateral loads, head fixity and soil stiffness are not available from GIS.</p>
  <div class="footer"><span>Location: Patna, Bihar</span><span>Page —</span></div>
</div>
</body></html>`

const annex = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Annexure B — Patna</title><style>${css}</style></head><body>
<div class="page">
  <div class="header">TAMS | TRANSMISSION TOWER GEOTECHNICAL INVESTIGATION REPORT</div>
  <h1>ANNEXURE B — Source Data and Provenance</h1>
  <p>Centimetre-scale SoilGrids source bands (not laboratory sample depths). Main report uses 0.0–0.5 / 0.5–1.0 / 1.0–1.5 / 1.5–2.0 m only.</p>
  <table>
    <thead><tr><th>Source depth</th><th>From (m)</th><th>To (m)</th><th>Sand %</th><th>Silt %</th><th>Clay %</th><th>bdod</th><th>pH</th></tr></thead>
    <tbody>
      <tr><td>0-5cm</td><td>0.00</td><td>0.05</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td></tr>
      <tr><td>5-15cm</td><td>0.05</td><td>0.15</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td></tr>
      <tr><td>15-30cm</td><td>0.15</td><td>0.30</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td></tr>
      <tr><td>30-60cm</td><td>0.30</td><td>0.60</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td></tr>
      <tr><td>60-100cm</td><td>0.60</td><td>1.00</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td></tr>
      <tr><td>100-200cm</td><td>1.00</td><td>2.00</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td><td>MODELLED</td></tr>
    </tbody>
  </table>
  <p>Aggregation: thickness-weighted mean of overlapping source layers → engineering metre intervals.</p>
  <p><b>bdod</b> is bulk density (g/cm³) — never soil depth.</p>
  <div class="footer"><span>Location: Patna, Bihar</span><span>Page —</span></div>
</div>
</body></html>`

fs.writeFileSync(path.join(outDir, '01_cover.html'), cover)
fs.writeFileSync(path.join(outDir, '02_soil_summary.html'), soil)
fs.writeFileSync(path.join(outDir, '03_sbc_calculation.html'), sbc)
fs.writeFileSync(path.join(outDir, '04_pile_analysis.html'), pile)
fs.writeFileSync(path.join(outDir, '05_annexure_b.html'), annex)
console.log('Wrote HTML previews to', outDir)
