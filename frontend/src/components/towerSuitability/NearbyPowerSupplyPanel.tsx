import React, { useState } from 'react'
import { ChevronDown, ChevronUp, MapPinned, Zap } from 'lucide-react'

import type { NearbyPowerSupply } from './nearbyPowerSupply'
import { interconnectEaseLabel, powerKindLabel } from './nearbyPowerSupply'

export default function NearbyPowerSupplyPanel({ supply }: { supply?: NearbyPowerSupply | null }) {
  const [open, setOpen] = useState(true)
  if (!supply) return null

  const {
    nearest,
    nearestPole,
    availableVoltageKv,
    assets,
    searchRadiusKm,
    note,
    interconnectEase,
    placementTips,
    corridorAssetCount,
  } = supply

  const easeColor =
    interconnectEase === 'easy'
      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
      : interconnectEase === 'moderate'
        ? 'text-amber-200 border-amber-500/40 bg-amber-500/10'
        : 'text-rose-300 border-rose-500/40 bg-rose-500/10'

  return (
    <div className="rounded-xl border border-violet-500/40 bg-violet-950/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-violet-950/30"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-violet-200">
          <Zap className="w-3.5 h-3.5" />
          Nearby power · where to place
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
          {nearestPole
            ? `Pole ${Math.round(nearestPole.distanceKm * 1000)} m`
            : nearest
              ? `${nearest.distanceKm.toFixed(1)} km`
              : 'None mapped'}
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 border-t border-violet-500/20 space-y-2.5 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${easeColor}`}>
              {interconnectEaseLabel(interconnectEase)}
            </span>
            {(nearestPole?.distanceKm ?? 99) <= 0.35 && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border text-cyan-200 border-cyan-500/40 bg-cyan-500/10">
                LV poles on corridor
              </span>
            )}
            {corridorAssetCount > 0 && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border text-slate-300 border-slate-600 bg-slate-800/60">
                {corridorAssetCount} along line
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">{note}</p>

          {placementTips.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase text-cyan-300/90 mb-1.5 flex items-center gap-1">
                <MapPinned className="w-3 h-3" />
                Placement suggestions (with accuracy)
              </p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {placementTips.map((tip, i) => (
                  <li
                    key={`${tip.title}-${i}`}
                    className="rounded-lg border border-slate-700/70 bg-slate-950/50 px-2.5 py-2 text-[11px]"
                  >
                    <p className="font-bold text-slate-100">
                      {i + 1}. {tip.title}
                    </p>
                    <p className="text-slate-400 mt-0.5 leading-snug">{tip.detail}</p>
                    <p className="text-[10px] text-amber-400/90 mt-1 font-semibold">{tip.accuracy}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {availableVoltageKv.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase text-violet-300/90 mb-1">
                Voltage you can match (within {searchRadiusKm} km)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableVoltageKv.map((kv) => (
                  <span
                    key={kv}
                    className="text-[11px] font-black px-2 py-0.5 rounded-md border border-violet-400/40 bg-violet-500/15 text-violet-100 tabular-nums"
                  >
                    {kv} kV
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Mapped nominal levels — not sanctioned MW or bay booking.
              </p>
            </div>
          )}

          {nearest && (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/50 px-2.5 py-2 text-[11px]">
              <p className="font-bold text-white">{nearest.name}</p>
              <p className="text-slate-400 mt-0.5">
                {powerKindLabel(nearest.kind)} · {nearest.distanceKm.toFixed(2)} km ·{' '}
                <span className="text-violet-200 font-semibold">
                  {nearest.voltageKv != null ? `${nearest.voltageKv} kV` : 'voltage not tagged'}
                </span>
              </p>
              {nearest.role && (
                <p className="text-slate-500 mt-0.5 capitalize">Role: {nearest.role.replace(/_/g, ' ')}</p>
              )}
              <p className="text-[10px] text-emerald-400/90 mt-1 font-semibold">
                Live · {nearest.source === 'tams' ? 'TAMS GIS' : 'OSM Overpass'} ·{' '}
                {nearest.lat.toFixed(5)}, {nearest.lon.toFixed(5)}
              </p>
            </div>
          )}

          {assets.length > 1 && (
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Also nearby</p>
              <ul className="space-y-1 max-h-28 overflow-y-auto">
                {assets.slice(0, 8).map((a) => (
                  <li key={a.id} className="text-[10px] text-slate-400 flex justify-between gap-2">
                    <span className="truncate text-slate-300">
                      <span className="text-slate-500">{powerKindLabel(a.kind)} · </span>
                      {a.name}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {a.distanceKm.toFixed(1)} km
                      {a.voltageKv != null ? ` · ${a.voltageKv} kV` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
