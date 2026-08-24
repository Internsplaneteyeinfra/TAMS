/** 512 KB day map — used instead of the 2.5 MB hi-res so the globe paints immediately. */
export const EARTH_DAY_URL = '/earth/earth_day.jpg'

let warmed = false

export function preloadEarthDayTexture() {
  if (warmed || typeof window === 'undefined') return
  warmed = true
  const img = new Image()
  img.decoding = 'async'
  img.src = EARTH_DAY_URL
}
