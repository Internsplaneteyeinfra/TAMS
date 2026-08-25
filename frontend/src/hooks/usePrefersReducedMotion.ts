import { useEffect, useState } from 'react'

/** True when the user prefers reduced motion (or SSR / unavailable). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      const sync = () => setReduced(Boolean(mq.matches))
      sync()
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', sync)
        return () => mq.removeEventListener('change', sync)
      }
      mq.addListener(sync)
      return () => mq.removeListener(sync)
    } catch {
      setReduced(false)
    }
  }, [])

  return reduced
}
