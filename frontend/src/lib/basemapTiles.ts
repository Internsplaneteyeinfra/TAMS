/**
 * High-quality basemap tile URLs for Leaflet + Cesium.
 * Do NOT use Esri World Imagery — it shows "Map data not yet available"
 * when zoomed in over many India locations.
 *
 * Bump IMAGERY_REVISION when providers change so Leaflet remounts tiles (HMR-safe).
 */

export const IMAGERY_REVISION = 'google-eox-v4'

export type BasemapKind = 'satellite' | 'satellite-labels' | 'street' | 'terrain'

/** Leaflet Google satellite (subdomains 0–3). */
export const GOOGLE_SATELLITE_URL =
  'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'

export const GOOGLE_HYBRID_URL =
  'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'

export const GOOGLE_LABELS_URL =
  'https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'

export const GOOGLE_TERRAIN_URL =
  'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'

export const GOOGLE_STREET_URL =
  'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'

export const OSM_STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Sentinel-2 cloudless (EOX) — backup under Google; no Esri blanks. */
export const EOX_SENTINEL_URL =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'

export const CESIUM_GOOGLE_SATELLITE_URL =
  'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'

export const CESIUM_EOX_SENTINEL_URL =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'

export const GOOGLE_SUBDOMAINS = ['0', '1', '2', '3'] as const

export const HIGH_ZOOM = {
  maxZoom: 22,
  maxNativeZoom: 21,
} as const
