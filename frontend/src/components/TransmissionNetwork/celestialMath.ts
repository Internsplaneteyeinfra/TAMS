import * as THREE from 'three'

export const CELESTIAL_CENTER_U = 0.5

/** 3D position for settled sun/moon — high in the sky dome. */
export function settledCelestialWorldPos(blend: number, out = new THREE.Vector3()) {
  const dayLift = THREE.MathUtils.lerp(0.1, 0.52, blend)
  return out.set(0.4, 3.05 + dayLift, -54)
}

/** 3D position on the low horizon arc (theme transition travel). */
export function worldPosFromArcU(u: number, blend: number, out = new THREE.Vector3()) {
  const t = THREE.MathUtils.clamp(u, 0, 1)
  const az = THREE.MathUtils.lerp(-0.48, 0.48, t)
  const x = Math.sin(az) * 15
  const z = -50
  const arcLift = Math.sin(t * Math.PI) * 0.55
  const y = 0.55 + arcLift + THREE.MathUtils.lerp(0.04, 0.25, blend) * 0.3
  return out.set(x, y, z)
}

export function settledSunArcU(blend: number) {
  return blend > 0.02 ? CELESTIAL_CENTER_U : 0
}

export function settledMoonArcU(blend: number) {
  return blend < 0.98 ? CELESTIAL_CENTER_U : 1
}

export function sunDirectionFromArcU(u: number, blend: number, out = new THREE.Vector3()) {
  const pos = worldPosFromArcU(u, blend)
  return out.copy(pos).normalize()
}

export function settledSunDirection(blend: number, out = new THREE.Vector3()) {
  return settledCelestialWorldPos(blend, out).normalize()
}
