/**
 * Generate Tower Suitability Numbered Analysis Reference — PDF + Word.
 * Usage: node scripts/generateNumberedAnalysisReference.mjs
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
const base = 'Tower_Suitability_Numbered_Analysis_Reference'
const htmlPath = join(root, 'sample-reports', `${base}.html`)
const pdfPath = join(root, 'sample-reports', `${base}.pdf`)
const docxPath = join(root, 'sample-reports', `${base}.docx`)

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
const borders = { top: thin, bottom: thin, left: thin, right: thin }

function cell(text, bold = false) {
  return new TableCell({
    borders,
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold, size: 18 })] })],
  })
}

function headerRow(cols) {
  return new TableRow({ children: cols.map((c) => cell(c, true)), tableHeader: true })
}

function dataRow(cols) {
  return new TableRow({ children: cols.map((c) => cell(c)) })
}

function table(rows) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
}

function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 } })
}

function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 60 } })
}

function p(text) {
  return new Paragraph({ children: [new TextRun({ text, size: 20 })], spacing: { after: 80 } })
}

function bullets(items) {
  return items.map((t) => new Paragraph({ text: `• ${t}`, spacing: { after: 40 } }))
}

const FACTORS = [
  {
    n: 1,
    title: 'Terrain slope',
    weight: '22%',
    see: [
      'Factor bar labelled Terrain slope with score 0–10',
      'Value line: e.g. 8.4° or n/a',
      'Note if steep: pad grading / retention likely costly',
      'Source tag: Live · Open-Meteo DEM',
    ],
    fetch: [
      'Open-Meteo Elevation API → Copernicus DEM ~30 m',
      '5 sample points: centre + N/S/E/W at 0.0012° (~133 m)',
    ],
    calc: [
      'For each offset: run distance (m), rise = |elev offset − centre|',
      'Angle = atan(rise/run) × 180/π',
      'Output slope = maximum angle among 4 directions',
    ],
    scoreRows: [
      ['≤ 5°', '10 (best)'],
      ['≥ 18°', '0 (worst)'],
      ['Between', 'Linear interpolation'],
      ['Missing', '5 neutral'],
    ],
    contrib: 'Contrib = factor score × 0.22',
  },
  {
    n: 2,
    title: 'Road access',
    weight: '14%',
    see: [
      'Factor bar: Road access',
      'Value: e.g. 1.24 km or live lookup failed',
      'Map: orange marker at nearest road snap',
      'Source: Live · OSRM nearest road',
    ],
    fetch: ['OSRM Nearest API — snap pad to drivable OSM road'],
    calc: [
      'Road distance (km) = OSRM waypoint distance ÷ 1000',
      'Fallback: Haversine pad → snap if OSRM distance missing',
    ],
    scoreRows: [
      ['≤ 0.5 km', '10'],
      ['≥ 8 km', '0'],
      ['Lookup failed', '3 uncertain'],
    ],
    contrib: 'Contrib = factor score × 0.14',
  },
  {
    n: 3,
    title: 'Water / flood buffer',
    weight: '14%',
    see: [
      'Factor bar: Water / flood buffer',
      'Value: e.g. 2.15 km, > 8 km, or fallback warning',
      'Source: Live · OSM Overpass or Fallback · Photon',
    ],
    fetch: [
      'OSM Overpass 8 km: water, waterway, reservoir, basin',
      'Fallback: Photon lake/river/reservoir — confidence −5%',
    ],
    calc: ['Nearest water distance (km) via Haversine', 'Cap at 8 km for scoring'],
    scoreRows: [
      ['≥ 0.8 km', '10 far = good'],
      ['≤ 0.05 km', '0 flood risk'],
      ['Missing', '5 neutral'],
    ],
    contrib: 'Contrib = score × 0.14 · Reused in #12',
  },
  {
    n: 4,
    title: 'Settlement clearance',
    weight: '10%',
    see: ['Factor bar + value e.g. 1.80 km or > 4 km', 'Note if close to buildings'],
    fetch: ['OSM Overpass 4 km: buildings, places, residential', 'Photon fallback if Overpass fails'],
    calc: ['Nearest settlement distance (km)', 'Cap at 4 km for scoring'],
    scoreRows: [
      ['≥ 0.25 km', '10'],
      ['≤ 0.02 km', '0'],
      ['Missing', '6'],
    ],
    contrib: 'Contrib = score × 0.10 · Reused in #12',
  },
  {
    n: 5,
    title: 'Power connectivity',
    weight: '10%',
    see: [
      'Value: Tower/Line name · distance km',
      'Power panel: nearest assets list',
      'Map: grid markers, connection lines',
    ],
    fetch: [
      'TAMS GIS: towers, SS, lines',
      'OSM: tower, portal, pole, line, cable, SS, plant',
      'Deduped into nearbyPower list',
    ],
    calc: [
      'Haversine distances; pick nearest asset',
      'Interconnect ease: ≤0.25/2/12 km thresholds',
    ],
    scoreRows: [
      ['Base', '0.2 km→10, 20 km→0 linear'],
      ['Bonuses', 'Pole +2, tower +1.2, SS +0.8, easy +0.5'],
      ['No data', '5 neutral'],
    ],
    contrib: 'Contrib = score × 0.10 · Shares data with #6, #7',
  },
  {
    n: 6,
    title: 'Voltage suitability',
    weight: '8%',
    see: ['Value: e.g. 220 kV, 33/110 kV, unknown', 'Controls: selected line class kV'],
    fetch: ['Voltage tags from merged power list (#5)', 'Tiers: 11–765 kV'],
    calc: ['Available kV set', 'Suggested kV from corridor → tower → line → SS'],
    scoreRows: [
      ['Tagged + HV ≥33 kV', '~9'],
      ['Tagged present', '~7'],
      ['No tags', '5 neutral'],
    ],
    contrib: 'Contrib = score × 0.08',
  },
  {
    n: 7,
    title: 'Connection distance',
    weight: '8%',
    see: ['Value: ~480 m or ~3.2 km', 'Asset card: straight m + road route m'],
    fetch: ['Nearest asset from power merge (#5)'],
    calc: ['Direct Haversine (km)', 'Practical spur = direct × 1.2'],
    scoreRows: [
      ['≤ 0.3 km', '10'],
      ['≥ 15 km', '0'],
      ['Unavailable', '5'],
    ],
    contrib: 'Contrib = score × 0.08',
  },
  {
    n: 8,
    title: 'Elevation',
    weight: '8%',
    see: ['Value: e.g. 342 m AMSL', 'Same DEM as #1'],
    fetch: ['Centre elevation from Open-Meteo 5-point grid'],
    calc: ['Elevation at pad centre (m)'],
    scoreRows: [
      ['20–800 m', '9'],
      ['< 5 m', '3'],
      ['> 1800 m', '4'],
      ['Other/missing', '7'],
    ],
    contrib: 'Contrib = score × 0.08',
  },
  {
    n: 9,
    title: 'Land cover hint',
    weight: '8%',
    see: ['Value: Barren / Vegetated / Built-up / Water / Unknown'],
    fetch: ['OSM landuse/natural 180 m', 'Nominatim fallback'],
    calc: ['5-class keyword classification'],
    scoreRows: [
      ['Barren', '9'],
      ['Vegetated', '5'],
      ['Built-up', '2'],
      ['Water', '0'],
      ['Unknown', '6'],
    ],
    contrib: 'Contrib = score × 0.08',
  },
  {
    n: 10,
    title: 'Soil / SBC',
    weight: '8%',
    see: [
      'Value: Loam · ~45% or GT-001 · 2.1 km',
      'GeoTech tab: Word report, soil tables',
    ],
    fetch: ['Path A: TAMS geotech ≤5 km', 'Path B: ISRIC SoilGrids 2.0'],
    calc: [
      'Path A: score from adopted SBC, CBR',
      'Path B: texture, indicative SBC, confidence%',
      'GeoTech report calcs outside /10 score',
    ],
    scoreRows: [
      ['Field SBC ≥20', '9'],
      ['Field SBC ≥12', '7'],
      ['SoilGrids only', 'max(5, conf%÷10)'],
      ['Neither', '5'],
    ],
    contrib: 'Contrib = score × 0.08',
  },
  {
    n: 11,
    title: 'Wind exposure',
    weight: '6%',
    see: ['Value: e.g. 6.2 m/s'],
    fetch: ['Open-Meteo 90-day daily max wind @ 10 m'],
    calc: ['Mean of daily max wind (m/s)'],
    scoreRows: [
      ['≤ 4 m/s', '10'],
      ['≥ 12 m/s', '0'],
      ['Missing', '6'],
    ],
    contrib: 'Contrib = score × 0.06',
  },
  {
    n: 12,
    title: 'Corridor feasibility',
    weight: '6%',
    see: ['Value: obstruction list or No major obstruction', 'Reuses #1, #3, #4 — no new fetch'],
    fetch: ['Reuses water km, building km, slope°'],
    calc: ['Start at 8, apply penalties, clamp 0–10'],
    scoreRows: [
      ['Water <150 m', '−2'],
      ['Settlement <100 m', '−2'],
      ['Slope >12°', '−1.5'],
      ['Slope >18°', '−1'],
    ],
    contrib: 'Contrib = score × 0.06',
  },
]

function factorSection(f) {
  const children = [
    h2(`${f.n}. ${f.title} (Weight ${f.weight})`),
    h3(`${f.n}.1 What you see`),
    ...bullets(f.see),
    h3(`${f.n}.2 What we fetch`),
    ...bullets(f.fetch),
    h3(`${f.n}.3 What we calculate`),
    ...bullets(f.calc),
    h3(`${f.n}.4 Score calculation`),
    table([headerRow(['Condition', 'Score']), ...f.scoreRows.map((r) => dataRow(r))]),
    h3(`${f.n}.5 Contribution to final score`),
    p(f.contrib),
  ]
  if (f.n === 6 || f.n === 9) children.push(new PageBreak())
  return children
}

function buildDocx() {
  const children = [
    new Paragraph({
      text: 'TAMS Tower Suitability — Numbered Analysis Reference',
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
    }),
    p('What you see · What we fetch · What we calculate · Factors 1–12 with sub-points'),

    h2('0. When you click Analyze — overall flow'),
    table([
      headerRow(['Step', 'What you see', 'What we calculate']),
      dataRow(['0.1', 'Progress bar: DEM, OSM, roads, weather, soil', 'Parallel API fetch at focus point']),
      dataRow(['0.2', 'Map: pad, road snap, grid assets, shift ghosts', 'Distances, OSRM, TAMS+OSM merge']),
      dataRow(['0.3', 'Score card: X.X/10 · verdict · confidence %', 'Weighted average of 12 factors']),
      dataRow(['0.4', 'Factors panel: 12 bars + values', 'Each factor 0–10']),
      dataRow(['0.5', 'Breakdown table: Value·Score·Weight·Contrib', 'Contrib = score × weight']),
      dataRow(['0.6', 'GeoTech tab: Word report', 'Separate — NOT in /10']),
      dataRow(['0.7', 'Corridor: Suggest/Shift/Skip/Review', 'CEA spans — NOT in /10']),
    ]),
    new PageBreak(),
  ]

  for (const f of FACTORS) {
    children.push(...factorSection(f))
  }

  children.push(
    new PageBreak(),
    h2('13. Final score merge (all 12 factors)'),
    h3('13.1 What you see'),
    ...bullets(['Header X.X/10', 'Verdict: Preferred / Conditional / Unsuitable', 'Confidence %']),
    h3('13.2 What we calculate'),
    table([
      headerRow(['Output', 'Formula']),
      dataRow(['Final score', 'Σ(factor_score × weight) ÷ Σ weights']),
      dataRow(['Verdict', '≥7 Preferred · 4.5–7 Conditional · <4.5 Unsuitable']),
    ]),

    h2('14. Confidence % (7 signals, not all 12)'),
    ...bullets([
      'Counts: elevation, slope, road, water, settlement, grid, wind',
      'Base 55% + (resolved÷7)×25% − 5% per fallback',
      'NOT counted: voltage, connection, land cover, soil, corridor',
    ]),

    h2('15. Separate from /10 score'),
    table([
      headerRow(['#', 'Module', 'What you see', 'What we calculate']),
      dataRow(['15.1', 'GeoTech Word report', 'Soil tables, SBC/pile download', 'IS 6403/2911 — outside score']),
      dataRow(['15.2', 'Corridor T1…Tn', 'Suggest/Shift/Skip/Review', 'CEA span bands']),
      dataRow(['15.3', 'Power take-off', 'Best pad → SS', 'Haversine + ease']),
      dataRow(['15.4', 'Road route overlay', 'Orange polyline', 'OSRM display only']),
      dataRow(['15.5', 'Shift ghosts', 'Suggested offset pads', 'Spacing shift rules']),
    ]),

    h2('16. Merge groups — quick lookup'),
    table([
      headerRow(['Group', 'Factors', 'Shared fetch']),
      dataRow(['DEM', '#1 + #8', 'Open-Meteo 5-point elevation']),
      dataRow(['Power', '#5 + #6 + #7', 'TAMS + OSM nearbyPower']),
      dataRow(['Soil', '#10', 'TAMS geotech OR SoilGrids']),
      dataRow(['Corridor', '#12 uses #1+#3+#4', 'Reused distances/slope']),
      dataRow(['Final', 'All #1–#12', 'Weighted average']),
    ]),

    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: 'Open-data screening only. Not utility approval or foundation design.',
          italics: true,
          size: 18,
          color: '64748B',
        }),
      ],
    })
  )

  return new Document({ sections: [{ children }] })
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p)) ?? null
}

function generatePdf() {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome/Edge not found for PDF generation')
  execSync(
    `"${chrome}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${pathToFileURL(htmlPath).href}"`,
    { stdio: 'inherit' }
  )
}

async function main() {
  readFileSync(htmlPath, 'utf8')
  console.log('[numbered-ref] Building Word…')
  writeFileSync(docxPath, await Packer.toBuffer(buildDocx()))
  console.log(`[numbered-ref] Wrote ${docxPath}`)
  console.log('[numbered-ref] Building PDF…')
  generatePdf()
  console.log(`[numbered-ref] Wrote ${pdfPath}`)
}

main().catch((e) => {
  console.error('[numbered-ref] Failed:', e.message)
  process.exit(1)
})
