import { useFrame, useThree } from '@react-three/fiber'

import * as THREE from 'three'

import { useRef, type MutableRefObject } from 'react'

import { sceneAppearance, type LandingAppearance } from '@/theme/landingTheme'

import type { CelestialVisualState } from '@/theme/LandingThemeContext'

import { settledCelestialWorldPos, worldPosFromArcU, sunDirectionFromArcU } from './celestialMath'



const D = sceneAppearance.dark

const L = sceneAppearance.light



const fogDark = new THREE.Color(D.fogColor)

const fogLight = new THREE.Color(L.fogColor)

const ambDark = new THREE.Color(D.ambient.color)

const ambLight = new THREE.Color(L.ambient.color)

const keyDark = new THREE.Color('#c8d8e8')

const keyLight = new THREE.Color('#FFF4E0')

const rimDark = new THREE.Color(D.rim.color)

const rimLight = new THREE.Color(L.rim.color)

const accDark = new THREE.Color(D.accent.color)

const accLight = new THREE.Color(L.accent.color)

const fillDark = new THREE.Color(D.fill.color)

const fillLight = new THREE.Color('#FFE8C8')

const hemiSkyDark = new THREE.Color('#102028')
const hemiGroundDark = new THREE.Color('#1a2e1c')
const hemiSkyLight = new THREE.Color('#a8d0ec')
const hemiGroundLight = new THREE.Color('#6a9a52')

const bgLight = new THREE.Color('#6EB4E8')



interface SceneThemeDriverProps {

  appearance: LandingAppearance

  blendRef: MutableRefObject<number>

  transitionLockRef: MutableRefObject<boolean>

  /** Passed from outside Canvas — R3F does not inherit React context. */

  isTransitioning: boolean

  celestial: CelestialVisualState | null

  dragArcURef: MutableRefObject<number | null>

}



/**

 * Lerps lights, fog and exposure toward the active appearance.

 * Sun/moon positions drive the primary directional light.

 */

