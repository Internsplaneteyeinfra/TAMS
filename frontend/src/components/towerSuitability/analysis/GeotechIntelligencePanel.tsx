import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import type { GeotechnicalIntelligence, GeoDataStatus, ProvenanceValue } from '../geotech'
import type { SoilScreening } from '../soilScreening'
import {
  defaultGeotechDocxInput,
  downloadCachedGeotechDocx,
  downloadGeotechInvestigationDocx,
  downloadTransmissionLineReport,
  type GeotechDocxInput,
  ReportValidationError,
} from '../geotech'
import {
  buildSoilScreeningReportHtml,
  downloadSoilScreeningReport,
  type SoilReportOpts,
} from '../downloadSoilScreeningReport'
import { Download, Eye, FileText, Loader2, X } from 'lucide-react'
import BoreholePlanningPanel from './BoreholePlanningPanel'
import SbcAnalysisPanel from './SbcAnalysisPanel'
import PileAnalysisPanel from './PileAnalysisPanel'
import CbrResistivityPanel from './CbrResistivityPanel'
import SoilVerdictPanel from './SoilVerdictPanel'
import PostSoilActionPanel from './PostSoilActionPanel'
import TowerPlanningPanel, { type TowerPlanningPanelProps } from './TowerPlanningPanel'
import SignalStatusPanel from './SignalStatusPanel'
import FullGeotechAnalysisModal from './FullGeotechAnalysisModal'
import type { SiteSignals } from '../scoring'
import type { TowerCandidate } from '../towerPlanning/types'

function StatusBadge({ status }: { status: GeoDataStatus }) {
  const colors: Record<string, string> = {
    MEASURED: 'bg-emerald-100 text-emerald-800',
    MODELLED: 'bg-sky-100 text-sky-800',
    DERIVED: 'bg-indigo-100 text-indigo-800',
    CALCULATED: 'bg-violet-100 text-violet-800',
    ESTIMATED: 'bg-amber-100 text-amber-900',
    NO_DATA: 'bg-slate-100 text-slate-600',
    FIELD_TEST_REQUIRED: 'bg-rose-100 text-rose-800',
    OUT_OF_RANGE: 'bg-orange-100 text-orange-900',
    INSUFFICIENT_DATA: 'bg-slate-100 text-slate-600',
    GIS_DERIVED: 'bg-teal-100 text-teal-800',
    SATELLITE_DERIVED: 'bg-cyan-100 text-cyan-800',
    ENGINEERING_CORRELATED: 'bg-purple-100 text-purple-800',
    MODEL_PREDICTED: 'bg-sky-100 text-sky-800',
  }
  const label =
    status === 'NO_DATA'
      ? 'NO DATA'
      : status === 'FIELD_TEST_REQUIRED'
        ? 'FIELD TEST REQUIRED'
        : status === 'INSUFFICIENT_DATA'
          ? 'INSUFFICIENT DATA'
          : status
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
        colors[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </span>
  )
}

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number(v.toFixed(digits)).toString()
}

