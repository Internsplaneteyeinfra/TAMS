import React, { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPinned,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Zap,
  Building2,
} from 'lucide-react'

import type {
  CorridorPlacementAdvice,
  LineKvSuitability,
  PlacementVerdict,
} from './corridorPlacementAdvice'
import { VOLTAGE_OPTIONS_KV, standardForVoltageKv } from './lineTowers'

function verdictStyle(v: PlacementVerdict): {
  label: string
  className: string
  Icon: typeof CheckCircle2
} {
  switch (v) {
    case 'place':
      return {
        label: 'Suggest place',
        className: 'text-[#126b79] border-[#27856b]/40 bg-[#dff0e8]',
        Icon: CheckCircle2,
      }
    case 'skip_existing':
      return {
        label: 'Suggest skip',
        className: 'text-[#c75b50] border-[#c75b50]/40 bg-[#f8e4e1]',
        Icon: XCircle,
      }
    case 'too_close':
      return {
        label: 'Suggest shift',
        className: 'text-[#b97816] border-[#b97816]/40 bg-[#f6ead1]',
        Icon: AlertTriangle,
      }
    default:
      return {
        label: 'Review',
        className: 'text-[#126b79] border-[#17879a]/40 bg-white/70',
        Icon: AlertTriangle,
      }
  }
}

function suitabilityLabel(s: LineKvSuitability): { title: string; hint: string } {
  switch (s) {
    case 'good':
      return { title: 'Looks suitable', hint: 'Line + kV match look promising for screening' }
    case 'fair':
      return { title: 'Fair / review', hint: 'Workable idea — compare kV or offset if needed' }
    case 'poor':
      return { title: 'Weak match', hint: 'Try another kV or a nearer corridor' }
    default:
      return { title: 'Unknown', hint: 'Pick a kV class to score this line' }
  }
}

