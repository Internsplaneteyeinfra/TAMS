import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { CelestialVisualState } from '@/theme/LandingThemeContext'
import { settledCelestialWorldPos, worldPosFromArcU } from './celestialMath'

interface CelestialScene3DProps {
  themeBlendRef: MutableRefObject<number>
  isTransitioning: boolean
  celestial: CelestialVisualState | null
  dragArcURef: MutableRefObject<number | null>
}

/** 3D sun/moon in the sky dome — subtle disc driving directional light. */
export default function CelestialScene3D({
  themeBlendRef,
  isTransitioning,
  celestial,
}: CelestialScene3DProps) {
  const sunRef = useRef<THREE.Mesh>(null)
  const sunGlowRef = useRef<THREE.Mesh>(null)
  const sunCoronaRef = useRef<THREE.Mesh>(null)
  const moonRef = useRef<THREE.Mesh>(null)
  const moonGlowRef = useRef<THREE.Mesh>(null)

  const sunMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFF8E8',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  )
  const sunGlowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFCC66',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  )
  const sunCoronaMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFE8A0',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  )
  const moonMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#E8EEF4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  )
  const moonGlowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#A8C0D0',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  )

  const settledPos = useMemo(() => new THREE.Vector3(), [])
  const travelPos = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    const blend = themeBlendRef.current
    const traveling = isTransitioning && celestial && celestial.bodyOpacity > 0.02

    const place = (mesh: THREE.Mesh | null, pos: THREE.Vector3, scale: number) => {
      if (!mesh) return
      mesh.position.copy(pos)
      mesh.lookAt(camera.position)
      mesh.scale.setScalar(scale)
    }

    const sunVis = traveling
      ? celestial!.bodyOpacity * celestial!.sunOpacity
      : THREE.MathUtils.clamp(blend * 1.35, 0, 1)
    const moonVis = traveling
      ? celestial!.bodyOpacity * celestial!.moonOpacity
      : THREE.MathUtils.clamp((1 - blend) * 1.35, 0, 1)

    if (traveling) {
      worldPosFromArcU(celestial!.arcU, blend, travelPos)
      place(sunRef.current, travelPos, 0.07)
      place(sunGlowRef.current, travelPos, 0.22)
      place(sunCoronaRef.current, travelPos, 0.38)
      place(moonRef.current, travelPos, 0.09)
      place(moonGlowRef.current, travelPos, 0.24)
    } else {
      settledCelestialWorldPos(blend, settledPos)
      place(sunRef.current, settledPos, THREE.MathUtils.lerp(0.09, 0.065, blend))
      place(sunGlowRef.current, settledPos, THREE.MathUtils.lerp(0.24, 0.17, blend))
      place(sunCoronaRef.current, settledPos, THREE.MathUtils.lerp(0.42, 0.28, blend))
      settledCelestialWorldPos(0, travelPos)
      place(moonRef.current, travelPos, 0.085)
      place(moonGlowRef.current, travelPos, 0.22)
    }

    sunMat.opacity = sunVis * THREE.MathUtils.lerp(0.55, 0.32, blend)
    sunGlowMat.opacity = sunVis * THREE.MathUtils.lerp(0.22, 0.1, blend)
    sunCoronaMat.opacity = sunVis * THREE.MathUtils.lerp(0.1, 0.05, blend)
    moonMat.opacity = moonVis * 0.72
    moonGlowMat.opacity = moonVis * 0.11
  })

  return (
    <group renderOrder={-1}>
      <mesh ref={sunCoronaRef} material={sunCoronaMat} frustumCulled={false}>
        <circleGeometry args={[1, 24]} />
      </mesh>
      <mesh ref={sunGlowRef} material={sunGlowMat} frustumCulled={false}>
        <circleGeometry args={[1, 24]} />
      </mesh>
      <mesh ref={sunRef} material={sunMat} frustumCulled={false}>
        <circleGeometry args={[1, 24]} />
      </mesh>
      <mesh ref={moonGlowRef} material={moonGlowMat} frustumCulled={false}>
        <circleGeometry args={[1, 24]} />
      </mesh>
      <mesh ref={moonRef} material={moonMat} frustumCulled={false}>
        <circleGeometry args={[1, 24]} />
      </mesh>
    </group>
  )
}
