'use client'

import React from 'react'

import type { SiteSignals } from '../scoring'
import { liveStatusBySource } from '../liveSignalStatus'
import { SUITABILITY_LIVE_SOURCES } from '../liveDataCatalog'

const LIVE_BADGE = { text: 'LIVE', className: 'bg-emerald-100 text-emerald-800' }

/** True when analyze resolved usable data for this source (even via fallback / GIS). */
function hasSignalData(signals: SiteSignals | null | undefined, srcId: string): boolean {
  if (!signals) return false
  switch (srcId) {
    case 'dem':
      return signals.elevationM != null || signals.enrichment?.terrain != null
    case 'road':
      return signals.roadKm != null
    case 'water':
      return signals.waterKm != null || signals.enrichment?.water != null
    case 'settlement':
      return signals.buildingKm != null || signals.enrichment?.settlement != null
    case 'power_supply':
      return Boolean(
        signals.nearbyPower?.liveOk ||
          (signals.nearbyPower?.assets?.length ?? 0) > 0 ||
          signals.towerKm != null ||
          signals.substationKm != null
      )
    case 'grid':
      return (
        signals.towerKm != null ||
        signals.substationKm != null ||
        (signals.nearbyPower?.assets?.length ?? 0) > 0
      )
    case 'wind':
      return signals.windMs != null
    case 'landcover':
      return signals.landCoverHint !== 'unknown' || signals.enrichment?.landCover != null
    case 'location':
      return Boolean(signals.placeLabel?.trim())
    case 'geotech':
      return signals.geotech != null || signals.soilScreening != null
    default:
      return false
  }
}

function statusLabel(
  fetchStatus: string,
  signals: SiteSignals | null | undefined,
  srcId: string
): { text: string; className: string } {
  if (hasSignalData(signals, srcId) || fetchStatus === 'live' || fetchStatus === 'fallback') {
    return LIVE_BADGE
  }
  if (fetchStatus === 'failed') return { text: 'NO DATA', className: 'bg-slate-100 text-slate-600' }
  if (fetchStatus === 'na') return { text: 'NO DATA', className: 'bg-slate-100 text-slate-600' }
  return { text: 'RESOLVING', className: 'bg-slate-100 text-slate-600' }
}

export default function SignalStatusPanel({ signals }: { signals?: SiteSignals | null }) {
  const byId = liveStatusBySource(signals)
  const enrich = signals?.enrichment

  const rows = SUITABILITY_LIVE_SOURCES.map((src) => {
    const st = byId[src.id] ?? 'na'
    const badge = statusLabel(st, signals, src.id)
    let detail = ''
    if (src.id === 'water' && enrich?.water) {
      detail = ` · ${enrich.water.waterType} · ${enrich.water.confidence}% conf`
    }
    if (src.id === 'dem' && enrich?.terrain) {
      detail = ` · ${enrich.terrain.elevationM != null ? Math.round(enrich.terrain.elevationM) + ' m' : '—'} elev`
    }
    if (src.id === 'landcover' && enrich?.landCover) {
      detail = ` · ${enrich.landCover.dominant}`
    }
    return { ...src, badge, detail }
  })

  if (enrich?.flood) {
    rows.push({
      id: 'flood',
      label: 'Flood susceptibility',
      badge: LIVE_BADGE,
      detail: ` · ${enrich.flood.risk} · ${enrich.flood.score}/100`,
    } as (typeof rows)[number])
  }

  return (
    <section className="rounded-lg border border-[rgba(51,65,85,0.12)] bg-white/70 p-2.5 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#17879a]">Live site signals</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-[10px]">
            <span className="font-semibold text-[#263238] truncate">{r.label}</span>
            <span className="shrink-0 flex items-center gap-1">
              <span className={`rounded px-1.5 py-0.5 font-black uppercase ${r.badge.className}`}>{r.badge.text}</span>
              {r.detail && <span className="text-[#66727a] tabular-nums">{r.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
