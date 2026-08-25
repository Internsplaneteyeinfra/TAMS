import React, { useMemo } from 'react'
import { CacheProvider } from '@emotion/react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'

import createEmotionCache from '@/lib/createEmotionCache'
import { createTamsMuiTheme } from '@/theme/tamsTheme'
import { useTamsAppearance } from '@/theme/useTamsAppearance'

const clientCache = createEmotionCache()

export default function MuiProvider({ children }: { children: React.ReactNode }) {
  const { appearance } = useTamsAppearance()
  const theme = useMemo(() => createTamsMuiTheme(appearance), [appearance])

  return (
    <CacheProvider value={clientCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  )
}