import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { CorridorLayout } from './corridor'
import type { ViewportTier } from './types'

interface CorridorEnvironmentProps {
  layout: CorridorLayout
  viewport: ViewportTier
  themeBlendRef: MutableRefObject<number>
}

/** Rural corridor palette — muted greens, olive, soil, dry grass */
const GROUND_A = new THREE.Color('#465F42')
const GROUND_B = new THREE.Color('#4F6A48')
const GROUND_C = new THREE.Color('#587550')
const GROUND_SOIL = new THREE.Color('#655C4A')
const GROUND_WARM = new THREE.Color('#6E6850')
const GROUND_OLIVE = new THREE.Color('#556048')
const DARK_SOIL = new THREE.Color('#141a14')
const LIGHT_HILL = new THREE.Color('#6A7E68')
const LIGHT_MOUNT = new THREE.Color('#8A9AAA')
const DARK_HILL = new THREE.Color('#0f1820')
const DARK_MOUNT = new THREE.Color('#0a1018')
const LIGHT_VEG = new THREE.Color('#365A3C')
const DARK_VEG = new THREE.Color('#1a2820')
const LIGHT_ROAD = new THREE.Color('#5E6850')
const DARK_ROAD = new THREE.Color('#1a2018')
const LIGHT_RIDGE = new THREE.Color('#7A8C7E')
const DARK_RIDGE = new THREE.Color('#0c141c')

function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function noise(x: number, z: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

function fbm(x: number, z: number) {
  return noise(x, z) * 0.55 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.15
}

function distToPolyline(x: number, z: number, pts: THREE.Vector3[]) {
  let best = 1e9
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x
    const az = pts[i].z
    const bx = pts[i + 1].x
    const bz = pts[i + 1].z
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz || 1
    let t = ((x - ax) * dx + (z - az) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    const px = ax + dx * t - x
    const pz = az + dz * t - z
    best = Math.min(best, Math.hypot(px, pz))
  }
  return best
}

function terrainHeight(x: number, z: number, pathPts: THREE.Vector3[]) {
  const d = distToPolyline(x, z, pathPts)
  const keep = THREE.MathUtils.smoothstep(0.85, 5.2, d)
  const dist = Math.hypot(x, z)
  let h = (fbm(x * 0.048, z * 0.048) - 0.5) * 1.15 * keep
  h += (fbm(x * 0.012 + 4, z * 0.012) - 0.5) * 2.15 * THREE.MathUtils.smoothstep(7, 28, dist)
  h += (fbm(x * 0.17, z * 0.17) - 0.5) * 0.09 * keep
  h += (fbm(x * 0.078 - 1.2, z * 0.078 + 0.7) - 0.5) * 0.28 * keep
  h += (fbm(x * 0.13, z * 0.13) - 0.5) * 0.1 * keep
  h += (fbm(x * 0.007, z * 0.007 + 2) - 0.5) * 1.35 * THREE.MathUtils.smoothstep(5, 22, dist)
  return h
}

const HORIZON_TINT = new THREE.Color('#C8D4DC')
const HORIZON_LIGHT = new THREE.Color('#DDE8EE')
const DARK_HORIZON_TINT = new THREE.Color('#0a1218')
const DARK_HORIZON_LIGHT = new THREE.Color('#0c161e')

function buildRidgeGeometry(
  width: number,
  zFront: number,
  zBack: number,
  baseY: number,
  amp: number,
  segs: number
) {
  const ridgeVerts: number[] = []
  const ridgeIdx: number[] = []
  for (let i = 0; i <= segs; i++) {
    const u = i / segs
    const x = (u - 0.5) * width
    const und =
      Math.sin(u * Math.PI * 1.9) * amp +
      Math.sin(u * Math.PI * 4.7 + 0.5) * amp * 0.42 +
      Math.sin(u * Math.PI * 8.3 + 1.1) * amp * 0.2 +
      (hash2(i * 2.3, zFront) - 0.5) * amp * 0.28
    const topY = baseY + und
    ridgeVerts.push(x, -2.8, zFront, x, topY, zFront, x, -3.0, zBack, x, topY * 0.9, zBack)
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 4
    ridgeIdx.push(a, a + 1, a + 4, a + 1, a + 5, a + 4)
    ridgeIdx.push(a + 2, a + 3, a + 6, a + 3, a + 7, a + 6)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ridgeVerts), 3))
  geo.setIndex(ridgeIdx)
  geo.computeVertexNormals()
  return geo
}

