import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface CollapsiblePanelCardProps {
  title: string
  subtitle?: React.ReactNode
  headerAction?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

export default function CollapsiblePanelCard({
  title,
  subtitle,
  headerAction,
  defaultOpen = true,
  children,
  className = '',
}: CollapsiblePanelCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section
      className={`bg-slate-900/40 border border-slate-800/80 rounded-xl shadow-lg overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-slate-950/60 hover:bg-slate-900/80 transition-colors group"
        aria-expanded={isOpen}
      >
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
        <h2 className="flex-1 text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">
          {title}
        </h2>
        {subtitle && <div className="shrink-0">{subtitle}</div>}
        {headerAction && (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-slate-800/60">{children}</div>
      )}
    </section>
  )
}

