'use client'

/**
 * Login backdrop — real GLB towers in a realistic ROW environment.
 * Light: outdoor highland approach (terrain, hills, sky, access track).
 * Dark: neon command-void (kept distinct from landing night).
 * Framed tighter than the landing corridor so it doesn't feel like a clone.
 */

import React, { Component, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'meshoptimizer'
import * as THREE from 'three'

const MODEL_PATH = '/models/transmission_tower.glb'
const TOWER_H = 2.45

const configureLoader = (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder)
}

useLoader.preload(GLTFLoader, MODEL_PATH, configureLoader)

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  return reduced
}

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err) {
    console.warn('[LoginTowerBackground]', err)
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}

function OverlayGrade({ light }) {
  if (light) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `
            linear-gradient(100deg, rgba(232,240,246,0.88) 0%, rgba(232,240,246,0.38) 28%, rgba(232,240,246,0.02) 52%, rgba(210,226,236,0.22) 100%),
            linear-gradient(180deg, rgba(186,214,236,0.28) 0%, transparent 22%, transparent 72%, rgba(120,150,120,0.18) 100%)
          `,
        }}
      />
    )
  }
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `
          linear-gradient(100deg, rgba(4,10,22,0.82) 0%, rgba(4,10,22,0.42) 34%, rgba(4,10,22,0.05) 56%, rgba(4,10,22,0.28) 100%),
          linear-gradient(180deg, rgba(4,10,22,0.4) 0%, transparent 24%, transparent 68%, rgba(4,10,22,0.62) 100%),
          radial-gradient(ellipse 42% 38% at 68% 42%, rgba(34,180,220,0.12), transparent 65%)
        `,
      }}
    />
  )
}

const SLOTS = [
  { x: -0.35, z: 1.85, s: 1.2, ry: 0.14 },
  { x: 1.05, z: 0.35, s: 1.08, ry: 0.08 },
  { x: 2.35, z: -1.0, s: 0.98, ry: 0.02 },
  { x: 3.55, z: -2.2, s: 0.9, ry: -0.03 },
  { x: 4.65, z: -3.25, s: 0.82, ry: -0.06 },
  { x: 5.7, z: -4.15, s: 0.76, ry: -0.08 },
]

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function noise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const u = fx * fx * (3 - 2 * fx)
  const v = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v)
}

function fbm(x, z) {
  return (
    noise(x, z) * 0.5 +
    noise(x * 2.1, z * 2.1) * 0.25 +
    noise(x * 4.3, z * 4.3) * 0.125
  )
}

function distToCorridor(x, z) {
  let best = Infinity
  for (let i = 0; i < SLOTS.length - 1; i++) {
    const a = SLOTS[i]
    const b = SLOTS[i + 1]
    const abx = b.x - a.x
    const abz = b.z - a.z
    const apx = x - a.x
    const apz = z - a.z
    const ab2 = abx * abx + abz * abz || 1
    const t = THREE.MathUtils.clamp((apx * abx + apz * abz) / ab2, 0, 1)
    const px = a.x + abx * t
    const pz = a.z + abz * t
    best = Math.min(best, Math.hypot(x - px, z - pz))
  }
  return best
}

function distToNearestTower(x, z) {
  let best = Infinity
  let scale = 1
  for (const s of SLOTS) {
    const d = Math.hypot(x - s.x, z - s.z)
    if (d < best) {
      best = d
      scale = s.s
    }
  }
  return { d: best, s: scale }
}

function stylizeTower(root, light) {
  const mats = []
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const apply = (mat) => {
      const m = mat.clone()
      m.transparent = true
      m.opacity = 1
      if (m.isMeshStandardMaterial) {
        if (light) {
          m.color.set('#3A4A56')
          m.metalness = 0.62
          m.roughness = 0.34
          m.emissive.set('#2a3a44')
          m.emissiveIntensity = 0.04
        } else {
          m.color.set('#9aadc0')
          m.metalness = 0.7
          m.roughness = 0.36
          m.emissive.set('#1a7894')
          m.emissiveIntensity = 0.34
        }
        m.fog = false
        mats.push(m)
      }
      return m
    }
    if (Array.isArray(obj.material)) obj.material = obj.material.map(apply)
    else if (obj.material) obj.material = apply(obj.material)
  })
  return mats
}

