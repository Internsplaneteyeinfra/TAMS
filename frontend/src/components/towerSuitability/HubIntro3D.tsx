/**
 * Tower Suitability hub intro — cinematic 3D engineering sequence.
 *
 * Story: terrain rises → proposed-site marker → foundation → the tower is
 * lowered and locks in → a site scan sweeps the terrain revealing
 * suitability zones → analysis ready → the scene settles into a dim
 * digital-twin background behind the start cards.
 *
 * The terrain, environment and suitability zones are illustrative
 * visualization layers (no engineering data exists at this stage). The zone
 * layout lives in DEMO_ZONES so it can later be fed from real backend
 * results without touching the scene code.
 */

import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
// Deep three imports keep drei/three-stdlib out of the chunk (same pattern
// as the landing network scene).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// Do not import MeshoptDecoder from three/examples — Next.js cannot bundle that file.
import { MeshoptDecoder } from 'meshoptimizer'
import type { MutableRefObject } from 'react'

const MODEL_PATH = '/models/transmission_tower.glb'
const TOWER_HEIGHT = 6.8
const TERRAIN_W = 64
const TERRAIN_D = 42

const configureLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder)
}

export type HubTier = 'desktop' | 'tablet' | 'mobile'
export type HubIntroMode = 'full' | 'instant'

export type HubIntroEvent =
  | { kind: 'status'; text: string | null }
  | { kind: 'marker' }
  | { kind: 'scanStart' }
  | { kind: 'indicators' }
  | { kind: 'done' }

interface HubIntro3DProps {
  mode: HubIntroMode
  tier: HubTier
  skipRef: MutableRefObject<boolean>
  onEvent: (e: HubIntroEvent) => void
  /** Light hub matches the Suitability start screen daylight look. */
  appearance?: 'dark' | 'light'
}

// Timeline anchors (seconds) — ~6.9s total in full mode
const T = {
  init: 0.05,
  terrain: 0.8,
  terrainDur: 1.2,
  marker: 2.0,
  foundation: 2.5,
  foundationDur: 0.55,
  tower: 3.0,
  towerDur: 1.0,
  scan: 4.15,
  scanDur: 1.5,
  indicators: 5.65,
  ready: 6.25,
  done: 6.9,
}
const LOCK_T = T.tower + T.towerDur

const ease = (v: number) => {
  const t = Math.min(1, Math.max(0, v))
  return t * t * (3 - 2 * t)
}

// --- seeded value noise (fixed seed → same site layout every visit) ---
function hash2(ix: number, iz: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const sx = fx * fx * (3 - 2 * fx)
  const sz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz, seed)
  const b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed)
  const d = hash2(ix + 1, iz + 1, seed)
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
}

function smoothstep(e0: number, e1: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const SEED = 20260814

function terrainHeight(x: number, z: number): number {
  const n =
    valueNoise(x * 0.05 + 7.3, z * 0.05 - 3.1, SEED) * 1.0 +
    valueNoise(x * 0.11 + 1.7, z * 0.11 + 9.4, SEED ^ 0x9e37) * 0.45 +
    valueNoise(x * 0.24 - 4.2, z * 0.24 + 2.8, SEED ^ 0x51ab) * 0.16
  let h = (n / 1.61 - 0.5) * 2 * 1.9
  // broad swell for natural elevation variation
  h += (valueNoise(x * 0.018 + 3.7, z * 0.018 - 8.9, SEED ^ 0x77aa) - 0.5) * 2.4
  // hills toward the horizon, valley in the working area
  const r = Math.max(Math.abs(x) / (TERRAIN_W / 2), Math.abs(z) / (TERRAIN_D / 2))
  h += smoothstep(0.5, 1, r) * 2.3
  // a second flatter area near the road corridor
  const dFlat = Math.hypot(x + 14, z - 7)
  h *= 1 - 0.55 * (1 - smoothstep(2.5, 7, dFlat))
  // graded flat pad where the tower is installed
  const dPad = Math.hypot(x, z)
  h *= 1 - 0.85 * (1 - smoothstep(3.2, 9, dPad))
  return h
}

function stylizeTower(root: THREE.Object3D, light: boolean): THREE.MeshStandardMaterial[] {
  const mats: THREE.MeshStandardMaterial[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const apply = (mat: THREE.Material) => {
      const m = mat.clone() as THREE.MeshStandardMaterial
      if (m.isMeshStandardMaterial) {
        if (light) {
          // Slightly darker steel so daylight towers read with more mass
          m.color.set('#3F4E5C')
          m.metalness = 0.5
          m.roughness = 0.52
          m.emissive.set('#2a3f4c')
          m.emissiveIntensity = 0.035
        } else {
          m.color.set('#98a7ba')
          m.metalness = 0.55
          m.roughness = 0.38
          m.emissive.set('#1b6d8c')
          m.emissiveIntensity = 0.22
        }
        mats.push(m)
      }
      return m
    }
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(apply)
    else if (mesh.material) mesh.material = apply(mesh.material)
  })
  return mats
}