export default function SceneThemeDriver({

  appearance,

  blendRef,

  transitionLockRef,

  isTransitioning,

  celestial,

  dragArcURef,

}: SceneThemeDriverProps) {

  const { scene, gl } = useThree()

  const ambientRef = useRef<THREE.AmbientLight>(null)

  const keyRef = useRef<THREE.DirectionalLight>(null)

  const rimRef = useRef<THREE.DirectionalLight>(null)

  const accentRef = useRef<THREE.PointLight>(null)

  const fillRef = useRef<THREE.DirectionalLight>(null)

  const hemiRef = useRef<THREE.HemisphereLight>(null)

  const tmp = useRef(new THREE.Color())

  const sunPosTmp = useRef(new THREE.Vector3())

  const moonPosTmp = useRef(new THREE.Vector3())

  const lightPosTmp = useRef(new THREE.Vector3())
  const sunDirTmp = useRef(new THREE.Vector3())
  const dayKeyTmp = useRef(new THREE.Vector3(14, 17, -9))



  useFrame((_, delta) => {

    if (!transitionLockRef.current) {

      const target = appearance === 'light' ? 1 : 0

      blendRef.current = THREE.MathUtils.damp(blendRef.current, target, 10, delta)

    }

    const t = blendRef.current



    const fog = scene.fog

    if (fog instanceof THREE.Fog) {

      fog.color.copy(tmp.current.lerpColors(fogDark, fogLight, t))

      fog.near = THREE.MathUtils.lerp(D.fogNear, L.fogNear, t)

      fog.far = THREE.MathUtils.lerp(D.fogFar, L.fogFar, t)

    }

    if (!(scene.background instanceof THREE.Color)) {

      scene.background = new THREE.Color()

    }

    const bg = tmp.current.lerpColors(fogDark, bgLight, t)
      ; (scene.background as THREE.Color).copy(bg)
    // Opaque clear prevents light page layers from bleeding through the sky dome.
    gl.setClearColor(bg.getHex(), 1)

    gl.toneMappingExposure = THREE.MathUtils.lerp(D.exposure, L.exposure, t)



    const transitioningCelestial = isTransitioning && celestial && celestial.bodyOpacity > 0.02
    const dragU = dragArcURef.current

    const sunPos = transitioningCelestial
      ? worldPosFromArcU(celestial!.arcU, t, sunPosTmp.current)
      : settledCelestialWorldPos(t, sunPosTmp.current)
    const moonPos = transitioningCelestial
      ? worldPosFromArcU(celestial!.arcU, 0, moonPosTmp.current)
      : settledCelestialWorldPos(0, moonPosTmp.current)

    // During transition, weight by which body is currently more visible.
    const sunWeight = transitioningCelestial ? celestial!.sunOpacity : t
    const lightPos = lightPosTmp.current.lerpVectors(moonPos, sunPos, sunWeight)

    // Settled daylight: key light from high sun with slight warm fill from upper-right.
    if (!transitioningCelestial && t > 0.05 && dragU === null) {
      lightPos.lerp(dayKeyTmp.current, t * 0.28)
    }

    if (ambientRef.current) {

      ambientRef.current.intensity = THREE.MathUtils.lerp(D.ambient.intensity * 1.08, L.ambient.intensity * 0.95, t)

      ambientRef.current.color.lerpColors(ambDark, ambLight, t)

    }

    if (keyRef.current) {

      keyRef.current.position.copy(lightPos)

      keyRef.current.intensity = THREE.MathUtils.lerp(D.key.intensity * 0.72, L.key.intensity * 1.08, t)

      keyRef.current.color.lerpColors(keyDark, keyLight, t)

    }

    if (rimRef.current) {

      rimRef.current.intensity = THREE.MathUtils.lerp(D.rim.intensity * 1.12, L.rim.intensity + 0.06, t)

      rimRef.current.color.lerpColors(rimDark, rimLight, t)

      // Soft fill from opposite side for gentle outdoor shading

      rimRef.current.position.set(-lightPos.x * 0.4, Math.max(2, lightPos.y * 0.35), -lightPos.z * 0.25)

    }

    if (accentRef.current) {

      accentRef.current.intensity = THREE.MathUtils.lerp(D.accent.intensity, L.accent.intensity, t)

      accentRef.current.color.lerpColors(accDark, accLight, t)

    }

    if (fillRef.current) {

      fillRef.current.intensity = THREE.MathUtils.lerp(D.fill.intensity, L.fill.intensity + 0.12, t)

      fillRef.current.color.lerpColors(fillDark, fillLight, t)

      fillRef.current.position.set(lightPos.x * 0.55, lightPos.y * 0.7, lightPos.z * 0.4)

    }

    if (hemiRef.current) {

      hemiRef.current.intensity = THREE.MathUtils.lerp(0.06, 0.52, t)

      hemiRef.current.color.lerpColors(hemiSkyDark, hemiSkyLight, t)

      hemiRef.current.groundColor.lerpColors(hemiGroundDark, hemiGroundLight, t)

    }



    // Expose sun direction for sky shader via scene userData
    if (transitioningCelestial) {
      scene.userData.sunDirection = sunDirectionFromArcU(celestial!.arcU, t, sunDirTmp.current)
    } else {
      scene.userData.sunDirection = sunDirTmp.current.copy(lightPos).normalize()
    }

  })



  return (

    <>

      <ambientLight ref={ambientRef} intensity={D.ambient.intensity} />

      <hemisphereLight ref={hemiRef} args={[hemiSkyDark, hemiGroundDark, 0]} />

      <directionalLight ref={keyRef} position={[8, 12, -20]} intensity={D.key.intensity} color={keyDark} />

      <directionalLight ref={rimRef} position={[-4, 3, -3]} intensity={D.rim.intensity} color={D.rim.color} />

      <pointLight

        ref={accentRef}

        position={[2.5, 2.5, -1.5]}

        intensity={D.accent.intensity}

        color={D.accent.color}

        distance={10}

        decay={2}

      />

      <directionalLight ref={fillRef} position={[1, 6, 2]} intensity={0} color={D.fill.color} />

    </>

  )

}


