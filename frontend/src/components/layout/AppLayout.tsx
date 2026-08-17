import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { SxProps, Theme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import MapIcon from '@mui/icons-material/Map'
import InventoryIcon from '@mui/icons-material/Inventory'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import BuildIcon from '@mui/icons-material/Build'
import FavoriteIcon from '@mui/icons-material/Favorite'
import AssignmentIcon from '@mui/icons-material/Assignment'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt'
import {
  AppBar,
  Badge,
  Box,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@/components/mui'
import MuiProvider from '@/components/layout/MuiProvider'
import { MODULE_NAV_ITEMS } from '@/config/moduleNav'

const DRAWER_WIDTH = 260

const NAV_ICONS: Record<string, React.ReactNode> = {
  '/': <MapIcon />,
  '/dashboard': <DashboardIcon />,
  '/assets': <InventoryIcon />,
  '/alarms': <NotificationsActiveIcon />,
  '/health': <FavoriteIcon />,
  '/maintenance': <BuildIcon />,
  '/inspections': <AssignmentIcon />,
  '/analytics': <AnalyticsIcon />,
  '/monitoring': <SatelliteAltIcon />,
}

const NAV_ITEMS = MODULE_NAV_ITEMS.map((item) => ({
  ...item,
  icon: NAV_ICONS[item.href] ?? <DashboardIcon />,
}))

// Annotated up front: react-three-fiber's global JSX augmentation makes MUI's
// inferred `sx` union too large for the compiler to represent.
const rootSx: SxProps<Theme> = { display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }
const appBarSx: SxProps<Theme> = { zIndex: (t: Theme) => t.zIndex.drawer + 1, bgcolor: 'primary.dark' }
const menuButtonSx: SxProps<Theme> = { mr: 2 }
const titleSx: SxProps<Theme> = { flexGrow: 1, fontWeight: 700 }
const chipSx: SxProps<Theme> = { mr: 2, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }
const listSx: SxProps<Theme> = { pt: 1 }
const listIconSx: SxProps<Theme> = { minWidth: 40 }

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  alarmCount?: number
}

export default function AppLayout({ children, title, alarmCount = 0 }: AppLayoutProps) {
  const [open, setOpen] = useState(true)
  const router = useRouter()

  const drawerSx: SxProps<Theme> = {
    width: open ? DRAWER_WIDTH : 0,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: DRAWER_WIDTH,
      boxSizing: 'border-box',
      top: 64,
      height: 'calc(100% - 64px)',
    },
  }

  const mainSx: SxProps<Theme> = {
    flexGrow: 1,
    mt: '64px',
    p: 3,
    width: open ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
  }

  return (
    <MuiProvider>
    <Box sx={rootSx}>
      <AppBar position="fixed" sx={appBarSx}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(!open)} sx={menuButtonSx}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={titleSx}>
            TAMS — Transmission Asset Monitoring
          </Typography>
          {title && <Chip label={title} size="small" sx={chipSx} />}
          <Link href="/alarms" style={{ color: 'inherit', display: 'flex' }}>
            <Badge badgeContent={alarmCount} color="error">
              <NotificationsActiveIcon />
            </Badge>
          </Link>
        </Toolbar>
      </AppBar>

      <Drawer variant="persistent" open={open} sx={drawerSx}>
        <List sx={listSx}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={router.pathname === item.href}
            >
              <ListItemIcon sx={listIconSx}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={mainSx}>
        {children}
      </Box>
    </Box>
    </MuiProvider>
  )
}
