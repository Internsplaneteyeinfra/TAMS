'use client'

/**
 * Lightweight login background — tower4.jpg as a subtle 3D parallax plane.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const TOWER4_URL = '/login-tower4.jpg'

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])
  return reduced
}

/** Soft vignette + night grade so the login form stays readable. */
function OverlayGrade() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `
          linear-gradient(90deg, rgba(4,10,22,0.55) 0%, rgba(4,10,22,0.18) 42%, rgba(4,10,22,0.08) 70%, rgba(4,10,22,0.28) 100%),
          linear-gradient(180deg, rgba(4,10,22,0.25) 0%, transparent 28%, transparent 72%, rgba(4,10,22,0.45) 100%),
          radial-gradient(ellipse 55% 50% at 72% 48%, rgba(34, 180, 220, 0.12), transparent 60%)
        `,
      }}
    />
  )
}

function Tower4Plane({ reducedMotion }) {
  const tex = useLoader(THREE.TextureLoader, TOWER4_URL)
  const group = useRef(null)
  const { viewport } = useThree()

  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
  }, [tex])

  // Cover viewport with a slight overscan so edges never show during drift
  const aspect = tex.image?.width && tex.image?.height ? tex.image.width / tex.image.height : 16 / 9
  const planeH = Math.max(viewport.height * 1.18, viewport.width / aspect)
  const planeW = planeH * aspect

  useFrame((state) => {
    if (!group.current || reducedMotion) return
    const t = state.clock.elapsedTime
    // Very light “3D” drift — almost imperceptible
    group.current.rotation.y = Math.sin(t * 0.08) * 0.045
    group.current.rotation.x = Math.sin(t * 0.06) * 0.02 - 0.04
    group.current.position.z = -0.15 + Math.sin(t * 0.05) * 0.08
  })

  return (
    <group ref={group} position={[0.35, 0.05, 0]}>
      {/* Soft back plate for depth */}
      <mesh position={[0, 0, -0.35]} scale={[1.04, 1.04, 1]}>
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial color="#06101f" toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Thin emissive rim suggesting energy depth */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[planeW * 0.995, planeH * 0.995]} />
        <meshBasicMaterial
          color="#1aa6c8"
          transparent
          opacity={0.045}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function CameraRig({ reducedMotion }) {
  useFrame((state) => {
    if (reducedMotion) return
    const t = state.clock.elapsedTime
    const cam = state.camera
    cam.position.x = Math.sin(t * 0.04) * 0.12
    cam.position.y = Math.cos(t * 0.035) * 0.06
    cam.position.z = 2.85 + Math.sin(t * 0.03) * 0.05
    cam.lookAt(0.2, 0, 0)
  })
  return null
}

function Scene({ reducedMotion }) {
  return (
    <>
      <color attach="background" args={['#050d17']} />
      <ambientLight intensity={1} />
      <CameraRig reducedMotion={reducedMotion} />
      <React.Suspense fallback={null}>
        <Tower4Plane reducedMotion={reducedMotion} />
      </React.Suspense>
    </>
  )
}

export default function LoginTowerBackground() {
  const reducedMotion = useReducedMotion()

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#050d17',
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 2.85], fov: 42, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <Scene reducedMotion={reducedMotion} />
      </Canvas>
      <OverlayGrade />
    </div>
  )
}
