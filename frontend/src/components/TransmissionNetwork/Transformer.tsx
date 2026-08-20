import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { LandingModuleId, NetProgress } from './types'
import type { CorridorLayout } from './corridor'
import { sceneAppearance } from '@/theme/landingTheme'

interface TransformerProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
  themeBlendRef: MutableRefObject<number>
}

/**
 * Stylized procedural substation transformer: tank body, cooling fins,
 * three HV bushings, base platform. Low-poly primitives, shared materials.
 */
export default function Transformer({ layout, progressRef, activeModule, themeBlendRef }: TransformerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const localLightRef = useRef<THREE.PointLight>(null)

  const contactShadowRef = useRef<THREE.Mesh>(null)

  const indicatorRef = useRef<THREE.Group>(null)
  const { steel, darkSteel, bushing, ringMat, indicatorMat, contactShadowMat, steelC, darkC, bushC, emiC, indC } = useMemo(() => {
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

    // Ground contact shadow — keeps the substation grounded without changing placement.
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const steelC = {
      dark: new THREE.Color('#5b6470'),
      light: new THREE.Color(sceneAppearance.light.transformer.steel),
    }
    const darkC = {
      dark: new THREE.Color('#3d4451'),
      light: new THREE.Color(sceneAppearance.light.transformer.darkSteel),
    }
    const bushC = {
      dark: new THREE.Color('#8b95a3'),
      light: new THREE.Color(sceneAppearance.light.transformer.bushing),
    }
    const emiC = {
      dark: new THREE.Color('#134e6a'),
      light: new THREE.Color(sceneAppearance.light.transformer.emissive),
    }
    const indC = {
      dark: new THREE.Color('#67e8f9'),
      light: new THREE.Color(sceneAppearance.light.transformer.indicator),
    }
    return { steel, darkSteel, bushing, ringMat, indicatorMat, contactShadowMat, steelC, darkC, bushC, emiC, indC }
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
    const blend = themeBlendRef.current
    const arrival = p.arrivalPulse * blend
    const glow = p.pulse * 1.1 + perfHover
    const targetOpacity = entrance * THREE.MathUtils.lerp(0.9, 0.84, blend) * (1 - p.dim * 0.1)

    // Contact shadow is subtle; it darkens in dark mode and softens in light mode.
    if (contactShadowRef.current) {
      const base = THREE.MathUtils.lerp(0.18, 0.11, blend)
      const energized = arrival * 0.18
        ; (contactShadowRef.current.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.damp(
          (contactShadowRef.current.material as THREE.MeshBasicMaterial).opacity,
          entrance * base + energized,
          6,
          delta
        )
    }

    steel.color.lerpColors(steelC.dark, steelC.light, blend)
    darkSteel.color.lerpColors(darkC.dark, darkC.light, blend)
    bushing.color.lerpColors(bushC.dark, bushC.light, blend)
    indicatorMat.color.lerpColors(indC.dark, indC.light, blend)

    for (const m of mats) {
      m.opacity = THREE.MathUtils.damp(m.opacity, targetOpacity, 8, delta)
      m.emissive.lerpColors(emiC.dark, emiC.light, blend)
      m.emissiveIntensity = THREE.MathUtils.damp(
        m.emissiveIntensity,
        THREE.MathUtils.lerp(0.16, 0.06, blend) + glow * THREE.MathUtils.lerp(0.6, 0.35, blend),
        8,
        delta
      )
    }

    if (localLightRef.current) {
      localLightRef.current.intensity = THREE.MathUtils.lerp(
        0.5,
        sceneAppearance.light.transformer.localLight + arrival * 0.35,
        blend
      )
    }

    // Indicator lights breathe slowly once the unit is energized
    if (indicatorRef.current) {
      const live = entrance > 0.9 ? 1 : 0
      const breathe = 0.55 + Math.sin(state.clock.elapsedTime * 1.6) * 0.2
      indicatorMat.opacity = THREE.MathUtils.damp(
        indicatorMat.opacity,
        live * breathe * (1 - p.dim * 0.2) + glow * 0.25 + arrival * 0.45,
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
      <pointLight ref={localLightRef} position={[0, 0.5, 0.5]} intensity={0.5} color="#22d3ee" distance={2.2} decay={2} />

      {/* Activation pulse ring */}
      <mesh ref={ringRef} material={ringMat} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.42, 0.5, 32]} />
      </mesh>

      {/* Contact shadow under transformer — grounded look */}
      <mesh ref={contactShadowRef} material={contactShadowMat} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[0.42, 18]} />
      </mesh>
    </group>
  )
}
