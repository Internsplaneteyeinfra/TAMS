import React from 'react'
import { Loader2, Zap } from 'lucide-react'

import type { PowerInfrastructureSummary } from '../towerPlanning'

export interface PowerInfrastructureGateProps {
  checked: boolean
  loading: boolean
  summary: PowerInfrastructureSummary | null
  searchRadiusKm: number
  onCheck: () => void
  disabled?: boolean
}

export default function PowerInfrastructureGate({
  checked,
  loading,
  summary,
  searchRadiusKm,
  onCheck,
  disabled,
}: PowerInfrastructureGateProps) {
  return (
    <section className="ts-glass rounded-lg p-2.5 border border-amber-200/80 space-y-2">
      <p className="text-[9px] font-black uppercase text-amber-950">Power infrastructure</p>
      <p className="text-[8px] text-[#66727a] leading-snug">
        GIS-detected transmission assets are not loaded automatically. Click below to search within {searchRadiusKm} km.
      </p>

      {!checked && (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={onCheck}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wide hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {loading ? 'Searching…' : 'Check Nearby Power Infrastructure'}
        </button>
      )}

      {checked && summary && (
        <div className="space-y-1 text-[10px]">
          <p className="font-black text-amber-950">Power infrastructure summary</p>
          <p>
            Nearest: <strong>{summary.nearestLabel}</strong>
            {summary.distanceKm != null ? ` — ${summary.distanceKm.toFixed(1)} km` : ''}
            {summary.direction ? ` (${summary.direction})` : ''}
          </p>
          <p className="text-[9px] text-[#66727a]">
            Type: {summary.infrastructureType} · Source: {summary.source}
          </p>
          {summary.raw?.assets?.length ? (
            <p>
              Assets in search radius: <strong>{summary.raw.assets.length}</strong>
            </p>
          ) : null}
          <p className="text-[8px] text-[#66727a] italic mt-1">{summary.message}</p>
        </div>
      )}
    </section>
  )
}
