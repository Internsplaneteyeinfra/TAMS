/**
 * Open-source soil screening proxy (ISRIC SoilGrids 250 m).
 * Screening only — not a borehole / lab certificate.
 *
 * Fetches properties in parallel batches (ISRIC often stalls on one huge query).
 * Depths include 60–100 cm and 100–200 cm for GEO engineering intervals.
 * Property `soc` = soil organic carbon (g/kg after d_factor).
 * Property `bdod` = bulk density ONLY — never soil depth.
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    // SoilGrids upstream can be slow; allow enough room for parallel batches.
    responseLimit: false,
  },
}

const PROPS_TEXTURE = ['clay', 'sand', 'silt'] as const
const PROPS_PHYSICAL = ['bdod', 'phh2o', 'cfvo', 'soc'] as const
const DEPTHS = ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm'] as const

type SoilGridsLayer = {
  name?: string
  unit_measure?: unknown
  depths?: unknown[]
}

type SoilGridsFeature = {
  type?: string
  geometry?: unknown
  properties?: { layers?: SoilGridsLayer[] }
}

async function fetchSoilBatch(
  lat: number,
  lon: number,
  properties: readonly string[],
  signal: AbortSignal
): Promise<SoilGridsFeature> {
  const qs = new URLSearchParams()
  qs.set('lat', String(lat))
  qs.set('lon', String(lon))
  for (const p of properties) qs.append('property', p)
  for (const d of DEPTHS) qs.append('depth', d)
  qs.append('value', 'mean')

  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?${qs.toString()}`
  const upstream = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'TAMS-TowerSuitability/1.0 (local-dev; soil-screening)',
    },
  })
  if (!upstream.ok) {
    throw new Error(`SoilGrids ${upstream.status}`)
  }
  return (await upstream.json()) as SoilGridsFeature
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const lat = Number(req.query.lat)
  const lon = Number(req.query.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat/lon required' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 28_000)

  try {
    const batches = await Promise.allSettled([
      fetchSoilBatch(lat, lon, PROPS_TEXTURE, controller.signal),
      fetchSoilBatch(lat, lon, PROPS_PHYSICAL, controller.signal),
    ])

    const layers: SoilGridsLayer[] = []
    let geometry: unknown
    let type = 'Feature'
    let textureOk = false

    for (const batch of batches) {
      if (batch.status !== 'fulfilled') continue
      const feature = batch.value
      if (feature.geometry) geometry = feature.geometry
      if (feature.type) type = feature.type
      const batchLayers = feature.properties?.layers
      if (!Array.isArray(batchLayers)) continue
      for (const layer of batchLayers) {
        if (!layer?.name) continue
        layers.push(layer)
        if (PROPS_TEXTURE.includes(layer.name as (typeof PROPS_TEXTURE)[number])) {
          textureOk = true
        }
      }
    }

    if (!textureOk || layers.length === 0) {
      const firstErr = batches.find((b) => b.status === 'rejected') as PromiseRejectedResult | undefined
      const detail =
        firstErr?.reason instanceof Error
          ? firstErr.reason.message
          : firstErr?.reason
            ? String(firstErr.reason)
            : 'No SoilGrids texture layers'
      return res.status(502).json({ error: detail })
    }

    return res.status(200).json({
      type,
      geometry: geometry ?? { type: 'Point', coordinates: [lon, lat] },
      properties: { layers },
    })
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return res.status(502).json({
      error: aborted
        ? 'SoilGrids timed out'
        : e instanceof Error
          ? e.message
          : 'SoilGrids failed',
    })
  } finally {
    clearTimeout(timer)
  }
}
