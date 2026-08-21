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

/** Full India state list (A–Z) for Places dropdown — major metros as children. */
const INDIA_STATES: StatePlace[] = [
  {
    id: 'andhra-pradesh',
    label: 'Andhra Pradesh',
    stateOrCountry: 'Andhra Pradesh',
    bounds: [[12.6, 76.75], [19.92, 84.75]],
    children: [
      { id: 'visakhapatnam', label: 'Visakhapatnam', bounds: [[17.65, 83.15], [17.85, 83.45]] },
      { id: 'vijayawada', label: 'Vijayawada', bounds: [[16.45, 80.55], [16.60, 80.75]] },
    ],
  },
  {
    id: 'arunachal-pradesh',
    label: 'Arunachal Pradesh',
    stateOrCountry: 'Arunachal Pradesh',
    bounds: [[26.55, 91.55], [29.45, 97.42]],
    children: [
      { id: 'itanagar', label: 'Itanagar', bounds: [[27.05, 93.55], [27.15, 93.70]] },
    ],
  },
  {
    id: 'assam',
    label: 'Assam',
    stateOrCountry: 'Assam',
    bounds: [[24.1, 89.7], [27.98, 96.02]],
    children: [
      { id: 'guwahati', label: 'Guwahati', bounds: [[26.05, 91.55], [26.25, 91.90]] },
    ],
  },
  {
    id: 'bihar',
    label: 'Bihar',
    stateOrCountry: 'Bihar',
    bounds: [[24.2, 83.3], [27.55, 88.3]],
    children: [
      { id: 'patna', label: 'Patna', bounds: [[25.55, 85.00], [25.70, 85.25]] },
    ],
  },
  {
    id: 'chhattisgarh',
    label: 'Chhattisgarh',
    stateOrCountry: 'Chhattisgarh',
    bounds: [[17.78, 80.24], [24.12, 84.4]],
    children: [
      { id: 'raipur', label: 'Raipur', bounds: [[21.15, 81.55], [21.35, 81.75]] },
    ],
  },
  {
    id: 'goa',
    label: 'Goa',
    stateOrCountry: 'Goa',
    bounds: [[14.53, 73.68], [15.8, 74.35]],
    children: [
      { id: 'panaji', label: 'Panaji', bounds: [[15.45, 73.78], [15.55, 73.90]] },
    ],
  },
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
      { id: 'gandhinagar', label: 'Gandhinagar', bounds: [[23.15, 72.60], [23.28, 72.72]] },
      { id: 'jamnagar', label: 'Jamnagar', bounds: [[22.42, 69.98], [22.55, 70.15]] },
    ],
  },
  {
    id: 'haryana',
    label: 'Haryana',
    stateOrCountry: 'Haryana',
    bounds: [[27.65, 74.45], [30.95, 77.6]],
    children: [
      { id: 'gurugram', label: 'Gurugram', bounds: [[28.35, 76.90], [28.55, 77.15]] },
      { id: 'faridabad', label: 'Faridabad', bounds: [[28.35, 77.25], [28.50, 77.40]] },
    ],
  },
  {
    id: 'himachal-pradesh',
    label: 'Himachal Pradesh',
    stateOrCountry: 'Himachal Pradesh',
    bounds: [[30.38, 75.55], [33.25, 79.07]],
    children: [
      { id: 'shimla', label: 'Shimla', bounds: [[31.05, 77.10], [31.15, 77.25]] },
    ],
  },
  {
    id: 'jharkhand',
    label: 'Jharkhand',
    stateOrCountry: 'Jharkhand',
    bounds: [[21.95, 83.28], [25.35, 87.98]],
    children: [
      { id: 'ranchi', label: 'Ranchi', bounds: [[23.28, 85.25], [23.42, 85.42]] },
      { id: 'jamshedpur', label: 'Jamshedpur', bounds: [[22.75, 86.10], [22.90, 86.30]] },
    ],
  },
  {
    id: 'karnataka',
    label: 'Karnataka',
    stateOrCountry: 'Karnataka',
    bounds: [[11.5, 74.05], [18.47, 78.59]],
    children: [
      { id: 'bengaluru', label: 'Bengaluru', bounds: [[12.85, 77.45], [13.15, 77.75]] },
      { id: 'mysuru', label: 'Mysuru', bounds: [[12.25, 76.55], [12.40, 76.75]] },
      { id: 'mangaluru', label: 'Mangaluru', bounds: [[12.85, 74.78], [13.00, 74.95]] },
    ],
  },
  {
    id: 'kerala',
    label: 'Kerala',
    stateOrCountry: 'Kerala',
    bounds: [[8.17, 74.85], [12.8, 77.4]],
    children: [
      { id: 'thiruvananthapuram', label: 'Thiruvananthapuram', bounds: [[8.45, 76.85], [8.60, 77.05]] },
      { id: 'kochi', label: 'Kochi', bounds: [[9.90, 76.20], [10.10, 76.40]] },
      { id: 'kozhikode', label: 'Kozhikode', bounds: [[11.20, 75.70], [11.35, 75.90]] },
    ],
  },
  {
    id: 'madhya-pradesh',
    label: 'Madhya Pradesh',
    stateOrCountry: 'Madhya Pradesh',
    bounds: [[21.0, 74.0], [26.9, 82.8]],
    children: [
      { id: 'bhopal', label: 'Bhopal', bounds: [[23.15, 77.30], [23.35, 77.55]] },
      { id: 'indore', label: 'Indore', bounds: [[22.65, 75.75], [22.85, 76.00]] },
      { id: 'jabalpur', label: 'Jabalpur', bounds: [[23.10, 79.85], [23.25, 80.05]] },
    ],
  },
  {
    id: 'maharashtra',
    label: 'Maharashtra',
    stateOrCountry: 'Maharashtra',
    bounds: [[15.6, 72.6], [22.1, 80.9]],
    children: [
      { id: 'mumbai', label: 'Mumbai', bounds: [[18.89, 72.75], [19.27, 73.05]] },
      { id: 'pune', label: 'Pune', bounds: [[18.4, 73.7], [18.65, 74.0]] },
      { id: 'nagpur', label: 'Nagpur', bounds: [[20.9, 78.9], [21.3, 79.2]] },
      { id: 'nashik', label: 'Nashik', bounds: [[19.95, 73.70], [20.10, 73.90]] },
      { id: 'aurangabad', label: 'Aurangabad', bounds: [[19.80, 75.25], [19.95, 75.45]] },
      { id: 'thane', label: 'Thane', bounds: [[19.15, 72.90], [19.30, 73.10]] },
    ],
  },
  {
    id: 'manipur',
    label: 'Manipur',
    stateOrCountry: 'Manipur',
    bounds: [[23.8, 93.0], [25.7, 94.8]],
    children: [
      { id: 'imphal', label: 'Imphal', bounds: [[24.75, 93.88], [24.85, 93.98]] },
    ],
  },
  {
    id: 'meghalaya',
    label: 'Meghalaya',
    stateOrCountry: 'Meghalaya',
    bounds: [[25.0, 89.8], [26.1, 92.8]],
    children: [
      { id: 'shillong', label: 'Shillong', bounds: [[25.55, 91.85], [25.62, 91.95]] },
    ],
  },
  {
    id: 'mizoram',
    label: 'Mizoram',
    stateOrCountry: 'Mizoram',
    bounds: [[21.9, 92.2], [24.5, 93.4]],
    children: [
      { id: 'aizawl', label: 'Aizawl', bounds: [[23.70, 92.68], [23.78, 92.78]] },
    ],
  },
  {
    id: 'nagaland',
    label: 'Nagaland',
    stateOrCountry: 'Nagaland',
    bounds: [[25.2, 93.3], [27.0, 95.3]],
    children: [
      { id: 'kohima', label: 'Kohima', bounds: [[25.64, 94.08], [25.70, 94.15]] },
    ],
  },
  {
    id: 'odisha',
    label: 'Odisha',
    stateOrCountry: 'Odisha',
    bounds: [[17.8, 81.3], [22.6, 87.5]],
    children: [
      { id: 'bhubaneswar', label: 'Bhubaneswar', bounds: [[20.22, 85.75], [20.40, 85.95]] },
      { id: 'cuttack', label: 'Cuttack', bounds: [[20.40, 85.80], [20.55, 85.95]] },
    ],
  },
  {
    id: 'punjab',
    label: 'Punjab',
    stateOrCountry: 'Punjab',
    bounds: [[29.5, 73.8], [32.5, 76.9]],
    children: [
      { id: 'ludhiana', label: 'Ludhiana', bounds: [[30.85, 75.75], [31.00, 75.95]] },
      { id: 'amritsar', label: 'Amritsar', bounds: [[31.58, 74.80], [31.70, 74.95]] },
    ],
  },
  {
    id: 'rajasthan',
    label: 'Rajasthan',
    stateOrCountry: 'Rajasthan',
    bounds: [[23.0, 69.3], [30.2, 78.2]],
    children: [
      { id: 'jaipur', label: 'Jaipur', bounds: [[26.80, 75.70], [27.00, 75.90]] },
      { id: 'jodhpur', label: 'Jodhpur', bounds: [[26.20, 72.95], [26.35, 73.10]] },
      { id: 'udaipur', label: 'Udaipur', bounds: [[24.52, 73.65], [24.65, 73.80]] },
    ],
  },
  {
    id: 'sikkim',
    label: 'Sikkim',
    stateOrCountry: 'Sikkim',
    bounds: [[27.0, 88.0], [28.2, 88.9]],
    children: [
      { id: 'gangtok', label: 'Gangtok', bounds: [[27.30, 88.58], [27.38, 88.65]] },
    ],
  },
  {
    id: 'tamil-nadu',
    label: 'Tamil Nadu',
    stateOrCountry: 'Tamil Nadu',
    bounds: [[8.0, 76.2], [13.6, 80.4]],
    children: [
      { id: 'chennai', label: 'Chennai', bounds: [[12.90, 80.10], [13.20, 80.35]] },
      { id: 'coimbatore', label: 'Coimbatore', bounds: [[10.95, 76.85], [11.10, 77.05]] },
      { id: 'madurai', label: 'Madurai', bounds: [[9.85, 78.05], [10.00, 78.20]] },
    ],
  },
  {
    id: 'telangana',
    label: 'Telangana',
    stateOrCountry: 'Telangana',
    bounds: [[15.8, 77.2], [19.9, 81.3]],
    children: [
      { id: 'hyderabad', label: 'Hyderabad', bounds: [[17.25, 78.25], [17.55, 78.60]] },
      { id: 'warangal', label: 'Warangal', bounds: [[17.90, 79.50], [18.05, 79.65]] },
    ],
  },
  {
    id: 'tripura',
    label: 'Tripura',
    stateOrCountry: 'Tripura',
    bounds: [[22.9, 91.2], [24.5, 92.3]],
    children: [
      { id: 'agartala', label: 'Agartala', bounds: [[23.80, 91.25], [23.90, 91.35]] },
    ],
  },
  {
    id: 'uttar-pradesh',
    label: 'Uttar Pradesh',
    stateOrCountry: 'Uttar Pradesh',
    bounds: [[23.7, 77.0], [30.4, 84.6]],
    children: [
      { id: 'lucknow', label: 'Lucknow', bounds: [[26.75, 80.85], [26.95, 81.05]] },
      { id: 'kanpur', label: 'Kanpur', bounds: [[26.40, 80.25], [26.55, 80.45]] },
      { id: 'agra', label: 'Agra', bounds: [[27.15, 77.95], [27.25, 78.10]] },
      { id: 'varanasi', label: 'Varanasi', bounds: [[25.25, 82.90], [25.40, 83.05]] },
      { id: 'noida', label: 'Noida', bounds: [[28.50, 77.30], [28.65, 77.45]] },
    ],
  },
  {
    id: 'uttarakhand',
    label: 'Uttarakhand',
    stateOrCountry: 'Uttarakhand',
    bounds: [[28.7, 77.5], [31.5, 81.0]],
    children: [
      { id: 'dehradun', label: 'Dehradun', bounds: [[30.25, 77.95], [30.40, 78.15]] },
      { id: 'haridwar', label: 'Haridwar', bounds: [[29.90, 78.10], [30.00, 78.20]] },
    ],
  },
  {
    id: 'west-bengal',
    label: 'West Bengal',
    stateOrCountry: 'West Bengal',
    bounds: [[21.5, 85.8], [27.2, 89.9]],
    children: [
      { id: 'kolkata', label: 'Kolkata', bounds: [[22.45, 88.20], [22.70, 88.50]] },
      { id: 'siliguri', label: 'Siliguri', bounds: [[26.65, 88.35], [26.80, 88.50]] },
    ],
  },
  // NCT — metros under Delhi NCR entry
  {
    id: 'delhi',
    label: 'Delhi',
    stateOrCountry: 'Delhi',
    bounds: [[28.4, 76.84], [28.88, 77.35]],
    children: [
      { id: 'new-delhi', label: 'New Delhi', bounds: [[28.55, 77.15], [28.68, 77.30]] },
    ],
  },
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

