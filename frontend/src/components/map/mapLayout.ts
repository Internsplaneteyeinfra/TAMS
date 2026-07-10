/** Shared map overlay layout constants */

export const MAP_EDGE = '0.75rem'

export const MAP_CHROME_TOP = '0.75rem'

/** Below search row + breadcrumb row */

export const MAP_INTEL_TOP = '5.25rem'

export const MAP_INTEL_WIDTH = '13.75rem'

export const MAP_INTEL_COLLAPSED_WIDTH = '2.75rem'

export const MAP_BOTTOM_INSET = '2.75rem'

/** Bottom offset for overlays panel (above status bar) */
export const MAP_OVERLAYS_BOTTOM = '3.25rem'

/** Gap between left panels */
export const MAP_PANEL_GAP = '0.5rem'

export function mapOverlaysLeft(intelCollapsed: boolean) {
  return `calc(${MAP_EDGE} + ${mapLeftInset(intelCollapsed)} + ${MAP_PANEL_GAP})`
}

export const MAP_RIGHT_RAIL_WIDTH = '7.25rem'

export const MAP_RIGHT_RAIL_COLLAPSED_WIDTH = '2.75rem'



export function mapRightInset(railCollapsed: boolean) {

  return railCollapsed ? MAP_RIGHT_RAIL_COLLAPSED_WIDTH : MAP_RIGHT_RAIL_WIDTH

}



export function mapLeftInset(intelCollapsed: boolean) {

  return intelCollapsed ? MAP_INTEL_COLLAPSED_WIDTH : MAP_INTEL_WIDTH

}


