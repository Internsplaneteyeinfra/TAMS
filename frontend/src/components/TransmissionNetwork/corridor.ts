import * as THREE from 'three'
import type { ViewportTier } from './types'

export const TOWER_HEIGHT = 1.9

export interface TowerSlot {
  position: THREE.Vector3
  rotationY: number
  scale: number
  /** normalized 0..1 position along the corridor (for scan highlighting) */
  corridorT: number
}

export interface CorridorLayout {
  towers: TowerSlot[]
  transformerPos: THREE.Vector3
  transformerRotY: number
  transformerScale: number
  /** ground path through tower bases → transformer (scan beam travels along it) */
  groundCurve: THREE.CatmullRomCurve3
  /** conductor curves (with sag) spanning the full corridor into the transformer */
  conductorCurves: THREE.CatmullRomCurve3[]
}

// Corridor waypoints — foreground-left sweeping to background-right.
// The slot after the last tower holds the transformer: kept to the right of
// the corridor and not much deeper, so it stays clearly visible.
//
// The first two entries are LOCKED: they place the foreground towers whose
// framing is final. Everything from index 2 on recedes faster so the corridor
// silhouette drops below the centered heading and leaves it unobstructed.
// Indices 0/1 are LOCKED — do not change. Indices 2+ follow a gentle arc (bowing
// toward the camera at centre) so the corridor reads circular, not a straight line.
const WAYPOINTS: [number, number, number][] = [
  [-3.4, 0, 2.3], // 1 — far-left foreground
  [-4.7, 0, -2.85], // 2 — left of Suitability, mid-depth
  [-2.55, 0, -7.55], // 3 — shifted right, between 2 and 4 on the arc
  [-0.55, 0, -10.15], // 4 — deep, Suitability/Analyzer gap
  [0.95, 0, -11.65], // 5 — deepest centre (below heading)
  [3.75, 0, -9.15], // 6 — Performance gap
  [6.35, 0, -6.25], // 7 — right wing toward substation
  [8.45, 0, -6.55], // transformer slot
]

const SCALE_JITTER = [1.0, 0.96, 1.1, 0.9, 0.76, 0.88, 1.06]
const MID_TOWER_LIFT = [0, 0, 0.02, 0.02, 0.02, 0.02, 0.02]
const ROT_JITTER = [0.12, -0.08, 0.04, 0.01, 0, -0.02, 0.03]

const TOWER_COUNT: Record<ViewportTier, number> = {
  desktop: 7,
  tablet: 4,
  mobile: 3,
}

const TRANSFORMER_SCALE: Record<ViewportTier, number> = {
  desktop: 1.55,
  tablet: 1.2,
  mobile: 1.0,
}

export function buildCorridor(viewport: ViewportTier): CorridorLayout {
  const count = TOWER_COUNT[viewport]
  const spread = viewport === 'mobile' ? 0.72 : viewport === 'tablet' ? 0.8 : 1
  const pts = WAYPOINTS.map(([x, y, z]) => new THREE.Vector3(x * spread, y, z * spread))

  const towers: TowerSlot[] = []
  for (let i = 0; i < count; i++) {
    const p = pts[i]
    const next = pts[Math.min(i + 1, pts.length - 1)]
    const dir = next.clone().sub(p).setY(0).normalize()
    const facing = Math.atan2(dir.x, dir.z)
    const lift = MID_TOWER_LIFT[i] ?? 0
    towers.push({
      position: p.clone().setY(p.y + lift),
      rotationY: facing + (ROT_JITTER[i] ?? 0),
      scale: SCALE_JITTER[i] ?? 0.9,
      corridorT: count > 1 ? i / count : 0,
    })
  }

  const transformerPos = pts[count].clone()
  const prev = pts[count - 1]
  const tDir = transformerPos.clone().sub(prev).setY(0).normalize()
  const transformerRotY = Math.atan2(tDir.x, tDir.z)
  const transformerScale = TRANSFORMER_SCALE[viewport]

  const groundPts = [...towers.map((t) => t.position.clone()), transformerPos.clone()]
  const groundCurve = new THREE.CatmullRomCurve3(groundPts, false, 'catmullrom', 0.32)

  // Conductor paths: through each tower's arm attach points with mid-span sag,
  // ending at the transformer bushings.
  const conductorCurves: THREE.CatmullRomCurve3[] = []
  const levels: { h: number; lateral: number }[] = [
    { h: TOWER_HEIGHT * 0.86, lateral: 0 },
    { h: TOWER_HEIGHT * 0.72, lateral: 0.15 },
    { h: TOWER_HEIGHT * 0.72, lateral: -0.15 },
  ]
  const levelCount = viewport === 'mobile' ? 2 : 3

  for (let li = 0; li < levelCount; li++) {
    const { h, lateral } = levels[li]
    const attach: THREE.Vector3[] = []

    for (let i = 0; i < towers.length; i++) {
      const t = towers[i]
      const next = i < towers.length - 1 ? towers[i + 1].position : transformerPos
      const dir = next.clone().sub(t.position).setY(0).normalize()
      const perp = new THREE.Vector3(-dir.z, 0, dir.x)
      attach.push(
        t.position
          .clone()
          .add(perp.multiplyScalar(lateral * t.scale))
          .setY(h * t.scale)
      )
    }
    // Transformer bushing attach — low, converging (scaled with the unit)
    attach.push(
      transformerPos
        .clone()
        .add(new THREE.Vector3(lateral * 0.3 * transformerScale, 0.62 * transformerScale, 0))
    )

    // Insert sagging midpoints between attach points
    const withSag: THREE.Vector3[] = []
    for (let i = 0; i < attach.length; i++) {
      withSag.push(attach[i])
      if (i < attach.length - 1) {
        const mid = attach[i].clone().lerp(attach[i + 1], 0.5)
        const span = attach[i].distanceTo(attach[i + 1])
        // Deeper catenary sag: reads as real conductors and drops the mid-span
        // wires clear of the centered heading
        mid.y -= span * 0.1
        withSag.push(mid)
      }
    }
    conductorCurves.push(new THREE.CatmullRomCurve3(withSag, false, 'catmullrom', 0.45))
  }

  return { towers, transformerPos, transformerRotY, transformerScale, groundCurve, conductorCurves }
}

/**
 * Mid-corridor wire sag so conductors frame the heading/cards in both themes.
 * Towers 0–1 are locked; this only adjusts wire vertex height, not tower geometry.
 */
export function headingClearanceY(t: number, blend: number) {
  const u = THREE.MathUtils.clamp(t, 0, 1)
  // Soft sag only where wires would cross the heading/card band —
  // keep conductors visible in the open space above the cards.
  const bell = Math.exp(-((u - 0.4) / 0.15) * ((u - 0.4) / 0.15))
  const base = 0.12
  const lightExtra = blend * 0.12
  return (base + lightExtra) * bell
}
