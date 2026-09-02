/**
 * Generate Nirona, Bhuj, Gujarat sample geotech DOCX (Transmission-line format).
 * Run: npx tsx scripts/generateNironaGeotechDocx.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { parseSoilGridsResponse } from '../src/components/towerSuitability/soilScreening'
import { buildGeotechnicalIntelligence } from '../src/components/towerSuitability/geotech/buildGeotechnicalIntelligence'
import { buildGeotechInvestigationDocx } from '../src/components/towerSuitability/geotech/report/buildGeotechInvestigationDocx'
import type { SiteSignals } from '../src/components/towerSuitability/scoring'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Location 1 — Nirona, Bhuj, Gujarat (from Transmission line reference) */
const NIRONA = {
  lat: 23.446103, // 23°26'45.97"N
  lon: 69.599508, // 69°35'58.23"E
  label: 'Nirona, Bhuj, Gujarat',
}

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
  // Kutch arid / sandy-clay profile shaped means for sample (MODELLED illustration)
  return {
    properties: {
      layers: [
        mk('clay', [280, 260, 230, 180, 120, 60], 10),
        mk('sand', [300, 320, 380, 430, 480, 520], 10),
        mk('silt', [380, 360, 300, 250, 180, 120], 10),
        mk('bdod', [145, 150, 155, 165, 175, 185], 100),
        mk('phh2o', [78, 77, 76, 75, 74, 73], 10),
        mk('cfvo', [40, 60, 100, 150, 220, 280], 10),
        mk('soc', [80, 60, 45, 30, 20, 12], 10),
      ],
    },
  }
}

async function main() {
  const soil = parseSoilGridsResponse(mockSoilGridsJson(), NIRONA.lat, NIRONA.lon, NIRONA.label)
  if (!soil) throw new Error('Failed to parse mock SoilGrids')

  const signals: SiteSignals = {
    lat: NIRONA.lat,
    lon: NIRONA.lon,
    elevationM: 95,
    slopeDeg: 1.5,
    roadKm: 0.4,
    waterKm: 3.2,
    buildingKm: 1.1,
    towerKm: 5.0,
    substationKm: 8.0,
    windMs: 4.2,
    landCoverHint: 'barren',
    placeLabel: NIRONA.label,
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
    purpose: 'Construction of Transmission Tower — Nirona, Bhuj screening',
    reportId: 'TAMS-GEO-NIRONA-SAMPLE',
  })

  const outDir = path.resolve(__dirname, '../sample-reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'Geotech_Investigation_Report_Nirona_Bhuj_Gujarat.docx')
  fs.writeFileSync(outPath, Buffer.from(buf as unknown as ArrayBuffer))
  console.log('Wrote', outPath)
  console.log(
    'Soil 0-0.5m sand/silt/clay:',
    geo.soilProfile[0].sandPct.value,
    geo.soilProfile[0].siltPct.value,
    geo.soilProfile[0].clayPct.value
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
