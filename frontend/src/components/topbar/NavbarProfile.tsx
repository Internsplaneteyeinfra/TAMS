import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Settings, User } from 'lucide-react'

import LogoutButton from '@/components/auth/LogoutButton'

type MenuView = 'root' | 'profile' | 'settings'

export default function NavbarProfile() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<MenuView>('root')
  const [coords, setCoords] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateCoords = () => {
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
  }

  useLayoutEffect(() => {
    if (!isOpen) return
    updateCoords()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onWin = () => updateCoords()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
      setView('root')
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const toggleMenu = () => {
    setIsOpen((open) => {
      if (open) setView('root')
      return !open
    })
  }

  const toggleView = (next: MenuView) => {
    setView((current) => (current === next ? 'root' : next))
  }

  const menu =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[6010] w-56 tams-az-portal bg-[#0e172a]/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
            style={{ top: coords.top, right: coords.right }}
          >
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-[11px] font-bold text-white">Admin</p>
                <p className="text-[9px] text-slate-500">TAMS Operator</p>
              </div>

              {view === 'root' && (
                <ul className="py-1">
                  <li>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-800/80 transition-colors"
                      onClick={() => toggleView('profile')}
                    >
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      Profile
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-800/80 transition-colors"
                      onClick={() => toggleView('settings')}
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      Settings
                    </button>
                  </li>
                  <li>
                    <LogoutButton variant="menu" />
                  </li>
                </ul>
              )}

              {view === 'profile' && (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Profile</p>
                  <p className="text-[11px] text-slate-200">Signed in as Admin</p>
                  <p className="text-[10px] text-slate-400">Role: TAMS Operator</p>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300"
                    onClick={() => setView('root')}
                  >
                    Back
                  </button>
                </div>
              )}

              {view === 'settings' && (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Settings</p>
                  <p className="text-[10px] leading-snug text-slate-400">
                    Use the sun and moon buttons in the header to switch light and dark theme.
                  </p>
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300"
                    onClick={() => setView('root')}
                  >
                    Back
                  </button>
                </div>
              )}
            </div>,
          document.body
        )
      : null

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-lg border border-white/10 bg-slate-950/60 hover:border-slate-600 transition-colors"
        aria-label="User profile menu"
        aria-expanded={isOpen}
        title="Profile"
      >
        <span className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-[10px] font-black text-white">
          AD
        </span>
        <span className="hidden sm:block text-[10px] font-bold text-slate-300">Admin</span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  )
}
