/**
 * Procedural Cesium entities for educational + live tower / line / substation scenes.
 */

import {
  resolveTowerTypeForAsset,
  type TowerTypeEntry,
  type TowerStructure,
} from '@/config/towerTypeCatalog'
import type { CesiumModule } from '@/lib/cesiumLoader'

type Viewer = import('cesium').Viewer
type Cartesian3 = import('cesium').Cartesian3

export interface SceneOrigin {
  lon: number
  lat: number
}

const DEFAULT_SCALE = 2.5

function metersToDeg(origin: SceneOrigin, eastM: number, northM: number) {
  const latRad = (origin.lat * Math.PI) / 180
  const mPerDegLat = 111_320
  const mPerDegLon = Math.max(111_320 * Math.cos(latRad), 1)
  return {
    lon: origin.lon + eastM / mPerDegLon,
    lat: origin.lat + northM / mPerDegLat,
  }
}

export function offsetMeters(
  Cesium: CesiumModule,
  origin: SceneOrigin,
  eastM: number,
  northM: number,
  upM = 0
): Cartesian3 {
  const { lon, lat } = metersToDeg(origin, eastM, northM)
  return Cesium.Cartesian3.fromDegrees(lon, lat, upM)
}

export function degToMeters(origin: SceneOrigin, lon: number, lat: number) {
  const latRad = (origin.lat * Math.PI) / 180
  const mPerDegLat = 111_320
  const mPerDegLon = Math.max(111_320 * Math.cos(latRad), 1)
  return {
    east: (lon - origin.lon) * mPerDegLon,
    north: (lat - origin.lat) * mPerDegLat,
  }
}

function steel(Cesium: CesiumModule, css: string, alpha = 0.95) {
  return Cesium.Color.fromCssColorString(css).withAlpha(alpha)
}

/** Local ENU point in display-meters (already scaled). */
interface Vec3 {
  e: number
  n: number
  u: number
}

/** A single steel member drawn as a straight polyline (real lattice look). */
function addMember(
  Cesium: CesiumModule,
  viewer: Viewer,
  id: string,
  origin: SceneOrigin,
  a: Vec3,
  b: Vec3,
  color: string,
  width: number,
  props?: Record<string, unknown>
) {
  return viewer.entities.add({
    id,
    polyline: {
      positions: [
        offsetMeters(Cesium, origin, a.e, a.n, a.u),
        offsetMeters(Cesium, origin, b.e, b.n, b.u),
      ],
      width,
      arcType: Cesium.ArcType.NONE,
      material: steel(Cesium, color, 1),
    },
    properties: props,
  })
}

/**
 * Build a realistic tapered 4-legged lattice tower body (legs, belts, X-bracing).
 * All dimensions are in real meters and multiplied by `scale` for globe visibility.
 */
function buildLatticeBody(
  Cesium: CesiumModule,
  viewer: Viewer,
  baseId: string,
  origin: SceneOrigin,
  cx: number,
  cy: number,
  opts: {
    height: number
    baseHalf: number
    topHalf: number
    panels: number
    waist?: number
  },
  color: string,
  width: number,
  scale: number,
  track: (id: string) => string,
  props?: Record<string, unknown>
) {
  const { height, baseHalf, topHalf, panels } = opts
  const signs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
  // Corner position at height fraction t (0 base → 1 top), tapering inward.
  const corner = (t: number, s: [number, number]): Vec3 => {
    const half = (baseHalf + (topHalf - baseHalf) * t) * scale
    return { e: cx + s[0] * half, n: cy + s[1] * half, u: t * height * scale }
  }

  // 4 tapered legs
  signs.forEach((s, i) => {
    addMember(Cesium, viewer, track(`${baseId}-leg-${i}`), origin, corner(0, s), corner(1, s), color, width + 1, props)
  })

  // Horizontal belts + X diagonal bracing per panel
  for (let p = 0; p < panels; p++) {
    const t0 = p / panels
    const t1 = (p + 1) / panels
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      // belt at top of panel
      addMember(Cesium, viewer, track(`${baseId}-belt-${p}-${i}`), origin, corner(t1, signs[i]), corner(t1, signs[j]), color, width, props)
      // single diagonal brace on each face
      addMember(Cesium, viewer, track(`${baseId}-brace-${p}-${i}`), origin, corner(t0, signs[i]), corner(t1, signs[j]), color, Math.max(width - 0.5, 1), props)
    }
  }

  return { corner }
}

