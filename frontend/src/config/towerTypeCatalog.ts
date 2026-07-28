/**
 * Educational catalog of transmission tower roles + voltage/lattice variants.
 * Heights/spans are typical averages for visualization (not design standards).
 */

export type TowerStructure =
  | 'pole'
  | 'lattice_single'
  | 'lattice_double'
  | 'lattice_v'
  | 'lattice_multilevel'
  | 'lattice_heavy'
  | 'h_frame'

export type TowerRole =
  | 'dead_end'
  | 'tangent'
  | 'transposition'
  | 'angle'
  | 'anchor'
  | 'voltage_demo'

export interface TowerTypeEntry {
  id: string
  label: string
  role: TowerRole
  roleLabel: string
  voltageKv: number
  heightM: number
  spanM: number
  structure: TowerStructure
  description: string
  /** Placement group: corridor (role line) or variants row */
  group: 'corridor' | 'variants'
  color: string
}

export const TOWER_TYPE_CATALOG: TowerTypeEntry[] = [
  {
    id: 'dead-end',
    label: 'Dead-End Tower',
    role: 'dead_end',
    roleLabel: 'Dead-End',
    voltageKv: 220,
    heightM: 38,
    spanM: 350,
    structure: 'lattice_heavy',
    description: 'Terminates conductor tension at line ends or into a substation gantry.',
    group: 'corridor',
    color: '#f59e0b',
  },
  {
    id: 'tangent',
    label: 'Tangent Tower',
    role: 'tangent',
    roleLabel: 'Tangent',
    voltageKv: 220,
    heightM: 32,
    spanM: 400,
    structure: 'lattice_single',
    description: 'Supports conductors on straight runs with minimal angle tension.',
    group: 'corridor',
    color: '#38bdf8',
  },
  {
    id: 'transposition',
    label: 'Transposition Tower',
    role: 'transposition',
    roleLabel: 'Transposition',
    voltageKv: 220,
    heightM: 36,
    spanM: 380,
    structure: 'lattice_double',
    description: 'Swaps phase positions to balance impedance along long corridors.',
    group: 'corridor',
    color: '#a78bfa',
  },
  {
    id: 'angle',
    label: 'Angle Tower',
    role: 'angle',
    roleLabel: 'Angle',
    voltageKv: 220,
    heightM: 40,
    spanM: 320,
    structure: 'lattice_heavy',
    description: 'Takes lateral pull where the right-of-way changes direction.',
    group: 'corridor',
    color: '#fb7185',
  },
  {
    id: 'anchor',
    label: 'Anchor Tower',
    role: 'anchor',
    roleLabel: 'Anchor',
    voltageKv: 220,
    heightM: 42,
    spanM: 360,
    structure: 'lattice_heavy',
    description: 'Heavy strain structure placed at intervals for tension control.',
    group: 'corridor',
    color: '#34d399',
  },
  {
    id: '66kv-pole',
    label: '66 kV Pole',
    role: 'voltage_demo',
    roleLabel: 'Voltage',
    voltageKv: 66,
    heightM: 15,
    spanM: 200,
    structure: 'pole',
    description: 'Single-pole medium-voltage structure with short insulator brackets.',
    group: 'variants',
    color: '#94a3b8',
  },
  {
    id: '66kv-lattice',
    label: '66 kV Lattice',
    role: 'voltage_demo',
    roleLabel: 'Voltage',
    voltageKv: 66,
    heightM: 18,
    spanM: 250,
    structure: 'lattice_single',
    description: 'Compact four-legged lattice for distribution / sub-transmission.',
    group: 'variants',
    color: '#64748b',
  },
  {
    id: '132kv-single',
    label: '132 kV Single Circuit',
    role: 'voltage_demo',
    roleLabel: 'Voltage',
    voltageKv: 132,
    heightM: 28,
    spanM: 350,
    structure: 'lattice_single',
    description: 'Classic tapered lattice with cross-arms for one three-phase circuit.',
    group: 'variants',
    color: '#60a5fa',
  },
  {
    id: '132kv-double',
    label: '132 kV Double Circuit',
    role: 'voltage_demo',
    roleLabel: 'Voltage',
    voltageKv: 132,
    heightM: 35,
    spanM: 350,
    structure: 'lattice_double',
    description: 'Taller lattice with stacked arms carrying two circuits.',
    group: 'variants',
    color: '#3b82f6',
  },
  {
    id: '220kv-v',
    label: '220 kV V-Type',
    role: 'voltage_demo',
    roleLabel: 'Voltage',
    voltageKv: 220,
    heightM: 40,
    spanM: 400,
    structure: 'lattice_v',
    description: 'Wide V-top lattice used on higher-capacity single-circuit corridors.',
    group: 'variants',
    color: '#22d3ee',
  },
  {
    id: '220kv-multi',
    label: '220 kV Multi-Level',
    role: 'voltage_demo',
    roleLabel: 'Voltage',
    voltageKv: 220,
    heightM: 48,
    spanM: 400,
    structure: 'lattice_multilevel',
    description: 'Slender multi-arm tower for dense double-circuit 220 kV lines.',
    group: 'variants',
    color: '#06b6d4',
  },
  {
    id: '400kv-lattice',
    label: '400 kV Lattice',
    role: 'voltage_demo',
    roleLabel: 'Voltage',
    voltageKv: 400,
    heightM: 55,
    spanM: 450,
    structure: 'lattice_heavy',
    description: 'Extra-high-voltage lattice (330–420 kV class) with wide cross-beam.',
    group: 'variants',
    color: '#eab308',
  },
]