function groundColorAt(x: number, z: number, pathPts: THREE.Vector3[], night = false) {
  if (night) {
    const n1 = fbm(x * 0.11, z * 0.11)
    const n2 = fbm(x * 0.24 + 1.3, z * 0.24 - 0.8)
    const c = new THREE.Color('#141c16')
    if (n1 < 0.42) c.lerp(new THREE.Color('#101814'), 0.45)
    else if (n1 > 0.58) c.lerp(new THREE.Color('#182018'), 0.35)
    c.lerp(new THREE.Color('#1a1814'), n2 * 0.22)
    const depthZ = THREE.MathUtils.smoothstep(-4, -38, z)
    const radial = THREE.MathUtils.smoothstep(16, 48, Math.hypot(x, z))
    const haze = Math.max(depthZ, radial * 0.55)
    c.lerp(DARK_HORIZON_TINT, haze * 0.18)
    c.lerp(DARK_HORIZON_LIGHT, haze * 0.08)
    return c
  }

  const n1 = fbm(x * 0.11, z * 0.11)
  const n2 = fbm(x * 0.24 + 1.3, z * 0.24 - 0.8)
  const n3 = fbm(x * 0.048 - 2.1, z * 0.048 + 1.4)
  const n4 = fbm(x * 0.36 + 0.5, z * 0.36 - 1.1)
  const n5 = fbm(x * 0.18 - 3.2, z * 0.18 + 2.6)
  const c = GROUND_B.clone()
  if (n1 < 0.38) c.lerp(GROUND_A, 0.5)
  else if (n1 > 0.62) c.lerp(GROUND_C, 0.42)
  c.lerp(GROUND_SOIL, n2 * 0.28)
  c.lerp(GROUND_OLIVE, (n3 - 0.5) * 0.28 + 0.16)
  c.lerp(GROUND_WARM, (n4 - 0.5) * 0.18 + (n5 - 0.5) * 0.22)

  const depthZ = THREE.MathUtils.smoothstep(-4, -38, z)
  const radial = THREE.MathUtils.smoothstep(16, 48, Math.hypot(x, z))
  const haze = Math.max(depthZ, radial * 0.55)
  c.lerp(HORIZON_TINT, haze * 0.22)
  c.lerp(HORIZON_LIGHT, haze * 0.1)
  return c
}

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vDir = normalize(w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform float uBlend;
  uniform vec3 uSunDir;
  uniform float uTime;
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
    // Clear outdoor daylight: deeper zenith → lighter mid → pale warm haze at horizon
    vec3 lightZen = vec3(0.38, 0.62, 0.90);
    vec3 lightMid = vec3(0.62, 0.78, 0.93);
    vec3 lightHor = vec3(0.92, 0.90, 0.87);
    vec3 darkZen = vec3(0.006, 0.014, 0.038);
    vec3 darkMid = vec3(0.012, 0.028, 0.055);
    vec3 darkHor = vec3(0.018, 0.038, 0.068);
    vec3 day = mix(lightHor, lightMid, smoothstep(0.04, 0.38, h));
    day = mix(day, lightZen, smoothstep(0.32, 0.94, h));
    float lift = smoothstep(0.22, 0.5, h) * (1.0 - smoothstep(0.65, 0.92, h));
    day += vec3(0.05, 0.06, 0.07) * lift;
    float haze = smoothstep(0.0, 0.48, 1.0 - h);
    day = mix(day, vec3(0.94, 0.93, 0.91), haze * 0.36);
    vec3 groundMist = vec3(0.86, 0.90, 0.93);
    float mistBand = smoothstep(0.0, 0.32, 1.0 - h) * smoothstep(0.0, 0.1, h);
    day = mix(day, groundMist, mistBand * 0.18 * uBlend);
    vec3 night = mix(darkHor, darkMid, smoothstep(0.0, 0.42, h));
    night = mix(night, darkZen, smoothstep(0.34, 0.94, h));
    vec2 uv = normalize(vDir.xz + 0.001) * (1.0 / max(0.14, vDir.y + 0.2));
    // Very soft haze variation (not obvious clouds)
    vec2 uv2 = uv + vec2(uTime * 0.01, uTime * 0.006);
    float cloud = n2(uv2 * 0.85) * 0.5 + n2(uv2 * 1.9) * 0.5;
    cloud = smoothstep(0.58, 0.84, cloud) * smoothstep(0.08, 0.5, vDir.y);
    day = mix(day, vec3(0.96, 0.97, 0.99), cloud * 0.08 * uBlend);
    vec3 dir = normalize(vDir);
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    day += vec3(1.0, 0.95, 0.86) * pow(sunDot, 32.0) * 0.04 * uBlend;
    day += vec3(1.0, 0.96, 0.9) * pow(sunDot, 8.0) * 0.028 * uBlend;
    float nightWeight = 1.0 - uBlend;
    // No star field — the old polar mapping caused vertical streak artifacts in dark mode.
    gl_FragColor = vec4(mix(night, day, uBlend), 1.0);
  }