/** Horizontal cross-arm with insulator stub, extending out to hold conductors. */
function addCrossArm(
  Cesium: CesiumModule,
  viewer: Viewer,
  id: string,
  origin: SceneOrigin,
  cx: number,
  cy: number,
  armHeight: number,
  reach: number,
  color: string,
  width: number,
  scale: number,
  track: (s: string) => string,
  props?: Record<string, unknown>
) {
  const u = armHeight * scale
  const r = reach * scale
  const tip: Vec3 = { e: cx + r, n: cy, u }
  const root: Vec3 = { e: cx, n: cy, u }
  addMember(Cesium, viewer, track(`${id}-arm`), origin, root, tip, color, width, props)
  // diagonal stay from tower up to arm tip (truss look)
  addMember(Cesium, viewer, track(`${id}-stay`), origin, { e: cx, n: cy, u: u + 4 * scale }, tip, color, Math.max(width - 0.5, 1), props)
  // insulator string hanging from tip
  addMember(Cesium, viewer, track(`${id}-ins`), origin, tip, { e: tip.e, n: tip.n, u: u - 3 * scale }, '#d1d5db', Math.max(width - 0.5, 1), props)
}

/** Per-structure lattice geometry: footprint, arm levels (height fractions) & reach. */
function latticeConfig(structure: TowerStructure): {
  baseHalf: number
  topHalf: number
  armLevels: number[]
  armReach: number
  armStep: number
} {
  switch (structure) {
    case 'lattice_v':
      return { baseHalf: 3, topHalf: 1, armLevels: [0.92], armReach: 8, armStep: 0 }
    case 'lattice_double':
      return { baseHalf: 4, topHalf: 1.4, armLevels: [0.6, 0.82], armReach: 6, armStep: 1.5 }
    case 'lattice_multilevel':
      return { baseHalf: 4.5, topHalf: 1.5, armLevels: [0.55, 0.72, 0.9], armReach: 6, armStep: 1.5 }
    case 'lattice_heavy':
      return { baseHalf: 6, topHalf: 2.2, armLevels: [0.7, 0.9], armReach: 9, armStep: 2 }
    case 'h_frame':
      // Two uprights + crossbeam (H / portal look)
      return { baseHalf: 5, topHalf: 4.5, armLevels: [0.85], armReach: 10, armStep: 0 }
    case 'lattice_single':
    default:
      return { baseHalf: 3.5, topHalf: 1.3, armLevels: [0.78, 0.92], armReach: 7, armStep: 1.5 }
  }
}

