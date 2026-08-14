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
const WAYPOINTS: [number, number, number][] = [
  [-3.4, 0, 2.3],
  [-1.85, 0, 1.05],
  [-0.2, 0, -0.5],
  [1.45, 0, -1.7],
  [2.9, 0, -2.75],
  [4.2, 0, -3.65],
  [5.35, 0, -4.4],
  [6.0, 0, -5.15],
]

const TOWER_COUNT: Record<ViewportTier, number> = {
  desktop: 7,
  tablet: 4,
  mobile: 3,
}

// Larger transformer where it sits deeper in the corridor
const TRANSFORMER_SCALE: Record<ViewportTier, number> = {
  desktop: 1.85,
  tablet: 1.3,
  mobile: 1.05,
}

// Indices 0/1 are locked; 2+ fall off faster to build foreground → midground
// → background depth
const SCALE_JITTER = [1.0, 0.96, 0.84, 0.75, 0.68, 0.62, 0.57]
const ROT_JITTER = [0.12, -0.08, 0.15, -0.12, 0.06, -0.05, 0.1]

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
    towers.push({
      position: p,
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
  const groundCurve = new THREE.CatmullRomCurve3(groundPts, false, 'catmullrom', 0.4)

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
