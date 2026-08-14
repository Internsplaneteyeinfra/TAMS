import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'
import TowerInstances from './TowerInstances'
import TransmissionLines from './TransmissionLines'
import Transformer from './Transformer'
import EnergyFlow from './EnergyFlow'
import NetworkScanner from './NetworkScanner'
import { buildCorridor, TOWER_HEIGHT } from './corridor'
import { createProgress } from './types'
import type { LandingModuleId, NetProgress, NetworkEvent, NetworkMode, ViewportTier } from './types'

export interface NetworkSceneProps {
  viewport: ViewportTier
  mode: NetworkMode
  activeModule: LandingModuleId | null
  /** true while a module click transition is running — camera pushes into the network */
  departing: boolean
  skipRef: MutableRefObject<boolean>
  /** pointer position in NDC; `active` is false until the pointer first moves */
  mouseRef: MutableRefObject<{ x: number; y: number; active: boolean }>
  /** screen-space position of the substation, so its status label can anchor to it */
  substationRef: MutableRefObject<{ x: number; y: number } | null>
  enableParallax: boolean
  onEvent?: (event: NetworkEvent) => void
}

// Timeline anchors (seconds, full mode) — one continuous ~7.4s sequence
const T = {
  towerStart: 0.3,
  towerStagger: 0.25,
  towerDur: 0.9,
  lines: 2.6,
  linesDur: 1.7,
  energy: 4.4,
  energyDur: 1.2,
  pulse: 5.6,
  pulseDur: 1.05,
  scan: 6.0,
  scanDur: 1.3,
  initialized: 7.4,
  dim: 7.9,
  dimDur: 1.4,
}
const SKIP_TO = T.initialized + 0.01

// Ambient verification pass: every 12s post-intro, subtle sweep along the corridor
const VERIFY_PERIOD = 12
const VERIFY_DUR = 2.2

/** Foreground towers with a finalized look — never pickable/reactive. */
const LOCKED_TOWERS = 2

const ease = (x: number) => {
  const c = THREE.MathUtils.clamp(x, 0, 1)
  return c * c * (3 - 2 * c)
}