export function addProceduralTower(
  Cesium: CesiumModule,
  viewer: Viewer,
  entry: TowerTypeEntry,
  origin: SceneOrigin,
  eastM: number,
  northM: number,
  selected: boolean,
  options?: {
    instanceId?: string
    labelText?: string
    colorOverride?: string
    visualScale?: number
    panels?: number
  }
): string[] {
  const scale = options?.visualScale ?? DEFAULT_SCALE
  const h = entry.heightM
  const color = options?.colorOverride ?? (selected ? '#ffffff' : entry.color)
  const baseId = options?.instanceId ? `tower-${options.instanceId}` : `tower-${entry.id}`
  const structure: TowerStructure = entry.structure
  const created: string[] = []
  const track = (id: string) => {
    created.push(id)
    return id
  }
  const memberProps = {
    towerTypeId: entry.id,
    assetId: options?.instanceId ?? entry.id,
  }
  const width = selected ? 3 : 2
  const panels = options?.panels ?? 5

  if (structure === 'pole') {
    // Single tubular steel pole with staggered arms.
    viewer.entities.add({
      id: track(`${baseId}-shaft`),
      position: offsetMeters(Cesium, origin, eastM, northM, (h * scale) / 2),
      cylinder: {
        length: h * scale,
        topRadius: 0.6 * scale,
        bottomRadius: 1.2 * scale,
        material: steel(Cesium, color),
        outline: true,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.55),
      },
      properties: memberProps,
    })
    for (let i = 0; i < 3; i++) {
      addCrossArm(Cesium, viewer, `${baseId}-a${i}`, origin, eastM, northM, h * (0.6 + i * 0.13), 4, color, width, scale, track, memberProps)
    }
  } else if (structure === 'h_frame') {
    // H-frame / portal: two uprights + top beam + side arms.
    const half = 4 * scale
    const uprightH = h * scale
    ;([-1, 1] as const).forEach((side, i) => {
      viewer.entities.add({
        id: track(`${baseId}-leg-${i}`),
        position: offsetMeters(Cesium, origin, eastM + side * half, northM, uprightH / 2),
        cylinder: {
          length: uprightH,
          topRadius: 0.7 * scale,
          bottomRadius: 1.1 * scale,
          material: steel(Cesium, color),
          outline: true,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
        },
        properties: memberProps,
      })
    })
    addMember(
      Cesium,
      viewer,
      track(`${baseId}-beam`),
      origin,
      { e: eastM - half, n: northM, u: uprightH * 0.92 },
      { e: eastM + half, n: northM, u: uprightH * 0.92 },
      color,
      width + 1,
      memberProps
    )
    addCrossArm(Cesium, viewer, `${baseId}-l0`, origin, eastM - half, northM, h * 0.88, -6, color, width, scale, track, memberProps)
    addCrossArm(Cesium, viewer, `${baseId}-r0`, origin, eastM + half, northM, h * 0.88, 6, color, width, scale, track, memberProps)
  } else {
    // All lattice variants share the tapered 4-leg lattice body; arms differ.
    const cfg = latticeConfig(structure)
    buildLatticeBody(
      Cesium,
      viewer,
      baseId,
      origin,
      eastM,
      northM,
      { height: h, baseHalf: cfg.baseHalf, topHalf: cfg.topHalf, panels },
      color,
      width,
      scale,
      track,
      memberProps
    )
    cfg.armLevels.forEach((lvl, i) => {
      const reach = cfg.armReach + i * cfg.armStep
      addCrossArm(Cesium, viewer, `${baseId}-l${i}`, origin, eastM, northM, h * lvl, -reach, color, width, scale, track, memberProps)
      addCrossArm(Cesium, viewer, `${baseId}-r${i}`, origin, eastM, northM, h * lvl, reach, color, width, scale, track, memberProps)
    })
    const peakTop: Vec3 = { e: eastM, n: northM, u: (h + 5) * scale }
    const peakL: Vec3 = { e: eastM - cfg.topHalf * scale, n: northM, u: h * scale }
    const peakR: Vec3 = { e: eastM + cfg.topHalf * scale, n: northM, u: h * scale }
    addMember(Cesium, viewer, track(`${baseId}-peakL`), origin, peakL, peakTop, color, width, memberProps)
    addMember(Cesium, viewer, track(`${baseId}-peakR`), origin, peakR, peakTop, color, width, memberProps)
  }

  viewer.entities.add({
    id: track(baseId),
    name: entry.label,
    position: offsetMeters(Cesium, origin, eastM, northM, h * scale + 8),
    point: {
      pixelSize: selected ? 16 : 9,
      color: Cesium.Color.fromCssColorString(color),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: selected ? 3 : 1.5,
      // Grows a little when close, shrinks (but stays visible) when far away.
      scaleByDistance: new Cesium.NearFarScalar(2.0e3, 1.6, 8.0e5, 0.55),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: options?.labelText ?? `${entry.label}\n${entry.voltageKv} kV · ${entry.heightM} m`,
      font: selected ? 'bold 13px sans-serif' : '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0a1020').withAlpha(0.85),
      backgroundPadding: new Cesium.Cartesian2(8, 5),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 120000),
    },
    properties: {
      towerTypeId: entry.id,
      assetId: options?.instanceId ?? entry.id,
    },
  })

  return created
}

/** Ideal live-map scale: tall enough to read in 3D, not corridor-blocking. */
export const LIVE_STRUCTURE_SCALE = 2.2

/** Conductor attachment height (meters above ground) for a catalog entry. */
export function liveConductorHeightM(entry: { heightM: number }): number {
  return entry.heightM * LIVE_STRUCTURE_SCALE * 0.82
}

/**
 * Live-map tower: solid volumes per identified TowerStructure so height is
 * always visible. Pass `hints` from the serving transmission line.
 */
