/**
 * Generate Tower Suitability Factor Merge Reference — PDF + Word.
 * Usage: node scripts/generateFactorMergeReference.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { execSync } from 'child_process'
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  PageBreak,
} from 'docx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const base = 'Tower_Suitability_Factor_Merge_Reference'
const htmlPath = join(root, 'sample-reports', `${base}.html`)
const pdfPath = join(root, 'sample-reports', `${base}.pdf`)
const docxPath = join(root, 'sample-reports', `${base}.docx`)

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
const borders = { top: thin, bottom: thin, left: thin, right: thin }

function cell(text, bold = false) {
  return new TableCell({
    borders,
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 18 })] })],
  })
}

function headerRow(cols) {
  return new TableRow({
    children: cols.map((c) => cell(c, true)),
    tableHeader: true,
  })
}

function dataRow(cols) {
  return new TableRow({ children: cols.map((c) => cell(c)) })
}

function table(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  })
}

function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } })
}

function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 } })
}

function p(text) {
  return new Paragraph({ children: [new TextRun({ text, size: 20 })], spacing: { after: 100 } })
}

function bullet(text) {
  return new Paragraph({ text: `• ${text}`, spacing: { after: 60 } })
}

function buildDocx() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'TAMS Tower Suitability — Factor Merge Reference',
            heading: HeadingLevel.TITLE,
            spacing: { after: 80 },
          }),
          p('What is merged during Analyze · How 12 scoring factors combine · TAMS open-data screening only'),

          h2('1. Final merge — all 12 factors → one score'),
          p('When you click Analyze, each factor is scored 0–10, then merged into a single site score.'),
          table([
            headerRow(['Formula', 'Detail']),
            dataRow(['Site score (0–10)', 'Σ (factor_score × weight) ÷ Σ weights']),
            dataRow(['Verdict', '≥ 7.0 Preferred · 4.5–7.0 Conditional · < 4.5 Unsuitable']),
          ]),

          h3('All 12 factors in the merge'),
          table([
            headerRow(['#', 'Factor', 'Weight', 'Merge role']),
            dataRow(['1', 'Terrain slope', '22%', 'Shares DEM fetch with #8']),
            dataRow(['2', 'Road access', '14%', 'Standalone (OSRM)']),
            dataRow(['3', 'Water / flood buffer', '14%', 'Feeds #12 corridor check']),
            dataRow(['4', 'Settlement clearance', '10%', 'Feeds #12 corridor check']),
            dataRow(['5', 'Power connectivity', '10%', 'Shares TAMS+OSM with #6, #7']),
            dataRow(['6', 'Voltage suitability', '8%', 'Shares TAMS+OSM with #5, #7']),
            dataRow(['7', 'Connection distance', '8%', 'Shares TAMS+OSM with #5, #6']),
            dataRow(['8', 'Elevation', '8%', 'Shares DEM fetch with #1']),
            dataRow(['9', 'Land cover', '8%', 'Standalone (OSM + Nominatim)']),
            dataRow(['10', 'Soil / SBC', '8%', 'TAMS geotech OR SoilGrids → one factor']),
            dataRow(['11', 'Wind', '6%', 'Standalone (Open-Meteo)']),
            dataRow(['12', 'Corridor feasibility', '6%', 'Merges #1 + #3 + #4 signals']),
          ]),

          new PageBreak(),

          h2('2. Data merges before scoring (collectSiteSignals)'),
          p('During Analyze, live APIs are fetched in parallel, merged into shared signal buckets, then passed to scoreSiteSignals().'),

          h3('A. DEM → 2 factors (#1 Slope + #8 Elevation)'),
          table([
            headerRow(['Source', 'What is merged', 'Feeds factors']),
            dataRow([
              'Open-Meteo Elevation API',
              '5-point grid: centre + N/S/E/W (~133 m). Centre → elevation. Max angle → slope.',
              '#1 Terrain slope · #8 Elevation',
            ]),
          ]),

          h3('B. TAMS GIS + OSM Overpass → 3 factors (#5, #6, #7)'),
          table([
            headerRow(['Source', 'Assets merged', 'Feeds factors']),
            dataRow(['TAMS GIS', 'Towers, substations, transmission lines', '#5 Power connectivity\n#6 Voltage suitability\n#7 Connection distance']),
            dataRow(['OSM Overpass', 'Towers, portals, poles (≤15 km), lines, cables, substations, plants', '(same merge list)']),
          ]),
          bullet('#5 — nearest asset distance + bonuses (pole ≤350 m, tower ≤2 km, substation, interconnect ease)'),
          bullet('#6 — voltage tags from merged assets vs planning tiers (11–765 kV)'),
          bullet('#7 — practical spur = nearest distance × 1.2'),

          h3('C. TAMS Geotech OR SoilGrids → 1 factor (#10)'),
          table([
            headerRow(['Priority', 'Source', 'Rule']),
            dataRow(['1 (preferred)', 'TAMS field geotech within ~5 km', 'Uses adopted SBC, CBR, design depth from /geotech']),
            dataRow(['2 (fallback)', 'ISRIC SoilGrids 2.0', 'Texture class, indicative SBC/CBR, ~40–48% screening confidence']),
          ]),
          p('Only one path is used — field geotech wins when present; otherwise open GIS soil screening.'),

          h3('D. Water + Settlement + Slope → 1 factor (#12)'),
          p('Factor #12 does not fetch new data. It reuses signals already computed for other factors:'),
          table([
            headerRow(['Reused signal', 'From factor', 'Penalty if triggered']),
            dataRow(['Water < 150 m', '#3 Water / flood buffer', '−2']),
            dataRow(['Settlement < 100 m', '#4 Settlement clearance', '−2']),
            dataRow(['Slope > 12°', '#1 Terrain slope', '−1.5']),
            dataRow(['Slope > 18°', '#1 Terrain slope', '−1']),
          ]),
          p('Starts at score 8; deductions applied; capped 0–10.'),

          new PageBreak(),

          h2('3. Standalone factors (no merge with others)'),
          table([
            headerRow(['#', 'Factor', 'Source only']),
            dataRow(['2', 'Road access', 'OSRM nearest drivable road']),
            dataRow(['3', 'Water / flood buffer', 'OSM water features (+ Photon fallback if Overpass fails)']),
            dataRow(['4', 'Settlement clearance', 'OSM buildings/places (+ Photon fallback)']),
            dataRow(['9', 'Land cover', 'OSM landuse/natural + Nominatim fallback']),
            dataRow(['11', 'Wind exposure', 'Open-Meteo 90-day mean daily max wind @ 10 m']),
          ]),

          h2('4. Confidence % — partial merge (not all 12)'),
          p('Confidence counts 7 resolved signals: elevation, slope, road, water, settlement, grid (tower/SS), wind.'),
          p('Not in confidence directly: #6 Voltage · #7 Connection distance · #9 Land cover · #10 Soil · #12 Corridor feasibility'),
          p('Formula: base 55% + up to 25% (resolved ÷ 7 × 25) − 5% per Photon/fallback used.'),

          h2('5. NOT merged into the 12-factor score'),
          table([
            headerRow(['Module', 'Runs at analyze?', 'In /10 score?']),
            dataRow(['Geotechnical Intelligence (GEO-1 Word/HTML report)', 'Yes', 'No — outside scoreSiteSignals']),
            dataRow(['Corridor placement panel (Suggest/Shift/Skip/Review)', 'Yes (KML/line)', 'No — separate CEA span screening']),
            dataRow(['Power network verdict (Yes/No/Unknown)', 'Yes', 'No — informational only']),
            dataRow(['OSRM road route overlay (orange line)', 'On demand', 'No — display only']),
          ]),

          h2('6. Quick reference — merge groups'),
          table([
            headerRow(['Merge group', 'Factors affected', 'Shared data']),
            dataRow(['DEM group', '#1, #8', 'Open-Meteo 5-point elevation grid']),
            dataRow(['Power group', '#5, #6, #7', 'TAMS + OSM deduped nearbyPower']),
            dataRow(['Soil group', '#10', 'TAMS geotech OR SoilGrids (one path)']),
            dataRow(['Corridor group', '#12 (uses #1, #3, #4)', 'Water km + building km + slope °']),
            dataRow(['Final score', 'All #1–#12', 'Weighted average → verdict']),
          ]),

          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: 'This document describes how TAMS Tower Suitability merges open-data signals during Analyze. Screening logic only — not utility approval, ROW certification, or foundation design.',
                italics: true,
                size: 18,
                color: '64748B',
              }),
            ],
          }),
        ],
      },
    ],
  })
  return doc
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p)) ?? null
}

function generatePdf() {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome/Edge not found for PDF generation')
  const uri = pathToFileURL(htmlPath).href
  execSync(
    `"${chrome}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${uri}"`,
    { stdio: 'inherit' }
  )
}

async function main() {
  readFileSync(htmlPath, 'utf8')

  console.log('[merge-ref] Building Word document…')
  const buffer = await Packer.toBuffer(buildDocx())
  writeFileSync(docxPath, buffer)
  console.log(`[merge-ref] Wrote ${docxPath}`)

  console.log('[merge-ref] Building PDF…')
  generatePdf()
  console.log(`[merge-ref] Wrote ${pdfPath}`)
}

main().catch((err) => {
  console.error('[merge-ref] Failed:', err.message)
  process.exit(1)
})
