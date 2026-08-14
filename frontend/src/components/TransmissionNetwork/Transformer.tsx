import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { LandingModuleId, NetProgress } from './types'
import type { CorridorLayout } from './corridor'

interface TransformerProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
}

/**
 * Stylized procedural substation transformer: tank body, cooling fins,
 * three HV bushings, base platform. Low-poly primitives, shared materials.
 */
export default function Transformer({ layout, progressRef, activeModule }: TransformerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const indicatorRef = useRef<THREE.Group>(null)
  const { steel, darkSteel, bushing, ringMat, indicatorMat } = useMemo(() => {
    const steel = new THREE.MeshStandardMaterial({
      color: '#5b6470',
      metalness: 0.7,
      roughness: 0.42,
      transparent: true,
      opacity: 0,
      emissive: new THREE.Color('#134e6a'),
      emissiveIntensity: 0.1,
    })
    const darkSteel = steel.clone()
    darkSteel.color.set('#3d4451')
    const bushing = steel.clone()
    bushing.color.set('#8b95a3')
    bushing.roughness = 0.3
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    // Small equipment indicator lights on the tank face
    const indicatorMat = new THREE.MeshBasicMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    return { steel, darkSteel, bushing, ringMat, indicatorMat }
  }, [])

  const mats = useMemo(() => [steel, darkSteel, bushing], [steel, darkSteel, bushing])

  useEffect(
    () => () => {
      for (const m of [steel, darkSteel, bushing, ringMat, indicatorMat]) m.dispose()
    },
    [steel, darkSteel, bushing, ringMat, indicatorMat]
  )

  useFrame((state, delta) => {
    const p = progressRef.current
    const g = groupRef.current
    if (!g) return

    const entrance = p.transformer
    g.position.y = layout.transformerPos.y - (1 - entrance) * 0.35

    const perfHover = activeModule === 'performance' ? 0.35 : 0
    const glow = p.pulse * 1.1 + perfHover
    const targetOpacity = entrance * 0.92 * (1 - p.dim * 0.12)

    for (const m of mats) {
      m.opacity = THREE.MathUtils.damp(m.opacity, targetOpacity, 8, delta)
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, 0.16 + glow * 0.6, 8, delta)
    }

    // Indicator lights breathe slowly once the unit is energized
    if (indicatorRef.current) {
      const live = entrance > 0.9 ? 1 : 0
      const breathe = 0.55 + Math.sin(state.clock.elapsedTime * 1.6) * 0.2
      indicatorMat.opacity = THREE.MathUtils.damp(
        indicatorMat.opacity,
        live * breathe * (1 - p.dim * 0.2) + glow * 0.25,
        6,
        delta
      )
    }

    // Activation pulse ring expanding at the base
    const ring = ringRef.current
    if (ring) {
      if (p.pulse > 0.01) {
        const expand = 1 - p.pulse // 0 → 1 as pulse decays
        ring.visible = true
        ring.scale.setScalar(0.4 + expand * 2.2)
        ringMat.opacity = p.pulse * 0.45
      } else {
        ring.visible = false
      }
    }
  })

  return (
    <group
      ref={groupRef}
      position={layout.transformerPos}
      rotation={[0, layout.transformerRotY, 0]}
      scale={layout.transformerScale}
    >
      {/* Base platform */}
      <mesh material={darkSteel} position={[0, 0.03, 0]}>
        <boxGeometry args={[0.78, 0.06, 0.6]} />
      </mesh>

      {/* Tank body */}
      <mesh material={steel} position={[0, 0.28, 0]}>
        <boxGeometry args={[0.52, 0.42, 0.4]} />
      </mesh>

      {/* Cooling fins (radiators) on both sides */}
      {[-1, 1].map((side) =>
        [0, 1, 2, 3].map((i) => (
          <mesh
            key={`${side}-${i}`}
            material={darkSteel}
            position={[side * 0.31, 0.28, -0.14 + i * 0.095]}
          >
            <boxGeometry args={[0.05, 0.34, 0.055]} />
          </mesh>
        ))
      )}

      {/* Conservator tank on top */}
      <mesh material={steel} position={[0.1, 0.56, -0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.34, 12]} />
      </mesh>

      {/* Three HV bushings */}
      {[-0.16, 0, 0.16].map((x, i) => (
        <group key={i} position={[x, 0.49, 0.08]}>
          <mesh material={bushing}>
            <cylinderGeometry args={[0.022, 0.03, 0.26, 8]} />
          </mesh>
          <mesh material={bushing} position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.028, 8, 8]} />
          </mesh>
        </group>
      ))}

      {/* Equipment indicator lights — small cyan dots on the tank face */}
      <group ref={indicatorRef}>
        {[-0.12, 0, 0.12].map((x, i) => (
          <mesh key={i} material={indicatorMat} position={[x, 0.14, 0.21]}>
            <sphereGeometry args={[0.016, 8, 8]} />
          </mesh>
        ))}
      </group>

      {/* Local accent light — range kept short so it cannot reach the towers */}
      <pointLight position={[0, 0.5, 0.5]} intensity={0.5} color="#22d3ee" distance={2.2} decay={2} />

      {/* Activation pulse ring */}
      <mesh ref={ringRef} material={ringMat} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.42, 0.5, 32]} />
      </mesh>
    </group>
  )
}