/**
 * Illustrative suitability zones. Structured so a later iteration can map
 * real backend results into the same shape.
 */
const DEMO_ZONES: Array<{ x: number; z: number; r: number; color: string }> = [
  { x: 0, z: 0, r: 3.0, color: '#2e7d54' }, // suitable — the proposed pad
  { x: -6.5, z: 4.5, r: 2.2, color: '#2e7d54' },
  { x: 7.5, z: -3.5, r: 2.3, color: '#a37b2c' },
  { x: -11, z: -7.5, r: 2.0, color: '#a37b2c' },
  { x: 14.5, z: -9, r: 2.1, color: '#9c3f3c' },
  { x: -17, z: 9.5, r: 1.8, color: '#9c3f3c' },
]

/** Environmental context clusters: representative x used for scan highlight. */
const TREES = [
  { x: -11.5, z: -6.5, s: 1.0 },
  { x: -10.2, z: -8.4, s: 0.8 },
  { x: -13.2, z: -8.0, s: 1.15 },
  { x: -12.4, z: -5.2, s: 0.7 },
  { x: -9.0, z: -7.2, s: 0.9 },
]
const BUILDINGS = [
  { x: 17.5, z: 8.5, w: 1.8, h: 1.1, d: 1.4 },
  { x: 19.6, z: 7.2, w: 1.4, h: 1.6, d: 1.2 },
  { x: 16.2, z: 10.4, w: 1.2, h: 0.9, d: 1.2 },
]
const ROCKS = [
  { x: 8.5, z: -9.5, s: 0.7 },
  { x: 9.8, z: -8.2, s: 0.5 },
  { x: 7.4, z: -10.8, s: 0.9 },
]

