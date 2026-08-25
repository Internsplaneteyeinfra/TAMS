import { createTheme } from '@mui/material/styles'
import type { LandingAppearance } from '@/theme/landingTheme'

export function createTamsMuiTheme(appearance: LandingAppearance) {
  const light = appearance === 'light'

  return createTheme({
    palette: {
      mode: light ? 'light' : 'dark',
      primary: {
        main: light ? '#0891B2' : '#22d3ee',
        dark: light ? '#0e7490' : '#155e75',
        contrastText: light ? '#ffffff' : '#07111D',
      },
      secondary: {
        main: light ? '#D97706' : '#fcd34d',
      },
      background: {
        default: light ? '#F3F7FA' : '#07111D',
        paper: light ? '#FFFFFF' : '#0c1a28',
      },
      text: {
        primary: light ? '#0B1726' : '#F4F7FA',
        secondary: light ? '#526579' : '#94a3b8',
      },
      divider: light ? '#C9D6DF' : 'rgba(143, 179, 201, 0.14)',
      error: { main: light ? '#dc2626' : '#f87171' },
      warning: { main: light ? '#D97706' : '#fbbf24' },
      success: { main: light ? '#059669' : '#34d399' },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700 },
      h2: { fontWeight: 600 },
      h3: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: light ? '#F3F7FA' : '#07111D',
            color: light ? '#0B1726' : '#F4F7FA',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: light ? 'rgba(255,255,255,0.92)' : '#081522',
            color: light ? '#0B1726' : '#F4F7FA',
            borderBottom: light ? '1px solid #D7E1E7' : '1px solid rgba(143,179,201,0.12)',
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: light ? '#F7FAFC' : '#081522',
            color: light ? '#0B1726' : '#F4F7FA',
            borderRight: light ? '1px solid #D7E1E7' : '1px solid rgba(143,179,201,0.12)',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 8px',
            '&.Mui-selected': {
              backgroundColor: light ? '#FFF1D6' : 'rgba(252, 211, 77, 0.14)',
              color: light ? '#D97706' : '#fcd34d',
              '&:hover': {
                backgroundColor: light ? '#FFE8C2' : 'rgba(252, 211, 77, 0.2)',
              },
              '& .MuiListItemIcon-root': {
                color: light ? '#D97706' : '#fcd34d',
              },
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            color: light ? '#526579' : '#94a3b8',
            minWidth: 40,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: light ? '#FFFFFF' : '#0c1a28',
            border: light ? '1px solid #CBD8E2' : '1px solid rgba(143,179,201,0.14)',
            boxShadow: light ? '0 12px 32px rgba(30,60,80,0.08)' : '0 18px 40px -18px rgba(3,10,20,0.85)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            color: light ? '#526579' : '#94a3b8',
            fontWeight: 700,
            borderBottomColor: light ? '#C9D6DF' : 'rgba(143,179,201,0.14)',
          },
          body: {
            color: light ? '#0B1726' : '#F4F7FA',
            borderBottomColor: light ? '#E7EFF4' : 'rgba(143,179,201,0.1)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          text: {
            fontWeight: 800,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 700,
          },
        },
      },
    },
  })
}

export const tamsTheme = createTamsMuiTheme('light')

export const severityColor = (severity: string) => {
  const s = severity.toLowerCase()
  if (s === 'critical') return '#D32F2F'
  if (s === 'high') return '#F57C00'
  if (s === 'medium') return '#FBC02D'
  return '#1976D2'
}