function NetworkContent({
  viewport,
  mode,
  activeModule,
  departing,
  skipRef,
  mouseRef,
  substationRef,
  enableParallax,
  onEvent,
}: NetworkSceneProps) {
  const layout = useMemo(() => buildCorridor(viewport), [viewport])
  const progressRef = useRef<NetProgress>(createProgress(layout.towers.length))
  const elapsedRef = useRef(mode === 'instant' ? 60 : 0)
  const firedRef = useRef<Set<NetworkEvent>>(new Set())
  const hoverScanRef = useRef(-1)
  const prevModuleRef = useRef<typeof activeModule>(null)
  const verifyClockRef = useRef(0)
  const verifyFiredRef = useRef(false)
  const departRef = useRef(0)
  const projTmp = useMemo(() => new THREE.Vector3(), [])
  const { camera } = useThree()

  // Reset progress array size if viewport changed tower count
  if (progressRef.current.towers.length !== layout.towers.length) {
    progressRef.current = createProgress(layout.towers.length)
  }

  useFrame((state, delta) => {
    const p = progressRef.current
    const speed = mode === 'fast' ? 3.4 : 1
    // Clamp delta: the 26MB GLB parse (and tab switches) block the main thread,
    // producing a huge first-frame delta that would fast-forward the timeline.
    elapsedRef.current += Math.min(delta, 0.1) * speed
    if (skipRef.current && elapsedRef.current < SKIP_TO) {
      elapsedRef.current = SKIP_TO
    }
    const t = elapsedRef.current

    // Phase 1 — towers fade in with heavy overlap; the camera does the revealing
    for (let i = 0; i < layout.towers.length; i++) {
      p.towers[i] = ease((t - (T.towerStart + i * T.towerStagger)) / T.towerDur)
    }
    p.transformer = ease(
      (t - (T.towerStart + layout.towers.length * T.towerStagger)) / T.towerDur
    )

    // Phase 2/3 — conductors cascade across the corridor into the transformer
    p.lineDraw = ease((t - T.lines) / T.linesDur)

    // Phase 5 — energy wavefront: slow start, accelerating toward the transformer
    const wave = THREE.MathUtils.clamp((t - T.energy) / T.energyDur, 0, 1)
    if (wave >= 1) {
      p.energyOn = true
      p.wavefront = 1
    } else {
      p.wavefront = wave * wave * (0.55 + 0.45 * wave)
    }

    // Transformer activation pulse
    p.pulse = t >= T.pulse ? Math.max(0, 1 - (t - T.pulse) / T.pulseDur) : 0

    // One-shot network scan (asset inspection pass)
    if (t >= T.scan && t < T.scan + T.scanDur) {
      p.scanActive = true
      p.scan = (t - T.scan) / T.scanDur
      p.scanStrength = 1
    } else {
      p.scanActive = false
      p.scan = -1
    }

    p.initialized = t >= T.initialized
    p.dim = ease((t - T.dim) / T.dimDur)

    if (p.initialized) {
      // Analyzer hover → brief re-scan of the network
      if (activeModule === 'analyzer') {
        if (prevModuleRef.current !== 'analyzer') hoverScanRef.current = 0
        if (hoverScanRef.current >= 0 && hoverScanRef.current < 1) {
          hoverScanRef.current += delta / 1.4
          p.scanActive = true
          p.scan = Math.min(hoverScanRef.current, 1)
          p.scanStrength = 0.6
        }
      } else {
        hoverScanRef.current = -1
      }
      prevModuleRef.current = activeModule

      // Periodic ambient verification sweep (skipped for reduced motion)
      if (mode !== 'instant' && !p.scanActive) {
        verifyClockRef.current += delta
        const local = verifyClockRef.current % VERIFY_PERIOD
        if (local > VERIFY_PERIOD - VERIFY_DUR) {
          p.scanActive = true
          p.scan = (local - (VERIFY_PERIOD - VERIFY_DUR)) / VERIFY_DUR
          p.scanStrength = 0.32
          if (p.scan > 0.96 && !verifyFiredRef.current) {
            verifyFiredRef.current = true
            queueMicrotask(() => onEvent?.('verified'))
          }
        } else {
          verifyFiredRef.current = false
        }
      }
    }

    // Pointer-hover over towers (desktop, post-intro, only when no card is hovered).
    // The pick radius follows each tower's projected height, so near towers get
    // a proportionally larger hit area than distant ones.
    if (enableParallax && mouseRef.current.active && p.initialized && !activeModule && !departing) {
      let best = -1
      let bestScore = 1
      // Locked foreground towers are not pickable — they must never react
      for (let i = LOCKED_TOWERS; i < layout.towers.length; i++) {
        const slot = layout.towers[i]
        projTmp.set(slot.position.x, slot.position.y, slot.position.z)
        projTmp.project(camera)
        if (projTmp.z > 1) continue
        const baseX = projTmp.x
        const baseY = projTmp.y
        projTmp.set(
          slot.position.x,
          slot.position.y + TOWER_HEIGHT * slot.scale,
          slot.position.z
        )
        projTmp.project(camera)
        const topY = projTmp.y
        const height = Math.abs(topY - baseY)
        const radius = THREE.MathUtils.clamp(height * 0.45, 0.05, 0.3)
        const d = Math.hypot(
          (baseX + projTmp.x) / 2 - mouseRef.current.x,
          (baseY + topY) / 2 - mouseRef.current.y
        )
        // Normalized so the closest-relative hit wins when areas overlap
        const score = d / radius
        if (score < 1 && score < bestScore) {
          bestScore = score
          best = i
        }
      }
      p.hoverTower = best
    } else {
      p.hoverTower = -1
    }

    // Events (deferred out of the rAF path)
    const fire = (e: NetworkEvent, when: number) => {
      if (t >= when && !firedRef.current.has(e)) {
        firedRef.current.add(e)
        queueMicrotask(() => onEvent?.(e))
      }
    }
    fire('mapping', T.towerStart)
    fire('connecting', T.lines)
    fire('energizing', T.energy)
    fire('pulse', T.pulse)
    fire('scanDone', T.scan + T.scanDur)
    fire('initialized', T.initialized)

    // Camera: discovery move — starts close on tower 1, pulls back + up to
    // reveal the corridor, transformer last. Settles as the UI appears.
    const camT = ease((t - 0.05) / (T.initialized - 0.5))
    const zMul = viewport === 'mobile' ? 1.4 : viewport === 'tablet' ? 1.18 : 1
    const spread = viewport === 'mobile' ? 0.72 : viewport === 'tablet' ? 0.8 : 1
    const startPos = { x: -3.1 * spread, y: 0.95, z: 4.7 * zMul }
    // Settled framing tilts slightly further down so the distant transformer
    // rides above the module-card band instead of hiding behind it
    const endPos = { x: 0.35, y: 2.45, z: 7.3 * zMul }
    const startLook = { x: -3.4 * spread, y: 1.0, z: 2.3 * spread }
    const endLook = { x: 0.2, y: 0.55, z: -0.7 }

    let px = 0
    let py = 0
    if (enableParallax && p.initialized) {
      px = mouseRef.current.x * 0.14
      py = mouseRef.current.y * 0.08
    }
    // Barely-perceptible float once settled
    const float = p.initialized ? Math.sin(state.clock.elapsedTime * 0.16) * 0.02 : 0

    // Module-departure transition: short push into the network before routing
    departRef.current = THREE.MathUtils.damp(departRef.current, departing ? 1 : 0, 5, delta)
    const depart = departRef.current

    const cx = THREE.MathUtils.lerp(startPos.x, endPos.x, camT) + px
    const cy = THREE.MathUtils.lerp(startPos.y, endPos.y, camT) + py + float - depart * 0.18
    const cz = THREE.MathUtils.lerp(startPos.z, endPos.z, camT) - depart * 0.9
    camera.position.x = THREE.MathUtils.damp(camera.position.x, cx, 4, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, cy, 4, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cz, 4, delta)
    camera.lookAt(
      THREE.MathUtils.lerp(startLook.x, endLook.x, camT) + px * 0.3,
      THREE.MathUtils.lerp(startLook.y, endLook.y, camT) + py * 0.2,
      THREE.MathUtils.lerp(startLook.z, endLook.z, camT)
    )

    // Screen anchor for the substation status label, so the status always reads
    // as belonging to the substation itself
    if (p.initialized) {
      projTmp.set(
        layout.transformerPos.x,
        layout.transformerPos.y + 0.36 * layout.transformerScale,
        layout.transformerPos.z
      )
      projTmp.project(camera)
      substationRef.current = { x: (projTmp.x + 1) / 2, y: (1 - projTmp.y) / 2 }
    } else {
      substationRef.current = null
    }
  })

  return (
    <>
      <TowerInstances layout={layout} progressRef={progressRef} activeModule={activeModule} />
      <TransmissionLines layout={layout} progressRef={progressRef} activeModule={activeModule} />
      <Transformer layout={layout} progressRef={progressRef} activeModule={activeModule} />
      <EnergyFlow
        layout={layout}
        progressRef={progressRef}
        activeModule={activeModule}
        viewport={viewport}
      />
      <NetworkScanner layout={layout} progressRef={progressRef} />

      {/* Ground plane keeps the corridor visually anchored */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#0a1626" metalness={0.15} roughness={0.9} transparent opacity={0.55} />
      </mesh>
    </>
  )
}

export default function NetworkScene(props: NetworkSceneProps) {
  const dprMax = props.viewport === 'mobile' ? 1.2 : props.viewport === 'tablet' ? 1.45 : 1.65

  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, dprMax]}
      gl={{
        antialias: props.viewport !== 'mobile',
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      camera={{ position: [-3.1, 0.95, 4.7], fov: 42, near: 0.1, far: 60 }}
      style={{ background: 'transparent' }}
    >
      <fog attach="fog" args={['#07111D', 9, 21]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 7, 4]} intensity={1.1} color="#e2e8f0" />
      {/* Cyan rim light from behind the corridor */}
      <directionalLight position={[-4, 3, -3]} intensity={0.65} color="#67e8f9" />
      <pointLight position={[2.5, 2.5, -1.5]} intensity={0.55} color="#22d3ee" distance={10} decay={2} />

      <Suspense fallback={null}>
        <NetworkContent {...props} />
      </Suspense>
    </Canvas>
  )
}
