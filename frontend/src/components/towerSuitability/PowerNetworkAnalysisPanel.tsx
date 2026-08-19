/**
 * Power Network Analysis Panel — decision-oriented grid connectivity report.
 * Three verdicts only: YES / NO / UNKNOWN.
 * Planned corridor towers (T1…Tn) are never treated as existing infrastructure.
 */

import React, { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Zap,
  Navigation,
} from 'lucide-react'
import type { NearbyPowerSupply, NearbyPowerAsset, NearbyPowerKind, PowerNetworkVerdict } from './nearbyPowerSupply'
import type { SuitabilityResult } from './scoring'

function kindLabel(kind: NearbyPowerKind): string {
  switch (kind) {
    case 'substation': return 'Substation'
    case 'plant': return 'Power plant'
    case 'line': return 'Power line'
    case 'tower': return 'Existing tower'
    case 'pole': return 'Pole'
    default: return 'Asset'
  }
}

function directionLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function suitabilityForAsset(asset: NearbyPowerAsset): {
  label: string
  color: string
  dot: string
} {
  const d = asset.distanceKm
  if (d <= 2) return { label: 'High', color: 'text-[#126b79]', dot: '🟢' }
  if (d <= 8) return { label: 'Medium', color: 'text-[#b97816]', dot: '🟡' }
  return { label: 'Low', color: 'text-[#c75b50]', dot: '🔴' }
}

function distLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function verdictMeta(v: PowerNetworkVerdict): {
  title: string
  border: string
  bg: string
  text: string
  Icon: typeof CheckCircle2
} {
  if (v === 'yes') {
    return {
      title: 'YES — SUITABLE',
      border: 'border-[#27856b]/50',
      bg: 'bg-[#dff0e8]',
      text: 'text-[#126b79]',
      Icon: CheckCircle2,
    }
  }
  if (v === 'no') {
    return {
      title: 'NO — NOT SUITABLE',
      border: 'border-[#c75b50]/50',
      bg: 'bg-[#f8e4e1]',
      text: 'text-[#c75b50]',
      Icon: XCircle,
    }
  }
  return {
    title: 'UNKNOWN — POWER DATA UNAVAILABLE',
    border: 'border-[#b97816]/50',
    bg: 'bg-[#f6ead1]',
    text: 'text-[#b97816]',
    Icon: HelpCircle,
  }
}

interface WhyChecklistProps {
  result: SuitabilityResult
  supply: NearbyPowerSupply
}

function WhyChecklist({ result, supply }: WhyChecklistProps) {
  const POWER_FACTOR_IDS = [
    'power_connectivity',
    'voltage_suitability',
    'connection_distance',
    'corridor_feasibility',
  ]
  const OTHER_IDS = ['slope', 'road', 'water', 'clearance']
  const allIds = [...POWER_FACTOR_IDS, ...OTHER_IDS]

  return (
    <div className="space-y-1.5">
      {result.factors
        .filter((f) => allIds.includes(f.id))
        .sort((a, b) => allIds.indexOf(a.id) - allIds.indexOf(b.id))
        .map((f) => {
          // When power data unavailable, show amber for power factors (not red)
          const powerFactor = POWER_FACTOR_IDS.includes(f.id)
          const dot =
            powerFactor && !supply.dataAvailable
              ? '🟡'
              : f.score >= 7
                ? '🟢'
                : f.score >= 4.5
                  ? '🟡'
                  : '🔴'
          return (
            <div key={f.id} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 mt-0.5">{dot}</span>
              <div className="min-w-0">
                <span className="font-semibold text-[#263238]">{f.label}</span>
                <span className="text-[#263238] ml-1.5 text-xs">({f.score.toFixed(1)}/10)</span>
                <p className="text-xs text-[#263238] leading-snug mt-0.5">{f.note}</p>
              </div>
            </div>
          )
        })}
    </div>
  )
}

interface PowerNetworkAnalysisPanelProps {
  supply: NearbyPowerSupply
  result: SuitabilityResult
}

