/**
 * Next.js config — API proxy and public env wiring.
 *
 * Local: browser → NEXT_PUBLIC_API_BASE_URL (/api/v1) → rewrite → BACKEND_URL
 * Render site: https://tams-txmr.onrender.com
 * Set BACKEND_URL to the Railway API (https://….up.railway.app)
 * and NEXT_PUBLIC_HOSTED_API_BASE_URL to https://….up.railway.app/api/v1
 * so the browser can reach the API even if the Next rewrite fails.
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.BACKEND_URL || process.env.BACKEND_URL.includes('127.0.0.1'))
) {
  console.warn(
    '[tams] BACKEND_URL is unset or local. On Render, set BACKEND_URL to your Railway https://….up.railway.app or data will not load via /api proxy.'
  )
}

const config = {
  reactStrictMode: true,
  swcMinify: true,
  // Allow opening the app via LAN IP (e.g. http://192.168.42.111:3000)
  allowedDevOrigins: ['192.168.42.111', '127.0.0.1', 'localhost'],
  transpilePackages: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
    NEXT_PUBLIC_HOSTED_API_BASE_URL: process.env.NEXT_PUBLIC_HOSTED_API_BASE_URL || '',
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '',
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
    NEXT_PUBLIC_MAPBOX_STYLE_ID: process.env.NEXT_PUBLIC_MAPBOX_STYLE_ID || '',
    NEXT_PUBLIC_IMAGERY_TILE_URL: process.env.NEXT_PUBLIC_IMAGERY_TILE_URL || '',
    NEXT_PUBLIC_CESIUM_ION_TOKEN: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || '',
    NEXT_PUBLIC_CESIUM_ASSET_BASE_URL: process.env.NEXT_PUBLIC_CESIUM_ASSET_BASE_URL || '/cesium/',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'TAMS Platform',
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  },
}

module.exports = config
