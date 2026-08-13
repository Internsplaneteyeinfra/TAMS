/**
 * Suitability entry hub — video background + Draw / Live / Upload.
 */

import React from 'react'
import { Crosshair, Map, Navigation, Upload } from 'lucide-react'

export type SuitabilityEntryMode = 'draw' | 'live' | 'upload'

export default function SuitabilityHub({
  onChoose,
  onBack,
}: {
  onChoose: (mode: SuitabilityEntryMode) => void
  onBack?: () => void
}) {
  return (
    <div className="fixed inset-0 z-[210] flex flex-col text-slate-100 overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster=""
      >
        <source src="/videos/planet-earth-city-lights.webm" type="video/webm" />
      </video>
      <div className="absolute inset-0 bg-[#060B17]/72" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 40%, rgba(34,211,238,0.12), transparent 70%)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 h-14">
        <div>
          <p className="text-[10px] font-black tracking-[0.22em] text-cyan-200/80 uppercase">
            Tower Site Suitability
          </p>
          <p className="text-sm font-black text-white tracking-wide">How do you want to start?</p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="h-9 px-3 rounded-lg border border-white/15 bg-black/35 text-xs font-bold text-slate-200 hover:bg-black/55"
          >
            Back
          </button>
        )}
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() => onChoose('draw')}
            className="group rounded-2xl border border-cyan-400/35 bg-slate-950/55 backdrop-blur-md px-5 py-8 text-left shadow-2xl hover:border-cyan-300 hover:-translate-y-0.5 transition-all"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10">
              <Map className="h-6 w-6 text-cyan-300" />
            </span>
            <h2 className="mt-5 text-xl font-black text-white">Draw KML on map</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Set a start with lat/lon or click the map, then draw a line or polygon. Save as KML or run
              analysis.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-cyan-300/90 flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5" />
              Lat/lon · click pin · draw
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('live')}
            className="group rounded-2xl border border-emerald-400/35 bg-slate-950/55 backdrop-blur-md px-5 py-8 text-left shadow-2xl hover:border-emerald-300 hover:-translate-y-0.5 transition-all"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10">
              <Navigation className="h-6 w-6 text-emerald-300" />
            </span>
            <h2 className="mt-5 text-xl font-black text-white">Live location</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Jump to your GPS position, draw line or polygon nearby, then download KML or continue to
              analysis.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
              Browser GPS · then draw
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('upload')}
            className="group rounded-2xl border border-amber-400/35 bg-slate-950/55 backdrop-blur-md px-5 py-8 text-left shadow-2xl hover:border-amber-300 hover:-translate-y-0.5 transition-all"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10">
              <Upload className="h-6 w-6 text-amber-300" />
            </span>
            <h2 className="mt-5 text-xl font-black text-white">Upload and get analysis</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Upload an existing KML and get the full suitability score, towers, voltage, and report.
            </p>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
              KML · instant screening
            </p>
          </button>
        </div>
      </main>
    </div>
  )
}
