import React from 'react'

import { KpiStripSkeleton, MapSkeleton, PanelSkeleton, SidebarListSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#060B17] overflow-hidden">
      <header className="shrink-0 bg-[#0e172a] border-b border-white/10">
        <div className="h-10 flex items-center gap-3 px-4 border-b border-white/5">
          <div className="space-y-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2 w-20" />
          </div>
          <Skeleton className="h-8 flex-1 max-w-md rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <div className="px-4 py-2">
          <KpiStripSkeleton />
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-[17rem] border-r border-slate-800 shrink-0 hidden sm:block">
          <SidebarListSkeleton rows={6} />
        </div>
        <div className="flex-1 relative">
          <MapSkeleton />
        </div>
        <div className="w-80 border-l border-slate-800 shrink-0 hidden md:block">
          <PanelSkeleton />
        </div>
      </div>

      <footer className="h-8 border-t border-white/10 bg-[#0a1020]/90 flex items-center px-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </footer>
    </div>
  )
}
