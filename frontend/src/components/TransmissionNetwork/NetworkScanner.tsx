import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { NetProgress } from './types'
import type { CorridorLayout } from './corridor'
import { TOWER_HEIGHT } from './corridor'
import { sceneAppearance } from '@/theme/landingTheme'

const SCAN_DARK = new THREE.Color(sceneAppearance.dark.scan.color)
const SCAN_LIGHT = new THREE.Color(sceneAppearance.light.scan.color)

interface NetworkScannerProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  themeBlendRef: MutableRefObject<number>
}

/**
 * One-shot scan: a translucent vertical beam sweeps along the corridor
 * (T1 → transformer). Tower highlighting reacts in TowerInstances.
 */
export default function NetworkScanner({ layout, progressRef, themeBlendRef }: NetworkScannerProps) {
  const beamRef = useRef<THREE.Mesh>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])

  // Radial falloff so the beam has no hard rectangular edges against the sky
  const alphaMap = useMemo(() => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.6)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
    }
    return new THREE.CanvasTexture(canvas)
  }, [])

  useEffect(() => () => alphaMap.dispose(), [alphaMap])

  useFrame((_, delta) => {
    const beam = beamRef.current
    if (!beam) return
    const p = progressRef.current
    const mat = beam.material as THREE.MeshBasicMaterial

    if (!p.scanActive || p.scan < 0) {
      mat.opacity = THREE.MathUtils.damp(mat.opacity, 0, 8, delta)
      if (mat.opacity < 0.01) beam.visible = false
      return
    }

    beam.visible = true
    const t = THREE.MathUtils.clamp(p.scan, 0.001, 0.999)
    layout.groundCurve.getPointAt(t, tmp)
    layout.groundCurve.getPointAt(Math.min(0.999, t + 0.02), ahead)

    beam.position.set(tmp.x, TOWER_HEIGHT * 0.52, tmp.z)
    beam.lookAt(ahead.x, TOWER_HEIGHT * 0.52, ahead.z)

    const fade = Math.sin(Math.min(1, p.scan) * Math.PI)
    const blend = themeBlendRef.current
    mat.color.lerpColors(SCAN_DARK, SCAN_LIGHT, blend)
    mat.opacity = (0.05 + fade * 0.08) * p.scanStrength * (1 + blend * 0.35)
  })

  return (
    <mesh ref={beamRef} visible={false}>
      <planeGeometry args={[2.4, TOWER_HEIGHT * 1.15]} />
      <meshBasicMaterial
        color="#22d3ee"
        alphaMap={alphaMap}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
