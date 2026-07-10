import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Layers,
  Satellite,
  Settings,
} from 'lucide-react'

export interface SidebarNavChild {
  label: string
  href: string
  assetType?: 'tower' | 'line' | 'substation'
}

export interface SidebarNavItem {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  children?: SidebarNavChild[]
}

/** Nested sidebar navigation — additive menu structure for GIS Command Center. */
export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    id: 'operations',
    label: 'Operations',
    icon: Activity,
    children: [
      { label: 'Live Grid', href: '/' },
      { label: 'AI Monitoring', href: '/monitoring' },
      { label: 'Alerts', href: '/alarms' },
      { label: 'Maintenance', href: '/maintenance' },
      { label: 'Work Orders', href: '/maintenance' },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    icon: Layers,
    children: [
      { label: 'Substations', href: '/', assetType: 'substation' },
      { label: 'Towers', href: '/', assetType: 'tower' },
      { label: 'Lines', href: '/', assetType: 'line' },
    ],
  },
  { id: 'satellite', label: 'Satellite', href: '/monitoring', icon: Satellite },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', href: '/analytics', icon: FileText },
  { id: 'settings', label: 'Settings', href: '/dashboard', icon: Settings },
]
