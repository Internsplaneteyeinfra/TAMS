export interface ModuleNavItem {
  href: string
  label: string
  shortLabel: string
}

/** Enterprise module routes — shared by GIS sidebars and MUI AppLayout. */
export const MODULE_NAV_ITEMS: ModuleNavItem[] = [
  { href: '/analyzer', label: 'GIS Command Center', shortLabel: 'Map' },
  { href: '/dashboard', label: 'Operations Dashboard', shortLabel: 'Ops' },
  { href: '/assets', label: 'Asset Registry', shortLabel: 'Assets' },
  { href: '/alarms', label: 'Alarm Center', shortLabel: 'Alarms' },
  { href: '/health', label: 'Condition Monitoring', shortLabel: 'Health' },
  { href: '/maintenance', label: 'Maintenance Center', shortLabel: 'Maint' },
  { href: '/inspections', label: 'Inspection Portal', shortLabel: 'Inspect' },
  { href: '/analytics', label: 'Analytics', shortLabel: 'Analytics' },
  { href: '/monitoring', label: 'Satellite Monitoring', shortLabel: 'Satellite' },
]
