import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export default function IntelligenceDrawer({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      className="ts-glass ts-drawer-in pointer-events-auto flex flex-col overflow-hidden"
      style={{
        width: 'min(390px, calc(100vw - 120px))',
        maxHeight: 'calc(100vh - 7.5rem)',
      }}
      role="dialog"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[rgba(51,65,85,0.16)] shrink-0">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-[#263238]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#66727a] hover:bg-[#d9ded4] hover:text-[#263238]"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">{children}</div>
    </aside>
  )
}