/** Open on full India explorer (state ops after PlacesMenu pick) */
export const DEFAULT_PLACE_ID = 'india'

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

/** State names for `/assets?state=` — used to sample all-India corridors. */
export function getIndiaStateFilters(): string[] {
  const india = PLACES_TREE[0]
  const names: string[] = []
  for (const state of india?.children ?? []) {
    if (state.stateOrCountry) names.push(state.stateOrCountry)
  }
  return names
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

/** Whether the selected place should load KML tower markers (viewport bbox still gated). */
export function placeShowsTowers(placeId: string): boolean {
  if (placeId === 'india') return true
  const path = getPlacePath(placeId)
  const towerStates = new Set([
    'gujarat',
    'rajasthan',
    'delhi',
    'haryana',
    'punjab',
    'himachal-pradesh',
    'uttarakhand',
    'karnataka',
    'kerala',
    'madhya-pradesh',
    'maharashtra',
    'tamil-nadu',
    'assam',
    'andhra-pradesh',
    'bihar',
    'goa',
    'jharkhand',
    'odisha',
    'sikkim',
    'arunachal-pradesh',
    'chhattisgarh',
    'manipur',
    'meghalaya',
    'mizoram',
    'nagaland',
    'telangana',
    'tripura',
    'uttar-pradesh',
    'west-bengal',
  ])
  return path.some((p) => towerStates.has(p.id))
}
