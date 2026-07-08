import { createTheme } from '@mui/material/styles'

export const tamsTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1565C0', dark: '#0D47A1' },
    secondary: { main: '#00838F' },
    background: { default: '#F5F7FA', paper: '#FFFFFF' },
    error: { main: '#D32F2F' },
    warning: { main: '#F57C00' },
    success: { main: '#2E7D32' },
    text: { primary: '#1A2332', secondary: '#64748B' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
      },
    },
  },
})

export const severityColor = (severity: string) => {
  const s = severity.toLowerCase()
  if (s === 'critical') return '#D32F2F'
  if (s === 'high') return '#F57C00'
  if (s === 'medium') return '#FBC02D'
  return '#1976D2'
}
