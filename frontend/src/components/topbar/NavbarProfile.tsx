import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, LogOut, Settings, User } from 'lucide-react'

export default function NavbarProfile() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-lg border border-white/10 bg-slate-950/60 hover:border-slate-600 transition-colors"
        aria-label="User profile menu"
        title="Profile"
      >
        <span className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-[10px] font-black text-white">
          OP
        </span>
        <span className="hidden sm:block text-[10px] font-bold text-slate-300">Operator</span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-48 z-50 bg-[#0e172a]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-[11px] font-bold text-white">Grid Operator</p>
            <p className="text-[9px] text-slate-500">operations@tams.grid</p>
          </div>
          <ul className="py-1">
            <li>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-800/80 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <User className="w-3.5 h-3.5 text-slate-500" />
                Profile
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-800/80 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                Settings
              </button>
            </li>
            <li>
              <Link
                href="/"
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-rose-200 hover:bg-slate-800/80 transition-colors"
                onClick={() => setIsOpen(false)}
                title="Back to module selection"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                Logout
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
