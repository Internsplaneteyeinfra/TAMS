import React from 'react'

import type { GeotechnicalIntelligence } from '../geotech'
import { formatVerdictLabel } from '../geotech/verdict'
import { SEARCH_RADIUS_OPTIONS_KM } from '../nearbyPowerSupply'
import type {
  PowerInfrastructureSummary,
  TowerCandidate,
  TowerCandidateAnalysis,
  TowerPlanningContext,
} from '../towerPlanning'
import { isApprovedForConstruction } from '../towerPlanning'
import PowerInfrastructureGate from './PowerInfrastructureGate'

export interface TowerPlanningPanelProps {
  geo: GeotechnicalIntelligence
  context: TowerPlanningContext
  planningGeometryReady: boolean
  powerChecked: boolean
  powerLoading: boolean
  powerSummary: PowerInfrastructureSummary | null
  searchRadiusKm: number
  onSearchRadiusKm: (km: number) => void
  towerCandidates: TowerCandidate[]
  selectedCandidateId: string | null
  towerAnalysis: TowerCandidateAnalysis | null
  towerAnalysisLoading: boolean
  onCreateTransmissionLine: () => void
  onCreateInvestigationArea: () => void
  onCheckTowerSuitability: () => void
  onCheckPowerInfrastructure: () => void
  onGenerateTowerSuggestions: () => void
  onSelectCandidate: (candidate: TowerCandidate) => void
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full px-2 py-1.5 rounded text-[9px] font-black uppercase tracking-wide disabled:opacity-40 ${
        variant === 'primary'
          ? 'bg-[#0f766e] text-white'
          : 'bg-white/70 border border-slate-200 text-[#263238]'
      }`}
    >
      {children}
    </button>
  )
}

export default function TowerPlanningPanel({
  geo,
  context,
  planningGeometryReady,
  powerChecked,
  powerLoading,
  powerSummary,
  searchRadiusKm,
  onSearchRadiusKm,
  towerCandidates,
  selectedCandidateId,
  towerAnalysis,
  towerAnalysisLoading,
  onCreateTransmissionLine,
  onCreateInvestigationArea,
  onCheckTowerSuitability,
  onCheckPowerInfrastructure,
  onGenerateTowerSuggestions,
  onSelectCandidate,
}: TowerPlanningPanelProps) {
  const verdict = geo.soilVerdictAnalysis
  if (!verdict) return null

  const mandatory = context.mandatoryInvestigations

  return (
    <section className="space-y-2 mt-3 border-t border-[#0f766e]/20 pt-3">
      <p className="text-[10px] font-black uppercase text-[#0f766e]">Next Planning Actions</p>
      <p className="text-[8px] text-[#66727a]">
        Soil Investigation → Engineering Assessment → Next Planning Action
      </p>
      <p className="text-[8px] font-bold text-amber-900 italic">PRELIMINARY PLANNING ONLY — not construction approval</p>

      {mandatory.length > 0 && (
        <div className="rounded border border-rose-200 bg-rose-50/80 p-2">
          <p className="text-[9px] font-black uppercase text-rose-900">Mandatory before final design</p>
          <ul className="mt-1 space-y-0.5">
            {mandatory.map((m) => (
              <li key={m} className="text-[8px] text-rose-900">
                • {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1">
        <ActionButton onClick={onCreateTransmissionLine}>Create Transmission Line</ActionButton>
        <ActionButton onClick={onCreateInvestigationArea} variant="secondary">
          Create Investigation Area
        </ActionButton>
        <ActionButton onClick={onCheckTowerSuitability} variant="secondary">
          Check Tower Suitability
        </ActionButton>
      </div>

      {(planningGeometryReady || context.investigationGeometry) && (
        <div className="ts-glass rounded-lg p-2 border border-sky-200/70 space-y-1">
          <label className="text-[8px] font-bold text-[#66727a] block">
            Power infrastructure search radius
            <select
              className="mt-0.5 w-full text-[9px] border border-slate-200 rounded px-1 py-0.5"
              value={searchRadiusKm}
              onChange={(e) => onSearchRadiusKm(Number(e.target.value))}
            >
              {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          </label>
          <PowerInfrastructureGate
            checked={powerChecked}
            loading={powerLoading}
            summary={powerSummary}
            searchRadiusKm={searchRadiusKm}
            onCheck={onCheckPowerInfrastructure}
          />
        </div>
      )}

      {powerChecked && powerSummary && (
        <div className="ts-glass rounded-lg p-2 border border-indigo-200/70 space-y-1">
          <ActionButton onClick={onGenerateTowerSuggestions}>Generate Tower Suggestions</ActionButton>
        </div>
      )}

      {towerCandidates.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase">Tower candidates</p>
          <p className="text-[8px] text-[#66727a]">Click any candidate to automatically analyze.</p>
          {towerCandidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCandidate(c)}
              className={`w-full text-left rounded border p-2 text-[8px] ${
                selectedCandidateId === c.id
                  ? 'border-[#0f766e] bg-[#ecfdf5] ring-2 ring-[#0f766e]/30'
                  : 'border-slate-200 bg-white/60'
              }`}
            >
              <p className="font-black text-[11px]">{c.id}</p>
              <p className="font-mono">Suitability: {c.suitabilityScore} / 100</p>
              <p className="text-[#66727a]">{c.recommendation.replace(/_/g, ' ')}</p>
              <p>Soil: {c.soilVerdictStatus}</p>
              <p>
                Power: {c.powerInfrastructureStatus.replace(/_/g, ' ')}
                {c.distanceToInfrastructureKm != null ? ` · ${c.distanceToInfrastructureKm.toFixed(2)} km` : ''}
              </p>
              {!isApprovedForConstruction(c.recommendation) && (
                <p className="text-[7px] text-amber-900 mt-0.5">Preliminary assessment only</p>
              )}
            </button>
          ))}
        </div>
      )}

      {towerAnalysisLoading && (
        <p className="text-[9px] text-[#0f766e] font-bold animate-pulse">Running tower suitability analysis…</p>
      )}

      {towerAnalysis && (
        <div className="ts-glass rounded-lg p-2 border-2 border-[#0f766e]/40 space-y-1">
          <p className="text-[10px] font-black uppercase text-[#0f766e]">Tower Suitability Analysis</p>
          <p className="text-[11px] font-black">{towerAnalysis.candidate.id}</p>
          <p className="text-[9px] font-mono">
            {towerAnalysis.candidate.latitude.toFixed(6)}, {towerAnalysis.candidate.longitude.toFixed(6)}
          </p>
          <p className="text-[12px] font-mono font-black">
            Overall: {Math.round(towerAnalysis.suitability.finalScore * 10)} / 100
          </p>
          <p className="text-[9px]">
            Geotechnical context — Soil verdict:{' '}
            {formatVerdictLabel(towerAnalysis.geotechnicalContext.soilVerdictAnalysis?.overall.status ?? 'NOT_ASSESSABLE')}
          </p>
          <p className="text-[8px] text-rose-800 italic">
            {towerAnalysis.mandatoryInvestigations.length > 0
              ? 'This candidate remains preliminary until mandatory field investigation is completed.'
              : 'Preliminary GIS screening — verify before design.'}
          </p>
          <p className="text-[9px] font-black uppercase text-amber-900">
            Final status: {towerAnalysis.finalStatus.replace(/_/g, ' ')}
          </p>
        </div>
      )}
    </section>
  )
}