function IntroScene({ mode, tier, skipRef, onEvent, appearance = 'dark' }: HubIntro3DProps) {
  const { camera, scene } = useThree()
  const light = appearance === 'light'

  // --- terrain geometry: graphite/steel (dark) or olive grass (light) ---
  const { terrainGeo, wireGeo } = useMemo(() => {
    const segX = tier === 'desktop' ? 96 : tier === 'tablet' ? 72 : 48
    const segZ = tier === 'desktop' ? 64 : tier === 'tablet' ? 48 : 32
    const geo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, segX, segZ)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const cLow = new THREE.Color(light ? '#6A8258' : '#1f2d3f')
    const cHigh = new THREE.Color(light ? '#9BB08A' : '#54718f')
    const tmp = new THREE.Color()
    let minH = Infinity
    let maxH = -Infinity
    const hs = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      const h = terrainHeight(pos.getX(i), pos.getZ(i))
      hs[i] = h
      minH = Math.min(minH, h)
      maxH = Math.max(maxH, h)
    }
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, hs[i])
      const hn = (hs[i] - minH) / Math.max(0.001, maxH - minH)
      tmp.copy(cLow).lerp(cHigh, hn)
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    const wSegX = tier === 'desktop' ? 44 : tier === 'tablet' ? 34 : 24
    const wSegZ = tier === 'desktop' ? 30 : tier === 'tablet' ? 24 : 16
    const wire = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, wSegX, wSegZ)
    wire.rotateX(-Math.PI / 2)
    const wPos = wire.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < wPos.count; i++) {
      wPos.setY(i, terrainHeight(wPos.getX(i), wPos.getZ(i)) + 0.03)
    }
    return { terrainGeo: geo, wireGeo: wire }
  }, [tier, light])

  // --- road ribbon draped on the terrain ---
  const roadGeo = useMemo(() => {
    const N = 44
    const halfW = 0.7
    const verts: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= N; i++) {
      const x = -TERRAIN_W / 2 + (i / N) * TERRAIN_W
      const z = 7.5 + Math.sin(x * 0.09) * 2.2
      const dz = 0.09 * 2.2 * Math.cos(x * 0.09)
      const len = Math.hypot(1, dz)
      const nx = -dz / len
      const nz = 1 / len
      const ax = x + nx * halfW
      const az = z + nz * halfW
      const bx = x - nx * halfW
      const bz = z - nz * halfW
      verts.push(ax, terrainHeight(ax, az) + 0.05, az, bx, terrainHeight(bx, bz) + 0.05, bz)
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    return geo
  }, [])

  // --- corridor endpoint (right) + conductor spans with power-flow beads ---
  const RIGHT_TOWER_X = 15.8
  const RIGHT_TOWER_Z = -4.6
  const LEFT_ANCHOR_X = -15.5
  const LEFT_ANCHOR_Z = -5.2

  const conductors = useMemo(() => {
    type Span = {
      line: THREE.Line
      curve: THREE.QuadraticBezierCurve3
      beads: THREE.Mesh[]
      beadGroup: THREE.Group
      dir: 1 | -1
    }
    const mkSpan = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      sag: number,
      dir: 1 | -1,
      beadCount = 5
    ): Span => {
      const mid = from.clone().lerp(to, 0.5)
      mid.y = Math.min(from.y, to.y) - sag
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48))
      const mat = new THREE.LineBasicMaterial({
        color: light ? '#3E5160' : '#3b6a7d',
        transparent: true,
        opacity: 0,
      })
      const line = new THREE.Line(geo, mat)
      const beadGroup = new THREE.Group()
      beadGroup.visible = false
      const beads: THREE.Mesh[] = []
      for (let i = 0; i < beadCount; i++) {
        const beadMat = new THREE.MeshBasicMaterial({
          color: light ? '#0891B2' : '#22d3ee',
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), beadMat)
        beads.push(mesh)
        beadGroup.add(mesh)
      }
      return { line, curve, beads, beadGroup, dir }
    }

    const phaseY = [5.9, 5.55, 5.2]
    const rightBase = terrainHeight(RIGHT_TOWER_X, RIGHT_TOWER_Z)
    const leftBase = terrainHeight(LEFT_ANCHOR_X, LEFT_ANCHOR_Z)
    const rightAttach = phaseY.map(
      (y, i) =>
        new THREE.Vector3(
          RIGHT_TOWER_X + (i - 1) * 0.38,
          rightBase + y * 0.88,
          RIGHT_TOWER_Z + (i - 1) * 0.14
        )
    )
    const leftAttach = phaseY.map(
      (y, i) =>
        new THREE.Vector3(
          LEFT_ANCHOR_X + (i - 1) * 0.28,
          leftBase + y * 0.82,
          LEFT_ANCHOR_Z + (i - 1) * 0.1
        )
    )

    const spans: Span[] = []
    phaseY.forEach((y, i) => {
      spans.push(
        mkSpan(new THREE.Vector3((i - 1) * 0.22, y, 0.08 * (i - 1)), rightAttach[i], 1.75 + i * 0.12, 1)
      )
    })
    phaseY.forEach((y, i) => {
      spans.push(
        mkSpan(new THREE.Vector3((i - 1) * 0.22, y, 0.08 * (i - 1)), leftAttach[i], 1.55 + i * 0.1, -1, 4)
      )
    })

    return spans
  }, [light])

  useEffect(() => () => {
    terrainGeo.dispose()
    wireGeo.dispose()
    roadGeo.dispose()
    conductors.forEach((s) => {
      s.line.geometry.dispose()
      ;(s.line.material as THREE.Material).dispose()
      s.beads.forEach((b) => {
        b.geometry.dispose()
        ;(b.material as THREE.Material).dispose()
      })
    })
  }, [terrainGeo, wireGeo, roadGeo, conductors])

  // Zones + wireframe are revealed behind the moving scan line
  const clipPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(-1, 0, 0), -(TERRAIN_W / 2) - 2),
    []
  )

  // --- environment materials (shared, highlighted as the scan passes) ---
  const envMats = useMemo(() => {
    const mk = (color: string, rough = 0.9) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: rough,
        metalness: 0.05,
        emissive: light ? '#0891B2' : '#22d3ee',
        emissiveIntensity: 0,
      })
    return light
      ? {
        tree: mk('#3F6A48'),
        trunk: mk('#6A5A48'),
        building: mk('#8A9AAA'),
        rock: mk('#7A8690'),
        road: mk('#8A9280', 0.95),
      }
      : {
        tree: mk('#2d4a3e'),
        trunk: mk('#3a3f46'),
        building: mk('#253243'),
        rock: mk('#2a3644'),
        road: mk('#232f3d', 0.95),
      }
  }, [light])
  useEffect(() => () => Object.values(envMats).forEach((m) => m.dispose()), [envMats])

  // --- zone materials (clipped by the scan plane) ---
  const zoneMats = useMemo(
    () =>
      DEMO_ZONES.map(
        (z) =>
          new THREE.MeshBasicMaterial({
            color: z.color,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            clippingPlanes: [clipPlane],
          })
      ),
    [clipPlane]
  )
  useEffect(() => () => zoneMats.forEach((m) => m.dispose()), [zoneMats])

  // --- tower model (existing GLB, normalized, base at y=0) ---
  const gltf = useLoader(GLTFLoader, MODEL_PATH, configureLoader)
  const { towerHolder, towerMats, remoteTowerHolder, remoteTowerMats } = useMemo(() => {
    const fit = (root: THREE.Object3D, height: number) => {
      const mats = stylizeTower(root, light)
      const box = new THREE.Box3().setFromObject(root)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      const s = height / (size.y || 1)
      root.scale.setScalar(s)
      root.position.set(-center.x * s, -box.min.y * s, -center.z * s)
      const holder = new THREE.Group()
      holder.add(root)
      return { holder, mats }
    }
    const main = fit(gltf.scene.clone(true), TOWER_HEIGHT)
    const remote = fit(gltf.scene.clone(true), TOWER_HEIGHT * 0.92)
    return {
      towerHolder: main.holder,
      towerMats: main.mats,
      remoteTowerHolder: remote.holder,
      remoteTowerMats: remote.mats,
    }
  }, [gltf, light])

  // --- animated refs ---
  const terrainGroupRef = useRef<THREE.Group>(null)
  const wireMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const foundationRef = useRef<THREE.Group>(null)
  const towerGroupRef = useRef<THREE.Group>(null)
  const scanRef = useRef<THREE.Mesh>(null)
  const scanMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const markerRef = useRef<THREE.Group>(null)
  const markerMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const lockPulseRef = useRef<THREE.Mesh>(null)
  const lockPulseMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const towerScanRef = useRef<THREE.Mesh>(null)
  const towerScanMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const envGroupRef = useRef<THREE.Group>(null)
  const ambRef = useRef<THREE.AmbientLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const sunDirRef = useRef<THREE.DirectionalLight>(null)
  const contactShadowRef = useRef<THREE.Mesh>(null)
  const castShadowRef = useRef<THREE.Mesh>(null)
  const remoteTowerRef = useRef<THREE.Group>(null)
  const flowTmp = useMemo(() => new THREE.Vector3(), [])

  const elapsedRef = useRef(mode === 'instant' ? T.done + 0.01 : 0)
  const firedRef = useRef<Set<string>>(new Set())
  const tmpLook = useMemo(() => new THREE.Vector3(), [])

  const fire = (key: string, fn: () => void) => {
    if (firedRef.current.has(key)) return
    firedRef.current.add(key)
    fn()
  }

  const camNear = useMemo(() => new THREE.Vector3(3.6, 3.0, 9.8), [])
  const camFar = useMemo(() => {
    const mul = tier === 'mobile' ? 1.3 : tier === 'tablet' ? 1.12 : 1
    return new THREE.Vector3(9.6 * mul, 6.2 * mul, 15.8 * mul)
  }, [tier])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    if (skipRef.current) {
      if (elapsedRef.current < T.done) elapsedRef.current = T.done + 0.01
      skipRef.current = false
    }
    elapsedRef.current += dt
    const t = elapsedRef.current
    const clock = state.clock.elapsedTime

    // --- narration events (once each) ---
    fire('init', () => onEvent({ kind: 'status', text: 'INITIALIZING SITE ANALYSIS…' }))
    if (t >= T.terrain) fire('terrain', () => onEvent({ kind: 'status', text: 'GENERATING 3D TERRAIN…' }))
    if (t >= T.marker) {
      fire('marker', () => {
        onEvent({ kind: 'status', text: 'MARKING PROPOSED SITE…' })
        onEvent({ kind: 'marker' })
      })
    }
    if (t >= T.foundation)
      fire('found', () => onEvent({ kind: 'status', text: 'PLACING FOUNDATION…' }))
    if (t >= T.tower)
      fire('tower', () => onEvent({ kind: 'status', text: 'LOWERING TOWER INTO POSITION…' }))
    if (t >= T.scan) {
      fire('scan', () => {
        onEvent({ kind: 'status', text: 'SCANNING SITE…' })
        onEvent({ kind: 'scanStart' })
      })
    }
    if (t >= T.indicators) {
      fire('ind', () => {
        onEvent({ kind: 'status', text: 'EVALUATING SITE FACTORS…' })
        onEvent({ kind: 'indicators' })
      })
    }
    if (t >= T.ready) fire('ready', () => onEvent({ kind: 'status', text: '✓ SITE ANALYSIS READY' }))
    if (t >= T.done) {
      fire('done', () => {
        onEvent({ kind: 'status', text: null })
        onEvent({ kind: 'done' })
      })
    }
    const settled = t >= T.done

    // --- terrain rise (environment fades in with it) ---
    const terrainRise = ease((t - T.terrain) / T.terrainDur)
    if (terrainGroupRef.current) {
      terrainGroupRef.current.visible = t >= T.terrain
      terrainGroupRef.current.scale.y = Math.max(0.03, terrainRise)
    }
    if (envGroupRef.current) {
      envGroupRef.current.visible = terrainRise > 0.6
      const s = ease((terrainRise - 0.6) / 0.4)
      envGroupRef.current.scale.setScalar(Math.max(0.001, s))
    }

    // --- proposed-site marker: appears, pulses slowly, brightens under scan ---
    if (markerRef.current && markerMatRef.current) {
      const appear = ease((t - T.marker) / 0.5)
      markerRef.current.visible = appear > 0.01
      const pulse = 1 + Math.sin(clock * 2.2) * 0.06
      markerRef.current.scale.setScalar(Math.max(0.001, appear * pulse))
      const base = settled ? 0.4 : 0.6
      markerMatRef.current.opacity = appear * (base + Math.sin(clock * 2.2) * 0.1)
    }

    // --- foundation ---
    if (foundationRef.current) {
      const f = ease((t - T.foundation) / T.foundationDur)
      foundationRef.current.visible = f > 0.01
      foundationRef.current.scale.set(1, Math.max(0.001, f), 1)
    }

    // --- tower lowered onto the foundation (ease-out, tiny stabilization) ---
    if (towerGroupRef.current) {
      const d = ease((t - T.tower) / T.towerDur)
      towerGroupRef.current.visible = d > 0.001
      let y = 0.14 + (1 - d) * 1.6
      if (t >= LOCK_T && t < LOCK_T + 0.35) {
        y -= 0.035 * Math.sin(((t - LOCK_T) / 0.35) * Math.PI)
      }
      towerGroupRef.current.position.y = y
    }

    // --- lock-in pulse ring at the base ---
    if (lockPulseRef.current && lockPulseMatRef.current) {
      const p = (t - LOCK_T) / 0.7
      const active = p >= 0 && p < 1
      lockPulseRef.current.visible = active
      if (active) {
        lockPulseRef.current.scale.setScalar(1 + p * 1.4)
        lockPulseMatRef.current.opacity = 0.38 * (1 - p)
      }
    }

    // --- conductors fade in once the tower is locked; power beads travel along sag ---
    const lineTarget = t >= LOCK_T ? (settled ? (light ? 0.42 : 0.34) : light ? 0.55 : 0.48) : 0
    const flowOn = t >= LOCK_T + 0.15
    for (let si = 0; si < conductors.length; si++) {
      const span = conductors[si]
      const m = span.line.material as THREE.LineBasicMaterial
      m.opacity = THREE.MathUtils.damp(m.opacity, lineTarget, 4, dt)
      span.beadGroup.visible = flowOn && m.opacity > 0.08
      if (!span.beadGroup.visible) continue
      const n = span.beads.length
      for (let bi = 0; bi < n; bi++) {
        const bead = span.beads[bi]
        const u =
          ((clock * 0.22 * span.dir + bi / n + si * 0.07) % 1 + 1) % 1
        span.curve.getPoint(u, flowTmp)
        bead.position.copy(flowTmp)
        const pulse = 0.45 + 0.55 * Math.sin(u * Math.PI)
        const bm = bead.material as THREE.MeshBasicMaterial
        bm.opacity = THREE.MathUtils.damp(bm.opacity, pulse * (light ? 0.85 : 0.95), 8, dt)
        bead.scale.setScalar(0.75 + pulse * 0.55)
      }
    }

    // Remote right-corner tower rises with the conductor lock
    if (remoteTowerRef.current) {
      const d = ease((t - LOCK_T + 0.35) / 0.85)
      remoteTowerRef.current.visible = d > 0.02
      const baseY = terrainHeight(RIGHT_TOWER_X, RIGHT_TOWER_Z)
      remoteTowerRef.current.position.set(RIGHT_TOWER_X, baseY + (1 - d) * 1.2, RIGHT_TOWER_Z)
      remoteTowerRef.current.rotation.y = -0.35
    }
    for (const m of remoteTowerMats) {
      const base = settled ? (light ? 0.03 : 0.12) : light ? 0.04 : 0.16
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, base, 5, dt)
    }

    // --- site scan: intro sweep, then a continuous ambient sweep ---
    const introScanEnd = T.scan + T.scanDur
    let scanActive = false
    let scanX = 0
    let scanOpacity = 0
    if (t >= T.scan && t < introScanEnd) {
      const scanT = (t - T.scan) / T.scanDur
      scanX = THREE.MathUtils.lerp(-TERRAIN_W / 2 - 1, TERRAIN_W / 2 + 1, ease(scanT))
      scanOpacity = 0.08 * Math.sin(Math.PI * scanT)
      scanActive = true
    } else if (t >= introScanEnd) {
      // Ambient scan keeps sweeping after the intro (subtler)
      const loopT = ((t - introScanEnd) % 4) / 4
      scanX = THREE.MathUtils.lerp(-TERRAIN_W / 2 - 1, TERRAIN_W / 2 + 1, loopT)
      scanOpacity = 0.055 * Math.sin(Math.PI * loopT)
      scanActive = true
    }
    clipPlane.constant = t >= introScanEnd ? TERRAIN_W : t >= T.scan ? scanX : -(TERRAIN_W / 2) - 2
    if (wireMatRef.current) {
      const target = t >= T.scan ? (settled ? (light ? 0.028 : 0.018) : light ? 0.055 : 0.04) : 0
      wireMatRef.current.opacity = THREE.MathUtils.damp(wireMatRef.current.opacity, target, 5, dt)
    }
    if (scanRef.current && scanMatRef.current) {
      scanRef.current.visible = scanActive
      if (scanActive) {
        scanRef.current.position.x = scanX
        scanMatRef.current.opacity = scanOpacity
      }
    }

    // --- suitability zones fade in as the scanner reveals them ---
    for (const m of zoneMats) {
      const target = t >= T.scan ? (settled ? (light ? 0.14 : 0.1) : light ? 0.2 : 0.16) : 0
      m.opacity = THREE.MathUtils.damp(m.opacity, target, 5, dt)
    }

    // --- environment briefly highlights as the scan passes each cluster ---
    if (scanActive && !settled) {
      const boost = (x: number) => Math.exp(-(((scanX - x) / 4) ** 2)) * 0.22
      envMats.tree.emissiveIntensity = boost(-11.5)
      envMats.trunk.emissiveIntensity = boost(-11.5) * 0.5
      envMats.building.emissiveIntensity = boost(17.5)
      envMats.rock.emissiveIntensity = boost(8.5)
      envMats.road.emissiveIntensity = boost(scanX) * 0.25
    } else {
      for (const m of Object.values(envMats)) {
        m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, 0, 6, dt)
      }
    }

    // --- vertical tower scan during the analysis phase ---
    if (towerScanRef.current && towerScanMatRef.current) {
      const sT = (t - T.scan) / T.scanDur
      const active = sT >= 0 && sT < 1
      towerScanRef.current.visible = active
      if (active) {
        towerScanRef.current.position.y = THREE.MathUtils.lerp(6.6, 0.3, ease(sT))
        towerScanMatRef.current.opacity = 0.26 * Math.sin(Math.PI * sT)
      }
    }

    // Tower edges glow whenever a scan line passes it (x ≈ 0); hero glow
    // eases down ~15% once settled
    const glow = scanActive ? Math.exp(-((scanX / 4) ** 2)) * (settled ? 0.3 : 0.5) : 0
    const towerBase = settled ? (light ? 0.045 : 0.16) : light ? 0.06 : 0.22
    for (const m of towerMats) {
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, towerBase + glow * (light ? 0.45 : 1), 6, dt)
    }

    // --- camera: close → pull back → settle with subtle ambient drift ---
    const camT = ease((t - 0.3) / 3.9)
    const drift = settled ? Math.sin(clock * 0.14) * 0.25 : 0
    const driftY = settled ? Math.sin(clock * 0.1) * 0.1 : 0
    camera.position.set(
      THREE.MathUtils.lerp(camNear.x, camFar.x, camT) + drift,
      THREE.MathUtils.lerp(camNear.y, camFar.y, camT) + driftY,
      THREE.MathUtils.lerp(camNear.z, camFar.z, camT)
    )
    tmpLook.set(0, THREE.MathUtils.lerp(1.4, 1.9, camT), 0)
    camera.lookAt(tmpLook)

    // Light mode: slow daylight → evening sky shift (fog + key lights)
    if (light) {
      const day = 0.5 + 0.5 * Math.sin(clock * 0.085)
      const evening = 1 - day
      if (ambRef.current) ambRef.current.intensity = 0.72 + day * 0.12
      if (hemiRef.current) {
        hemiRef.current.color.set(day > 0.45 ? '#9ec8e8' : '#c9a88a')
        hemiRef.current.groundColor.set(day > 0.45 ? '#6a8a58' : '#7a6a52')
        hemiRef.current.intensity = 0.42 + day * 0.14
      }
      if (sunDirRef.current) {
        sunDirRef.current.intensity = 0.95 + day * 0.28
        sunDirRef.current.color.set(day > 0.4 ? '#fff8ee' : '#ffd2a8')
        sunDirRef.current.position.set(10 + evening * 6, 14 - evening * 4, 6)
      }
      if (scene.fog && (scene.fog as THREE.Fog).isFog) {
        const fog = scene.fog as THREE.Fog
        fog.color.set(day > 0.45 ? '#C8D8E4' : '#D4C4B0')
      }
    }

    // Contact + left-cast ground shadows grow with the tower
    const towerVis = t >= T.tower ? ease((t - T.tower) / T.towerDur) : 0
    if (contactShadowRef.current) {
      contactShadowRef.current.visible = towerVis > 0.05
      const s = 0.55 + towerVis * 0.9
      contactShadowRef.current.scale.set(s, s, 1)
      const mat = contactShadowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = towerVis * (light ? 0.28 : 0.38)
    }
    if (castShadowRef.current) {
      castShadowRef.current.visible = towerVis > 0.05
      castShadowRef.current.scale.set(0.7 + towerVis * 1.1, 0.35 + towerVis * 0.45, 1)
      const mat = castShadowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = towerVis * (light ? 0.2 : 0.3)
    }
  })

  const showEnv = tier !== 'mobile'

  return (
    <>
      {/* Daylight / digital-twin lighting */}
      <ambientLight ref={ambRef} intensity={light ? 0.78 : 0.72} />
      <hemisphereLight
        ref={hemiRef}
        args={light ? ['#9ec8e8', '#6a8a58', 0.52] : ['#3d5470', '#0b1420', 0.45]}
      />
      <directionalLight
        ref={sunDirRef}
        position={[12, 16, 8]}
        intensity={light ? 1.15 : 1.1}
        color={light ? '#fff8ee' : '#e2e8f0'}
      />
      <directionalLight
        position={[-10, 8, -10]}
        intensity={light ? 0.28 : 0.5}
        color={light ? '#98b8c8' : '#67e8f9'}
      />
      <pointLight
        position={[4, 9, 6]}
        intensity={light ? 0.35 : 0.55}
        color={light ? '#ffe8c8' : '#cfe6f5'}
        distance={26}
        decay={2}
      />
      <pointLight
        position={[-3, 2.5, 4.5]}
        intensity={light ? 0.12 : 0.3}
        color={light ? '#0891B2' : '#22d3ee'}
        distance={14}
        decay={2}
      />

      {/* Terrain + analysis-coverage wireframe (revealed by the scan) */}
      <group ref={terrainGroupRef} visible={false}>
        <mesh geometry={terrainGeo}>
          <meshStandardMaterial
            vertexColors
            flatShading
            metalness={light ? 0.04 : 0.12}
            roughness={light ? 0.95 : 0.92}
          />
        </mesh>
        <mesh geometry={wireGeo}>
          <meshBasicMaterial
            ref={wireMatRef}
            color={light ? '#0891B2' : '#22d3ee'}
            wireframe
            transparent
            opacity={0}
            depthWrite={false}
            clippingPlanes={[clipPlane]}
          />
        </mesh>

        {/* Suitability zones (illustrative; revealed by the scan) */}
        {DEMO_ZONES.map((z, i) => (
          <mesh
            key={i}
            material={zoneMats[i]}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[z.x, terrainHeight(z.x, z.z) + 0.18, z.z]}
          >
            <circleGeometry args={[z.r, 28]} />
          </mesh>
        ))}

        {/* Environmental context — road, trees, buildings, rocks */}
        <group ref={envGroupRef} visible={false}>
          <mesh geometry={roadGeo} material={envMats.road} />
          {showEnv &&
            TREES.map((tr, i) => (
              <group key={`t${i}`} position={[tr.x, terrainHeight(tr.x, tr.z), tr.z]} scale={tr.s}>
                <mesh position={[0, 0.25, 0]} material={envMats.trunk}>
                  <cylinderGeometry args={[0.06, 0.08, 0.5, 5]} />
                </mesh>
                <mesh position={[0, 0.95, 0]} material={envMats.tree}>
                  <coneGeometry args={[0.45, 1.4, 6]} />
                </mesh>
              </group>
            ))}
          {showEnv &&
            BUILDINGS.map((b, i) => (
              <mesh
                key={`b${i}`}
                material={envMats.building}
                position={[b.x, terrainHeight(b.x, b.z) + b.h / 2, b.z]}
              >
                <boxGeometry args={[b.w, b.h, b.d]} />
              </mesh>
            ))}
          {showEnv &&
            ROCKS.map((r, i) => (
              <mesh
                key={`r${i}`}
                material={envMats.rock}
                position={[r.x, terrainHeight(r.x, r.z) + r.s * 0.3, r.z]}
                rotation={[0.4 * i, 0.9 * i, 0]}
              >
                <icosahedronGeometry args={[r.s, 0]} />
              </mesh>
            ))}
        </group>
      </group>

      {/* Proposed-site marker — pulsing cyan ring + center dot */}
      <group ref={markerRef} visible={false} position={[0, 0.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.75, 1.95, 40]} />
          <meshBasicMaterial
            ref={markerMatRef}
            color={light ? '#0891B2' : '#22d3ee'}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Lock-in pulse when the tower settles */}
      <mesh ref={lockPulseRef} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
        <ringGeometry args={[1.5, 1.66, 40]} />
        <meshBasicMaterial
          ref={lockPulseMatRef}
          color={light ? '#22d3ee' : '#67e8f9'}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Foundation — concrete slab, four pads, steel anchors */}
      <group ref={foundationRef} visible={false}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[2.6, 0.14, 2.6]} />
          <meshStandardMaterial
            color={light ? '#9AA3AE' : '#4d5866'}
            metalness={0.08}
            roughness={0.9}
          />
        </mesh>
        {[
          [-0.95, -0.95],
          [0.95, -0.95],
          [-0.95, 0.95],
          [0.95, 0.95],
        ].map(([px, pz], i) => (
          <group key={i} position={[px, 0, pz]}>
            <mesh position={[0, 0.26, 0]}>
              <boxGeometry args={[0.5, 0.26, 0.5]} />
              <meshStandardMaterial
                color={light ? '#A8B0BA' : '#5b6673'}
                metalness={0.08}
                roughness={0.88}
              />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.26, 8]} />
              <meshStandardMaterial
                color={light ? '#6E7E8E' : '#8b98a8'}
                metalness={0.7}
                roughness={0.35}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Transmission tower — existing GLB */}
      <group ref={towerGroupRef} visible={false}>
        <primitive object={towerHolder} />
      </group>

      {/* Soft contact shadow + left-cast ground projection under the tower */}
      <mesh
        ref={contactShadowRef}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
      >
        <circleGeometry args={[1.55, 40]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        ref={castShadowRef}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0.35]}
        position={[-1.15, 0.11, 0.35]}
      >
        <circleGeometry args={[1.9, 40]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Right-corner transmission tower — receives the sagging corridor */}
      <group ref={remoteTowerRef} visible={false}>
        <primitive object={remoteTowerHolder} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <circleGeometry args={[1.35, 32]} />
          <meshBasicMaterial
            color="#0b1220"
            transparent
            opacity={light ? 0.22 : 0.32}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Left corridor anchor (simple pole) */}
      <group position={[LEFT_ANCHOR_X, terrainHeight(LEFT_ANCHOR_X, LEFT_ANCHOR_Z), LEFT_ANCHOR_Z]}>
        <mesh position={[0, 2.35, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 4.7, 6]} />
          <meshStandardMaterial
            color={light ? '#3A4A58' : '#6b7c8c'}
            metalness={0.45}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0, 4.75, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 1.7, 6]} />
          <meshStandardMaterial
            color={light ? '#3A4A58' : '#6b7c8c'}
            metalness={0.5}
            roughness={0.45}
          />
        </mesh>
      </group>

      {/* Sagging conductors + moving power flow */}
      {conductors.map((span, i) => (
        <group key={`span-${i}`}>
          <primitive object={span.line} />
          <primitive object={span.beadGroup} />
        </group>
      ))}

      {/* Vertical tower scan ring (analysis phase) */}
      <mesh ref={towerScanRef} visible={false}>
        <cylinderGeometry args={[1.95, 1.95, 0.025, 24, 1, true]} />
        <meshBasicMaterial
          ref={towerScanMatRef}
          color={light ? '#0891B2' : '#22d3ee'}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Site scan plane */}
      <mesh ref={scanRef} visible={false} rotation={[0, Math.PI / 2, 0]} position={[0, 2.4, 0]}>
        <planeGeometry args={[TERRAIN_D, 4.8]} />
        <meshBasicMaterial
          ref={scanMatRef}
          color={light ? '#0891B2' : '#22d3ee'}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
}

/**
 * If the model or WebGL context fails, don't crash the hub — drop the 3D
 * layer and tell the parent to reveal the cards over the static background.
 */
class SceneErrorBoundary extends React.Component<
  { onFail: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFail()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function HubIntro3D(props: HubIntro3DProps) {
  const failedRef = useRef(false)
  const handleFail = () => {
    if (failedRef.current) return
    failedRef.current = true
    props.onEvent({ kind: 'status', text: null })
    props.onEvent({ kind: 'done' })
  }
  const light = props.appearance === 'light'
  const fogColor = light ? '#C8D8E4' : '#07111d'

  return (
    <SceneErrorBoundary onFail={handleFail}>
      <Canvas
        dpr={[1, props.tier === 'desktop' ? 2 : 1.5]}
        camera={{ position: [3.6, 3.0, 9.8], fov: 50, near: 0.1, far: 250 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true
        }}
      >
        <fog attach="fog" args={[fogColor, light ? 28 : 34, light ? 88 : 95]} />
        <Suspense fallback={null}>
          <IntroScene {...props} />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  )
}

useLoader.preload(GLTFLoader, MODEL_PATH, configureLoader)