function ParamCell({
  label,
  p,
}: {
  label: string
  p: ProvenanceValue<number | string | null> | ProvenanceValue<{ low: number; high: number } | null> | undefined
}) {
  if (!p) {
    return (
      <div className="flex items-start justify-between gap-2 border-b border-[rgba(51,65,85,0.08)] py-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[#263238]">{label}</p>
          <p className="text-[11px] font-mono tabular-nums">—</p>
        </div>
        <StatusBadge status="NO_DATA" />
      </div>
    )
  }
  let display = '—'
  if (p.value != null) {
    if (typeof p.value === 'object' && 'low' in p.value && 'high' in p.value) {
      display = `${p.value.low}–${p.value.high}`
    } else {
      display = String(p.value)
    }
  }
  return (
    <div className="flex items-start justify-between gap-2 border-b border-[rgba(51,65,85,0.08)] py-1">
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-[#263238]">{label}</p>
        <p className="text-[11px] font-mono tabular-nums">
          {display}
          {p.unit && p.value != null ? ` ${p.unit}` : ''}
        </p>
      </div>
      <StatusBadge status={p.status} />
    </div>
  )
}

export default function GeotechIntelligencePanel({
  geo,
  geotechDocxInput = null,
  docxReady = false,
  docxBuilding = false,
  soilReportOpts = null,
  towerPlanning = null,
  soilScreening: _soilScreening = null,
  selectedBoreholeId = null,
  onSelectBorehole,
  siteSignals = null,
  siteLat = 0,
  siteLon = 0,
  siteLabel = 'Site',
  towerCandidates = [],
  powerChecked = false,
}: {
  geo: GeotechnicalIntelligence | null | undefined
  geotechDocxInput?: GeotechDocxInput | null
  /** True when Word report was pre-built in background after analyze */
  docxReady?: boolean
  /** True while Word report is being built */
  docxBuilding?: boolean
  soilReportOpts?: SoilReportOpts | null
  towerPlanning?: TowerPlanningPanelProps | null
  soilScreening?: SoilScreening | null
  selectedBoreholeId?: string | null
  onSelectBorehole?: (boreholeId: string) => void
  siteSignals?: SiteSignals | null
  siteLat?: number
  siteLon?: number
  siteLabel?: string
  towerCandidates?: TowerCandidate[]
  powerChecked?: boolean
}) {
  const [docxBusy, setDocxBusy] = useState(false)
  const [docxError, setDocxError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [fullAnalysisOpen, setFullAnalysisOpen] = useState(false)
  const [geoTab, setGeoTab] = useState<
    'plan' | 'profile' | 'summary' | 'params' | 'sbc' | 'pile' | 'cbr' | 'resistivity' | 'verdict'
  >('plan')
  const reportLoading = docxBuilding || docxBusy

  const previewHtml = useMemo(
    () => (soilReportOpts?.soil ? buildSoilScreeningReportHtml(soilReportOpts) : ''),
    [soilReportOpts]
  )

  useEffect(() => {
    if (!previewOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewOpen])

  if (!geo) {
    return (
      <div className="space-y-2 text-[#263238]">
        <p className="text-sm font-black">Geotechnical Intelligence</p>
        <p className="text-[12px] text-[#66727a]">
          Run Analyze to build the additive GEO-1 soil profile. This does not change the production
          suitability score.
        </p>
      </div>
    )
  }

  const eng = geo.engineeringParameterEstimation

  const downloadDocx = async () => {
    setDocxBusy(true)
    setDocxError(null)
    try {
      const input = geotechDocxInput ?? defaultGeotechDocxInput(geo)
      if (docxReady) {
        await downloadCachedGeotechDocx(input)
      } else {
        await downloadGeotechInvestigationDocx(input)
      }
    } catch (e) {
      if (e instanceof ReportValidationError) {
        const msgs = e.result.issues
          .filter((i) => i.severity === 'critical')
          .map((i) => i.message)
          .slice(0, 3)
        setDocxError(`Report validation failed: ${msgs.join(' · ')}`)
      } else {
        setDocxError(e instanceof Error ? e.message : 'Report download failed')
      }
    } finally {
      setDocxBusy(false)
    }
  }

  const downloadPdf = () => {
    const input = geotechDocxInput ?? defaultGeotechDocxInput(geo)
    downloadTransmissionLineReport(input)
  }

  const downloadHtml = () => {
    if (!soilReportOpts?.soil) return
    downloadSoilScreeningReport(soilReportOpts)
  }

  return (
    <div className="space-y-3 text-[#263238]">
      <SignalStatusPanel signals={siteSignals} />

      <div>
        <p className="text-sm font-black">Geotechnical Intelligence</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#17879a] mt-0.5">
          {geo.reportClassification.replace(/_/g, ' ')}
        </p>
        <p className="text-[10px] text-[#66727a] mt-1">
          Version {geo.version} · additive only · score unchanged
        </p>
      </div>

      <section className="ts-glass rounded-lg p-2.5 space-y-2 border border-[#0f766e]/20 relative overflow-hidden">
        <p className="text-[10px] font-black uppercase text-[#0f766e]">Download reports</p>

        {reportLoading && (
          <div
            className="flex items-center gap-2.5 rounded-lg border border-[#0f766e]/30 bg-[#ecfdf5] px-2.5 py-2.5"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#0f766e]" />
            <div className="min-w-0">
              <p className="text-[11px] font-black text-[#0f766e]">
                {docxBusy ? 'Downloading report…' : 'Preparing Word report…'}
              </p>
              <p className="text-[9px] text-[#66727a] leading-snug mt-0.5">
                {docxBusy
                  ? 'Saving file to your device'
                  : 'Building investigation DOCX in background — usually a few seconds'}
              </p>
            </div>
          </div>
        )}

        {!reportLoading && docxReady && (
          <p className="text-[10px] font-semibold text-[#27856b]">Word report ready — instant download</p>
        )}

        {!reportLoading && !docxReady && (
          <p className="text-[10px] text-[#b97816]">Report will be ready shortly after analyze</p>
        )}

        <button
          type="button"
          onClick={() => void downloadDocx()}
          disabled={reportLoading}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg bg-[#0f766e] text-white text-[11px] font-black hover:bg-[#0d9488] disabled:opacity-50"
        >
          {reportLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          {reportLoading ? 'Please wait…' : 'Download Word investigation (.docx)'}
        </button>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={reportLoading}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 rounded-lg border border-[#0f766e] bg-white text-[#0f766e] text-[11px] font-black hover:bg-[#ecfdf5] disabled:opacity-50"
        >
          {reportLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Download PDF report (landscape)
        </button>
        {docxError && (
          <p className="text-[10px] text-rose-700 font-semibold leading-snug" role="alert">
            {docxError}
          </p>
        )}
        <p className="text-[9px] text-[#66727a] leading-snug">
          Transmission-line format: cover, scope, soil tables — all landscape. PDF opens print dialog (Save as PDF).
        </p>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!soilReportOpts?.soil || reportLoading}
          className="inline-flex w-full items-center justify-center gap-1.5 h-8 rounded-lg border border-[#0f766e] text-[#0f766e] text-[10px] font-black hover:bg-[#ecfdf5] disabled:opacity-50"
        >
          {reportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
          Preview screening HTML
        </button>
        <button
          type="button"
          onClick={downloadHtml}
          disabled={!soilReportOpts?.soil || reportLoading}
          className="inline-flex w-full items-center justify-center gap-1.5 h-8 rounded-lg border border-[rgba(51,65,85,0.2)] text-[#66727a] text-[10px] font-bold hover:bg-[#f8fafc] disabled:opacity-50"
        >
          {reportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Download screening HTML
        </button>
        <button
          type="button"
          onClick={() => setFullAnalysisOpen(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 h-8 rounded-lg border border-[#17879a] bg-[#17879a]/10 text-[#126b79] text-[10px] font-black hover:bg-[#17879a]/20"
        >
          <Eye className="h-3 w-3" />
          Open full analysis
        </button>
      </section>

      {geo.soilScreeningSummary && (
        <section className="ts-glass rounded-lg p-2.5 space-y-0.5 border border-amber-200/70 bg-amber-50/50">
          <p className="text-[10px] font-black uppercase text-amber-950">
            Available GIS data (populated for this site)
          </p>
          <ParamCell label="SoilGrids texture (0–30 cm)" p={geo.soilScreeningSummary.textureClass} />
          <ParamCell label="Indicative SBC range" p={geo.soilScreeningSummary.indicativeSbcTm2} />
          <ParamCell label="Indicative CBR range" p={geo.soilScreeningSummary.indicativeCbrPct} />
          <ParamCell label="Screening confidence" p={geo.soilScreeningSummary.confidencePct} />
          {geo.siteContext && (
            <>
              <ParamCell label="Nearest road" p={geo.siteContext.roadKm} />
              <ParamCell label="Nearest water" p={geo.siteContext.waterKm} />
              <ParamCell label="Wind (mean)" p={geo.siteContext.windMs} />
            </>
          )}
          <p className="text-[9px] text-amber-950 leading-snug mt-1">
            Live SoilGrids + texture screening — ESTIMATED for planning, not laboratory MEASURED values.
            Re-download Word report after analyze to get §1.1 Available Data Inventory.
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ['plan', 'Investigation Plan'],
            ['profile', 'Soil Profile'],
            ['summary', 'Soil Summary'],
            ['params', 'Engineering Parameters'],
            ['sbc', 'SBC Analysis'],
            ['pile', 'Pile Analysis'],
            ['cbr', 'CBR'],
            ['resistivity', 'Earth Resistivity'],
            ['verdict', 'Soil Verdict'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGeoTab(id)}
            className={`px-2 py-1 rounded text-[9px] font-black ${
              geoTab === id ? 'bg-[#0f766e] text-white' : 'bg-white/50 border border-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {geoTab === 'plan' && (
        <BoreholePlanningPanel
          plan={geo.boreholeInvestigationPlan}
          selectedBoreholeId={selectedBoreholeId}
          onSelectBorehole={onSelectBorehole}
        />
      )}

      {geoTab === 'profile' && (
        <>
      {geo.soilLayerParameters && geo.soilLayerParameters.length > 0 && (
        <section className="space-y-1">
          <p className="text-[10px] font-black uppercase">Soil parameters (Phase C)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] border-collapse">
              <thead>
                <tr className="bg-[#ecfdf5] text-left">
                  <th className="p-1 border border-slate-200">Depth</th>
                  <th className="p-1 border border-slate-200">G</th>
                  <th className="p-1 border border-slate-200">Sa</th>
                  <th className="p-1 border border-slate-200">Si</th>
                  <th className="p-1 border border-slate-200">Cl</th>
                  <th className="p-1 border border-slate-200">Σ</th>
                  <th className="p-1 border border-slate-200">LL</th>
                  <th className="p-1 border border-slate-200">PL</th>
                  <th className="p-1 border border-slate-200">PI</th>
                  <th className="p-1 border border-slate-200">Class</th>
                </tr>
              </thead>
              <tbody>
                {geo.soilLayerParameters.map((row) => (
                  <tr key={row.reportDepth}>
                    <td className="p-1 border border-slate-200 font-bold">{row.reportDepthLabel}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.gravelPct.value)}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.sandPct.value)}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.siltPct.value)}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.clayPct.value)}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.grainSizeSumPct.value)}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.liquidLimit.value)}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.plasticLimit.value)}</td>
                    <td className="p-1 border border-slate-200">{fmtNum(row.plasticityIndex.value)}</td>
                    <td className="p-1 border border-slate-200 text-[7px]">
                      {row.soilClassification.value ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-[#66727a]">
            PI = LL − PL (calculated). IS 1498 class reproducible from displayed G/Sa/Si/Cl + LL + PI.
          </p>
        </section>
      )}

      <section className="space-y-1">
        <p className="text-[10px] font-black uppercase">Soil profile (0–2 m)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-[#ecfdf5] text-left">
                <th className="p-1 border border-slate-200">Depth</th>
                <th className="p-1 border border-slate-200">Sand</th>
                <th className="p-1 border border-slate-200">Silt</th>
                <th className="p-1 border border-slate-200">Clay</th>
                <th className="p-1 border border-slate-200">ρd</th>
                <th className="p-1 border border-slate-200">Texture</th>
                <th className="p-1 border border-slate-200">Status</th>
              </tr>
            </thead>
            <tbody>
              {geo.soilProfile.map((row) => (
                <tr key={row.reportDepth}>
                  <td className="p-1 border border-slate-200 font-bold">{row.reportDepthLabel}</td>
                  <td className="p-1 border border-slate-200">{fmtNum(row.sandPct.value)}</td>
                  <td className="p-1 border border-slate-200">{fmtNum(row.siltPct.value)}</td>
                  <td className="p-1 border border-slate-200">{fmtNum(row.clayPct.value)}</td>
                  <td className="p-1 border border-slate-200">{fmtNum(row.dryDensityGcc.value, 2)}</td>
                  <td className="p-1 border border-slate-200">{row.usdaTexture.value ?? '—'}</td>
                  <td className="p-1 border border-slate-200">
                    <StatusBadge status={row.sandPct.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-[#66727a]">
          Source depths preserved per interval. Aggregation: thickness-weighted SoilGrids overlap.
          Gravel % and IS class remain NO DATA / INSUFFICIENT without lab tests.
        </p>
      </section>
        </>
      )}

      {geoTab === 'summary' && geo.soilTestSummary && (
        <section className="ts-glass rounded-lg p-2.5 space-y-1">
          <p className="text-[10px] font-black uppercase">Soil test summary (Phase D)</p>
          <p className="text-[10px] font-mono">
            {geo.soilTestSummary.totalRecords} record(s) · generated{' '}
            {new Date(geo.soilTestSummary.generatedAt).toLocaleString()}
          </p>
          {geo.soilTestSummary.validationNotes.map((n) => (
            <p key={n} className="text-[9px] text-[#66727a] leading-snug">
              {n}
            </p>
          ))}
        </section>
      )}

      {geoTab === 'sbc' && <SbcAnalysisPanel geo={geo} />}

      {geoTab === 'pile' && <PileAnalysisPanel geo={geo} />}

      {geoTab === 'params' && (
        <section className="ts-glass rounded-lg p-2.5 space-y-0.5">
          <p className="text-[10px] font-black uppercase mb-1">Resolved engineering parameters (PR-1)</p>
          <p className="text-[9px] text-[#66727a] mb-1 leading-snug">
            GIS / correlation / project data fusion. Click status badge for provenance in report appendix.
          </p>
          <ParamCell label="Unit weight γ" p={eng.gammaKnM3} />
          <ParamCell label="Dry density" p={eng.dryDensityGcc} />
          <ParamCell label="Predicted friction angle φ" p={eng.phiDeg} />
          <ParamCell label="Predicted cohesion c" p={eng.cohesionKpa} />
          {geo.resolvedParameterContext?.byLayer[0] && (
            <ParamCell
              label="GIS-predicted equivalent SPT N"
              p={{
                value: geo.resolvedParameterContext.site.equivalentSptN.value,
                unit: '—',
                source: geo.resolvedParameterContext.site.equivalentSptN.sourceChain[0] ?? 'PR-1',
                method: geo.resolvedParameterContext.site.equivalentSptN.method,
                confidence: geo.resolvedParameterContext.site.equivalentSptN.confidence,
                status: geo.resolvedParameterContext.site.equivalentSptN.status as GeoDataStatus,
              }}
            />
          )}
          {geo.parameterCompleteness && (
            <p className="text-[9px] text-[#66727a] mt-2">
              Parameter completeness: {geo.parameterCompleteness.completionPct}% (
              {geo.parameterCompleteness.completeParameters.length} resolved)
            </p>
          )}
        </section>
      )}

      {geoTab === 'cbr' && <CbrResistivityPanel geo={geo} mode="cbr" />}

      {geoTab === 'resistivity' && <CbrResistivityPanel geo={geo} mode="resistivity" />}

      {geoTab === 'verdict' && (
        <>
          <SoilVerdictPanel geo={geo} />
          {geo.soilVerdictAnalysis && geo.foundationRecommendation && towerPlanning && (
            <PostSoilActionPanel
              verdict={geo.soilVerdictAnalysis}
              foundationRecommendation={geo.foundationRecommendation}
              onCreateTransmissionLine={towerPlanning.onCreateTransmissionLine}
              onCreateInvestigationPolygon={towerPlanning.onCreateInvestigationArea}
              onCheckTowerSuitability={towerPlanning.onCheckTowerSuitability}
            />
          )}
          {towerPlanning && <TowerPlanningPanel {...towerPlanning} />}
        </>
      )}

      {geoTab === 'plan' && (
        <>
      <section className="space-y-1">
        <p className="text-[10px] font-black uppercase">Field investigation match</p>
        <p className="text-[11px] leading-relaxed">{geo.fieldInvestigationMatch.reason}</p>
        <p className="text-[9px] text-[#66727a] leading-snug">
          TAMS searches the geotech database for borehole investigations within 5 km. Only investigations
          within 250 m can transfer MEASURED lab values to this site. Add field/lab data at{' '}
          <strong>/geotech</strong> with SPT, Atterberg, SBC, CBR, and resistivity to fill missing fields.
        </p>
      </section>

      <section className="space-y-1">
        <p className="text-[10px] font-black uppercase">Limitations</p>
        <ul className="list-disc pl-4 space-y-0.5">
          {geo.limitations.slice(0, 6).map((L) => (
            <li key={L.slice(0, 40)} className="text-[10px] text-[#66727a] leading-snug">
              {L}
            </li>
          ))}
        </ul>
      </section>

      <section className="ts-glass rounded-lg p-2.5">
        <p className="text-[10px] font-black uppercase mb-1">Missing critical data — how to obtain</p>
        <table className="w-full text-[9px] border-collapse">
          <thead>
            <tr className="bg-[#ecfdf5] text-left">
              <th className="p-1 border border-slate-200">Parameter</th>
              <th className="p-1 border border-slate-200">How to fill</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['SPT_N_VALUE', 'Borehole SPT test (IS 2131) — enter in /geotech soil layers'],
              ['DIRECT_SHEAR_PARAMETERS', 'Lab direct shear / triaxial (c, φ) — /geotech design_params'],
              ['GROUNDWATER_LEVEL', 'Field observation during boring — /geotech groundwater_note'],
              ['FIELD_EARTH_RESISTIVITY', 'Wenner test (IS 3043) — /geotech resistivity'],
              ['ATTERBERG_LIMITS', 'Lab LL, PL, PI (IS 2720) — /geotech soil_layers'],
              ['SOAKED_CBR', 'Lab soaked CBR (IS 2720) — /geotech cbr_by_depth'],
            ].map(([param, how]) => (
              <tr key={param}>
                <td className="p-1 border border-slate-200 font-mono font-bold">{param}</td>
                <td className="p-1 border border-slate-200">{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
        </>
      )}

      {previewOpen &&
        soilReportOpts &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[5000] flex flex-col bg-[#0b1720]/60 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Soil screening preview"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700/80 bg-[#0e172a] px-4 py-3 text-white shadow-lg">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wider text-teal-300">
                  Soil screening preview
                </p>
                <p className="truncate text-[12px] text-slate-300">{soilReportOpts.siteLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={downloadHtml}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-[11px] font-black text-white hover:bg-[#0d9488]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download HTML
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-[#e8eef2] p-3 sm:p-5">
              <iframe
                title="Soil screening preview"
                className="h-full w-full rounded-xl border border-slate-300 bg-white shadow-xl"
                srcDoc={previewHtml}
              />
            </div>
          </div>,
          document.body
        )}
      <FullGeotechAnalysisModal
        open={fullAnalysisOpen}
        onClose={() => setFullAnalysisOpen(false)}
        siteLabel={siteLabel}
        lat={siteLat}
        lon={siteLon}
        geo={geo}
        signals={siteSignals}
        towerCandidates={towerCandidates}
        powerChecked={powerChecked}
      />
    </div>
  )
}