export function addLiveTowerModel(
  Cesium: CesiumModule,
  viewer: Viewer,
  asset: {
    id: string
    name: string
    longitude: number
    latitude: number
    metadata?: Record<string, unknown>
    voltage_level_kv?: number | null
    health_score?: string
  },
  selected: boolean,
  hasAlert: boolean,
  loadCapacity?: { color: string; mva: number },
  voltageOverride?: number,
  structureHints?: import('@/config/towerTypeCatalog').TowerStructureHints
): string[] {
  const hints: import('@/config/towerTypeCatalog').TowerStructureHints = {
    ...structureHints,
    voltageKv: voltageOverride ?? structureHints?.voltageKv,
  }
  const entry = resolveTowerTypeForAsset(asset, hints)
  const healthColor =
    asset.health_score === 'critical'
      ? '#d62828'
      : asset.health_score === 'attention_required'
        ? '#f77f00'
        : entry.color
  const baseColor = loadCapacity?.color ?? healthColor
  const color = hasAlert ? '#f97316' : selected ? '#ffffff' : baseColor
  const structLabel = entry.structure.replace(/_/g, ' ')
  const conflictNote =
    hints?.voltageConflict && hints.lineVoltages?.length
      ? ` · ${hints.lineVoltages.join('/')} kV`
      : ''
  const labelText = loadCapacity
    ? `${asset.name}\n${entry.voltageKv} kV · ${structLabel}${conflictNote}\n~${loadCapacity.mva} MVA`
    : `${asset.name}\n${entry.voltageKv} kV · ${structLabel}${conflictNote}`

  return addSolidStructureTower(
    Cesium,
    viewer,
    entry,
    { lon: asset.longitude, lat: asset.latitude },
    selected,
    {
      instanceId: asset.id,
      labelText,
      colorOverride: color,
    }
  )
}

/**
 * Draw elevated transmission conductors between consecutive towers so lines
 * attach at cross-arm height (not clamped to the ground).
 */
/**
 * Draw conductor spans like the live map overlay: green links between
 * adjacent towers along each line (junctions can attach to multiple lines).
 *
 * Priority:
 *  1) metadata.adjacent_towers from corridor walk
 *  2) towers ordered along each LineString geometry
 *  3) nearest-neighbour chain fallback
 */
