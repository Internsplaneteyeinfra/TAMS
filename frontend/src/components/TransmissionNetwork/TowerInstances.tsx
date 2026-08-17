import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
// Loading straight from three keeps drei + three-stdlib out of the bundle,
// which measurably speeds up first paint.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'meshoptimizer'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import type { LandingModuleId, NetProgress } from './types'
import type { CorridorLayout } from './corridor'
import { TOWER_HEIGHT } from './corridor'

const MODEL_PATH = '/models/transmission_tower.glb'

// Module-level so useLoader's cache key stays stable
const configureLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder)
}

interface TowerInstancesProps {
  layout: CorridorLayout
  progressRef: MutableRefObject<NetProgress>
  activeModule: LandingModuleId | null
}

const EMISSIVE_IDLE = new THREE.Color('#155e78')
const EMISSIVE_SCAN = new THREE.Color('#22d3ee')
const BASE_OPACITY = 0.7

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
      if ('color' in m && m.color instanceof THREE.Color) {
        m.color.set('#7a8698').lerp(new THREE.Color('#a3b4c6'), 0.3)
      }
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const std = m as THREE.MeshStandardMaterial
        std.metalness = 0.68
        std.roughness = 0.42
        std.envMapIntensity = 0.7
        std.emissive.copy(EMISSIVE_IDLE)
        std.emissiveIntensity = 0.16
        mats.push(std)
      }
      return m
    }
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(apply)
    else if (mesh.material) mesh.material = apply(mesh.material)
  })
  return mats
}

export default function TowerInstances({ layout, progressRef, activeModule }: TowerInstancesProps) {
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

      const targetOpacity = entrance * BASE_OPACITY * (1 - p.dim * 0.08) * recede
      for (const std of instances[i].mats) {
        std.opacity = THREE.MathUtils.damp(std.opacity, targetOpacity + highlight * 0.1, 8, delta)
        std.emissiveIntensity = THREE.MathUtils.damp(
          std.emissiveIntensity,
          0.22 + highlight * 0.6,
          8,
          delta
        )
        std.emissive.lerpColors(EMISSIVE_IDLE, EMISSIVE_SCAN, Math.min(1, highlight))
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