export default function PowerNetworkAnalysisPanel({ supply, result }: PowerNetworkAnalysisPanelProps) {
  const [open, setOpen] = useState(true)

  const verdict = supply.powerNetworkVerdict ?? (supply.dataAvailable ? 'yes' : 'unknown')
  const meta = verdictMeta(verdict)
  const Icon = meta.Icon
  const confidence = result.confidencePct

  const tableAssets = [
    ...supply.existingPowerTowers,
    ...supply.existingPowerLines,
    ...supply.existingSubstations,
    ...supply.assets.filter((a) => a.kind === 'pole'),
  ]
    .filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i)
    .slice(0, 8)

  const routeDifficultyColor =
    supply.routeDifficulty === 'low'
      ? 'text-[#126b79]'
      : supply.routeDifficulty === 'moderate'
        ? 'text-[#b97816]'
        : 'text-[#c75b50]'

  const powerNetworkScore = supply.dataAvailable
    ? result.factors
        .filter((f) =>
          ['power_connectivity', 'voltage_suitability', 'connection_distance', 'corridor_feasibility'].includes(
            f.id
          )
        )
        .reduce((sum, f) => sum + f.score * f.weight, 0) /
      Math.max(
        0.001,
        result.factors
          .filter((f) =>
            [
              'power_connectivity',
              'voltage_suitability',
              'connection_distance',
              'corridor_feasibility',
            ].includes(f.id)
          )
          .reduce((sum, f) => sum + f.weight, 0)
      )
    : null

  const practicalKm =
    supply.estimatedPracticalConnectionDistanceKm ?? supply.connectionDistanceKm ?? null
  const directKm = supply.directDistanceKm ?? supply.nearest?.distanceKm ?? null

  return (
    <div className="rounded-xl border border-[rgba(51,65,85,0.16)] bg-[rgba(248,247,241,0.96)] overflow-hidden text-[#263238]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-3 hover:bg-white/60 transition-colors"
      >
        <Zap className="w-4 h-4 text-[#17879a] shrink-0" />
        <span className="flex-1 text-left text-sm font-black text-[#263238] uppercase tracking-wide">
          Power Network Analysis
        </span>
        {supply.nearest && supply.dataAvailable && (
          <span className="text-xs font-bold text-[#263238] tabular-nums">
            {distLabel(supply.nearest.distanceKm)}
          </span>
        )}
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#263238] shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#263238] shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-[rgba(51,65,85,0.12)]">
          <div className={`mt-3 rounded-xl border-2 px-4 py-3 ${meta.border} ${meta.bg}`}>
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 shrink-0 ${meta.text}`} />
              <p className={`text-base font-black tracking-wide ${meta.text}`}>{meta.title}</p>
            </div>
            {verdict === 'unknown' && (
              <p className="text-sm text-[#263238] mt-1.5 leading-snug">
                API / open-data failure is <span className="font-bold">not</span> an
                engineering rejection. Re-analyze when TAMS GIS or OSM responds.
              </p>
            )}
            {verdict !== 'unknown' && supply.suggestedVoltageKv != null && (
              <p className="text-sm text-[#263238] mt-1.5">
                Recommended connection:{' '}
                <span className="font-bold">{supply.suggestedVoltageKv} kV network</span>
                <span>
                  {' '}
                  · {supply.recommendedVoltageSource} · {supply.recommendedVoltageConfidence} confidence
                </span>
              </p>
            )}
            {verdict !== 'unknown' && practicalKm != null && (
              <p className="text-sm text-[#263238] mt-0.5">
                Estimated practical connection:{' '}
                <span className="font-bold">~{distLabel(practicalKm)}</span>
                <span> (screening: direct × 1.2)</span>
              </p>
            )}
            <p className="text-xs text-[#263238] mt-1">
              Site score: <span className="font-bold">{result.finalScore.toFixed(1)}/10</span>
              {' · '}
              Confidence: <span className="font-bold">~{confidence}%</span>
            </p>
          </div>

          {supply.diagnostics && (
            <p className="text-[10px] text-[#263238] font-mono leading-snug">
              Search {supply.diagnostics.searchRadiusKm} km · TAMS towers{' '}
              {supply.diagnostics.tamsTowerCount}
              {supply.diagnostics.tamsOk ? '' : ' (fail)'} · TAMS SS{' '}
              {supply.diagnostics.tamsSsCount} · OSM {supply.diagnostics.osmAssetCount}
              {supply.diagnostics.osmOk ? '' : ' (fail)'}
              {supply.diagnostics.errors.length
                ? ` · ${supply.diagnostics.errors.join('; ')}`
                : ''}
            </p>
          )}

          {tableAssets.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#263238] mb-1.5">
                Existing power infrastructure (not planned T1…Tn)
              </p>
              <div className="rounded-lg border border-[rgba(51,65,85,0.16)] overflow-x-auto bg-white/70">
                <table className="w-full text-xs">
                  <thead className="bg-white text-[#263238]">
                    <tr>
                      <th className="text-left px-2.5 py-2 font-bold">Infrastructure</th>
                      <th className="text-right px-2.5 py-2 font-bold">Distance</th>
                      <th className="text-right px-2.5 py-2 font-bold">Voltage</th>
                      <th className="text-right px-2.5 py-2 font-bold">Suitability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableAssets.map((asset) => {
                      const suit = suitabilityForAsset(asset)
                      return (
                        <tr key={asset.id} className="border-t border-[rgba(51,65,85,0.12)]">
                          <td className="px-2.5 py-2 text-[#263238]">
                            <div className="font-semibold truncate max-w-[120px]">{asset.name}</div>
                            <div className="text-[10px]">
                              {kindLabel(asset.kind)} · {asset.source.toUpperCase()}
                            </div>
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono text-[#263238] tabular-nums">
                            {distLabel(asset.distanceKm)}
                          </td>
                          <td className="px-2.5 py-2 text-right text-[#263238]">
                            {asset.voltageKv != null ? `${asset.voltageKv} kV` : 'Unknown'}
                          </td>
                          <td className={`px-2.5 py-2 text-right font-bold ${suit.color}`}>
                            {suit.dot} {suit.label}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {supply.dataAvailable && supply.nearest && (
            <div className="rounded-lg border border-[rgba(51,65,85,0.16)] bg-white/80 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#263238] mb-2">
                Proposed tower connection
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-[#263238]">
                <span>Voltage</span>
                <span className="font-bold text-right">
                  {supply.suggestedVoltageKv != null
                    ? `${supply.suggestedVoltageKv} kV`
                    : 'Unknown'}
                </span>
                <span>Voltage source</span>
                <span className="font-bold text-right text-[10px]">
                  {supply.recommendedVoltageSource}
                </span>
                {supply.nearestTower && (
                  <>
                    <span>Nearest existing tower</span>
                    <span className="font-bold text-right truncate">
                      {supply.nearestTower.name} · {distLabel(supply.nearestTower.distanceKm)}
                    </span>
                  </>
                )}
                {supply.nearestLine && (
                  <>
                    <span>Nearest existing line</span>
                    <span className="font-bold text-right truncate">
                      {supply.nearestLine.name} · {distLabel(supply.nearestLine.distanceKm)}
                    </span>
                  </>
                )}
                {directKm != null && (
                  <>
                    <span>Direct distance</span>
                    <span className="font-bold text-right">{distLabel(directKm)}</span>
                  </>
                )}
                {practicalKm != null && (
                  <>
                    <span>Practical route (×1.2)</span>
                    <span className="font-bold text-right">~{distLabel(practicalKm)}</span>
                  </>
                )}
                <span>Route difficulty</span>
                <span className={`font-bold text-right capitalize ${routeDifficultyColor}`}>
                  {supply.routeDifficulty}
                </span>
                <span>Network score</span>
                <span className="font-bold text-right">
                  {powerNetworkScore != null ? `${powerNetworkScore.toFixed(1)} / 10` : 'n/a'}
                </span>
                <span>Network capacity</span>
                <span className="font-bold text-[#b97816] text-right text-[10px]">
                  Unknown — utility verification required
                </span>
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[#263238] mb-2">Why?</p>
            <WhyChecklist result={result} supply={supply} />
          </div>

          {verdict === 'no' && supply.alternativeSiteHint && (
            <div className="rounded-lg border border-[#b97816]/40 bg-[#f6ead1] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Navigation className="w-4 h-4 text-[#b97816] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#263238]">
                    Alternative: Move ~{supply.alternativeSiteHint.distanceKm} km{' '}
                    {directionLabel(supply.alternativeSiteHint.directionDeg)} (
                    {supply.alternativeSiteHint.directionDeg}°)
                  </p>
                  <p className="text-xs text-[#263238] mt-0.5 leading-snug">
                    {supply.alternativeSiteHint.reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {supply.note && (
            <p className="text-xs text-[#263238] leading-snug border-t border-[rgba(51,65,85,0.12)] pt-2">
              {supply.note}
            </p>
          )}

          {!supply.osmQueryOk && (
            <div className="flex items-start gap-2 rounded-lg border border-[#b97816]/30 bg-[#f6ead1] px-2.5 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#b97816] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#263238] leading-snug">
                OSM Overpass did not respond — pole/line data may be incomplete.
                {supply.diagnostics?.tamsOk
                  ? ' TAMS GIS towers still used when available.'
                  : ' TAMS GIS also unavailable.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
