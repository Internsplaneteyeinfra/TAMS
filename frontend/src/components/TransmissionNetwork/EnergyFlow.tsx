import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { LandingModuleId, NetProgress, ViewportTier } from './types'
import type { CorridorLayout } from './corridor'

interface EnergyFlowProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
  viewport: ViewportTier
}

/**
 * Energy particles that travel the conductor curves tower → tower → transformer.
 * First a bright wavefront runs the full corridor (activation), then a calm loop.
 */
export default function EnergyFlow({ layout, progressRef, activeModule, viewport }: EnergyFlowProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  // 2–4 particles per conductor path — power reads as moving, not swarming
  const count = viewport === 'mobile' ? 6 : viewport === 'tablet' ? 9 : 12
  const curveCount = layout.conductorCurves.length

  const meta = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        curveIndex: i % curveCount,
        offset: (Math.floor(i / curveCount) / Math.ceil(count / curveCount)) % 1,
        speed: 0.045 + (i % 4) * 0.008,
      })),
    [count, curveCount]
  )

  const positions = useMemo(() => new Float32Array(count * 3), [count])

  useFrame((state, delta) => {
    const points = pointsRef.current
    if (!points) return
    const p = progressRef.current
    const mat = points.material as THREE.PointsMaterial

    if (!p.energyOn && p.wavefront <= 0) {
      mat.opacity = THREE.MathUtils.damp(mat.opacity, 0, 6, delta)
      return
    }

    const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute
    const perfBoost = activeModule === 'performance' ? 1 : 0

    if (!p.energyOn) {
      // Activation wavefront: tight bright cluster racing down the corridor
      mat.opacity = THREE.MathUtils.damp(mat.opacity, 0.9, 8, delta)
      mat.size = 0.05
      for (let i = 0; i < meta.length; i++) {
        const m = meta[i]
        const trail = (i % 5) * 0.018
        const t = THREE.MathUtils.clamp(p.wavefront - trail, 0.001, 0.999)
        layout.conductorCurves[m.curveIndex].getPointAt(t, tmp)
        attr.setXYZ(i, tmp.x, tmp.y, tmp.z)
      }
    } else {
      // Steady ambient flow
      // Post-intro the flow settles but stays clearly alive
      const targetOpacity = (0.5 + perfBoost * 0.3) * (1 - p.dim * 0.32)
      mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 4, delta)
      mat.size = viewport === 'mobile' ? 0.03 : 0.038
      const time = state.clock.elapsedTime
      for (let i = 0; i < meta.length; i++) {
        const m = meta[i]
        const t = (m.offset + time * m.speed * (1 + perfBoost * 0.8)) % 1
        layout.conductorCurves[m.curveIndex].getPointAt(t, tmp)
        attr.setXYZ(i, tmp.x, tmp.y, tmp.z)
      }
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} renderOrder={3}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
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
  )
}