export function addElevatedSpansBetweenTowers(
  Cesium: CesiumModule,
  viewer: Viewer,
  towers: Array<{
    id: string
    longitude: number
    latitude: number
    metadata?: Record<string, unknown>
    voltage_level_kv?: number | null
    name?: string
  }>,
  options: {
    heightByTowerId: Map<string, number>
    colorByTowerId: Map<string, string>
    maxSpanM?: number
    lines?: Array<{
      id: string
      geometry?: { type: string; coordinates: number[][] }
      metadata?: Record<string, unknown>
    }>
    defaultColor?: string
  }
): string[] {
  const ids: string[] = []
  if (towers.length < 2) return ids

  const maxSpanM = options.maxSpanM ?? 900
  const byId = new Map(towers.map((t) => [t.id, t]))
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const edges = new Map<string, [typeof towers[0], typeof towers[0]]>()

  const addEdge = (a: (typeof towers)[0], b: (typeof towers)[0]) => {
    const dLat = (a.latitude - b.latitude) * 111320
    const dLon =
      (a.longitude - b.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180)
    if (Math.hypot(dLat, dLon) > maxSpanM) return
    edges.set(edgeKey(a.id, b.id), [a, b])
  }

  // 1) Explicit adjacency from corridor sync (multi-line junctions included)
  towers.forEach((t) => {
    const adj = t.metadata?.adjacent_towers
    if (!Array.isArray(adj)) return
    adj.forEach((n) => {
      if (!n || typeof n !== 'object') return
      const nid = String((n as { tower_id?: string }).tower_id || '')
      const other = byId.get(nid)
      if (other) addEdge(t, other)
    })
  })

  // 2) Order towers along each line polyline (matches green corridor overlay)
  const distPointToSeg = (
    lon: number,
    lat: number,
    a: number[],
    b: number[]
  ): { d: number; along: number; segLen: number } => {
    const latR = (lat * Math.PI) / 180
    const mLat = 111320
    const mLon = Math.max(111320 * Math.cos(latR), 1)
    const ax = (a[0] - lon) * mLon
    const ay = (a[1] - lat) * mLat
    const bx = (b[0] - lon) * mLon
    const by = (b[1] - lat) * mLat
    const abx = bx - ax
    const aby = by - ay
    const ab2 = abx * abx + aby * aby
    const t = ab2 < 1e-6 ? 0 : Math.max(0, Math.min(1, (-ax * abx - ay * aby) / ab2))
    const d = Math.hypot(ax + t * abx, ay + t * aby)
    const segLen = Math.hypot((b[0] - a[0]) * mLon, (b[1] - a[1]) * mLat)
    return { d, along: t * segLen, segLen }
  }

  ;(options.lines || []).forEach((line) => {
    if (line.geometry?.type !== 'LineString') return
    const coords = line.geometry.coordinates
    if (!coords || coords.length < 2) return

    const alongTowers: Array<{ along: number; tower: (typeof towers)[0] }> = []
    towers.forEach((tw) => {
      let bestD = Number.POSITIVE_INFINITY
      let along = 0
      let cum = 0
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i]
        const b = coords[i + 1]
        const hit = distPointToSeg(tw.longitude, tw.latitude, a, b)
        if (hit.d < bestD) {
          bestD = hit.d
          along = cum + hit.along
        }
        cum += hit.segLen
      }
      if (bestD <= 120) alongTowers.push({ along, tower: tw })
    })
    alongTowers.sort((x, y) => x.along - y.along)
    for (let i = 0; i < alongTowers.length - 1; i++) {
      addEdge(alongTowers[i].tower, alongTowers[i + 1].tower)
    }
  })

  // 3) Fallback nearest-neighbour chains if still sparse
  if (edges.size === 0) {
    const remaining = new Set(towers.map((t) => t.id))
    let current = [...towers].sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude)[0]
    remaining.delete(current.id)
    while (remaining.size > 0) {
      let bestId: string | null = null
      let bestDist = Number.POSITIVE_INFINITY
      for (const id of remaining) {
        const t = byId.get(id)!
        const dLat = (t.latitude - current.latitude) * 111320
        const dLon =
          (t.longitude - current.longitude) * 111320 * Math.cos((current.latitude * Math.PI) / 180)
        const d = Math.hypot(dLat, dLon)
        if (d < bestDist) {
          bestDist = d
          bestId = id
        }
      }
      if (!bestId || bestDist > maxSpanM) {
        const nextSeed = [...remaining]
          .map((id) => byId.get(id)!)
          .sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude)[0]
        if (!nextSeed) break
        current = nextSeed
        remaining.delete(current.id)
        continue
      }
      const next = byId.get(bestId)!
      addEdge(current, next)
      remaining.delete(bestId)
      current = next
    }
  }

  const defaultColor = options.defaultColor ?? '#22c55e'
  let idx = 0
  edges.forEach(([a, b]) => {
    const hA = options.heightByTowerId.get(a.id) ?? 28
    const hB = options.heightByTowerId.get(b.id) ?? 28
    const color =
      options.colorByTowerId.get(a.id) ?? options.colorByTowerId.get(b.id) ?? defaultColor
    const steps = 8
    const positions: Cartesian3[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const lon = a.longitude + (b.longitude - a.longitude) * t
      const lat = a.latitude + (b.latitude - a.latitude) * t
      const midSag = Math.min(hA, hB) * 0.06 * Math.sin(Math.PI * t)
      const up = Math.max(hA + (hB - hA) * t - midSag, 6)
      positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, up))
    }
    const ent = viewer.entities.add({
      id: `span-${a.id}-${b.id}-${idx++}`,
      polyline: {
        positions,
        width: 2.8,
        arcType: Cesium.ArcType.NONE,
        material: Cesium.Color.fromCssColorString(color).withAlpha(0.92),
      },
    })
    if (ent?.id) ids.push(ent.id as string)
  })

  return ids
}

/** Ideal live-map scale used by solid structure towers (exported above). */

function addSolidBox(
  Cesium: CesiumModule,
  viewer: Viewer,
  id: string,
  origin: SceneOrigin,
  e: number,
  n: number,
  u: number,
  dims: { x: number; y: number; z: number },
  color: string,
  props: Record<string, unknown>
) {
  return viewer.entities.add({
    id,
    position: offsetMeters(Cesium, origin, e, n, u),
    box: {
      dimensions: new Cesium.Cartesian3(dims.x, dims.y, dims.z),
      material: steel(Cesium, color, 0.98),
      outline: true,
      outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
    },
    properties: props,
  })
}

/**
 * Structure-specific solid towers (always have clear vertical extent).
 */
