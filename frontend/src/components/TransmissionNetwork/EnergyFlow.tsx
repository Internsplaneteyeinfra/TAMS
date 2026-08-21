import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import { sceneAppearance } from '@/theme/landingTheme'
import type { LandingModuleId, NetProgress, ViewportTier } from './types'
import type { CorridorLayout } from './corridor'
import { headingClearanceY } from './corridor'

interface EnergyFlowProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
  viewport: ViewportTier
  themeBlendRef: MutableRefObject<number>
}

const ENERGY_DARK = new THREE.Color(sceneAppearance.dark.energy.color)
const ENERGY_LIGHT = new THREE.Color(sceneAppearance.light.energy.color)
const TRAIL_STEPS = 3
const TRAIL_GAP = 0.008
const TRAIL_ALPHA = [0.78, 0.26, 0.07]
const ARRIVAL_DUR = 0.55

/**
 * Energy particles that travel the conductor curves tower → tower → transformer.
 * First a bright wavefront runs the full corridor (activation), then a calm loop.
 * Light mode adds a core, soft halo, and a short path-aligned trail.
 */
export default function EnergyFlow({
  layout,
  progressRef,
  activeModule,
  viewport,
  themeBlendRef,
}: EnergyFlowProps) {
  const coreRef = useRef<THREE.Points>(null)
  const glowRef = useRef<THREE.Points>(null)
  const trailRef = useRef<THREE.Points>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const arrivalLeftRef = useRef(0)

  // 2–4 particles per conductor path — power reads as moving, not swarming
  const count = viewport === 'mobile' ? 6 : viewport === 'tablet' ? 9 : 12

  const meta = useMemo(() => {
    const spreadOffsets =
      viewport === 'mobile'
        ? [0.16, 0.42, 0.68, 0.88, 0.55, 0.3]
        : viewport === 'tablet'
          ? [0.1, 0.24, 0.38, 0.52, 0.66, 0.8, 0.92, 0.32, 0.58]
          : [0.08, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.92, 0.26, 0.5, 0.62, 0.74]
    return Array.from({ length: count }, (_, i) => {
      const curveIndex = i % 5 === 0 ? 0 : i % 5 === 1 ? 2 : 1
      return {
        curveIndex,
        offset: spreadOffsets[i] ?? (i + 0.5) / count,
        speed: 0.043 + (i % 4) * 0.007,
        lastT: 0,
      }
    })
  }, [count, viewport])

  const trailCount = count * TRAIL_STEPS

  const corePos = useMemo(() => new Float32Array(count * 3), [count])
  const glowPos = useMemo(() => new Float32Array(count * 3), [count])
  const trailPos = useMemo(() => new Float32Array(trailCount * 3), [trailCount])
  const trailColor = useMemo(() => {
    const c = new Float32Array(trailCount * 3)
    const col = ENERGY_DARK
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < TRAIL_STEPS; k++) {
        const idx = (i * TRAIL_STEPS + k) * 3
        const a = TRAIL_ALPHA[k]
        c[idx] = col.r * a
        c[idx + 1] = col.g * a
        c[idx + 2] = col.b * a
      }
    }
    return c
  }, [count, trailCount])

  const place = (curveIndex: number, t: number, out: Float32Array, i: number, blend: number) => {
    const u = THREE.MathUtils.clamp(t, 0.001, 0.999)
    layout.conductorCurves[curveIndex].getPointAt(u, tmp)
    tmp.y -= headingClearanceY(u, blend)
    out[i * 3] = tmp.x
    out[i * 3 + 1] = tmp.y
    out[i * 3 + 2] = tmp.z
  }

  useFrame((state, delta) => {
    const core = coreRef.current
    const glow = glowRef.current
    const trail = trailRef.current
    if (!core || !glow || !trail) return
    const p = progressRef.current
    const coreMat = core.material as THREE.PointsMaterial
    const glowMat = glow.material as THREE.PointsMaterial
    const trailMat = trail.material as THREE.PointsMaterial
    const blend = themeBlendRef.current
    coreMat.color.lerpColors(ENERGY_DARK, ENERGY_LIGHT, blend)
    glowMat.color.lerpColors(ENERGY_DARK, ENERGY_LIGHT, blend)
    trailMat.color.lerpColors(ENERGY_DARK, ENERGY_LIGHT, blend)
    coreMat.blending = blend > 0.45 ? THREE.NormalBlending : THREE.AdditiveBlending

    if (!p.energyOn && p.wavefront <= 0) {
      coreMat.opacity = THREE.MathUtils.damp(coreMat.opacity, 0, 6, delta)
      glowMat.opacity = THREE.MathUtils.damp(glowMat.opacity, 0, 6, delta)
      trailMat.opacity = THREE.MathUtils.damp(trailMat.opacity, 0, 6, delta)
      return
    }

    const perfBoost = activeModule === 'performance' ? 1 : 0
    const markArrival = (m: { lastT: number }, t: number) => {
      if (m.lastT < 0.94 && t >= 0.94) arrivalLeftRef.current = ARRIVAL_DUR
      m.lastT = t
    }

    const darkSize = viewport === 'mobile' ? 0.034 : 0.04
    const lightSize = darkSize * 0.88
    const darkOpacity = (0.92 + perfBoost * 0.2) * (1 - p.dim * 0.2)
    const lightOpacity = (0.78 + perfBoost * 0.1) * (1 - p.dim * 0.1)

    const sampleT = (i: number) => {
      const m = meta[i]
      if (!p.energyOn) {
        const waveTrail = (i % 5) * 0.018
        return THREE.MathUtils.clamp(p.wavefront - waveTrail, 0.001, 0.999)
      }
      const time = state.clock.elapsedTime
      return (m.offset + time * m.speed * (1 + perfBoost * 0.8)) % 1
    }

    if (!p.energyOn) {
      coreMat.opacity = THREE.MathUtils.damp(coreMat.opacity, THREE.MathUtils.lerp(0.9, 0.95, blend), 8, delta)
      coreMat.size = THREE.MathUtils.lerp(0.05, 0.05 * 1.28, blend)
    } else {
      coreMat.opacity = THREE.MathUtils.damp(
        coreMat.opacity,
        THREE.MathUtils.lerp(darkOpacity, lightOpacity, blend),
        4,
        delta
      )
      coreMat.size = THREE.MathUtils.lerp(darkSize, lightSize, blend)
    }

    glowMat.size = coreMat.size * THREE.MathUtils.lerp(2.4, 1.85, blend)
    const glowTarget = THREE.MathUtils.lerp(0.38, 0.3, blend) * (1 - p.dim * 0.1)
    const trailTarget = THREE.MathUtils.lerp(0.68, 0.58, blend) * (1 - p.dim * 0.06)
    glowMat.blending = blend > 0.55 ? THREE.NormalBlending : THREE.AdditiveBlending
    trailMat.blending = blend > 0.55 ? THREE.NormalBlending : THREE.AdditiveBlending
    glowMat.opacity = THREE.MathUtils.damp(glowMat.opacity, glowTarget, 6, delta)
    trailMat.size = coreMat.size * (0.66 + blend * 0.08)
    trailMat.opacity = THREE.MathUtils.damp(trailMat.opacity, trailTarget, 6, delta)

    for (let i = 0; i < meta.length; i++) {
      const m = meta[i]
      const t = sampleT(i)
      place(m.curveIndex, t, corePos, i, blend)
      glowPos[i * 3] = corePos[i * 3]
      glowPos[i * 3 + 1] = corePos[i * 3 + 1]
      glowPos[i * 3 + 2] = corePos[i * 3 + 2]
      for (let k = 0; k < TRAIL_STEPS; k++) {
        const tt = t - TRAIL_GAP * (k + 1)
        const idx = i * TRAIL_STEPS + k
        if (tt < 0.002) {
          trailPos[idx * 3] = corePos[i * 3]
          trailPos[idx * 3 + 1] = corePos[i * 3 + 1]
          trailPos[idx * 3 + 2] = corePos[i * 3 + 2]
        } else {
          place(m.curveIndex, tt, trailPos, idx, blend)
        }
      }
      markArrival(m, t)
    }

    arrivalLeftRef.current = Math.max(0, arrivalLeftRef.current - delta)
    const u = 1 - arrivalLeftRef.current / ARRIVAL_DUR
    p.arrivalPulse = arrivalLeftRef.current > 0 ? Math.sin(Math.PI * u) : 0

    const coreAttr = core.geometry.getAttribute('position') as THREE.BufferAttribute
    const glowAttr = glow.geometry.getAttribute('position') as THREE.BufferAttribute
    const trailAttr = trail.geometry.getAttribute('position') as THREE.BufferAttribute
    coreAttr.needsUpdate = true
    glowAttr.needsUpdate = true
    trailAttr.needsUpdate = true
  })

  return (
    <group>
      <points ref={coreRef} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[corePos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#7dd3fc"
          size={0.038}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={glowRef} renderOrder={4}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glowPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#00A8C7"
          size={0.08}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.NormalBlending}
        />
      </points>
      <points ref={trailRef} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColor, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#00A8C7"
          size={0.028}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
          vertexColors
          blending={THREE.NormalBlending}
        />
      </points>
    </group>
  )
}
