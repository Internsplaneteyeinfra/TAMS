import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { LandingModuleId, NetProgress } from './types'
import type { CorridorLayout } from './corridor'

interface TransmissionLinesProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
}

const POINTS_PER_CURVE = 140

/**
 * Sagging conductor lines drawn progressively (0% → 100%) via drawRange —
 * the network visibly "connects" tower by tower into the transformer.
 */
export default function TransmissionLines({ layout, progressRef, activeModule }: TransmissionLinesProps) {
  const lines = useMemo(
    () =>
      layout.conductorCurves.map((curve, i) => {
        const pts = curve.getPoints(POINTS_PER_CURVE)
        const geom = new THREE.BufferGeometry().setFromPoints(pts)
        geom.setDrawRange(0, 0)
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color('#67e8f9'),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const line = new THREE.Line(geom, mat)
        line.renderOrder = 2
        // slight per-line stagger so conductors connect one after another
        line.userData.stagger = i * 0.08
        return line
      }),
    [layout]
  )

  useFrame((_, delta) => {
    const p = progressRef.current
    for (const line of lines) {
      const stagger = line.userData.stagger as number
      const draw = THREE.MathUtils.clamp((p.lineDraw - stagger) / (1 - stagger || 1), 0, 1)
      line.geometry.setDrawRange(0, Math.floor(draw * (POINTS_PER_CURVE + 1)))

      const mat = line.material as THREE.LineBasicMaterial
      const scanBoost = p.scanActive ? 0.25 * p.scanStrength : 0
      const hoverBoost = activeModule === 'analyzer' ? 0.2 : 0
      // Suitability hover focuses on towers — the corridor recedes slightly
      const recede = activeModule === 'suitability' ? 0.85 : 1
      const target = draw > 0 ? (0.5 + scanBoost + hoverBoost) * (1 - p.dim * 0.14) * recede : 0
      mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 6, delta)
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