export function getTowerTypeById(id: string): TowerTypeEntry | undefined {
  return TOWER_TYPE_CATALOG.find((t) => t.id === id)
}

/**
 * Load-carrying capacity tiers keyed by voltage class.
 * `mva` is a representative single-circuit thermal capacity used to visualise
 * how much power a tower/line at that voltage class can carry (approximate).
 */
export interface LoadCapacityTier {
  id: string
  label: string
  /** Inclusive lower voltage bound (kV) for this tier. */
  minKv: number
  /** Representative carrying capacity in MVA. */
  mva: number
  color: string
}

export const LOAD_CAPACITY_TIERS: LoadCapacityTier[] = [
  { id: 'lv', label: 'Distribution · ≤ 66 kV', minKv: 0, mva: 50, color: '#22c55e' },
  { id: 'mv', label: 'Sub-transmission · 110–132 kV', minKv: 100, mva: 150, color: '#84cc16' },
  { id: 'hv', label: 'HV · 220 kV', minKv: 200, mva: 400, color: '#f59e0b' },
  { id: 'ehv', label: 'EHV · 400 kV', minKv: 350, mva: 1200, color: '#ef4444' },
  { id: 'uhv', label: 'UHV · ≥ 765 kV', minKv: 700, mva: 2400, color: '#a855f7' },
]

/** Resolve the load-capacity tier for a given voltage (kV). */
export function loadCapacityForKv(voltageKv: number): LoadCapacityTier {
  let tier = LOAD_CAPACITY_TIERS[0]
  for (const t of LOAD_CAPACITY_TIERS) {
    if (voltageKv >= t.minKv) tier = t
  }
  return tier
}

/**
 * Parse OSM / KML voltage tags into kV.
 * Handles volts (`220000`), kV (`220`), and multi-values (`66;220` → max).
 */
export function parseVoltageKv(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw >= 1000 ? raw / 1000 : raw
  }
  if (raw == null || raw === '') return undefined
  const parts = String(raw)
    .split(/[;,/|]+/)
    .map((p) => parseFloat(p.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!parts.length) return undefined
  const max = Math.max(...parts)
  return max >= 1000 ? max / 1000 : max
}

/** Extract a numeric voltage (kV) from a live asset's metadata / fields. */
export function assetVoltageKv(asset: {
  metadata?: Record<string, unknown>
  voltage_level_kv?: number | null
}): number {
  const fromMeta =
    parseVoltageKv(asset.metadata?.voltage_kv) ??
    parseVoltageKv(asset.metadata?.voltage) ??
    parseVoltageKv(asset.voltage_level_kv)
  return fromMeta && fromMeta > 0 ? fromMeta : 220
}

/** Load-capacity tier for a live asset (tower or line). */
export function loadCapacityForAsset(asset: {
  metadata?: Record<string, unknown>
  voltage_level_kv?: number | null
}): LoadCapacityTier {
  return loadCapacityForKv(assetVoltageKv(asset))
}

export interface TowerStructureHints {
  voltageKv?: number
  /** All voltages of lines snapped onto this tower (junction / conflict). */
  lineVoltages?: number[]
  /** True when ≥2 distinct voltage classes meet at this tower. */
  voltageConflict?: boolean
  cables?: number
  circuits?: number
  /** OSM power=* e.g. tower, portal, pole, line */
  power?: string
  /** OSM structure=* or design hint */
  structure?: string
  name?: string
  /** Distance in metres to the chosen serving line. */
  snapDistanceM?: number
}

