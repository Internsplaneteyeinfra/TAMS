/**
 * Next.js config — API proxy and public env wiring.
 *
 * Local: browser → NEXT_PUBLIC_API_BASE_URL (/api/v1) → rewrite → BACKEND_URL
 * Production: set NEXT_PUBLIC_API_BASE_URL to the full backend URL if not using the proxy.
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

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