function LoginTowers({ reducedMotion, light }) {
  const gltf = useLoader(GLTFLoader, MODEL_PATH, configureLoader)
  const allMats = useRef([])

  const instances = useMemo(() => {
    const probe = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(probe)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const fit = TOWER_H / (size.y || 1)

    return SLOTS.map((slot, i) => {
      const clone = gltf.scene.clone(true)
      const mats = stylizeTower(clone, light)
      clone.scale.setScalar(fit)
      clone.position.set(-center.x * fit, -box.min.y * fit, -center.z * fit)
      const holder = new THREE.Group()
      holder.name = `login-tower-${i}`
      holder.add(clone)
      holder.position.set(slot.x, 0, slot.z)
      holder.rotation.y = slot.ry
      holder.scale.setScalar(slot.s)
      return { holder, mats }
    })
  }, [gltf, light])

  useEffect(() => {
    allMats.current = instances.flatMap((i) => i.mats)
  }, [instances])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pulse = light ? 0.04 : 0.32 + Math.sin(t * 1.5) * 0.05
    for (const m of allMats.current) {
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, pulse, 5, 0.016)
    }
    if (reducedMotion) return
    instances.forEach((inst, i) => {
      inst.holder.rotation.y = SLOTS[i].ry + Math.sin(t * 0.18 + i * 1.1) * 0.008
    })
  })

  return (
    <group>
      {instances.map((inst, i) => (
        <primitive key={`${light}-${i}`} object={inst.holder} />
      ))}
    </group>
  )
}

function Conductors({ light }) {
  const lines = useMemo(() => {
    const levels = [TOWER_H * 0.86, TOWER_H * 0.72, TOWER_H * 0.58]
    const out = []
    for (const h of levels) {
      const pts = []
      for (let i = 0; i < SLOTS.length; i++) {
        const s = SLOTS[i]
        pts.push(new THREE.Vector3(s.x, h * s.s, s.z))
        if (i < SLOTS.length - 1) {
          const n = SLOTS[i + 1]
          pts.push(
            new THREE.Vector3(
              (s.x + n.x) * 0.5,
              Math.min(h * s.s, h * n.s) - 0.28,
              (s.z + n.z) * 0.5
            )
          )
        }
      }
      const last = SLOTS[SLOTS.length - 1]
      pts.push(new THREE.Vector3(last.x + 1.6, 0.55, last.z - 0.9))
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4)
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72))
      const mat = new THREE.LineBasicMaterial({
        color: light ? '#2C3842' : '#67e8f9',
        transparent: true,
        opacity: light ? 0.78 : 0.55,
        blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
      out.push(new THREE.Line(geo, mat))
    }
    return out
  }, [light])

  useEffect(
    () => () => {
      lines.forEach((l) => {
        l.geometry.dispose()
        l.material.dispose()
      })
    },
    [lines]
  )

  useFrame((state) => {
    if (light) return
    const t = state.clock.elapsedTime
    for (const line of lines) {
      line.material.opacity = 0.42 + Math.sin(t * 1.3) * 0.1
    }
  })

  return (
    <>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </>
  )
}

function EnergyFlow({ reducedMotion, light }) {
  const coreRef = useRef(null)
  const count = light ? 8 : 12
  const meta = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        offset: i / count,
        speed: 0.09 + (i % 3) * 0.02,
        path: i % 2,
      })),
    [count]
  )

  const pathPts = useMemo(() => {
    const mk = (h) => {
      const pts = SLOTS.map((s) => new THREE.Vector3(s.x, h * s.s, s.z))
      const last = SLOTS[SLOTS.length - 1]
      pts.push(new THREE.Vector3(last.x + 1.6, 0.55, last.z - 0.9))
      return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4)
    }
    return [mk(TOWER_H * 0.86), mk(TOWER_H * 0.72)]
  }, [])

  const pos = useMemo(() => new Float32Array(count * 3), [count])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((_state, delta) => {
    const pts = coreRef.current
    if (!pts) return
    if (reducedMotion) {
      pts.visible = false
      return
    }
    pts.visible = true
    const arr = pts.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      const m = meta[i]
      m.offset = (m.offset + m.speed * delta) % 1
      pathPts[m.path].getPointAt(m.offset, tmp)
      arr[i * 3] = tmp.x
      arr[i * 3 + 1] = tmp.y
      arr[i * 3 + 2] = tmp.z
    }
    pts.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={coreRef} renderOrder={5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={light ? '#0EA5C9' : '#7dd3fc'}
        size={light ? 0.042 : 0.055}
        transparent
        opacity={light ? 0.75 : 0.9}
        depthWrite={false}
        blending={light ? THREE.NormalBlending : THREE.AdditiveBlending}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  )
}

