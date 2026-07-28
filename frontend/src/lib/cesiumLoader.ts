/**
 * Shared Cesium script loader (local /cesium first, then CDN).
 * Avoids Next.js webpack bundling of Cesium.
 */

const CESIUM_VERSION = '1.142.0'

const CESIUM_SOURCES = [
  '/cesium/',
  `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`,
  `https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium/`,
]

export type CesiumModule = typeof import('cesium')

let cesiumLoader: Promise<CesiumModule> | null = null

function ensureTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}

function loadScript(base: string): Promise<CesiumModule> {
  const CESIUM_BASE = ensureTrailingSlash(base)
  const win = window as Window & { CESIUM_BASE_URL?: string; Cesium?: CesiumModule }

  if (win.Cesium) {
    return Promise.resolve(win.Cesium)
  }

  win.CESIUM_BASE_URL = CESIUM_BASE

  const cssHref = `${CESIUM_BASE}Widgets/widgets.css`
  if (!document.querySelector(`link[data-cesium-widgets="${cssHref}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = cssHref
    link.setAttribute('data-cesium-widgets', cssHref)
    document.head.appendChild(link)
  }

  const existing = document.querySelector(`script[data-cesium-src="${CESIUM_BASE}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        if (win.Cesium) resolve(win.Cesium)
        else reject(new Error('Cesium global missing after script load'))
      })
      existing.addEventListener('error', () => reject(new Error(`Failed: ${CESIUM_BASE}`)))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${CESIUM_BASE}Cesium.js`
    script.async = true
    script.setAttribute('data-cesium-src', CESIUM_BASE)
    script.onload = () => {
      if (win.Cesium) resolve(win.Cesium)
      else reject(new Error('Cesium global missing after script load'))
    }
    script.onerror = () => {
      script.remove()
      reject(new Error(`Could not load Cesium from ${CESIUM_BASE}`))
    }
    document.head.appendChild(script)
  })
}

export async function loadCesium(): Promise<CesiumModule> {
  if (typeof window === 'undefined') {
    throw new Error('Cesium requires browser environment')
  }

  const win = window as Window & { Cesium?: CesiumModule }
  if (win.Cesium) {
    return win.Cesium
  }

  if (!cesiumLoader) {
    cesiumLoader = (async () => {
      const errors: string[] = []
      for (const source of CESIUM_SOURCES) {
        try {
          return await loadScript(source)
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }
      throw new Error(errors.join(' | '))
    })()
  }

  return cesiumLoader
}