function parseMetaNumber(meta: Record<string, unknown> | undefined, key: string): number | undefined {
  const raw = meta?.[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (raw != null) {
    const n = parseFloat(String(raw))
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/**
 * Identify the physical TowerStructure from tags + serving-line hints.
 * This is the fix for "wrong 3D model" — do not default everything to 220 kV lattice.
 */
export function identifyTowerStructure(
  asset: {
    metadata?: Record<string, unknown>
    voltage_level_kv?: number | null
    name?: string
  },
  hints?: TowerStructureHints
): TowerStructure {
  const meta = asset.metadata ?? {}
  const structureTag = String(hints?.structure ?? meta.structure ?? meta.design ?? '').toLowerCase()
  const powerTag = String(hints?.power ?? meta.power ?? '').toLowerCase()
  const name = String(hints?.name ?? asset.name ?? '').toLowerCase()
  const voltage = hints?.voltageKv ?? assetVoltageKv(asset)
  const cables = hints?.cables ?? parseMetaNumber(meta, 'cables') ?? 0
  const circuits = hints?.circuits ?? parseMetaNumber(meta, 'circuits') ?? 0
  const junction = Boolean(hints?.voltageConflict) || (hints?.lineVoltages?.length ?? 0) > 1

  // Explicit OSM / KML tags win
  if (
    powerTag === 'portal' ||
    structureTag.includes('portal') ||
    structureTag.includes('h-frame') ||
    structureTag.includes('h_frame') ||
    structureTag.includes('gantry')
  ) {
    return 'h_frame'
  }

  // OSM power=tower / pylon = lattice — never mis-label as distribution pole
  const isOsmTower =
    powerTag === 'tower' ||
    powerTag === 'transmission_tower' ||
    powerTag.includes('pylon') ||
    structureTag.includes('lattice') ||
    structureTag.includes('steel') ||
    name.includes('pylon')

  if (
    (powerTag === 'pole' || structureTag.includes('pole') || structureTag.includes('monopole')) &&
    !isOsmTower &&
    voltage <= 66 &&
    !junction
  ) {
    return 'pole'
  }
  if (structureTag.includes('multi') || structureTag.includes('triple')) {
    return 'lattice_multilevel'
  }
  if (structureTag.includes('double') || structureTag.includes('d/c') || name.includes('d/c')) {
    return 'lattice_double'
  }
  if (structureTag.includes('v-type') || structureTag.includes('v_type') || structureTag === 'v') {
    return 'lattice_v'
  }
  if (
    structureTag.includes('heavy') ||
    structureTag.includes('dead') ||
    structureTag.includes('angle') ||
    junction
  ) {
    return voltage >= 200 ? 'lattice_heavy' : 'lattice_double'
  }
  if (isOsmTower || structureTag.includes('lattice') || structureTag.includes('steel')) {
    if (voltage >= 350) return 'lattice_heavy'
    if (voltage >= 200 && (circuits >= 2 || cables >= 6 || junction)) return 'lattice_multilevel'
    if (voltage >= 200) return 'lattice_v'
    if (circuits >= 2 || cables >= 6) return 'lattice_double'
    return 'lattice_single'
  }

  // Infer from voltage class + circuit count on the serving line
  if (voltage <= 66 && !junction) {
    return cables <= 3 && circuits <= 1 ? 'pole' : 'lattice_single'
  }
  if (voltage <= 132) {
    return circuits >= 2 || cables >= 6 || name.includes('double') || junction
      ? 'lattice_double'
      : 'lattice_single'
  }
  if (voltage <= 220) {
    return circuits >= 2 || cables >= 6 || name.includes('double') || name.includes('d/c') || junction
      ? 'lattice_multilevel'
      : 'lattice_v'
  }
  // 400 kV+
  return 'lattice_heavy'
}

/** Map a live asset (+ optional line hints) → catalog entry with correct structure. */
export function resolveTowerTypeForAsset(
  asset: {
    metadata?: Record<string, unknown>
    voltage_level_kv?: number | null
    name?: string
  },
  hints?: TowerStructureHints
): TowerTypeEntry {
  const voltage = hints?.voltageKv ?? assetVoltageKv(asset)
  const structure = identifyTowerStructure(asset, { ...hints, voltageKv: voltage })

  const variants = TOWER_TYPE_CATALOG.filter((t) => t.group === 'variants')
  const sameStructure = variants.filter((t) => t.structure === structure)
  const pool = sameStructure.length > 0 ? sameStructure : variants

  let best = pool[0] ?? TOWER_TYPE_CATALOG[0]
  let bestDist = Math.abs(best.voltageKv - voltage)
  for (const v of pool) {
    const d = Math.abs(v.voltageKv - voltage)
    if (d < bestDist) {
      best = v
      bestDist = d
    }
  }

  return {
    ...best,
    structure,
    voltageKv: Math.round(voltage),
    label: `${best.label.replace(/^\d+\s*kV\s*/i, `${Math.round(voltage)} kV `)}`,
  }
}
