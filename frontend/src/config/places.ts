/**
 * Hierarchical place tree for GIS command-center navigation (India only).
 * Bounds are [[south, west], [north, east]] in WGS84.
 */

export interface PlaceNode {
  id: string
  label: string
  icon?: string
  /** Leaflet fitBounds padding target */
  bounds?: [[number, number], [number, number]]
  /** Match assets where metadata.region equals this (case-insensitive) */
  region?: string
  /** Match assets where metadata.country_or_state equals this */
  stateOrCountry?: string
  children?: PlaceNode[]
}

type StatePlace = {
  id: string
  label: string
  stateOrCountry: string
  bounds: [[number, number], [number, number]]
  children?: PlaceNode[]
}

/** Full India state list (A–Z) for Places dropdown. */
const INDIA_STATES: StatePlace[] = [
  { id: 'andhra-pradesh', label: 'Andhra Pradesh', stateOrCountry: 'Andhra Pradesh', bounds: [[12.6, 76.7], [19.9, 84.8]] },
  { id: 'arunachal-pradesh', label: 'Arunachal Pradesh', stateOrCountry: 'Arunachal Pradesh', bounds: [[26.5, 91.5], [29.5, 97.4]] },
  { id: 'assam', label: 'Assam', stateOrCountry: 'Assam', bounds: [[24.1, 89.7], [28.0, 96.0]] },
  { id: 'bihar', label: 'Bihar', stateOrCountry: 'Bihar', bounds: [[24.3, 83.3], [27.5, 88.3]] },
  { id: 'chhattisgarh', label: 'Chhattisgarh', stateOrCountry: 'Chhattisgarh', bounds: [[17.8, 80.2], [24.1, 84.4]] },
  { id: 'goa', label: 'Goa', stateOrCountry: 'Goa', bounds: [[14.9, 73.7], [15.8, 74.3]] },
  {
    id: 'gujarat',
    label: 'Gujarat',
    stateOrCountry: 'Gujarat',
    bounds: [[20.1, 68.1], [24.7, 74.5]],
    children: [
      { id: 'ahmedabad', label: 'Ahmedabad', bounds: [[22.95, 72.5], [23.15, 72.65]] },
      { id: 'surat', label: 'Surat', bounds: [[21.1, 72.7], [21.25, 73.0]] },
      { id: 'vadodara', label: 'Vadodara', bounds: [[22.25, 73.1], [22.4, 73.25]] },
      { id: 'rajkot', label: 'Rajkot', bounds: [[22.25, 70.7], [22.4, 70.85]] },
      { id: 'bhavnagar', label: 'Bhavnagar', bounds: [[21.7, 72.1], [21.85, 72.2]] },
    ],
  },
  { id: 'haryana', label: 'Haryana', stateOrCountry: 'Haryana', bounds: [[27.65, 74.45], [30.95, 77.6]] },
  { id: 'himachal-pradesh', label: 'Himachal Pradesh', stateOrCountry: 'Himachal Pradesh', bounds: [[30.4, 75.6], [33.3, 79.0]] },
  { id: 'jharkhand', label: 'Jharkhand', stateOrCountry: 'Jharkhand', bounds: [[22.0, 83.3], [25.3, 87.9]] },
  { id: 'karnataka', label: 'Karnataka', stateOrCountry: 'Karnataka', bounds: [[11.5, 74.0], [18.5, 78.6]] },
  { id: 'kerala', label: 'Kerala', stateOrCountry: 'Kerala', bounds: [[8.0, 74.8], [12.8, 77.4]] },
  { id: 'madhya-pradesh', label: 'Madhya Pradesh', stateOrCountry: 'Madhya Pradesh', bounds: [[21.0, 74.0], [26.9, 82.8]] },
  {
    id: 'maharashtra',
    label: 'Maharashtra',
    stateOrCountry: 'Maharashtra',
    bounds: [[15.6, 72.6], [22.1, 80.9]],
    children: [
      { id: 'mumbai', label: 'Mumbai', bounds: [[18.89, 72.75], [19.27, 73.05]] },
      { id: 'pune', label: 'Pune', bounds: [[18.4, 73.7], [18.65, 74.0]] },
      { id: 'nagpur', label: 'Nagpur', bounds: [[20.9, 78.9], [21.3, 79.2]] },
    ],
  },
  { id: 'manipur', label: 'Manipur', stateOrCountry: 'Manipur', bounds: [[23.8, 93.0], [25.7, 94.8]] },
  { id: 'meghalaya', label: 'Meghalaya', stateOrCountry: 'Meghalaya', bounds: [[25.0, 89.8], [26.1, 92.8]] },
  { id: 'mizoram', label: 'Mizoram', stateOrCountry: 'Mizoram', bounds: [[21.9, 92.2], [24.5, 93.4]] },
  { id: 'nagaland', label: 'Nagaland', stateOrCountry: 'Nagaland', bounds: [[25.2, 93.3], [27.0, 95.3]] },
  { id: 'odisha', label: 'Odisha', stateOrCountry: 'Odisha', bounds: [[17.8, 81.3], [22.6, 87.5]] },
  { id: 'punjab', label: 'Punjab', stateOrCountry: 'Punjab', bounds: [[29.5, 73.8], [32.5, 76.9]] },
  { id: 'rajasthan', label: 'Rajasthan', stateOrCountry: 'Rajasthan', bounds: [[23.0, 69.3], [30.2, 78.2]] },
  { id: 'sikkim', label: 'Sikkim', stateOrCountry: 'Sikkim', bounds: [[27.0, 88.0], [28.2, 88.9]] },
  { id: 'tamil-nadu', label: 'Tamil Nadu', stateOrCountry: 'Tamil Nadu', bounds: [[8.0, 76.2], [13.6, 80.4]] },
  { id: 'telangana', label: 'Telangana', stateOrCountry: 'Telangana', bounds: [[15.8, 77.2], [19.9, 81.3]] },
  { id: 'tripura', label: 'Tripura', stateOrCountry: 'Tripura', bounds: [[22.9, 91.2], [24.5, 92.3]] },
  { id: 'uttar-pradesh', label: 'Uttar Pradesh', stateOrCountry: 'Uttar Pradesh', bounds: [[23.7, 77.0], [30.4, 84.6]] },
  { id: 'uttarakhand', label: 'Uttarakhand', stateOrCountry: 'Uttarakhand', bounds: [[28.7, 77.5], [31.5, 81.0]] },
  { id: 'west-bengal', label: 'West Bengal', stateOrCountry: 'West Bengal', bounds: [[21.5, 85.8], [27.2, 89.9]] },
  // NCT kept — tower/corridor KML pack already imported
  { id: 'delhi', label: 'Delhi', stateOrCountry: 'Delhi', bounds: [[28.4, 76.8], [28.9, 77.4]] },
]

