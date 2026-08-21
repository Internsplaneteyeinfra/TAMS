import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Open-source soil screening proxy (ISRIC SoilGrids 250 m).
 * Screening only — not a borehole / lab certificate.
 */
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

  const props = ['clay', 'sand', 'silt', 'bdod', 'phh2o', 'cfvo']
  const depths = ['0-5cm', '5-15cm', '15-30cm', '30-60cm']
  const qs = new URLSearchParams()
  qs.set('lat', String(lat))
  qs.set('lon', String(lon))
  for (const p of props) qs.append('property', p)
  for (const d of depths) qs.append('depth', d)
  qs.append('value', 'mean')

  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?${qs.toString()}`

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TAMS-TowerSuitability/1.0 (local-dev; soil-screening)',
      },
    })
    if (!upstream.ok) {
      return res.status(502).json({ error: `SoilGrids ${upstream.status}` })
    }
    const json = await upstream.json()
    return res.status(200).json(json)
  } catch (e) {
    return res.status(502).json({
      error: e instanceof Error ? e.message : 'SoilGrids failed',
    })
  }
}
