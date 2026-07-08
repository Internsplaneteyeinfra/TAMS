import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Badge,
  Chip,
} from '@mui/material'
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

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  alarmCount?: number
}

export default function AppLayout({ children, title, alarmCount = 0 }: AppLayoutProps) {
  const [open, setOpen] = useState(true)
  const router = useRouter()

  return (
    <MuiProvider>
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'primary.dark' }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(!open)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            TAMS — Transmission Asset Monitoring
          </Typography>
          {title && (
            <Chip label={title} size="small" sx={{ mr: 2, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
          )}
          <Link href="/alarms" style={{ color: 'inherit', display: 'flex' }}>
            <Badge badgeContent={alarmCount} color="error">
              <NotificationsActiveIcon />
            </Badge>
          </Link>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: 64,
            height: 'calc(100% - 64px)',
          },
        }}
      >
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={router.pathname === item.href}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '64px',
          ml: open ? 0 : 0,
          p: 3,
          width: open ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
        }}
      >
        {children}
      </Box>
    </Box>
    </MuiProvider>
  )
}