function addSolidStructureTower(
  Cesium: CesiumModule,
  viewer: Viewer,
  entry: TowerTypeEntry,
  origin: SceneOrigin,
  selected: boolean,
  options: { instanceId: string; labelText: string; colorOverride: string }
): string[] {
  const created: string[] = []
  const track = (id: string) => {
    created.push(id)
    return id
  }
  const baseId = `tower-${options.instanceId}`
  const color = options.colorOverride
  const props = { assetId: options.instanceId, towerTypeId: entry.id }
  const s = LIVE_STRUCTURE_SCALE
  const h = entry.heightM * s
  const structure = entry.structure

  if (structure === 'pole') {
    viewer.entities.add({
      id: track(`${baseId}-shaft`),
      position: offsetMeters(Cesium, origin, 0, 0, h / 2),
      cylinder: {
        length: h,
        topRadius: 0.55 * s,
        bottomRadius: 1.1 * s,
        material: steel(Cesium, color, 0.98),
        outline: true,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
      },
      properties: props,
    })
    for (let i = 0; i < 3; i++) {
      const uh = h * (0.58 + i * 0.14)
      addSolidBox(Cesium, viewer, track(`${baseId}-arm-${i}`), origin, 2.2 * s, 0, uh, {
        x: 5 * s,
        y: 0.45 * s,
        z: 0.45 * s,
      }, color, props)
    }
  } else if (structure === 'h_frame') {
    const half = 4.5 * s
    ;([-1, 1] as const).forEach((side, i) => {
      viewer.entities.add({
        id: track(`${baseId}-leg-${i}`),
        position: offsetMeters(Cesium, origin, side * half, 0, h / 2),
        cylinder: {
          length: h,
          topRadius: 0.7 * s,
          bottomRadius: 1.15 * s,
          material: steel(Cesium, color, 0.98),
          outline: true,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.5),
        },
        properties: props,
      })
    })
    addSolidBox(Cesium, viewer, track(`${baseId}-beam`), origin, 0, 0, h * 0.9, {
      x: half * 2 + 2 * s,
      y: 0.7 * s,
      z: 0.7 * s,
    }, color, props)
  } else {
    // Lattice family: 4 corner legs + body taper cue + structure-specific arms
    const cfg = latticeConfig(structure)
    const baseHalf = cfg.baseHalf * s
    const topHalf = cfg.topHalf * s
    const signs: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    signs.forEach((sg, i) => {
      // Place leg centered between base and top footprint (reads as taper from afar)
      const midE = ((sg[0] * (baseHalf + topHalf)) / 2)
      const midN = ((sg[1] * (baseHalf + topHalf)) / 2)
      viewer.entities.add({
        id: track(`${baseId}-leg-${i}`),
        position: offsetMeters(Cesium, origin, midE, midN, h / 2),
        cylinder: {
          length: h,
          topRadius: 0.35 * s,
          bottomRadius: 0.75 * s,
          material: steel(Cesium, color, 0.98),
          outline: true,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.45),
        },
        properties: props,
      })
    })
    // Central lattice body (visible silhouette)
    addSolidBox(Cesium, viewer, track(`${baseId}-body`), origin, 0, 0, h * 0.42, {
      x: (baseHalf + topHalf) * 0.7,
      y: (baseHalf + topHalf) * 0.7,
      z: h * 0.78,
    }, color, props)

    cfg.armLevels.forEach((frac, i) => {
      const reach = (cfg.armReach + i * cfg.armStep) * s
      const uh = h * frac
      addSolidBox(Cesium, viewer, track(`${baseId}-arm-${i}`), origin, 0, 0, uh, {
        x: reach * 2,
        y: 0.55 * s,
        z: 0.55 * s,
      }, color, props)
    })

    // Peak
    addSolidBox(Cesium, viewer, track(`${baseId}-peak`), origin, 0, 0, h + 2 * s, {
      x: 1.2 * s,
      y: 1.2 * s,
      z: 5 * s,
    }, color, props)
  }

  viewer.entities.add({
    id: track(baseId),
    name: entry.label,
    position: offsetMeters(Cesium, origin, 0, 0, h + 10 * s),
    point: {
      pixelSize: selected ? 14 : 8,
      color: Cesium.Color.fromCssColorString(color),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: selected ? 3 : 1.5,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: options.labelText,
      font: selected ? 'bold 13px sans-serif' : '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0a1020').withAlpha(0.85),
      backgroundPadding: new Cesium.Cartesian2(8, 5),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 25000),
    },
    properties: props,
  })

  return created
}

