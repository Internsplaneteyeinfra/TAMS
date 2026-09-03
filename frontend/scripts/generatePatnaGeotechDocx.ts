/**
 * Generate Patna, Bihar sample geotechnical investigation DOCX for review.
 * Run: npx tsx scripts/generatePatnaGeotechDocx.ts
 * Does not touch production scoring.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { parseSoilGridsResponse } from '../src/components/towerSuitability/soilScreening'
import { buildGeotechnicalIntelligence } from '../src/components/towerSuitability/geotech/buildGeotechnicalIntelligence'
import { buildGeotechInvestigationDocx } from '../src/components/towerSuitability/geotech/report/buildGeotechInvestigationDocx'
import type { SiteSignals } from '../src/components/towerSuitability/scoring'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Patna approximate centre */
const PATNA = { lat: 25.5941, lon: 85.1376, label: 'Patna, Bihar' }

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
  // Clay-loam leaning alluvial profile (illustrative modelled means for sample DOC)
  return {
    properties: {
      layers: [
        mk('clay', [320, 340, 360, 350, 300, 280], 10),
        mk('sand', [350, 340, 330, 360, 400, 420], 10),
        mk('silt', [330, 320, 310, 290, 300, 300], 10),
        mk('bdod', [135, 140, 145, 150, 155, 160], 100),
        mk('phh2o', [72, 71, 70, 69, 68, 67], 10),
        mk('cfvo', [40, 50, 55, 60, 70, 80], 10),
        mk('soc', [110, 90, 70, 50, 30, 20], 10),
      ],
    },
  }
}

async function main() {
  const soil = parseSoilGridsResponse(mockSoilGridsJson(), PATNA.lat, PATNA.lon, PATNA.label)
  if (!soil) throw new Error('Failed to parse mock SoilGrids')

  const signals: SiteSignals = {
    lat: PATNA.lat,
    lon: PATNA.lon,
    elevationM: 53,
    slopeDeg: 1.2,
    roadKm: 0.15,
    waterKm: 1.8,
    buildingKm: 0.4,
    towerKm: 2.5,
    substationKm: 4.0,
    windMs: 3.5,
    landCoverHint: 'built',
    placeLabel: PATNA.label,
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
    purpose: 'Construction of Transmission Tower — Patna sample screening',
    reportId: 'TAMS-GEO-PATNA-SAMPLE',
  })

  const outDir = path.resolve(__dirname, '../sample-reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'Geotech_Investigation_Report_Patna_Bihar.docx')
  fs.writeFileSync(outPath, Buffer.from(buf as ArrayBuffer))
  console.log('Wrote', outPath)
  console.log('Classification:', geo.reportClassification)
  console.log('SBC status:', geo.sbcAnalysis.calculationStatus)
  console.log('Pile 450/2.0 status:', geo.pileAnalysis['450mm']['2.0m'].calculationStatus)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
