/**
 * Map SoilGrids source depths → engineering report intervals 0–2 m.
 *
 * Method: thickness-weighted mean of source layers that overlap each report interval.
 * Original sourceDepth labels are preserved. bdod is bulk density only — NEVER soil depth.
 */

import {
  isSoilClassificationFromPlasticity,
  preliminaryMaterialDescription,
  usdaTextureProvenance,
} from './soilClassification'
import { noData, provenance } from './provenance'
import {
  REPORT_DEPTH_INTERVALS,
  SOILGRIDS_SOURCE_DEPTHS,
  type ProvenanceValue,
  type ReportDepthId,
  type SoilProfileInterval,
  type SourceLayerObservation,
} from './types'

const SOURCE = 'ISRIC SoilGrids 2.0'
const DATASET_RES = '~250 m pixel · WCS mean'
const AGG_METHOD =
  'Thickness-weighted mean of SoilGrids source layers overlapping the report interval; coverage = overlapping thickness / interval thickness'

/** Parse SoilGrids labels like "0-5cm", "100-200cm" into metres. */
export function parseSoilGridsDepthLabel(label: string): { fromM: number; toM: number } | null {
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)cm$/i.exec(label.trim())
  if (!m) return null
  return { fromM: Number(m[1]) / 100, toM: Number(m[2]) / 100 }
}

function overlapThickness(
  a0: number,
  a1: number,
  b0: number,
  b1: number
): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

function weightedMean(
  parts: Array<{ weight: number; value: number | null }>
): number | null {
  let wSum = 0
  let vSum = 0
  for (const p of parts) {
    if (p.value == null || !Number.isFinite(p.value) || p.weight <= 0) continue
    wSum += p.weight
    vSum += p.value * p.weight
  }
  if (wSum <= 0) return null
  return vSum / wSum
}

function modelledParam(
  value: number | null,
  unit: string,
  method: string,
  sourceDepths: string[],
  coveragePct: number,
  limitation?: string
): ProvenanceValue<number | null> {
  if (value == null || !Number.isFinite(value)) {
    return noData(
      unit,
      coveragePct <= 0
        ? 'No overlapping SoilGrids source layers for this report interval'
        : 'SoilGrids mean missing for overlapping layers'
    )
  }
  const conf = Math.max(25, Math.min(55, Math.round(30 + coveragePct * 0.25)))
  return provenance(Number(value.toFixed(2)), {
    unit,
    source: `${SOURCE} (${DATASET_RES})`,
    method,
    confidence: conf,
    status: 'MODELLED',
    inputValues: { sourceDepths: sourceDepths.join(', '), overlapCoveragePct: coveragePct },
    assumptions: [
      'SoilGrids values are modelled spatial means, not borehole samples',
      'Report interval may span multiple source depth bands',
    ],
    engineeringLimitation:
      limitation ||
      'Do not treat as laboratory particle-size or Proctor result for the full report interval',
  })
}

export type RawSoilGridsSlice = {
  depthLabel: string
  clayPct: number | null
  sandPct: number | null
  siltPct: number | null
  bulkDensityGcc: number | null
  ph: number | null
  coarseFragPct: number | null
  organicCarbonGkg?: number | null
}

export function toSourceObservations(slices: RawSoilGridsSlice[]): SourceLayerObservation[] {
  const out: SourceLayerObservation[] = []
  for (const s of slices) {
    const parsed = parseSoilGridsDepthLabel(s.depthLabel)
    if (!parsed) continue
    out.push({
      sourceDepth: s.depthLabel,
      depthFromM: parsed.fromM,
      depthToM: parsed.toM,
      sandPct: s.sandPct,
      siltPct: s.siltPct,
      clayPct: s.clayPct,
      // bdod → bulk density only; never reinterpret as depth
      bulkDensityGcc: s.bulkDensityGcc,
      bdodGcc: s.bulkDensityGcc,
      organicCarbonGkg: s.organicCarbonGkg ?? null,
      ph: s.ph,
      coarseFragPct: s.coarseFragPct,
    })
  }
  return out
}

