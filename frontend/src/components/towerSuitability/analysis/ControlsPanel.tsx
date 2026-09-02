import React from 'react'

import SearchRadiusPicker from './SearchRadiusPicker'
import {
  spanForVoltageKv,
  standardForVoltageKv,
  towerPredictionNote,
  estimateTowerBand,
  VOLTAGE_OPTIONS_KV,
  type LineTowerPlan,
  type SpanPolicy,
} from '../lineTowers'

export default function ControlsPanel({
  searchRadiusKm,
  onSearchRadiusKm,
  lineTowerPlan,
  manualVoltageKv,
  onManualVoltageKv,
  spanPolicy,
  onSpanPolicy,
  showCorridorPlanning = false,
  voltageStandard,
  towerBand,
}: {
  searchRadiusKm: number
  onSearchRadiusKm: (km: number) => void
  lineTowerPlan?: LineTowerPlan | null
  manualVoltageKv: number | null
  onManualVoltageKv: (kv: number | null) => void
  spanPolicy: SpanPolicy
  onSpanPolicy: (p: SpanPolicy) => void
  /** After soil / geotech analysis — optional line corridor planning */
  showCorridorPlanning?: boolean
  voltageStandard?: ReturnType<typeof standardForVoltageKv>
  towerBand?: ReturnType<typeof estimateTowerBand> | null
}) {
  return (
    <div className="space-y-4 text-[#263238]">
      <div>
        <p className="text-sm font-black">Setup</p>
        <p className="text-[10px] text-[#66727a] mt-0.5">
          Adjust search radius after analyze. Start coordinates are edited from the top map bar (Undo to reset).
        </p>
      </div>
      <SearchRadiusPicker value={searchRadiusKm} onChange={onSearchRadiusKm} compact />

      {showCorridorPlanning && lineTowerPlan && (
        <div className="rounded-lg border border-[#b97816]/30 bg-[#fffbeb]/80 p-2.5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#b97816]">
            Transmission line planning
          </p>
          <p className="text-[10px] text-[#66727a] leading-snug">
            Optional — set voltage and span policy after geotechnical screening when you want tower projections on
            the corridor.
          </p>
          <label className="block text-[10px] font-bold text-[#66727a]">
            Voltage class (CEA bands)
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
            {(
              [
                { id: 'dense' as const, label: 'Dense' },
                { id: 'ruling' as const, label: 'Ruling' },
                { id: 'long' as const, label: 'Long' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSpanPolicy(p.id)}
                className={`h-8 rounded-lg text-[10px] font-black border ${
                  spanPolicy === p.id
                    ? 'bg-[#b97816] text-white border-[#b97816]'
                    : 'bg-white/50 text-[#263238] border-[rgba(51,65,85,0.16)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#66727a] leading-snug">
            {towerPredictionNote(
              lineTowerPlan.lengthKm,
              lineTowerPlan.spanM,
              lineTowerPlan.towerCount,
              voltageStandard ?? null
            )}
          </p>
          {towerBand && voltageStandard && (
            <p className="text-[10px] text-[#66727a] leading-snug">
              Band: {towerBand.dense} (dense) – {towerBand.ruling} (ruling) – {towerBand.long} (long) · ROW ~
              {voltageStandard.rowWidthM} m
            </p>
          )}
        </div>
      )}
    </div>
  )
}
