import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
// Loading straight from three keeps drei + three-stdlib out of the bundle,
// which measurably speeds up first paint.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// Do not import MeshoptDecoder from three/examples — Next.js cannot bundle that file.
import { MeshoptDecoder } from 'meshoptimizer'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { LandingModuleId, NetProgress } from './types'
import type { CorridorLayout } from './corridor'
import { TOWER_HEIGHT } from './corridor'
import { sceneAppearance } from '@/theme/landingTheme'

const MODEL_PATH = '/models/transmission_tower.glb'

// Module-level so useLoader's cache key stays stable
const configureLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder)
}

interface TowerInstancesProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
  themeBlendRef: MutableRefObject<number>
}

const EMISSIVE_IDLE_DARK = new THREE.Color(sceneAppearance.dark.tower.emissiveIdle)
const EMISSIVE_SCAN_DARK = new THREE.Color(sceneAppearance.dark.tower.emissiveScan)
const EMISSIVE_IDLE_LIGHT = new THREE.Color(sceneAppearance.light.tower.emissiveIdle)
const EMISSIVE_SCAN_LIGHT = new THREE.Color(sceneAppearance.light.tower.emissiveScan)
const COLOR_DARK = new THREE.Color('#7a8698').lerp(new THREE.Color('#a3b4c6'), 0.3)
const COLOR_LIGHT_LOCKED = new THREE.Color('#5E7180')
const STEEL_MID = new THREE.Color('#4A5C6A')
const STEEL_FAR = new THREE.Color('#627888')
const STEEL_BACKGROUND = new THREE.Color('#7A92A4')
const STEEL_DARK_FAR = new THREE.Color('#8aa0b0')
const STEEL_DARK_BG = new THREE.Color('#7a92a4')
const ATMOS_TINT = new THREE.Color('#8FA4B4')
const ATMOS_BLEND = new THREE.Color()
const IDLE_MIX = new THREE.Color()
const SCAN_MIX = new THREE.Color()
const BASE_OPACITY = sceneAppearance.dark.tower.opacity

/** Foreground towers whose look is finalized — excluded from all reactive effects. */
const LOCKED_TOWERS = 2

function stylize(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const mats: THREE.MeshStandardMaterial[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const apply = (mat: THREE.Material) => {
      const m = mat.clone()
      m.transparent = true
      m.opacity = 0
      m.fog = false
      if ('color' in m && m.color instanceof THREE.Color) {
        m.color.set('#7a8698').lerp(new THREE.Color('#a3b4c6'), 0.3)
      }
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const std = m as THREE.MeshStandardMaterial
        std.metalness = 0.68
        std.roughness = 0.42
        std.envMapIntensity = 0.7
        std.emissive.copy(EMISSIVE_IDLE_DARK)
        std.emissiveIntensity = 0.16
        std.userData.darkColor = std.color.clone()
        std.userData.lightColorLocked = COLOR_LIGHT_LOCKED.clone()
        mats.push(std)
      }
      return m
    }
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(apply)
    else if (mesh.material) mesh.material = apply(mesh.material)
  })
  return mats
}