export function buildEngineeringDepthProfile(
  observations: SourceLayerObservation[],
  opts?: {
    measuredIsClassByDepth?: Partial<Record<ReportDepthId, string | null>>
  }
): SoilProfileInterval[] {
  return REPORT_DEPTH_INTERVALS.map((interval) => {
    const overlaps = observations
      .map((obs) => {
        const w = overlapThickness(interval.fromM, interval.toM, obs.depthFromM, obs.depthToM)
        return { obs, w }
      })
      .filter((x) => x.w > 0)

    const sourceDepths = overlaps.map((x) => x.obs.sourceDepth)
    const intervalTh = interval.toM - interval.fromM
    const covered = overlaps.reduce((s, x) => s + x.w, 0)
    const coveragePct = intervalTh > 0 ? Math.min(100, (covered / intervalTh) * 100) : 0

    const pick = (key: keyof SourceLayerObservation) =>
      weightedMean(
        overlaps.map(({ obs, w }) => ({
          weight: w,
          value: typeof obs[key] === 'number' ? (obs[key] as number) : null,
        }))
      )

    const sand = pick('sandPct')
    const silt = pick('siltPct')
    const clay = pick('clayPct')
    const bdod = pick('bdodGcc')
    const ph = pick('ph')
    const cfvo = pick('coarseFragPct')
    const soc = pick('organicCarbonGkg')

    const sandP = modelledParam(
      sand,
      '%',
      AGG_METHOD,
      sourceDepths,
      coveragePct
    )
    const siltP = modelledParam(silt, '%', AGG_METHOD, sourceDepths, coveragePct)
    const clayP = modelledParam(clay, '%', AGG_METHOD, sourceDepths, coveragePct)

    // Coarse fragments (cfvo) ≠ gravel % from sieve — keep separate; gravel stays NO_DATA unless measured
    const cfvoP = modelledParam(
      cfvo,
      '% vol',
      AGG_METHOD,
      sourceDepths,
      coveragePct,
      'SoilGrids cfvo = volumetric coarse fragments — not ASTM gravel % by mass'
    )
    const gravelP = noData(
      '%',
      'Gravel % requires laboratory sieve analysis (IS 2720). SoilGrids cfvo is not gravel %.'
    )

    const bdodP = modelledParam(
      bdod,
      'g/cm³',
      `${AGG_METHOD}; property = oven-dry bulk density (bdod)`,
      sourceDepths,
      coveragePct,
      'bdod is bulk density (g/cm³), NEVER soil depth'
    )

    // SoilGrids bdod is oven-dry bulk density → dry density can be reported as MODELLED same value
    const dryP =
      bdod != null && Number.isFinite(bdod)
        ? provenance(Number(bdod.toFixed(2)), {
            unit: 'g/cm³',
            source: `${SOURCE} bdod`,
            method: 'SoilGrids oven-dry bulk density (bdod) used as dry density proxy',
            confidence: Math.max(25, Math.min(50, Math.round(28 + coveragePct * 0.2))),
            status: 'MODELLED',
            formula: 'ρ_d ≈ bdod (SoilGrids oven-dry bulk density)',
            inputValues: { bdodGcc: Number(bdod.toFixed(2)) },
            assumptions: [
              'SoilGrids bdod target is oven-dry bulk density',
              'Not a Proctor MDD or field dry density measurement',
            ],
            engineeringLimitation: 'Do not use as Proctor MDD. bdod must never be interpreted as depth.',
          })
        : noData('g/cm³', 'No bdod available for dry density proxy')

    const socP = modelledParam(
      soc,
      'g/kg',
      AGG_METHOD,
      sourceDepths,
      coveragePct
    )
    const phP = modelledParam(ph, 'pH', AGG_METHOD, sourceDepths, coveragePct)

    const usda = usdaTextureProvenance(
      sandP.value,
      siltP.value,
      clayP.value
    )
    const measuredClass = opts?.measuredIsClassByDepth?.[interval.id]
    const isClass = isSoilClassificationFromPlasticity(null, null, measuredClass)
    const material = preliminaryMaterialDescription(
      sandP.value,
      siltP.value,
      clayP.value,
      usda.value
    )

    return {
      reportDepth: interval.id,
      reportDepthLabel: interval.label,
      depthFromM: interval.fromM,
      depthToM: interval.toM,
      sourceDepths,
      aggregationMethod: AGG_METHOD,
      overlapCoveragePct: Number(coveragePct.toFixed(1)),
      sandPct: sandP,
      siltPct: siltP,
      clayPct: clayP,
      gravelPct: gravelP,
      coarseFragPct: cfvoP,
      bulkDensityGcc: bdodP,
      dryDensityGcc: dryP,
      organicCarbonGkg: socP,
      ph: phP,
      usdaTexture: usda,
      isSoilClassification: isClass,
      preliminaryMaterialDescription: material,
    }
  })
}

export function emptySourceDepthChecklist(): string[] {
  return [...SOILGRIDS_SOURCE_DEPTHS]
}