function createAnimatedLineMaterial(Cesium: CesiumModule, cssColor: string) {
  const baseColor = Cesium.Color.fromCssColorString(cssColor)
  return new Cesium.PolylineGlowMaterialProperty({
    color: new Cesium.CallbackProperty((time) => {
      const t = time ?? Cesium.JulianDate.now()
      const millis = Cesium.JulianDate.toDate(t).getTime()
      const pulse = 0.3 + 0.2 * (Math.sin(millis * 0.0013) + 1) * 0.5
      return baseColor.withAlpha(0.35 + pulse * 0.35)
    }, false),
    glowPower: new Cesium.CallbackProperty((time) => {
      const t = time ?? Cesium.JulianDate.now()
      const millis = Cesium.JulianDate.toDate(t).getTime()
      return 0.15 + 0.08 * Math.sin(millis * 0.0016)
    }, false),
  })
}

export function addCatenaryConductors(
  Cesium: CesiumModule,
  viewer: Viewer,
  idPrefix: string,
  origin: SceneOrigin,
  from: { east: number; north: number; height: number },
  to: { east: number; north: number; height: number },
  phases = 3,
  cableColor = '#fde68a'
): string[] {
  const ids: string[] = []
  const steps = 20
  const scale = DEFAULT_SCALE

  for (let p = 0; p < phases; p++) {
    const lateral = (p - (phases - 1) / 2) * 3
    const positions: Cartesian3[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const east = from.east + (to.east - from.east) * t + lateral * 0.2
      const north = from.north + (to.north - from.north) * t
      const midSag = 8 * Math.sin(Math.PI * t)
      const up = (from.height + (to.height - from.height) * t - midSag) * scale
      positions.push(offsetMeters(Cesium, origin, east, north, Math.max(up, 2)))
    }

    const entity = viewer.entities.add({
      id: `${idPrefix}-phase-${p}`,
      polyline: {
        positions,
        width: 3,
        material: createAnimatedLineMaterial(Cesium, cableColor),
      },
    })
    ids.push(entity.id as string)
  }

  const midEast = (from.east + to.east) / 2
  const midNorth = (from.north + to.north) / 2
  const midHeight = ((from.height + to.height) / 2 + 10) * scale
  const label = viewer.entities.add({
    id: `${idPrefix}-label`,
    position: offsetMeters(Cesium, origin, midEast, midNorth, Math.max(midHeight, 8)),
    label: {
      text: `Power Line ${idPrefix.replace(/^span-/, '')}`,
      font: 'bold 12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -10),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 220000),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0f172a').withAlpha(0.8),
      backgroundPadding: new Cesium.Cartesian2(8, 4),
    },
  })
  ids.push(label.id as string)

  return ids
}

export function addSaggingLinePath(
  Cesium: CesiumModule,
  viewer: Viewer,
  idPrefix: string,
  coordinates: number[][],
  heights: number[],
  phases = 3,
  cableColor = '#fde68a'
): string[] {
  const ids: string[] = []
  if (coordinates.length < 2 || heights.length !== coordinates.length) return ids

  const origin: SceneOrigin = { lon: coordinates[0][0], lat: coordinates[0][1] }
  const points = coordinates.map(([lon, lat], idx) => {
    const meters = degToMeters(origin, lon, lat)
    return {
      east: meters.east,
      north: meters.north,
      height: heights[idx],
    }
  })

  for (let i = 0; i < points.length - 1; i++) {
    ids.push(
      ...addCatenaryConductors(
        Cesium,
        viewer,
        `${idPrefix}-span-${i}`,
        origin,
        points[i],
        points[i + 1],
        phases,
        cableColor
      )
    )
  }

  const midPoint = points[Math.floor(points.length / 2)]
  const label = viewer.entities.add({
    id: `${idPrefix}-label`,
    position: offsetMeters(Cesium, origin, midPoint.east, midPoint.north, Math.max(midPoint.height, 8)),
    label: {
      text: `Power Line ${idPrefix}`,
      font: 'bold 12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -10),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 220000),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#0f172a').withAlpha(0.8),
      backgroundPadding: new Cesium.Cartesian2(8, 4),
    },
  })
  ids.push(label.id as string)

  return ids
}