/** Realistic colored terrain with ROW cut + excavated soil around towers */
function RealisticTerrain() {
  const geo = useMemo(() => {
    const w = 48
    const d = 42
    const segX = 72
    const segZ = 60
    const g = new THREE.PlaneGeometry(w, d, segX, segZ)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const cGrass = new THREE.Color('#4E6A3C')
    const cGrassLite = new THREE.Color('#6B8648')
    const cGrassDeep = new THREE.Color('#3D5530')
    const cSoil = new THREE.Color('#6A4E32')
    const cSoilWet = new THREE.Color('#4E3A26')
    const cSoilLite = new THREE.Color('#8A6A45')
    const cGravel = new THREE.Color('#8A8074')
    const cTrack = new THREE.Color('#7A7062')
    const tmp = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const corridor = distToCorridor(x, z)
      const { d: td, s: ts } = distToNearestTower(x, z)
      const n1 = fbm(x * 0.12, z * 0.12)
      const n2 = fbm(x * 0.28 + 1.4, z * 0.28)
      const n3 = fbm(x * 0.55, z * 0.55)
      let y =
        (n1 - 0.5) * 0.2 +
        (n2 - 0.5) * 0.07 +
        Math.sin(x * 0.15) * 0.035

      const flatten = THREE.MathUtils.smoothstep(2.4, 0.55, corridor)
      y *= 1 - flatten * 0.94

      if (corridor > 0.75 && corridor < 2.9) {
        y += (1 - Math.abs(corridor - 1.65) / 1.25) * 0.05
      }

      // Disturbed earth around each tower: slightly sunken pad, berm at edge
      const padR = 0.52 * ts
      const bermR = 0.95 * ts
      if (td < bermR) {
        const pad = 1 - THREE.MathUtils.smoothstep(padR * 0.85, padR, td)
        const berm = Math.exp(-Math.pow((td - padR * 1.05) / (0.22 * ts), 2))
        y = y * (1 - pad * 0.85) - pad * 0.018 + berm * 0.055
        y += (n3 - 0.5) * 0.012
      }

      pos.setY(i, y)

      if (td < padR * 1.05) {
        tmp.copy(cGravel)
        tmp.lerp(cSoil, n3 * 0.45)
        tmp.lerp(cSoilWet, (1 - n2) * 0.2)
      } else if (td < bermR) {
        tmp.copy(cSoil)
        tmp.lerp(cSoilLite, n1 * 0.45)
        tmp.lerp(cSoilWet, n2 * 0.25)
        tmp.lerp(cGrass, THREE.MathUtils.smoothstep(padR, bermR, td) * 0.35)
      } else if (corridor < 0.82) {
        tmp.copy(cTrack)
        tmp.lerp(cSoil, n2 * 0.4)
      } else if (corridor < 1.55) {
        tmp.copy(cSoil)
        tmp.lerp(cSoilLite, n1 * 0.4)
        tmp.lerp(cGrass, THREE.MathUtils.smoothstep(0.9, 1.55, corridor) * 0.5)
      } else {
        tmp.copy(cGrass)
        if (n1 > 0.58) tmp.lerp(cGrassLite, 0.5)
        if (n1 < 0.32) tmp.lerp(cGrassDeep, 0.45)
        if (n2 < 0.32) tmp.lerp(cSoilLite, 0.28)
      }

      const haze = THREE.MathUtils.smoothstep(10, 26, Math.hypot(x - 2, z + 2))
      tmp.lerp(new THREE.Color('#C5D6E0'), haze * 0.16)

      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <mesh geometry={geo} position={[0, -0.02, 0]} receiveShadow={false}>
      <meshStandardMaterial vertexColors roughness={0.94} metalness={0.02} />
    </mesh>
  )
}

function AccessTrack() {
  const geo = useMemo(() => {
    const pts = SLOTS.map((s) => new THREE.Vector3(s.x, 0.01, s.z))
    const last = SLOTS[SLOTS.length - 1]
    pts.push(new THREE.Vector3(last.x + 1.8, 0.01, last.z - 1.1))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35)
    return new THREE.TubeGeometry(curve, 48, 0.42, 5, false)
  }, [])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#6E685C" roughness={0.95} metalness={0.02} />
    </mesh>
  )
}