export const PLACES_TREE: PlaceNode[] = [
  {
    id: 'india',
    label: 'India',
    icon: '🇮🇳',
    bounds: [[6.5, 68], [35.5, 97.5]],
    region: 'India',
    children: INDIA_STATES,
  },
]

/** Open on Gujarat so KML towers/corridors are visible immediately */
export const DEFAULT_PLACE_ID = 'gujarat'

export const INDIA_MAP_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 68],
  [35.5, 97.5],
]

const placeById = new Map<string, PlaceNode>()

function indexPlaces(nodes: PlaceNode[], ancestors: PlaceNode[] = []) {
  for (const node of nodes) {
    placeById.set(node.id, node)
    if (node.children?.length) indexPlaces(node.children, [...ancestors, node])
  }
}

indexPlaces(PLACES_TREE)

export function getPlaceById(id: string): PlaceNode | undefined {
  return placeById.get(id)
}

export function getPlacePath(placeId: string): PlaceNode[] {
  const path: PlaceNode[] = []

  function walk(nodes: PlaceNode[], trail: PlaceNode[]): boolean {
    for (const node of nodes) {
      const next = [...trail, node]
      if (node.id === placeId) {
        path.push(...next)
        return true
      }
      if (node.children && walk(node.children, next)) return true
    }
    return false
  }

  walk(PLACES_TREE, [])
  return path
}

export function flattenPlaces(nodes: PlaceNode[] = PLACES_TREE): PlaceNode[] {
  const out: PlaceNode[] = []
  const visit = (list: PlaceNode[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children) visit(n.children)
    }
  }
  visit(nodes)
  return out
}

/** Resolve API state filter from selected place id (walks parents for cities). */
export function getStateFilterForPlace(placeId: string): string | undefined {
  if (placeId === 'india') return undefined
  const path = getPlacePath(placeId)
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].stateOrCountry) return path[i].stateOrCountry
  }
  return getPlaceById(placeId)?.stateOrCountry
}

/** Whether the selected place should load KML tower markers. */
export function placeShowsTowers(placeId: string): boolean {
  const path = getPlacePath(placeId)
  const towerStates = new Set([
    'gujarat',
    'rajasthan',
    'delhi',
    'haryana',
    'punjab',
    'himachal-pradesh',
    'uttarakhand',
  ])
  return path.some((p) => towerStates.has(p.id))
}
