/** Shared map overlay layout constants */

export const MAP_EDGE = '0.75rem'

export const MAP_CHROME_TOP = '0.75rem'

/** Below search / breadcrumb row — MAP TOOLS sits here (right side only) */
export const MAP_TOOLS_TOP = '3.75rem'

/** Keep MAP TOOLS above status bar + AI assistant */
export const MAP_TOOLS_BOTTOM = '4.5rem'

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

/** Single tool column (w-11) + padding */
export const MAP_RIGHT_RAIL_WIDTH = '4.5rem'

export const MAP_RIGHT_RAIL_COLLAPSED_WIDTH = '2.75rem'



export function mapRightInset(railCollapsed: boolean) {
  return railCollapsed ? MAP_RIGHT_RAIL_COLLAPSED_WIDTH : MAP_RIGHT_RAIL_WIDTH
}

/** Clear space for MAP TOOLS rail on the right. Collapsed buttons sit next to LABELS. */
export function mapOverlayRight(railCollapsed: boolean) {
  if (railCollapsed) return MAP_EDGE
  return `calc(${MAP_EDGE} + ${MAP_RIGHT_RAIL_WIDTH} + ${MAP_PANEL_GAP})`
}

export function mapLeftInset(intelCollapsed: boolean) {
  return intelCollapsed ? MAP_INTEL_COLLAPSED_WIDTH : MAP_INTEL_WIDTH
}


