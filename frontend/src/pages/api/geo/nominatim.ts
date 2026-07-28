import type { NextApiRequest, NextApiResponse } from 'next'

/** Reverse geocode via Nominatim for land-use / place context. */
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

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1&extratags=1`
    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TAMS-TowerSuitability/1.0 (local-dev)',
      },
    })
    if (!upstream.ok) {
      return res.status(502).json({ error: `Nominatim ${upstream.status}` })
    }
    const json = await upstream.json()
    return res.status(200).json(json)
  } catch (e) {
    return res.status(502).json({
      error: e instanceof Error ? e.message : 'Nominatim failed',
    })
  }
}
