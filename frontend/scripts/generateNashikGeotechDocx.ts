/**
 * Generate Nashik, Maharashtra sample geotechnical investigation DOCX.
 * Run: npx tsx scripts/generateNashikGeotechDocx.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { parseSoilGridsResponse } from '../src/components/towerSuitability/soilScreening'
import { buildGeotechnicalIntelligence } from '../src/components/towerSuitability/geotech/buildGeotechnicalIntelligence'
import { buildGeotechInvestigationDocx } from '../src/components/towerSuitability/geotech/report/buildGeotechInvestigationDocx'
import type { SiteSignals } from '../src/components/towerSuitability/scoring'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Nashik approximate centre */
const NASHIK = { lat: 19.9975, lon: 73.7898, label: 'Nashik, Maharashtra' }

function mockSoilGridsJson() {
  const depths = ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm']
  const mk = (name: string, values: number[], dFactor: number) => ({
    name,
    unit_measure: { d_factor: dFactor },
    depths: depths.map((label, i) => ({
      label,
      values: { mean: values[i] },
    })),
  })
  // Clay-dominated profile typical of Nashik screening (modelled means)
  return {
    properties: {
      layers: [
        mk('clay', [430, 440, 435, 420, 400, 380], 10),
        mk('sand', [250, 240, 245, 260, 280, 300], 10),
        mk('silt', [320, 320, 320, 320, 320, 320], 10),
        mk('bdod', [128, 132, 136, 140, 145, 150], 100),
        mk('phh2o', [68, 67, 66, 65, 64, 63], 10),
        mk('cfvo', [30, 35, 40, 45, 50, 55], 10),
        mk('soc', [90, 75, 60, 45, 30, 20], 10),
      ],
    },
  }
}

async function main() {
  const soil = parseSoilGridsResponse(mockSoilGridsJson(), NASHIK.lat, NASHIK.lon, NASHIK.label)
  if (!soil) throw new Error('Failed to parse mock SoilGrids')

  const signals: SiteSignals = {
    lat: NASHIK.lat,
    lon: NASHIK.lon,
    elevationM: 560,
    slopeDeg: 2.1,
    roadKm: 0.42,
    waterKm: 2.1,
    buildingKm: 0.8,
    towerKm: 1.2,
    substationKm: 3.5,
    windMs: 4.2,
    landCoverHint: 'cropland',
    placeLabel: NASHIK.label,
    soilScreening: soil,
    geotech: null,
    liveOk: {
      dem: true,
      road: true,
      water: true,
      settlement: true,
      grid: true,
      wind: true,
      landcover: true,
      soilScreening: true,
    },
  }

  const geo = buildGeotechnicalIntelligence(signals)
  const buf = await buildGeotechInvestigationDocx({
    geo,
    projectName: 'Transmission line',
    clientName: 'TAMS Tower Suitability',
    preparedFor: 'TAMS Tower Suitability',
    consultant: 'Planeteye Infra AI',
    purpose: 'Construction of Transmission Tower — Nashik preliminary GIS screening',
    reportId: 'TAMS-GEO-NASHIK-SAMPLE',
  })

  const outDir = path.resolve(__dirname, '../sample-reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'Geotech_Investigation_Report_Nashik_Maharashtra.docx')
  fs.writeFileSync(outPath, Buffer.from(buf as ArrayBuffer))
  console.log('Wrote', outPath)
  console.log('Texture:', soil.textureClass)
  console.log('Screening SBC:', soil.indicativeSbcTm2)
  console.log('SBC status:', geo.sbcAnalysis.calculationStatus)
  console.log('Data readiness:', geo.reportReadiness.completionPercentage + '%')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
