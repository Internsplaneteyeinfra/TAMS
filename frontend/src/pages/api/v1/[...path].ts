import type { NextApiRequest, NextApiResponse } from 'next'
import http from 'http'
import https from 'https'
import { URL } from 'url'

const { resolveBackendOrigin } = require('../../../../lib/resolveBackendUrl') as {
  resolveBackendOrigin: (hostHeader?: string) => string
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
])

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : []
  const searchIndex = req.url?.indexOf('?') ?? -1
  const search = searchIndex >= 0 ? req.url!.slice(searchIndex) : ''
  const origin = resolveBackendOrigin(req.headers.host)
  const target = `${origin}/api/v1/${pathParts.join('/')}${search}`

  let url: URL
  try {
    url = new URL(target)
  } catch {
    res.status(500).json({ error: 'Invalid backend URL', target })
    return
  }

  const lib = url.protocol === 'https:' ? https : http
  const headers: http.OutgoingHttpHeaders = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP.has(key.toLowerCase())) continue
    headers[key] = value
  }

  const proxyReq = lib.request(
    {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: req.method,
      headers,
      timeout: 120_000,
    },
    (proxyRes) => {
      const outHeaders = { ...proxyRes.headers }
      delete outHeaders['transfer-encoding']
      res.writeHead(proxyRes.statusCode || 502, outHeaders)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('timeout', () => {
    proxyReq.destroy()
  })

  proxyReq.on('error', (err) => {
    if (res.headersSent) {
      res.end()
      return
    }
    res.status(502).json({
      error: 'Backend unreachable',
      detail: err.message,
      target: origin,
    })
  })

  req.pipe(proxyReq)
}
