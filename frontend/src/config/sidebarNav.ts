import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Layers,
  RadioTower,
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
  { id: 'dashboard', label: 'Dashboard', href: '/analyzer', icon: LayoutDashboard },
  {
    id: 'operations',
    label: 'Operations',
    icon: Activity,
    children: [
      { label: 'Live Grid', href: '/analyzer' },
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
      { label: 'Substations', href: '/analyzer', assetType: 'substation' },
      { label: 'Towers', href: '/analyzer', assetType: 'tower' },
      { label: 'Lines', href: '/analyzer', assetType: 'line' },
      { label: 'Tower Types 3D', href: '/tower-types' },
    ],
  },
  { id: 'tower-types', label: 'Tower Types 3D', href: '/tower-types', icon: RadioTower },
  { id: 'satellite', label: 'Satellite', href: '/monitoring', icon: Satellite },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', href: '/analytics', icon: FileText },
  { id: 'geotech', label: 'Geotech', href: '/geotech', icon: Layers },
  // Settings route TBD — keep Analyzer map; Ops KPIs are /dashboard via landing only
  { id: 'settings', label: 'Settings', href: '/analyzer', icon: Settings },
]

/** Analyzer GIS only — Tower Performance / ops routes stay on /dashboard. */
export const ANALYZER_SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Map', href: '/analyzer', icon: LayoutDashboard },
  {
    id: 'assets',
    label: 'Assets',
    icon: Layers,
    children: [
      { label: 'Substations', href: '/analyzer', assetType: 'substation' },
      { label: 'Towers', href: '/analyzer', assetType: 'tower' },
      { label: 'Lines', href: '/analyzer', assetType: 'line' },
      { label: 'Tower Types 3D', href: '/tower-types' },
    ],
  },
  { id: 'tower-types', label: 'Tower Types 3D', href: '/tower-types', icon: RadioTower },
]