export default function CorridorPlacementPanel({
  advice,
  manualVoltageKv,
  onManualVoltageKv,
}: {
  advice: CorridorPlacementAdvice | null
  manualVoltageKv?: number | null
  onManualVoltageKv?: (kv: number | null) => void
}) {
  const [open, setOpen] = useState(true)
  if (!advice) return null

  const suit = suitabilityLabel(advice.lineSuitability)
  const selectedKv = manualVoltageKv ?? advice.voltageKv

  return (
    <div className="rounded-xl border border-[rgba(51,65,85,0.16)] bg-[rgba(248,247,241,0.96)] overflow-hidden text-[#263238]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-white/60"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#263238]">
          <MapPinned className="w-3.5 h-3.5 text-[#17879a]" />
          Tower placement · suggestions
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold text-[#263238]">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
            style={{ backgroundColor: advice.lineColor }}
            title={suit.title}
          />
          {advice.canPlaceCount}/{advice.plannedCount} OK
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 border-t border-[rgba(51,65,85,0.12)] space-y-2.5 pt-2">
          <p className="text-[10px] text-[#66727a] leading-snug flex gap-1.5 items-start">
            <Lightbulb className="w-3.5 h-3.5 shrink-0 text-[#b97816] mt-0.5" />
            {advice.suggestionNote}
          </p>

          <div
            className="rounded-lg border px-2.5 py-2"
            style={{
              borderColor: `${advice.lineColor}55`,
              backgroundColor: `${advice.lineColor}14`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: advice.lineColor }}>
                Line × {advice.voltageLabel}
              </p>
              <span
                className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded border bg-white/80"
                style={{ color: advice.lineColor, borderColor: `${advice.lineColor}66` }}
              >
                {suit.title}
              </span>
            </div>
            <p className="text-[11px] mt-1 leading-snug text-[#263238]">{suit.hint}</p>
            <p className="text-[10px] mt-1 text-[#66727a]">
              Search radius <span className="font-bold text-[#263238]">{advice.searchRadiusKm} km</span> ·{' '}
              {advice.assetsInRadiusCount} assets · {advice.towersInRadiusCount} towers/poles near line
            </p>
          </div>

          {onManualVoltageKv && (
            <label className="block text-[10px] font-bold uppercase text-[#66727a]">
              Try another kV (your choice)
              <select
                value={selectedKv ?? ''}
                onChange={(e) => onManualVoltageKv(e.target.value ? Number(e.target.value) : null)}
                className="mt-1 w-full h-9 rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/80 px-2 text-xs font-bold text-[#263238]"
              >
                <option value="">Select kV class…</option>
                {VOLTAGE_OPTIONS_KV.map((kv) => {
                  const std = standardForVoltageKv(kv)
                  return (
                    <option key={kv} value={kv}>
                      {std?.label ?? `${kv} kV`} · ~{std?.rulingSpanM ?? '—'} m span
                    </option>
                  )
                })}
              </select>
              <span className="mt-1 block text-[10px] font-normal normal-case text-[#66727a] leading-snug">
                Change kV to see if this same line still looks good for a bigger or smaller tower class.
              </span>
            </label>
          )}

          <div className="grid grid-cols-1 gap-1.5">
            {advice.powerConnect && (
              <div className="rounded-lg border border-[#0f766e]/40 bg-[#ecfdf5] px-2.5 py-2 space-y-1.5">
                <p className="text-[9px] font-black uppercase text-[#0f766e]">
                  Power take-off · station ↔ new tower
                </p>
                <p className="text-[12px] font-black text-[#263238]">
                  New T{advice.powerConnect.bestPadIndex} → “{advice.powerConnect.station.name}”
                </p>
                <p className="text-[11px] text-[#263238]">
                  ~{advice.powerConnect.stationToPadKm.toFixed(2)} km · screening fit{' '}
                  <span className="font-black text-[#0f766e]">
                    ~{advice.powerConnect.confidencePct}%
                  </span>
                  {advice.powerConnect.voltageFit === 'exact'
                    ? ' · exact kV match'
                    : advice.powerConnect.voltageFit === 'close'
                      ? ' · close kV'
                      : advice.powerConnect.voltageFit === 'mismatch'
                        ? ' · kV mismatch'
                        : ''}
                </p>
                <p className="text-[10px] text-[#66727a] leading-snug">
                  {advice.powerConnect.confidenceNote}
                </p>
                {advice.powerConnect.towerNearStation && (
                  <p className="text-[11px] text-[#7e22ce] leading-snug">
                    Station’s nearest existing tower: “{advice.powerConnect.towerNearStation.name}” (~
                    {advice.powerConnect.towerNearStation.distanceKm.toFixed(2)} km from SS) — purple
                    dashed link on map.
                  </p>
                )}
                {advice.powerConnect.towerNearPad &&
                  advice.powerConnect.towerNearPad.id !==
                    advice.powerConnect.towerNearStation?.id && (
                    <p className="text-[11px] text-[#1d4ed8] leading-snug">
                      Existing tower near your new pad: “{advice.powerConnect.towerNearPad.name}” (~
                      {advice.powerConnect.towerNearPad.distanceKm.toFixed(2)} km) — blue dashed link.
                    </p>
                  )}
                <p className="text-[10px] text-[#0f766e] font-semibold">
                  Map: teal link = SS → new T{advice.powerConnect.bestPadIndex} (best pad for power). ★
                  marks that new transmission pad.
                </p>
              </div>
            )}
            {advice.nearestTower && (
              <div className="rounded-lg border border-[#3b82f6]/35 bg-[#eff6ff] px-2.5 py-2">
                <p className="text-[9px] font-black uppercase text-[#1d4ed8] flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Nearest existing tower to your line
                </p>
                <p className="text-[12px] font-black mt-0.5 truncate">{advice.nearestTower.name}</p>
                <p className="text-[11px] text-[#263238]">
                  ~{advice.nearestTower.distanceKm.toFixed(2)} km from corridor
                  {advice.nearestTower.voltageKv != null
                    ? ` · ${advice.nearestTower.voltageKv} kV`
                    : ''}
                </p>
                <p className="text-[10px] text-[#66727a] mt-0.5 leading-snug">{advice.nearestTower.note}</p>
              </div>
            )}
            {advice.nearestStation && !advice.powerConnect && (
              <div className="rounded-lg border border-[#a855f7]/35 bg-[#faf5ff] px-2.5 py-2">
                <p className="text-[9px] font-black uppercase text-[#7e22ce] flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  Nearest power station
                </p>
                <p className="text-[12px] font-black mt-0.5 truncate">{advice.nearestStation.name}</p>
                <p className="text-[11px] text-[#263238]">
                  ~{advice.nearestStation.distanceKm.toFixed(2)} km
                  {advice.nearestStation.voltageKv != null
                    ? ` · ${advice.nearestStation.voltageKv} kV`
                    : ''}
                </p>
                <p className="text-[10px] text-[#66727a] mt-0.5 leading-snug">{advice.nearestStation.note}</p>
              </div>
            )}
            {!advice.nearestTower && !advice.nearestStation && (
              <p className="text-[11px] text-[#b97816] leading-snug">
                No tower or station inside {advice.searchRadiusKm} km of this line — widen search radius and
                re-analyze, or draw closer to the grid.
              </p>
            )}
          </div>

          {advice.suggestedConnectKm != null && (
            <p className="text-[11px] font-semibold text-[#263238]">
              Suggested connect distance along planning: ~{advice.suggestedConnectKm.toFixed(1)} km toward
              nearest station/tower (straight-line screening).
            </p>
          )}

          <div className="rounded-lg border border-[#27856b]/25 bg-[#dff0e8]/60 px-2.5 py-2">
            <p className="text-[9px] font-black uppercase text-[#126b79]">Why follow this line</p>
            <p className="text-[11px] leading-snug mt-0.5">{advice.whyFollow}</p>
          </div>
          <div className="rounded-lg border border-[#c75b50]/25 bg-[#f8e4e1]/70 px-2.5 py-2">
            <p className="text-[9px] font-black uppercase text-[#c75b50]">Why you might not</p>
            <p className="text-[11px] leading-snug mt-0.5">{advice.whyNotFollow}</p>
          </div>

          <p className="text-[11px] text-[#263238] leading-relaxed">{advice.summary}</p>

          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg border border-[#27856b]/30 bg-[#dff0e8] px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#126b79]">Suggest</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.canPlaceCount}</p>
            </div>
            <div className="rounded-lg border border-[#c75b50]/30 bg-[#f8e4e1] px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#c75b50]">Skip</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.skipExistingCount}</p>
            </div>
            <div className="rounded-lg border border-[#b97816]/30 bg-[#f6ead1] px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#b97816]">Shift</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.tooCloseCount}</p>
            </div>
            <div className="rounded-lg border border-[#17879a]/30 bg-white/80 px-1.5 py-1.5">
              <p className="text-[9px] font-bold uppercase text-[#126b79]">Review</p>
              <p className="text-lg font-black text-[#263238] tabular-nums">{advice.reviewCount}</p>
            </div>
          </div>

          <div className="rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/70 px-2.5 py-2 text-[10px] text-[#263238] leading-snug">
            <p className="font-bold text-[#263238] uppercase tracking-wide mb-0.5">
              Spacing idea ({advice.voltageLabel})
            </p>
            <p>
              Min <span className="font-bold">{advice.minSpanM} m</span> · usual{' '}
              <span className="font-bold">{advice.rulingSpanM} m</span> · max{' '}
              <span className="font-bold">{advice.maxSpanM} m</span> · ROW ~{advice.rowWidthM} m
            </p>
            <p className="mt-1 text-[#263238]">{advice.rulesSummary}</p>
            {advice.nearbyVoltagesKv.length > 0 && (
              <p className="mt-1 text-[#66727a]">
                Voltages seen in radius: {advice.nearbyVoltagesKv.slice(0, 6).join(' / ')} kV
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 bg-white/80">
              <i className="h-2 w-2 rounded-full" style={{ backgroundColor: advice.lineColor }} /> Line color
            </span>
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 bg-[#dff0e8] text-[#126b79]">
              ● Suggest place
            </span>
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 bg-[#eff6ff] text-[#1d4ed8]">
              ● Tower
            </span>
            <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 bg-[#faf5ff] text-[#7e22ce]">
              ● Station
            </span>
          </div>

          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            {advice.items.map((item) => {
              const style = verdictStyle(item.verdict)
              const Icon = style.Icon
              return (
                <li
                  key={`pad-${item.index}`}
                  className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/70 px-2.5 py-2 text-[11px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-black text-[#263238]">
                      T{item.index}{' '}
                      <span className="text-[#263238] font-semibold tabular-nums">
                        at {Math.round(item.chainageM)} m
                      </span>
                    </p>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${style.className}`}
                    >
                      <Icon className="w-3 h-3" />
                      {style.label}
                    </span>
                  </div>
                  <p className="text-[#263238] mt-1 leading-snug">{item.reason}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
