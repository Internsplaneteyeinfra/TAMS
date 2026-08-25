import React from 'react'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'

export const SIDEBAR_WIDTH_EXPANDED = '17rem'
export const SIDEBAR_WIDTH_COLLAPSED = '3rem'

interface CollapsibleSidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  children: React.ReactNode
  collapsedRail?: React.ReactNode
}

export default function CollapsibleSidebar({
  isCollapsed,
  onToggle,
  children,
  collapsedRail,
}: CollapsibleSidebarProps) {
  return (
    <div
      className="relative shrink-0 h-full overflow-hidden tams-sidebar-ease"
      style={{ width: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
    >
      <div
        className={`absolute inset-y-0 left-0 flex flex-col bg-[#070b14] border-r border-slate-800/90 tams-sidebar-ease ${isCollapsed ? '-translate-x-full' : 'translate-x-0'
          }`}
        style={{ width: SIDEBAR_WIDTH_EXPANDED }}
      >
        {children}
      </div>

      {isCollapsed && collapsedRail && (
        <div
          className="absolute inset-0 flex flex-col bg-[#070b14] border-r border-slate-800/90 tams-panel-in"
          style={{ width: SIDEBAR_WIDTH_COLLAPSED }}
        >
          {collapsedRail}
        </div>
      )}

      <button
        type="button"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggle}
        className={`absolute top-1/2 z-30 w-5 h-8 flex items-center justify-center bg-[#070b14] border border-slate-700/80 rounded-r-md text-slate-400 hover:text-slate-100 hover:border-slate-500 shadow-md tams-sidebar-ease -translate-y-1/2 -translate-x-px`}
        style={{ left: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  )
}

export function SidebarCollapseHeader({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="w-9 h-9 mx-auto mt-2 flex items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
    >
      <Menu className="w-4 h-4" />
    </button>
  )
}
