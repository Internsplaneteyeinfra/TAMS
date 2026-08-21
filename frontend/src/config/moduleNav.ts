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
  { href: '/geotech', label: 'Geotech Investigations', shortLabel: 'Geotech' },
  { href: '/analytics', label: 'Analytics', shortLabel: 'Analytics' },
  { href: '/monitoring', label: 'Satellite Monitoring', shortLabel: 'Satellite' },
]

/**
 * Analyzer top-bar strip — map workspace only (no Operations Dashboard).
 * Tower Performance /dashboard is reached from the landing card, not Analyzer.
 */
export const ANALYZER_STRIP_NAV_ITEMS: ModuleNavItem[] = MODULE_NAV_ITEMS.filter(
  (item) => item.href !== '/dashboard'
)
