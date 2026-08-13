/**
 * TAMS entry landing — pick Tower Suitability, Analyzer, or Performance.
 */

import React, { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Activity, ArrowLeft, MapPinned, RadioTower, X } from 'lucide-react'

const MODULES = [
  {
    id: 'suitability',
    title: 'Tower Suitability',
    subtitle: 'Upload KML · score site fit',
    href: '/tower-suitability',
    icon: MapPinned,
    accent: 'from-cyan-500/20 to-blue-600/10 border-cyan-400/40 hover:border-cyan-300',
    iconClass: 'text-cyan-300',
  },
  {
    id: 'analyzer',
    title: 'Tower Analyzer',
    subtitle: 'TAMS Grid Command',
    href: '/analyzer',
    icon: RadioTower,
    accent: 'from-emerald-500/20 to-teal-600/10 border-emerald-400/40 hover:border-emerald-300',
    iconClass: 'text-emerald-300',
  },
  {
    id: 'performance',
    title: 'Tower Performance',
    subtitle: 'Coming soon',
    href: null as string | null,
    icon: Activity,
    accent: 'from-amber-500/20 to-orange-600/10 border-amber-400/40 hover:border-amber-300',
    iconClass: 'text-amber-300',
  },
] as const

export default function LandingPage() {
  const router = useRouter()
  const [performanceOpen, setPerformanceOpen] = useState(false)

  return (
    <>
      <Head>
        <title>TAMS · Choose module</title>
      </Head>
      <div className="min-h-full flex flex-col bg-[#060B17] text-slate-200 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,211,238,0.12), transparent), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(16,185,129,0.08), transparent)',
          }}
        />

        <header className="relative z-10 shrink-0 h-14 flex items-center px-6 border-b border-white/5">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">PlanetEye · TAMS</p>
            <h1 className="text-sm font-black tracking-widest text-white">Transmission Asset Intelligence</h1>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 mb-3">Select a module</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-10 tracking-tight">
            Where do you want to work?
          </h2>

          <div className="grid w-full max-w-4xl grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {MODULES.map((mod) => {
              const Icon = mod.icon
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    if (mod.href) void router.push(mod.href)
                    else setPerformanceOpen(true)
                  }}
                  className={`group flex flex-col items-center text-center rounded-2xl border bg-gradient-to-b ${mod.accent} bg-[#0e172a]/80 px-5 py-8 shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60`}
                >
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70">
                    <Icon className={`h-7 w-7 ${mod.iconClass}`} />
                  </span>
                  <span className="text-lg font-black text-white tracking-tight">{mod.title}</span>
                  <span className="mt-1.5 text-xs font-semibold text-slate-400">{mod.subtitle}</span>
                </button>
              )
            })}
          </div>
        </main>

        {performanceOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="performance-soon-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-[#0e172a] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">Tower Performance</p>
                  <h3 id="performance-soon-title" className="mt-1 text-xl font-black text-white">
                    Coming soon
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPerformanceOpen(false)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Performance analytics for towers is under development. Check back later for KPIs, trends, and health
                insights.
              </p>
              <button
                type="button"
                onClick={() => setPerformanceOpen(false)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 h-11 rounded-xl border border-amber-400/50 bg-amber-500/15 text-sm font-bold text-amber-100 hover:bg-amber-500/25 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to modules
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