export default function TowerInstances({ layout, progressRef, activeModule, themeBlendRef }: TowerInstancesProps) {
  const { scene } = useLoader(GLTFLoader, MODEL_PATH, configureLoader)
  const groupRefs = useRef<(THREE.Group | null)[]>([])

  const instances = useMemo(() => {
    // Normalize the source model once: scale to TOWER_HEIGHT, base at y=0, centered XZ
    const probe = scene.clone(true)
    const box = new THREE.Box3().setFromObject(probe)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const fit = TOWER_HEIGHT / (size.y || 1)

    return layout.towers.map(() => {
      const clone = scene.clone(true)
      const mats = stylize(clone)
      clone.scale.setScalar(fit)
      clone.position.set(-center.x * fit, -box.min.y * fit, -center.z * fit)
      const holder = new THREE.Group()
      holder.add(clone)
      return { holder, mats }
    })
  }, [scene, layout])

  useLayoutEffect(() => {
    instances.forEach((inst, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      while (g.children.length) g.remove(g.children[0])
      g.add(inst.holder)
    })
  }, [instances])

  useFrame((state, delta) => {
    const p = progressRef.current
    const time = state.clock.elapsedTime
    const blend = themeBlendRef.current
    IDLE_MIX.lerpColors(EMISSIVE_IDLE_DARK, EMISSIVE_IDLE_LIGHT, blend)
    SCAN_MIX.lerpColors(EMISSIVE_SCAN_DARK, EMISSIVE_SCAN_LIGHT, blend)

    for (let i = 0; i < instances.length; i++) {
      const g = groupRefs.current[i]
      if (!g) continue
      const slot = layout.towers[i]
      const entrance = p.towers[i] ?? 0

      // Entrance: gentle rise + scale 0.97 → 1 + fade (camera does the reveal)
      g.position.y = slot.position.y - (1 - entrance) * 0.3
      g.scale.setScalar(slot.scale * (0.97 + 0.03 * entrance))

      // The two foreground towers are locked: their settled appearance is
      // final, so no hover, pick or ambient-scan effect may touch them. Only
      // the one-shot intro scan (scanStrength 1) still passes over them.
      const locked = i < LOCKED_TOWERS

      // Scan pass highlight (gaussian around the beam position)
      let highlight = 0
      if (p.scanActive && p.scan >= 0 && (!locked || p.scanStrength >= 1)) {
        const d = (p.scan - slot.corridorT) * 5
        highlight = Math.exp(-d * d) * 0.85 * p.scanStrength
      }

      // Hover interactions — suitability spotlights the midground towers while
      // the rest of the corridor recedes slightly
      let recede = 1
      if (activeModule === 'suitability') {
        if (i === 2 || i === 3) highlight = Math.max(highlight, i === 2 ? 0.5 : 0.34)
        else recede = 0.85
      }
      if (activeModule === 'analyzer') highlight = Math.max(highlight, 0.28)
      if (i === p.hoverTower) highlight = Math.max(highlight, 0.45)

      if (locked) {
        highlight = p.scanStrength >= 1 ? highlight : 0
        recede = 1
      }

      const lightOpacity = locked
        ? sceneAppearance.light.tower.opacity
        : 0.96
      let targetOpacity =
        entrance * THREE.MathUtils.lerp(BASE_OPACITY, lightOpacity, blend) * (1 - p.dim * 0.08) * recede
      // Atmospheric perspective via colour/saturation — keep towers readable (no heavy opacity fade)
      const atmos = locked ? 0 : THREE.MathUtils.clamp((i - 2) / 4.5, 0, 1)
      const idleEmissive =
        (sceneAppearance.dark.tower.emissiveBase * (1 - blend) +
          sceneAppearance.light.tower.emissiveBase * blend) *
        (locked ? 1 : 1 + atmos * 0.15)
      ATMOS_BLEND.lerpColors(STEEL_MID, ATMOS_TINT, atmos * 0.55)
      const depthLight = locked
        ? COLOR_LIGHT_LOCKED
        : i <= 3
          ? new THREE.Color('#3E505E')
          : i <= 5
            ? ATMOS_BLEND
            : STEEL_BACKGROUND
      const depthDark = locked
        ? COLOR_DARK
        : i <= 2
          ? COLOR_DARK
          : i <= 4
            ? STEEL_DARK_FAR
            : STEEL_DARK_BG
      for (const std of instances[i].mats) {
        std.opacity = THREE.MathUtils.damp(std.opacity, targetOpacity + highlight * 0.1, 8, delta)
        std.emissiveIntensity = THREE.MathUtils.damp(
          std.emissiveIntensity,
          idleEmissive + highlight * (0.6 - blend * 0.42),
          8,
          delta
        )
        std.emissive.lerpColors(IDLE_MIX, SCAN_MIX, Math.min(1, highlight))
        const darkCol = locked
          ? ((std.userData.darkColor as THREE.Color) ?? COLOR_DARK)
          : depthDark
        std.color.lerpColors(darkCol, depthLight, blend)
        const lightMetal = locked
          ? sceneAppearance.light.tower.metalness
          : sceneAppearance.light.tower.metalness + 0.1 - Math.min(i, 5) * 0.012
        const lightRough = locked
          ? sceneAppearance.light.tower.roughness
          : sceneAppearance.light.tower.roughness - 0.08 + Math.min(i, 5) * 0.015
        std.metalness = THREE.MathUtils.lerp(0.68, lightMetal, blend)
        std.roughness = THREE.MathUtils.lerp(0.42, lightRough, blend)
        // Soft daylight response on mid/distant towers only (locked left tower unchanged)
        if (!locked) {
          std.envMapIntensity = THREE.MathUtils.lerp(0.85, 0.95 - Math.min(i, 5) * 0.06, blend)
        }
      }

      // Barely-perceptible idle sway once initialized
      if (p.initialized) {
        g.rotation.y = slot.rotationY + Math.sin(time * 0.22 + i * 1.7) * 0.006
      }
    }
  })

  return (
    <>
      {layout.towers.map((slot, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el
          }}
          position={slot.position}
          rotation={[0, slot.rotationY, 0]}
          scale={slot.scale}
        />
      ))}
    </>
  )
}

useLoader.preload(GLTFLoader, MODEL_PATH, configureLoader)
