import { useCallback, useEffect, useState } from 'react'
import {
  persistLandingAppearance,
  readLandingAppearance,
  type LandingAppearance,
} from '@/theme/landingTheme'

/** Follows landing `tams-theme` so ops pages match dark / light. */
export function useTamsAppearance() {
  const [appearance, setAppearance] = useState<LandingAppearance>('dark')

  useEffect(() => {
    setAppearance(readLandingAppearance())
    const sync = () => {
      const next = readLandingAppearance()
      setAppearance(next)
      document.documentElement.dataset.tamsTheme = next
    }
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('tams-theme-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('tams-theme-change', sync)
    }
  }, [])

  const setTheme = useCallback((next: LandingAppearance) => {
    persistLandingAppearance(next)
    document.documentElement.dataset.tamsTheme = next
    setAppearance(next)
  }, [])

  return { appearance, setTheme }
}