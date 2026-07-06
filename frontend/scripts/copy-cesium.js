/**
 * Copy Cesium Build/Cesium assets into public/cesium for local 3D globe loading.
 */
const fs = require('fs')
const path = require('path')

function findCesiumBuildDir() {
  const candidates = [
    path.join(__dirname, '../node_modules/cesium/Build/Cesium'),
    path.join(__dirname, '../../node_modules/cesium/Build/Cesium'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'Cesium.js'))) {
      return candidate
    }
  }
  return null
}

const src = findCesiumBuildDir()
const dest = path.join(__dirname, '../public/cesium')

if (!src) {
  console.warn('[copy-cesium] cesium package not found — 3D map will use CDN fallback')
  process.exit(0)
}

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
console.log(`[copy-cesium] Copied Cesium assets to public/cesium`)
