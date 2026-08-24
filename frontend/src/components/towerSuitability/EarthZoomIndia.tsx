/**
 * Draw-KML intro: Earth keeps rotating until the user hits Go to lat/lon,
 * then flies to those coordinates and hands off to the map.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'

function geoToSphere(lat: number, lon: number, radius: number) {
  const u = (lon + 180) / 360
  const phi = u * Math.PI * 2
  const theta = THREE.MathUtils.degToRad(90 - lat)
  const st = Math.sin(theta)
  return new THREE.Vector3(-Math.cos(phi) * st * radius, Math.cos(theta) * radius, Math.sin(phi) * st * radius)
}

function facingRotations(lat: number, lon: number) {
  const p = geoToSphere(lat, lon, 1).normalize()
  const rotY = Math.atan2(p.x, p.z)
  const q = p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
  const rotX = Math.atan2(-q.y, q.z)
  return { rotX, rotY }
}

export default function EarthZoomIndia({
  flyTo,
  onComplete,
}: {
  flyTo: { lat: number; lon: number } | null
  onComplete: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const flyToRef = useRef(flyTo)
  flyToRef.current = flyTo
  const doneRef = useRef(false)
  const [fading, setFading] = useState(false)
  const [status, setStatus] = useState('Earth rotating…')

  const finish = (immediate = false) => {
    if (doneRef.current) return
    doneRef.current = true
    if (immediate) {
      onCompleteRef.current()
      return
    }
    setFading(true)
    window.setTimeout(() => onCompleteRef.current(), 450)
  }

  useEffect(() => {
    if (flyTo) setStatus(`Flying to ${flyTo.lat.toFixed(4)}, ${flyTo.lon.toFixed(4)}`)
  }, [flyTo])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let cancelled = false
    let raf = 0
    let renderer: THREE.WebGLRenderer | null = null

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      return undefined
    }

    const w = Math.max(8, host.clientWidth || window.innerWidth)
    const h = Math.max(8, host.clientHeight || window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setSize(w, h, false)
    renderer.setClearColor(0x071018, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.05, 40)
    const camZIdle = 2.35
    const camZClose = 1.58
    camera.position.set(0, 0.12, camZIdle)
    camera.lookAt(0, 0, 0)
    scene.add(new THREE.AmbientLight(0xffffff, 1))

    const earthGroup = new THREE.Group()
    earthGroup.rotation.x = 0.18
    scene.add(earthGroup)

    const globeMat = new THREE.MeshBasicMaterial({ color: 0x1d6a9a })
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), globeMat)
    earthGroup.add(globe)

    const loader = new THREE.TextureLoader()
    const applyMap = (url: string) => {
      loader.load(url, (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        globeMat.map = tex
        globeMat.color.set(0xffffff)
        globeMat.needsUpdate = true
      })
    }
    applyMap('/earth/earth_day_hi.jpg')
    window.setTimeout(() => {
      if (!cancelled && !globeMat.map) applyMap('/earth/earth_day.jpg')
    }, 800)

    let phase: 'spin' | 'fly' | 'hold' = 'spin'
    let flyT0 = 0
    let fromY = 0
    let fromX = 0
    let fromZ = camZIdle
    let toY = 0
    let toX = 0
    const FLY_MS = 2200
    const HOLD_MS = 500

    const tick = (now: number) => {
      if (cancelled || !renderer) return

      if (phase === 'spin') {
        earthGroup.rotation.y += 0.0022
        const target = flyToRef.current
        if (target) {
          const face = facingRotations(target.lat, target.lon)
          fromY = earthGroup.rotation.y
          fromX = earthGroup.rotation.x
          fromZ = camera.position.z
          // unwind so we take the short path
          let dy = face.rotY - fromY
          while (dy > Math.PI) dy -= Math.PI * 2
          while (dy < -Math.PI) dy += Math.PI * 2
          toY = fromY + dy
          toX = face.rotX
          flyT0 = now
          phase = 'fly'
        }
      } else if (phase === 'fly') {
        const u = Math.min(1, (now - flyT0) / FLY_MS)
        const e = 1 - Math.pow(1 - u, 3)
        earthGroup.rotation.y = THREE.MathUtils.lerp(fromY, toY, e)
        earthGroup.rotation.x = THREE.MathUtils.lerp(fromX, toX, e)
        camera.position.z = THREE.MathUtils.lerp(fromZ, camZClose, e)
        camera.lookAt(0, 0, 0)
        if (u >= 1) {
          phase = 'hold'
          flyT0 = now
        }
      } else {
        if (now - flyT0 > HOLD_MS) {
          finish()
          return
        }
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)

    const onResize = () => {
      if (!renderer) return
      const nw = Math.max(8, host.clientWidth || window.innerWidth)
      const nh = Math.max(8, host.clientHeight || window.innerHeight)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh, false)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      globe.geometry.dispose()
      globeMat.map?.dispose()
      globeMat.dispose()
      renderer?.dispose()
      if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 bg-[#071018]"
      style={{
        zIndex: 4000,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.45s ease',
        pointerEvents: fading ? 'none' : 'none',
      }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-6 top-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/70">Satellite Earth</p>
        <p className="mt-1 text-lg font-semibold text-white">{status}</p>
        <p className="mt-1 text-[11px] text-white/55">Keeps rotating until you press Go to lat/lon</p>
      </div>
    </div>
  )
}