`

export default function CorridorEnvironment({ layout, viewport, themeBlendRef }: CorridorEnvironmentProps) {
  const { scene } = useThree()
  const terrainMat = useRef<THREE.MeshStandardMaterial>(null)
  const roadMat = useRef<THREE.MeshStandardMaterial>(null)
  const skyMat = useRef<THREE.ShaderMaterial>(null)
  const horizonMat = useRef<THREE.MeshBasicMaterial>(null)
  const horizonDark = useMemo(() => new THREE.Color('#061018'), [])
  const horizonLight = useMemo(() => new THREE.Color('#C4D4DE'), [])
  const terrainDark = useMemo(() => new THREE.Color('#0a100e'), [])
  const terrainLight = useMemo(() => new THREE.Color('#d8e0d2'), [])
  const horizonTmp = useMemo(() => new THREE.Color(), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const shared = useMemo(
    () => ({
      hill: new THREE.MeshStandardMaterial({
        color: DARK_HILL.clone(),
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
      mount: new THREE.MeshStandardMaterial({
        color: DARK_MOUNT.clone(),
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      ridge: new THREE.MeshBasicMaterial({
        color: DARK_RIDGE.clone(),
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        toneMapped: false,
      }),
      ridgeFar: new THREE.MeshBasicMaterial({
        color: DARK_RIDGE.clone(),
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        toneMapped: false,
      }),
      veg: new THREE.MeshStandardMaterial({
        color: DARK_VEG.clone(),
        roughness: 0.96,
        metalness: 0,
        transparent: true,
        opacity: 0.38,
      }),
      trunk: new THREE.MeshStandardMaterial({
        color: '#1a1814',
        roughness: 0.98,
        metalness: 0,
        transparent: true,
        opacity: 0.32,
      }),
      shadow: new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    }),
    []
  )

  const pathPts = useMemo(
    () => [...layout.towers.map((t) => t.position), layout.transformerPos],
    [layout]
  )

  const segs = viewport === 'mobile' ? 28 : viewport === 'tablet' ? 36 : 48
  // Keep vegetation sparse: open corridor, not a forest
  const grassN = viewport === 'mobile' ? 36 : viewport === 'tablet' ? 52 : 78
  const treeN = viewport === 'mobile' ? 4 : viewport === 'tablet' ? 6 : 9
  const bushN = viewport === 'mobile' ? 8 : viewport === 'tablet' ? 12 : 18

  const { terrainGeo, roadGeo, ridgeGeo, ridgeFarGeo, terrainLightCols, terrainDarkCols } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(90, 90, segs, segs)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const lightCol = new Float32Array(pos.count * 3)
    const darkCol = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, terrainHeight(x, z, pathPts))
      const cLight = groundColorAt(x, z, pathPts, false)
      const cDark = groundColorAt(x, z, pathPts, true)
      lightCol[i * 3] = cLight.r
      lightCol[i * 3 + 1] = cLight.g
      lightCol[i * 3 + 2] = cLight.b
      darkCol[i * 3] = cDark.r
      darkCol[i * 3 + 1] = cDark.g
      darkCol[i * 3 + 2] = cDark.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(lightCol.slice(), 3))
    geo.computeVertexNormals()

    const samples = 36
    const half = 0.32
    const verts: number[] = []
    const tmp = new THREE.Vector3()
    const next = new THREE.Vector3()
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1)
      layout.groundCurve.getPointAt(Math.min(0.999, t), tmp)
      layout.groundCurve.getPointAt(Math.min(0.999, t + 0.02), next)
      const dx = next.x - tmp.x
      const dz = next.z - tmp.z
      const len = Math.hypot(dx, dz) || 1
      const px = (-dz / len) * half
      const pz = (dx / len) * half
      const ox = 1.8
      const x0 = tmp.x + px - (dz / len) * ox
      const z0 = tmp.z + pz + (dx / len) * ox
      const x1 = tmp.x - px - (dz / len) * ox
      const z1 = tmp.z - pz + (dx / len) * ox
      const y0 = terrainHeight(x0, z0, pathPts) + 0.015
      const y1 = terrainHeight(x1, z1, pathPts) + 0.015
      verts.push(x0, y0, z0, x1, y1, z1)
    }
    const road = new THREE.BufferGeometry()
    road.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    const idx: number[] = []
    for (let i = 0; i < samples - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    road.setIndex(idx)
    road.computeVertexNormals()

    const ridge = buildRidgeGeometry(120, -30, -38, 1.85, 1.15, 52)
    const ridgeFar = buildRidgeGeometry(150, -48, -58, 2.55, 0.85, 40)

    return { terrainGeo: geo, roadGeo: road, ridgeGeo: ridge, ridgeFarGeo: ridgeFar, terrainLightCols: lightCol, terrainDarkCols: darkCol }
  }, [layout, pathPts, segs])

  const grassRef = useRef<THREE.InstancedMesh>(null)
  const bushRef = useRef<THREE.InstancedMesh>(null)
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const crownRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const inLeftTowerCone = (x: number, z: number) => x < -1.15 && z > 0.15
    const scatter = (
      mesh: THREE.InstancedMesh | null,
      n: number,
      scale: (i: number) => number,
      yOff: number,
      minD: number,
      maxD: number
    ) => {
      if (!mesh) return
      let placed = 0
      let guard = 0
      while (placed < n && guard < n * 22) {
        guard++
        const x = (hash2(placed + 2.1, guard) - 0.5) * 48
        const z = (hash2(placed + 8.7, guard + 3) - 0.5) * 48
        const d = distToPolyline(x, z, pathPts)
        if (d < minD || d > maxD || inLeftTowerCone(x, z)) continue
        dummy.position.set(x, terrainHeight(x, z, pathPts) + yOff, z)
        dummy.rotation.set(0, hash2(x, z) * Math.PI * 2, 0)
        dummy.scale.setScalar(scale(placed))
        dummy.updateMatrix()
        mesh.setMatrixAt(placed, dummy.matrix)
        placed++
      }
      mesh.count = placed
      mesh.instanceMatrix.needsUpdate = true
    }
    scatter(grassRef.current, grassN, (i) => 0.22 + hash2(i, 1) * 0.2, 0.06, 1.8, 20)
    scatter(bushRef.current, bushN, (i) => 0.18 + hash2(i, 4) * 0.18, 0.1, 2.8, 18)

    const trunks = trunkRef.current
    const crowns = crownRef.current
    if (trunks && crowns) {
      let placed = 0
      let guard = 0
      while (placed < treeN && guard < treeN * 40) {
        guard++
        const x = (hash2(placed + 11.4, guard) - 0.5) * 44
        const z = (hash2(placed + 3.2, guard + 9) - 0.5) * 44
        const d = distToPolyline(x, z, pathPts)
        if (d < 6.2 || d > 26 || inLeftTowerCone(x, z)) continue
        const y = terrainHeight(x, z, pathPts)
        const s = 0.36 + hash2(placed, 6) * 0.22
        dummy.position.set(x, y + 0.28 * s, z)
        dummy.rotation.set(0, hash2(x, z) * Math.PI * 2, 0)
        dummy.scale.set(s, s * 1.05, s)
        dummy.updateMatrix()
        trunks.setMatrixAt(placed, dummy.matrix)
        dummy.position.set(x, y + 0.62 * s, z)
        dummy.scale.set(s * 0.95, s * 0.55, s * 0.95)
        dummy.updateMatrix()
        crowns.setMatrixAt(placed, dummy.matrix)
        placed++
      }
      trunks.count = placed
      crowns.count = placed
      trunks.instanceMatrix.needsUpdate = true
      crowns.instanceMatrix.needsUpdate = true
    }
  }, [bushN, dummy, grassN, pathPts, treeN])

  useEffect(
    () => () => {
      terrainGeo.dispose()
      roadGeo.dispose()
      ridgeGeo.dispose()
      ridgeFarGeo.dispose()
    },
    [terrainGeo, roadGeo, ridgeGeo, ridgeFarGeo]
  )

  useEffect(
    () => () => {
      shared.hill.dispose()
      shared.mount.dispose()
      shared.ridge.dispose()
      shared.ridgeFar.dispose()
      shared.veg.dispose()
      shared.trunk.dispose()
      shared.shadow.dispose()
    },
    [shared]
  )

  const sunDirDefault = useMemo(() => new THREE.Vector3(0.35, 0.25, -0.9), [])

  useFrame((state) => {
    const t = themeBlendRef.current
    const terrainColors = terrainGeo.attributes.color as THREE.BufferAttribute
    if (terrainColors && terrainLightCols && terrainDarkCols) {
      const arr = terrainColors.array as Float32Array
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = terrainDarkCols[i] + (terrainLightCols[i] - terrainDarkCols[i]) * t
        arr[i + 1] = terrainDarkCols[i + 1] + (terrainLightCols[i + 1] - terrainDarkCols[i + 1]) * t
        arr[i + 2] = terrainDarkCols[i + 2] + (terrainLightCols[i + 2] - terrainDarkCols[i + 2]) * t
      }
      terrainColors.needsUpdate = true
    }
    if (skyMat.current) {
      skyMat.current.uniforms.uBlend.value = t
      const sunDir = (scene.userData.sunDirection as THREE.Vector3 | undefined) ?? sunDirDefault
      skyMat.current.uniforms.uSunDir.value.copy(sunDir)
      skyMat.current.uniforms.uTime.value = state.clock.elapsedTime
    }
    if (terrainMat.current) {
      terrainMat.current.color.lerpColors(terrainDark, terrainLight, t)
      terrainMat.current.emissive.lerpColors(DARK_SOIL, new THREE.Color('#000000'), t)
      terrainMat.current.emissiveIntensity = THREE.MathUtils.lerp(0.025, 0.008, t)
    }
    shared.hill.color.lerpColors(DARK_HILL, LIGHT_HILL, t)
    shared.hill.opacity = THREE.MathUtils.lerp(0.55, 0.78, t)
    shared.mount.color.lerpColors(DARK_MOUNT, LIGHT_MOUNT, t)
    shared.mount.opacity = THREE.MathUtils.lerp(0.42, 0.55, t)
    shared.ridge.color.lerpColors(DARK_RIDGE, LIGHT_RIDGE, t)
    shared.ridge.opacity = THREE.MathUtils.lerp(0.32, 0.72, t)
    shared.ridgeFar.color.lerpColors(DARK_RIDGE, LIGHT_RIDGE, t)
    shared.ridgeFar.opacity = THREE.MathUtils.lerp(0.22, 0.5, t)
    if (horizonMat.current) {
      horizonMat.current.color.copy(horizonTmp.lerpColors(horizonDark, horizonLight, t))
      horizonMat.current.opacity = THREE.MathUtils.lerp(0.08, 0.14, t)
    }
    if (roadMat.current) {
      roadMat.current.color.lerpColors(DARK_ROAD, LIGHT_ROAD, t)
      roadMat.current.opacity = THREE.MathUtils.lerp(0.35, 0.22, t)
    }
    shared.veg.color.lerpColors(DARK_VEG, LIGHT_VEG, t)
    shared.veg.opacity = THREE.MathUtils.lerp(0.38, 0.55, t)
    shared.trunk.color.lerpColors(new THREE.Color('#141210'), new THREE.Color('#4a4038'), t)
    shared.trunk.opacity = THREE.MathUtils.lerp(0.32, 0.24, t)
    shared.shadow.opacity = THREE.MathUtils.lerp(0.14, 0.1, t)
  })

  /** Soft midground hills + farther atmospheric mountain silhouettes */
  const hillPos: [number, number, number, number, number, number][] = [
    [-28, 0.28, -22, 16, 2.4, 11],
    [22, 0.18, -26, 18, 2.2, 12],
    [-8, 0.22, -32, 20, 2.8, 13],
    [32, 0.12, -30, 14, 2.0, 10],
    [-18, 0.32, -36, 15, 2.15, 11],
    [8, 0.24, -38, 13, 1.9, 9],
  ]
  const mountPos: [number, number, number, number, number, number][] = [
    [-48, 1.05, -52, 36, 4.2, 20],
    [-16, 1.25, -60, 42, 5.0, 24],
    [24, 1.15, -56, 38, 4.6, 22],
    [50, 0.85, -64, 32, 3.6, 18],
    [-32, 0.7, -68, 34, 3.8, 20],
    [8, 0.6, -72, 30, 3.2, 16],
    [-6, 0.5, -78, 26, 2.8, 14],
    [36, 0.45, -76, 24, 2.5, 13],
  ]

  return (
    <group>
      <mesh scale={[80, 80, 80]} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <shaderMaterial
          ref={skyMat}
          vertexShader={SKY_VERT}
          fragmentShader={SKY_FRAG}
          uniforms={{
            uBlend: { value: 0 },
            uSunDir: { value: new THREE.Vector3(0.35, 0.25, -0.9) },
            uTime: { value: 0 },
          }}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>

      {/* Soft atmospheric veil behind the ridge (not a hard horizontal line) */}
      <mesh position={[0, 2.4, -44]} renderOrder={-1} frustumCulled={false}>
        <planeGeometry args={[220, 28, 1, 1]} />
        <meshBasicMaterial
          ref={horizonMat}
          color="#C4D4DE"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh geometry={ridgeFarGeo} material={shared.ridgeFar} renderOrder={-1} frustumCulled={false} />
      <mesh geometry={ridgeGeo} material={shared.ridge} renderOrder={-1} frustumCulled={false} />

      <mesh geometry={terrainGeo} receiveShadow={false} renderOrder={-3}>
        <meshStandardMaterial
          ref={terrainMat}
          vertexColors
          color="#ffffff"
          roughness={0.97}
          metalness={0.02}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>

      <mesh geometry={roadGeo} renderOrder={-2}>
        <meshStandardMaterial
          ref={roadMat}
          color={DARK_ROAD}
          roughness={0.98}
          metalness={0.01}
          transparent
          opacity={0.35}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {hillPos.map((h, i) => (
        <mesh key={`h${i}`} position={[h[0], h[1], h[2]]} scale={[h[3], h[4], h[5]]} material={shared.hill}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}

      {mountPos.map((m, i) => (
        <mesh key={`m${i}`} position={[m[0], m[1], m[2]]} scale={[m[3], m[4], m[5]]} material={shared.mount}>
          <sphereGeometry args={[1, 6, 5]} />
        </mesh>
      ))}

      <instancedMesh ref={grassRef} args={[undefined, shared.veg, grassN]}>
        <coneGeometry args={[0.07, 0.14, 4]} />
      </instancedMesh>
      <instancedMesh ref={bushRef} args={[undefined, shared.veg, bushN]}>
        <sphereGeometry args={[0.14, 5, 4]} />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, shared.trunk, treeN]}>
        <cylinderGeometry args={[0.035, 0.05, 0.55, 4]} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, shared.veg, treeN]}>
        <sphereGeometry args={[0.22, 5, 4]} />
      </instancedMesh>

      {pathPts.map((p, i) => (
        <mesh
          key={`c${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[p.x, terrainHeight(p.x, p.z, pathPts) + 0.045, p.z]}
          renderOrder={1}
          material={shared.shadow}
        >
          <circleGeometry args={[i === pathPts.length - 1 ? 0.62 : 0.42, 16]} />
        </mesh>
      ))}
    </group>
  )
}
