import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Same-origin proxy for Google satellite tiles so the 3D globe can
 * stitch a clear Earth that matches the Leaflet map.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const z = Number(req.query.z)
  const x = Number(req.query.x)
  const y = Number(req.query.y)
  const n = 2 ** z
  if (!Number.isInteger(z) || z < 0 || z > 5 || !Number.isInteger(x) || !Number.isInteger(y)) {
    return res.status(400).end('bad tile')
  }
  if (x < 0 || y < 0 || x >= n || y >= n) {
    return res.status(400).end('out of range')
  }

  try {
    const url = `https://mt${x % 4}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'TAMS-TowerSuitability/1.0',
        Accept: 'image/jpeg,image/png,image/*',
      },
    })
    if (!upstream.ok) {
      return res.status(502).end('tile fetch failed')
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
    return res.status(200).send(buf)
  } catch {
    return res.status(502).end('tile fetch failed')
  }
}
