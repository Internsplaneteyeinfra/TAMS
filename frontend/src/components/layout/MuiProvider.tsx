import React from 'react'
import { CacheProvider } from '@emotion/react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'

import createEmotionCache from '@/lib/createEmotionCache'
import { tamsTheme } from '@/theme/tamsTheme'

const clientCache = createEmotionCache()

export default function MuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <CacheProvider value={clientCache}>
      <ThemeProvider theme={tamsTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  )
}