function buildHillRidge(width, depth, height, segs = 24) {
  const positions = []
  const indices = []
  const colors = []
  const cNear = new THREE.Color('#5E7350')
  const cFar = new THREE.Color('#7A8E9A')
  const tmp = new THREE.Color()

  for (let iz = 0; iz <= segs; iz++) {
    const vz = iz / segs
    const z = -vz * depth
    for (let ix = 0; ix <= segs; ix++) {
      const u = ix / segs
      const x = (u - 0.5) * width
      const ridge =
        Math.sin(u * Math.PI) *
        (0.55 + 0.45 * Math.sin(u * Math.PI * 2.4 + vz * 1.7)) *
        (1 - vz * 0.35)
      const und =
        Math.sin(u * Math.PI * 3.1 + vz * 2.0) * 0.12 +
        (hash2(ix * 1.7, iz * 2.3) - 0.5) * 0.1
      const y = Math.max(0, height * ridge + und * height)
      positions.push(x, y, z)
      tmp.copy(cNear).lerp(cFar, vz * 0.7 + (1 - ridge) * 0.25)
      colors.push(tmp.r, tmp.g, tmp.b)
    }
  }

  const stride = segs + 1
  for (let iz = 0; iz < segs; iz++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = iz * stride + ix
      const b = a + 1
      const c = a + stride
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function DistantHills() {
  const layers = useMemo(
    () => [
      { geo: buildHillRidge(36, 10, 3.2, 28), pos: [2, -0.15, -11], opacity: 1 },
      { geo: buildHillRidge(42, 12, 4.0, 26), pos: [0, -0.2, -16], opacity: 1 },
      { geo: buildHillRidge(48, 14, 4.8, 24), pos: [3, -0.25, -22], opacity: 1 },
    ],
    []
  )

  useEffect(
    () => () => {
      layers.forEach((l) => l.geo.dispose())
    },
    [layers]
  )

  return (
    <group>
      {layers.map((layer, i) => (
        <mesh key={i} geometry={layer.geo} position={layer.pos}>
          <meshStandardMaterial
            vertexColors
            roughness={1}
            metalness={0}
            flatShading={false}
          />
        </mesh>
      ))}
    </group>
  )
}

const CANOPY_COLORS = ['#2F4A28', '#3C5A30', '#4A6B38', '#355534', '#587844']

function RealisticTree({ x, z, seed, scale = 1 }) {
  const leanX = (hash2(seed, 11) - 0.5) * 0.12
  const leanZ = (hash2(seed, 12) - 0.5) * 0.1
  const h = (1.15 + hash2(seed, 13) * 0.85) * scale
  const trunkR = 0.042 + hash2(seed, 14) * 0.028
  const canopyW = (0.55 + hash2(seed, 15) * 0.28) * scale
  const blobs = useMemo(() => {
    const n = 5 + Math.floor(hash2(seed, 16) * 3)
    const out = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash2(seed, 20 + i) * 0.6
      const r = canopyW * (0.18 + hash2(seed, 30 + i) * 0.38)
      out.push({
        px: Math.cos(a) * r,
        py: h * (0.58 + hash2(seed, 40 + i) * 0.32),
        pz: Math.sin(a) * r * 0.85,
        sx: canopyW * (0.55 + hash2(seed, 50 + i) * 0.35),
        sy: canopyW * (0.42 + hash2(seed, 60 + i) * 0.28),
        sz: canopyW * (0.5 + hash2(seed, 70 + i) * 0.32),
        color: CANOPY_COLORS[(i + Math.floor(hash2(seed, 80 + i) * 4)) % CANOPY_COLORS.length],
      })
    }
    return out
  }, [h, canopyW, seed])

  return (
    <group position={[x, 0, z]} rotation={[leanZ, hash2(seed, 17) * 0.8, leanX]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[canopyW * 0.55, 12]} />
        <meshBasicMaterial color="#2A3A22" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, h * 0.32, 0]}>
        <cylinderGeometry args={[trunkR * 0.55, trunkR, h * 0.64, 7]} />
        <meshStandardMaterial color="#3B2A1C" roughness={0.96} />
      </mesh>
      <mesh position={[0, h * 0.58, 0]} rotation={[0.25, 0.4, 0.35]}>
        <cylinderGeometry args={[trunkR * 0.22, trunkR * 0.38, h * 0.28, 5]} />
        <meshStandardMaterial color="#4A3424" roughness={0.95} />
      </mesh>
      <mesh position={[0, h * 0.54, 0]} rotation={[-0.3, -0.6, -0.4]}>
        <cylinderGeometry args={[trunkR * 0.18, trunkR * 0.32, h * 0.22, 5]} />
        <meshStandardMaterial color="#40301E" roughness={0.95} />
      </mesh>
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.px, b.py, b.pz]} scale={[b.sx, b.sy, b.sz]}>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial color={b.color} roughness={0.88} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function RealisticBush({ x, z, seed, scale = 1 }) {
  const clumps = useMemo(() => {
    const n = 3 + Math.floor(hash2(seed, 9) * 2)
    return Array.from({ length: n }, (_, i) => ({
      px: (hash2(seed, 10 + i) - 0.5) * 0.28 * scale,
      pz: (hash2(seed, 20 + i) - 0.5) * 0.28 * scale,
      sy: (0.22 + hash2(seed, 30 + i) * 0.16) * scale,
      sx: (0.28 + hash2(seed, 40 + i) * 0.18) * scale,
      color: CANOPY_COLORS[(i + 1) % CANOPY_COLORS.length],
    }))
  }, [seed, scale])

  return (
    <group position={[x, 0, z]}>
      {clumps.map((c, i) => (
        <mesh key={i} position={[c.px, c.sy * 0.55, c.pz]} scale={[c.sx, c.sy, c.sx * 0.9]}>
          <icosahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color={c.color} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Vegetation() {
  const items = useMemo(() => {
    const out = []
    for (let i = 0; i < 42; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const along = (i / 42) * 12 - 1.4
      const x = 2.2 + side * (2.7 + hash2(i, 2) * 4.4) + (hash2(i, 3) - 0.5) * 1.5
      const z = 1.7 - along * 0.92 + (hash2(i, 4) - 0.5) * 1.7
      if (distToCorridor(x, z) < 1.85) continue
      if (distToNearestTower(x, z).d < 1.35) continue
      out.push({
        x,
        z,
        seed: i + 3,
        scale: 0.85 + hash2(i, 5) * 0.55,
        kind: hash2(i, 7) > 0.68 ? 'bush' : 'tree',
      })
    }
    return out
  }, [])

  return (
    <group>
      {items.map((p, i) =>
        p.kind === 'bush' ? (
          <RealisticBush key={i} x={p.x} z={p.z} seed={p.seed} scale={p.scale * 0.9} />
        ) : (
          <RealisticTree key={i} x={p.x} z={p.z} seed={p.seed} scale={p.scale} />
        )
      )}
    </group>
  )
}

/** Gravel pad + earth berm + four concrete footings under each tower */
function TowerFoundations() {
  return (
    <group>
      {SLOTS.map((s, i) => {
        const r = 0.48 * s.s
        const foot = 0.09 * s.s
        const spread = 0.22 * s.s
        return (
          <group key={i} position={[s.x, 0, s.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
              <circleGeometry args={[r, 28]} />
              <meshStandardMaterial color="#7C7468" roughness={0.96} metalness={0.04} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[r * 0.42, r * 0.72, 24]} />
              <meshStandardMaterial color="#6A5A44" roughness={0.98} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
              <torusGeometry args={[r * 0.92, 0.045 * s.s, 8, 28]} />
              <meshStandardMaterial color="#5C4A32" roughness={1} />
            </mesh>
            {[
              [spread, spread],
              [spread, -spread],
              [-spread, spread],
              [-spread, -spread],
            ].map(([fx, fz], k) => (
              <mesh key={k} position={[fx, 0.035, fz]}>
                <boxGeometry args={[foot * 1.7, 0.07, foot * 1.7]} />
                <meshStandardMaterial color="#9AA0A6" roughness={0.82} metalness={0.08} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

function RealisticSubstation() {
  const last = SLOTS[SLOTS.length - 1]
  return (
    <group position={[last.x + 1.65, 0, last.z - 0.95]}>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 1.8]} />
        <meshStandardMaterial color="#6E6A62" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.95, 0.78, 0.7]} />
        <meshStandardMaterial color="#5A6570" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0.55, 0.95, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
        <meshStandardMaterial color="#4A5560" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[-0.5, 0.85, 0.15]}>
        <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
        <meshStandardMaterial color="#4A5560" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.7, 0.06, 0.5]} />
        <meshStandardMaterial
          color="#0891B2"
          emissive="#0891B2"
          emissiveIntensity={0.25}
          metalness={0.2}
          roughness={0.45}
        />
      </mesh>
      <pointLight position={[0, 1.4, 0.4]} intensity={0.35} color="#E8F4FA" distance={5} decay={2} />
    </group>
  )
}

function RealisticSky({ reducedMotion }) {
  const mat = useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() },
    }
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vDir = normalize(w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uTime;
        uniform vec3 uSunDir;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float n2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 zen = vec3(0.28, 0.56, 0.92);
          vec3 mid = vec3(0.52, 0.74, 0.95);
          vec3 hor = vec3(0.86, 0.90, 0.94);
          vec3 col = mix(hor, mid, smoothstep(0.04, 0.4, h));
          col = mix(col, zen, smoothstep(0.32, 0.92, h));

          float haze = smoothstep(0.0, 0.4, 1.0 - h);
          col = mix(col, vec3(0.94, 0.93, 0.91), haze * 0.32);

          vec2 uv = normalize(vDir.xz + 0.001) * (1.0 / max(0.12, vDir.y + 0.18));
          vec2 uv2 = uv + vec2(uTime * 0.006, uTime * 0.004);
          float cloud = n2(uv2 * 0.65) * 0.55 + n2(uv2 * 1.7) * 0.45;
          cloud = smoothstep(0.5, 0.82, cloud) * smoothstep(0.05, 0.55, vDir.y);
          col = mix(col, vec3(0.98, 0.99, 1.0), cloud * 0.22);

          vec3 dir = normalize(vDir);
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          col += vec3(1.0, 0.96, 0.88) * pow(sunDot, 32.0) * 0.55;
          col += vec3(1.0, 0.94, 0.82) * pow(sunDot, 6.0) * 0.12;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  }, [])

  useFrame((state) => {
    if (reducedMotion) return
    mat.uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => () => mat.dispose(), [mat])

  return (
    <mesh scale={[70, 70, 70]} renderOrder={-4} frustumCulled={false}>
      <sphereGeometry args={[1, 28, 18]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

function SunDisc() {
  return (
    <mesh position={[14, 11, 8]}>
      <sphereGeometry args={[0.55, 16, 16]} />
      <meshBasicMaterial color="#FFF6D8" toneMapped={false} />
    </mesh>
  )
}

function HorizonMist() {
  return (
    <group>
      <mesh position={[3, 0.55, -13]} renderOrder={2}>
        <planeGeometry args={[50, 2.4]} />
        <meshBasicMaterial
          color="#D0E0EC"
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[3, 1.35, -18]} renderOrder={2}>
        <planeGeometry args={[56, 2.0]} />
        <meshBasicMaterial
          color="#C8D8E6"
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function DarkVoidGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.2, -0.04, -1.2]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#060e18" roughness={1} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.2, -0.02, -1.2]}>
        <planeGeometry args={[32, 32, 20, 20]} />
        <meshBasicMaterial
          color="#0e2436"
          wireframe
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function DarkSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 zen = vec3(0.02, 0.05, 0.1);
            vec3 mid = vec3(0.015, 0.035, 0.07);
            vec3 hor = vec3(0.01, 0.02, 0.04);
            vec3 col = mix(hor, mid, smoothstep(0.0, 0.45, h));
            col = mix(col, zen, smoothstep(0.4, 0.95, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh scale={[60, 60, 60]} renderOrder={-3} frustumCulled={false}>
      <sphereGeometry args={[1, 20, 14]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

function LoginTransformer({ reducedMotion }) {
  const last = SLOTS[SLOTS.length - 1]
  const indicatorRef = useRef(null)

  useFrame((state) => {
    if (reducedMotion || !indicatorRef.current) return
    const breathe = 0.55 + Math.sin(state.clock.elapsedTime * 1.6) * 0.25
    indicatorRef.current.children.forEach((child) => {
      if (child.material) child.material.opacity = breathe
    })
  })

  return (
    <group position={[last.x + 1.55, 0, last.z - 0.85]} scale={1.35} rotation={[0, -0.35, 0]}>
      {/* Contact shadow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      {/* Concrete pad */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[1.05, 0.06, 0.78]} />
        <meshStandardMaterial color="#3a414c" metalness={0.35} roughness={0.7} />
      </mesh>

      {/* Main oil tank body */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.68, 0.5, 0.52]} />
        <meshStandardMaterial
          color="#5b6470"
          metalness={0.72}
          roughness={0.38}
          emissive="#134e6a"
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Rounded tank top plate */}
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[0.7, 0.04, 0.54]} />
        <meshStandardMaterial color="#4a5562" metalness={0.65} roughness={0.4} />
      </mesh>

      {/* Cooling radiators / fins — both sides */}
      {[-1, 1].map((side) =>
        [0, 1, 2, 3, 4].map((i) => (
          <mesh key={`${side}-${i}`} position={[side * 0.4, 0.32, -0.18 + i * 0.09]}>
            <boxGeometry args={[0.06, 0.42, 0.05]} />
            <meshStandardMaterial color="#3d4451" metalness={0.6} roughness={0.45} />
          </mesh>
        ))
      )}

      {/* Radiator headers */}
      {[-1, 1].map((side) => (
        <mesh key={`hdr-${side}`} position={[side * 0.4, 0.32, 0]}>
          <boxGeometry args={[0.05, 0.44, 0.48]} />
          <meshStandardMaterial color="#323841" metalness={0.55} roughness={0.5} />
        </mesh>
      ))}

      {/* Conservator cylinder on top */}
      <mesh position={[0.12, 0.72, -0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.42, 14]} />
        <meshStandardMaterial
          color="#5b6470"
          metalness={0.7}
          roughness={0.4}
          emissive="#134e6a"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Conservator end caps */}
      <mesh position={[-0.09, 0.72, -0.1]}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshStandardMaterial color="#4a5562" metalness={0.65} roughness={0.42} />
      </mesh>
      <mesh position={[0.33, 0.72, -0.1]}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshStandardMaterial color="#4a5562" metalness={0.65} roughness={0.42} />
      </mesh>

      {/* Pipe from conservator to tank */}
      <mesh position={[0.12, 0.64, 0.02]}>
        <cylinderGeometry args={[0.02, 0.02, 0.14, 8]} />
        <meshStandardMaterial color="#6b7582" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Three HV bushings */}
      {[-0.2, 0, 0.2].map((x, i) => (
        <group key={i} position={[x, 0.62, 0.12]}>
          <mesh>
            <cylinderGeometry args={[0.028, 0.038, 0.32, 10]} />
            <meshStandardMaterial color="#8b95a3" metalness={0.55} roughness={0.28} />
          </mesh>
          {/* Shed rings */}
          {[0.06, 0.14, 0.22].map((y, k) => (
            <mesh key={k} position={[0, y - 0.08, 0]}>
              <torusGeometry args={[0.04, 0.008, 6, 14]} />
              <meshStandardMaterial color="#9aa3b0" metalness={0.5} roughness={0.35} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.034, 10, 10]} />
            <meshStandardMaterial color="#a8b0bc" metalness={0.6} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Control cabinet on front */}
      <mesh position={[0, 0.22, 0.29]}>
        <boxGeometry args={[0.28, 0.22, 0.08]} />
        <meshStandardMaterial color="#2f3640" metalness={0.45} roughness={0.55} />
      </mesh>

      {/* Indicator lights */}
      <group ref={indicatorRef}>
        {[-0.08, 0, 0.08].map((x, i) => (
          <mesh key={i} position={[x, 0.22, 0.34]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshBasicMaterial
              color={i === 1 ? '#67e8f9' : '#22d3ee'}
              transparent
              opacity={0.7}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Cable glands / LV terminals on side */}
      {[-0.12, 0.12].map((z, i) => (
        <mesh key={i} position={[-0.36, 0.18, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
          <meshStandardMaterial color="#6b7582" metalness={0.65} roughness={0.4} />
        </mesh>
      ))}

      <pointLight position={[0, 0.7, 0.55]} intensity={0.55} color="#22d3ee" distance={3.2} decay={2} />
    </group>
  )
}

function CameraRig({ reducedMotion, mouseRef }) {
  useFrame((state) => {
    const cam = state.camera
    const mouse = mouseRef.current
    const mx = reducedMotion ? 0 : mouse.x
    const my = reducedMotion ? 0 : mouse.y
    const t = state.clock.elapsedTime

    cam.position.set(
      0.2 + mx * 0.2 + (reducedMotion ? 0 : Math.sin(t * 0.045) * 0.04),
      1.35 + my * 0.1 + (reducedMotion ? 0 : Math.cos(t * 0.035) * 0.025),
      4.55
    )
    cam.lookAt(2.1 + mx * 0.08, 0.85 + my * 0.04, -1.0)
  })
  return null
}

function RealisticEnvironment({ reducedMotion }) {
  return (
    <>
      <RealisticSky reducedMotion={reducedMotion} />
      <SunDisc />
      <RealisticTerrain />
      <AccessTrack />
      <DistantHills />
      <Vegetation />
      <HorizonMist />
      <TowerFoundations />
      <RealisticSubstation />
      <hemisphereLight args={['#B8D4F0', '#6A7A4A', 0.55]} />
      <directionalLight position={[10, 14, 6]} intensity={1.35} color="#FFF2D6" />
      <directionalLight position={[-6, 4, -3]} intensity={0.35} color="#8EB0C8" />
      <ambientLight intensity={0.28} />
    </>
  )
}

function Scene({ reducedMotion, mouseRef }) {
  return (
    <>
      <color attach="background" args={['#050d17']} />
      <fog attach="fog" args={['#050d17', 9, 24]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#1a3a55', '#050d17', 0.35]} />
      <directionalLight position={[6, 10, 4]} intensity={0.85} color="#cfe8f5" />
      <directionalLight position={[-4, 4, -2]} intensity={0.35} color="#67e8f9" />
      <DarkSky />
      <DarkVoidGround />
      <CameraRig reducedMotion={reducedMotion} mouseRef={mouseRef} />
      <React.Suspense fallback={null}>
        <LoginTowers reducedMotion={reducedMotion} light={false} />
        <Conductors light={false} />
        <EnergyFlow reducedMotion={reducedMotion} light={false} />
        <LoginTransformer reducedMotion={reducedMotion} />
      </React.Suspense>
    </>
  )
}

export default function LoginTowerBackground({ onReady }) {
  const reducedMotion = useReducedMotion()
  const mouseRef = useRef({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (reducedMotion) return undefined
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [reducedMotion])

  useEffect(() => {
    setReady(false)
    const t = window.setTimeout(() => {
      setReady(true)
      onReady?.()
    }, 80)
    return () => window.clearTimeout(t)
  }, [onReady])

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#050d17',
        opacity: ready ? 1 : 0.95,
        transition: 'opacity 0.3s ease',
      }}
    >
      <Canvas
        dpr={[1, 1.4]}
        camera={{ position: [0.2, 1.35, 4.55], fov: 40, near: 0.1, far: 60 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        onCreated={() => {
          setReady(true)
          onReady?.()
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <SceneErrorBoundary fallback={<RealisticEnvironment reducedMotion={reducedMotion} />}>
          <Scene reducedMotion={reducedMotion} mouseRef={mouseRef} />
        </SceneErrorBoundary>
      </Canvas>
      <OverlayGrade light={false} />
    </div>
  )
}
