/** OSRM driving route between two points — for road-distance screening on the map. */

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms)
    promise
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch(() => {
        clearTimeout(t)
        resolve(fallback)
      })
  })
}

export type DrivingRoute = {
  km: number
  /** [lat, lon] pairs along the driving route */
  coordinates: Array<[number, number]>
}

/** Snap to nearest drivable road (OSRM nearest). */
export async function fetchNearestRoad(
  lat: number,
  lon: number
): Promise<{ km: number; lat: number; lon: number } | null> {
  const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}?number=1`
  const json = await withTimeout(
    (async () => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json() as Promise<{
        waypoints?: { distance?: number; location?: [number, number] }[]
      }>
    })(),
    7000,
    null
  )
  const wp = json?.waypoints?.[0]
  if (!wp?.location) return null
  const roadLat = wp.location[1]
  const roadLon = wp.location[0]
  const km =
    wp.distance != null && Number.isFinite(wp.distance) ? wp.distance / 1000 : null
  if (km == null || !Number.isFinite(km)) return null
  return { km, lat: roadLat, lon: roadLon }
}

/** Fetch a driving route polyline + distance via public OSRM. */
export async function fetchDrivingRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): Promise<DrivingRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
  const json = await withTimeout(
    (async () => {
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json() as Promise<{
        routes?: { distance?: number; geometry?: { coordinates?: [number, number][] } }[]
      }>
    })(),
    9000,
    null
  )
  const route = json?.routes?.[0]
  const coords = route?.geometry?.coordinates
  if (!coords?.length) return null
  const km =
    route?.distance != null && Number.isFinite(route.distance)
      ? route.distance / 1000
      : null
  if (km == null) return null
  return {
    km,
    coordinates: coords.map(([lon, lat]) => [lat, lon] as [number, number]),
  }
}
