import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { LandingModuleId, NetProgress } from './types'
import type { CorridorLayout } from './corridor'
import { headingClearanceY } from './corridor'
import { sceneAppearance } from '@/theme/landingTheme'

interface TransmissionLinesProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
  themeBlendRef: MutableRefObject<number>
}

const POINTS_PER_CURVE = 140

const LINE_DARK = new THREE.Color(sceneAppearance.dark.line.color)
const LINE_LIGHT = new THREE.Color(sceneAppearance.light.line.color)
const LINE_FAR_LIGHT = new THREE.Color('#8FA3B0')
const LINE_FAR_DARK = new THREE.Color('#4a6a78')
const TMP_COL = new THREE.Color()
const FAR_MIX = new THREE.Color()

/**
 * Sagging conductor lines drawn progressively (0% → 100%) via drawRange —
 * the network visibly "connects" tower by tower into the transformer.
 */
export default function TransmissionLines({
  layout,
  progressRef,
  activeModule,
  themeBlendRef,
}: TransmissionLinesProps) {
  const lines = useMemo(
    () =>
      layout.conductorCurves.map((curve, i) => {
        const pts = curve.getPoints(POINTS_PER_CURVE)
        const geom = new THREE.BufferGeometry().setFromPoints(pts)
        geom.setDrawRange(0, 0)
        const orig = new Float32Array(pts.length * 3)
        const colors = new Float32Array(pts.length * 3)
        for (let i = 0; i < pts.length; i++) {
          orig[i * 3] = pts[i].x
          orig[i * 3 + 1] = pts[i].y
          orig[i * 3 + 2] = pts[i].z
          const t = pts.length > 1 ? i / (pts.length - 1) : 0
          // Soften toward the distant end of the corridor
          const fade = 1 - t * 0.22
          colors[i * 3] = fade
          colors[i * 3 + 1] = fade
          colors[i * 3 + 2] = fade
        }
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color('#67e8f9'),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          fog: false,
          vertexColors: true,
        })
        const line = new THREE.Line(geom, mat)
        line.renderOrder = 2
        // slight per-line stagger so conductors connect one after another
        line.userData.stagger = i * 0.08
        line.userData.orig = orig
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
      const blend = themeBlendRef.current
      TMP_COL.lerpColors(LINE_DARK, LINE_LIGHT, blend)
      FAR_MIX.lerpColors(LINE_FAR_DARK, LINE_FAR_LIGHT, blend)
      mat.color.copy(TMP_COL).lerp(FAR_MIX, 0.2 + blend * 0.12)
      mat.blending = blend > 0.45 ? THREE.NormalBlending : THREE.AdditiveBlending
      mat.depthTest = blend > 0.45

      // Soft sag so mid-span conductors clear heading text but stay above cards
      const orig = line.userData.orig as Float32Array
      const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute
      if (orig && pos) {
        const n = pos.count
        for (let i = 0; i < n; i++) {
          const t = n > 1 ? i / (n - 1) : 0
          pos.setXYZ(i, orig[i * 3], orig[i * 3 + 1] - headingClearanceY(t, blend), orig[i * 3 + 2])
        }
        pos.needsUpdate = true
      }

      const darkTarget = draw > 0 ? (0.72 + scanBoost + hoverBoost) * (1 - p.dim * 0.14) * recede : 0
      const lightTarget =
        draw > 0 ? (0.62 + scanBoost * 0.12 + hoverBoost * 0.5) * (1 - p.dim * 0.08) * recede : 0
      const energyBoost = p.energyOn ? THREE.MathUtils.lerp(0.1, 0.05, blend) * (1 - p.dim) : 0
      const target = THREE.MathUtils.lerp(darkTarget, lightTarget, blend)
      mat.opacity = THREE.MathUtils.damp(mat.opacity, target + energyBoost, 6, delta)
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
