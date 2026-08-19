import React from 'react'
import { Crosshair, Navigation } from 'lucide-react'

import { SEARCH_RADIUS_OPTIONS_KM } from '../nearbyPowerSupply'
import {
  spanForVoltageKv,
  standardForVoltageKv,
  VOLTAGE_OPTIONS_KV,
  type LineTowerPlan,
  type SpanPolicy,
} from '../lineTowers'

export default function ControlsPanel({
  searchRadiusKm,
  onSearchRadiusKm,
  latInput,
  lonInput,
  onLatInput,
  onLonInput,
  onGoToLocation,
  onLiveLocation,
  geoBusy,
  lineTowerPlan,
  manualVoltageKv,
  onManualVoltageKv,
  spanPolicy,
  onSpanPolicy,
}: {
  searchRadiusKm: number
  onSearchRadiusKm: (km: number) => void
  latInput: string
  lonInput: string
  onLatInput: (v: string) => void
  onLonInput: (v: string) => void
  onGoToLocation: () => void
  onLiveLocation: () => void
  geoBusy: boolean
  lineTowerPlan?: LineTowerPlan | null
  manualVoltageKv: number | null
  onManualVoltageKv: (kv: number | null) => void
  spanPolicy: SpanPolicy
  onSpanPolicy: (p: SpanPolicy) => void
}) {
  return (
    <div className="space-y-3 text-[#263238]">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#66727a]">Search radius</p>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => onSearchRadiusKm(km)}
              className={`h-8 rounded-lg text-[10px] font-black border ${
                searchRadiusKm === km
                  ? 'bg-[#17879a] text-white border-[#126b79]'
                  : 'bg-white/50 text-[#263238] border-[rgba(51,65,85,0.16)] hover:border-[#17879a]'
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-[#66727a] leading-snug">
          Ground km from the start point. The cyan ring on the map is this search (existing grid only).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] font-bold text-[#66727a]">
          Latitude
          <input
            value={latInput}
            onChange={(e) => onLatInput(e.target.value)}
            placeholder="22.9734"
            inputMode="decimal"
            className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2 text-xs font-mono text-[#263238]"
          />
        </label>
        <label className="text-[10px] font-bold text-[#66727a]">
          Longitude
          <input
            value={lonInput}
            onChange={(e) => onLonInput(e.target.value)}
            placeholder="78.6569"
            inputMode="decimal"
            className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2 text-xs font-mono text-[#263238]"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onGoToLocation}
        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#17879a] text-white text-[11px] font-black"
      >
        <Crosshair className="h-3.5 w-3.5" />
        Go To Location
      </button>
      <button
        type="button"
        disabled={geoBusy}
        onClick={onLiveLocation}
        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(51,65,85,0.16)] text-[11px] font-black text-[#263238] disabled:opacity-50"
      >
        <Navigation className="h-3.5 w-3.5" />
        {geoBusy ? 'Locating…' : 'Use Live Location'}
      </button>
      {lineTowerPlan && (
        <div className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/40 p-2.5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#b97816]">Map options · planning</p>
          <label className="block text-[10px] font-bold text-[#66727a]">
            Voltage class
            <select
              value={manualVoltageKv ?? lineTowerPlan.voltageKv ?? ''}
              onChange={(e) => onManualVoltageKv(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2 text-xs font-bold text-[#263238]"
            >
              <option value="">Select kV…</option>
              {VOLTAGE_OPTIONS_KV.map((kv) => {
                const std = standardForVoltageKv(kv)
                return (
                  <option key={kv} value={kv}>
                    {kv} kV · ruling {std?.rulingSpanM ?? spanForVoltageKv(kv)} m
                  </option>
                )
              })}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['dense', 'ruling', 'long'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSpanPolicy(id)}
                className={`h-8 rounded-lg text-[10px] font-black border ${
                  spanPolicy === id
                    ? 'bg-[#b97816] text-white border-[#b97816]'
                    : 'bg-white/50 text-[#263238] border-[rgba(51,65,85,0.16)]'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#66727a]">
            {lineTowerPlan.towerCount} towers · {lineTowerPlan.spanM} m span
          </p>
        </div>
      )}
    </div>
  )
}
