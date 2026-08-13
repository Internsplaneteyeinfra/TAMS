/**
 * Honest catalog: what is live open data vs planning standards vs not available.
 * We never label planning estimates as "live satellite".
 */

export type DataKind = 'live' | 'planning' | 'visual' | 'unavailable'

export interface DataSourceEntry {
  id: string
  label: string
  kind: DataKind
  provider: string
  whatYouSee: string
  limits: string
}

/** Signals used in suitability scoring — fetched at analyze time. */
export const SUITABILITY_LIVE_SOURCES: DataSourceEntry[] = [
  {
    id: 'dem',
    label: 'Elevation & slope',
    kind: 'live',
    provider: 'Open-Meteo Elevation API (Copernicus DEM ~30 m)',
    whatYouSee: 'Pad height (m) and approximate slope from a 5-point DEM sample.',
    limits: 'Not a survey; steep local cliffs smaller than ~30 m may be missed.',
  },
  {
    id: 'road',
    label: 'Road access',
    kind: 'live',
    provider: 'OSRM · OpenStreetMap road network',
    whatYouSee: 'Distance (km) to nearest mapped drivable road.',
    limits: 'Unmapped tracks / new roads not in OSM will not appear.',
  },
  {
    id: 'water',
    label: 'Water / flood buffer',
    kind: 'live',
    provider: 'OSM Overpass (rivers, lakes, reservoirs)',
    whatYouSee: 'Distance to nearest mapped surface water.',
    limits: 'Seasonal streams or unmapped tanks not in OSM.',
  },
  {
    id: 'settlement',
    label: 'Settlement clearance',
    kind: 'live',
    provider: 'OSM Overpass (buildings, places)',
    whatYouSee: 'Distance to nearest mapped buildings / village-town.',
    limits: 'Not a legal ROW or census boundary certificate.',
  },
  {
    id: 'power_supply',
    label: 'Nearby tower / substation / plant',
    kind: 'live',
    provider: 'TAMS GIS + OSM (tower, line, substation, plant)',
    whatYouSee: 'Nearest mapped grid asset within the selected 8–50 km search ring, distance, voltage, and where to place new towers.',
    limits: 'Max live radius is 50 km. Satellite-visible towers may be missing from OSM — verify on imagery.',
  },
  {
    id: 'grid',
    label: 'Grid corridor proximity',
    kind: 'live',
    provider: 'TAMS GIS towers/lines + OSM power=line/tower/substation',
    whatYouSee: 'Nearest mapped tower, line, or substation inside the chosen search radius (8 / 15 / 25 / 50 km). OSM may include voltage tag.',
    limits: 'Incomplete OSM in rural areas; TAMS mock/KML when DB offline.',
  },
  {
    id: 'wind',
    label: 'Wind exposure',
    kind: 'live',
    provider: 'Open-Meteo archive (90-day mean daily max wind @ 10 m)',
    whatYouSee: 'Recent wind climate proxy (m/s).',
    limits: 'Not IS wind zone map or CEA notification — structural design needs official zone.',
  },
  {
    id: 'landcover',
    label: 'Land cover hint',
    kind: 'live',
    provider: 'OSM landuse / natural tags near pad',
    whatYouSee: 'Barren, vegetated, built, or water hint from mapped polygons.',
    limits: 'Not satellite land-cover classification (ESA WorldCover etc.) in this build.',
  },
  {
    id: 'location',
    label: 'City / State label',
    kind: 'live',
    provider: 'Nominatim reverse geocode (OSM)',
    whatYouSee: 'Human-readable place name for the analysis header.',
    limits: 'Depends on OSM naming; not official revenue village code.',
  },
]

export const MAP_VISUAL_SOURCES: DataSourceEntry[] = [
  {
    id: 'basemap',
    label: 'Satellite basemap',
    kind: 'visual',
    provider: 'Google satellite tiles (Leaflet)',
    whatYouSee: 'True-colour imagery for visual context only — you draw KML on it.',
    limits: 'We do not auto-run AI land/soil analysis on pixels in this screen.',
  },
]

export const PLANNING_ONLY_SOURCES: DataSourceEntry[] = [
  {
    id: 'voltage_span',
    label: 'Voltage class & span',
    kind: 'planning',
    provider: 'CEA / utility practice reference bands (screening)',
    whatYouSee: 'Typical span range & ROW width for 33–765 kV — you pick class or read from KML/OSM.',
    limits: 'Not a government approval. Final span needs sag-tension, terrain, river crossings, IS 5613.',
  },
  {
    id: 'tower_count',
    label: 'Tower count along corridor',
    kind: 'planning',
    provider: 'Corridor length ÷ selected span (geometry math)',
    whatYouSee: 'Estimated T1…Tn positions on your drawn/uploaded line.',
    limits: 'Planning estimate only — not as-built tower schedule from DISCOM/STU.',
  },
]

export const NOT_IN_THIS_BUILD: DataSourceEntry[] = [
  {
    id: 'is_wind_zone',
    label: 'IS wind zone (official)',
    kind: 'unavailable',
    provider: 'BIS / IS 875 — not wired live',
    whatYouSee: '—',
    limits: 'Requires licensed wind-zone map or manual entry.',
  },
  {
    id: 'cea_row_cert',
    label: 'CEA ROW / forest clearance',
    kind: 'unavailable',
    provider: 'Central / state forest & ROW portals — not wired live',
    whatYouSee: '—',
    limits: 'Needs manual clearance workflow outside TAMS.',
  },
  {
    id: 'geotech',
    label: 'Soil / SBC / borehole',
    kind: 'unavailable',
    provider: 'Field investigation only',
    whatYouSee: '—',
    limits: 'No live satellite can replace lab geotech.',
  },
]

export function kindBadge(kind: DataKind): { text: string; className: string } {
  switch (kind) {
    case 'live':
      return { text: 'Live fetch', className: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' }
    case 'visual':
      return { text: 'Visual only', className: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10' }
    case 'planning':
      return { text: 'Planning ref', className: 'text-amber-300 border-amber-500/40 bg-amber-500/10' }
    default:
      return { text: 'Not live', className: 'text-slate-400 border-slate-600 bg-slate-800/50' }
  }
}