/**
 * Create a GPU-instanced collection of a small GLTF tower model.
 * The function attempts to use Cesium's ModelInstanceCollection if available.
 * Returns the created primitive/collection or null on failure.
 */
export async function createInstancedTowerCollection(
  Cesium: CesiumModule,
  viewer: Viewer,
  assets: Array<{ id: string; longitude: number; latitude: number; health_score?: string }>,
  gltfUrl = '/models/tower.glb'
): Promise<any | null> {
  try {
    const MIC = (Cesium as any).ModelInstanceCollection
    if (!MIC) return null

    const instances = assets.map((a) => {
      const pos = Cesium.Cartesian3.fromDegrees(a.longitude, a.latitude, 0)
      const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos)
      const css = a.health_score === 'critical' ? '#d62828' : a.health_score === 'attention_required' ? '#f77f00' : '#ef4444'
      const color = Cesium.Color.fromCssColorString(css)
      return {
        id: `tower-${a.id}`,
        modelMatrix,
        scale: 1.0,
        color,
      }
    })

    const collection = new MIC({
      gltf: gltfUrl,
      instances,
      allowPicking: true,
    })

    viewer.scene.primitives.add(collection)
    return collection
  } catch (err) {
    // If anything fails, return null so caller can fallback.
    // eslint-disable-next-line no-console
    console.warn('Instancing not available or failed:', err)
    return null
  }
}

export function addSubstationYard(
  Cesium: CesiumModule,
  viewer: Viewer,
  origin: SceneOrigin,
  eastM: number,
  northM: number
): string {
  const id = 'substation-yard'
  const scale = DEFAULT_SCALE
  viewer.entities.add({
    id: `${id}-pad`,
    position: offsetMeters(Cesium, origin, eastM, northM, 1),
    box: {
      dimensions: new Cesium.Cartesian3(60 * scale, 40 * scale, 2),
      material: Cesium.Color.fromCssColorString('#475569').withAlpha(0.95),
      outline: true,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
    },
  })
  for (let i = 0; i < 3; i++) {
    viewer.entities.add({
      id: `${id}-xfmr-${i}`,
      position: offsetMeters(Cesium, origin, eastM - 12 + i * 12, northM - 5, 10 * scale),
      box: {
        dimensions: new Cesium.Cartesian3(6 * scale, 5 * scale, 10 * scale),
        material: Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.95),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    })
  }
  viewer.entities.add({
    id: `${id}-bus`,
    position: offsetMeters(Cesium, origin, eastM, northM + 8, 14 * scale),
    box: {
      dimensions: new Cesium.Cartesian3(45 * scale, 0.6 * scale, 0.6 * scale),
      material: Cesium.Color.fromCssColorString('#fbbf24'),
    },
  })
  viewer.entities.add({
    id: `${id}-gantry`,
    position: offsetMeters(Cesium, origin, eastM + 22, northM, 16 * scale),
    box: {
      dimensions: new Cesium.Cartesian3(3 * scale, 24 * scale, 28 * scale),
      material: Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.9),
      outline: true,
      outlineColor: Cesium.Color.BLACK,
    },
  })
  viewer.entities.add({
    id,
    name: 'Substation',
    position: offsetMeters(Cesium, origin, eastM, northM, 40 * scale),
    label: {
      text: 'Substation\nGantry · Bus · Transformers',
      font: 'bold 15px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 4,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString('#1e3a5f').withAlpha(0.9),
      backgroundPadding: new Cesium.Cartesian2(12, 8),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    properties: { towerTypeId: 'substation' },
  })
  return id
}

export function addDemoGround(Cesium: CesiumModule, viewer: Viewer, origin: SceneOrigin): void {
  viewer.entities.add({
    id: 'demo-ground',
    position: offsetMeters(Cesium, origin, 140, 30, -1),
    box: {
      dimensions: new Cesium.Cartesian3(500, 260, 2),
      material: Cesium.Color.fromCssColorString('#166534').withAlpha(0.95),
    },
  })
}

export function zoomToShowcase(Cesium: CesiumModule, viewer: Viewer, origin: SceneOrigin): void {
  const center = offsetMeters(Cesium, origin, 150, 30, 40)
  const sphere = new Cesium.BoundingSphere(center, 220)
  viewer.camera.flyToBoundingSphere(sphere, {
    duration: 0.6,
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(40),
      Cesium.Math.toRadians(-30),
      380
    ),
  })
}
