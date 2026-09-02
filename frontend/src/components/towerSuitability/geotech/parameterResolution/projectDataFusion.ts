/**
 * G1 — Merge project / backend geotechnical records into resolved parameter context.
 * Higher-quality measured/project values override GIS predictions — never the reverse.
 */

import type { GeotechInvestigation, GeotechSoilLayer } from '@/lib/geotechApi'
import type { ReportDepthId } from '../types'
import { REPORT_DEPTH_INTERVALS } from '../types'
import { predictLayerParameters } from './soilPredictionEngine'
import { fuseNumeric, type SourceCandidate } from './sourceFusion'
import type {
  LayerEngineeringParameters,
  ParameterResolutionInput,
  ResolvedParameter,
  ResolvedParameterContext,
  ResolutionStatus,
  SiteEngineeringParameters,
} from './parameterTypes'

export interface ProjectGeotechRecord {
  siteCode: string
  distanceKm: number
  usedForMeasured: boolean
  investigation?: GeotechInvestigation | null
}

function layerMidM(fromM: number, toM: number): number {
  return (fromM + toM) / 2
}

function reportDepthForMid(midM: number): ReportDepthId {
  if (midM <= 0.5) return '0.0-0.5m'
  if (midM <= 1.0) return '0.5-1.0m'
  if (midM <= 1.5) return '1.0-1.5m'
  return '1.5-2.0m'
}

function overlapM(aFrom: number, aTo: number, bFrom: number, bTo: number): number {
  return Math.max(0, Math.min(aTo, bTo) - Math.max(aFrom, bFrom))
}

/** Map backend soil layers to report depth intervals by maximum overlap. */
export function mapProjectLayersByReportDepth(
  soilLayers: GeotechSoilLayer[] | undefined | null
): Partial<Record<ReportDepthId, GeotechSoilLayer>> {
  const out: Partial<Record<ReportDepthId, GeotechSoilLayer>> = {}
  if (!soilLayers?.length) return out

  for (const iv of REPORT_DEPTH_INTERVALS) {
    let best: GeotechSoilLayer | null = null
    let bestOverlap = 0
    for (const sl of soilLayers) {
      const ov = overlapM(iv.fromM, iv.toM, sl.depth_from_m, sl.depth_to_m)
      if (ov > bestOverlap) {
        bestOverlap = ov
        best = sl
      }
    }
    if (best && bestOverlap > 0) out[iv.id] = best
  }
  return out
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function overrideNumeric(
  predicted: ResolvedParameter,
  value: number | null | undefined,
  status: ResolutionStatus,
  method: string,
  source: string
): ResolvedParameter {
  if (value == null || !Number.isFinite(value)) return predicted
  return fuseNumeric(predicted.unit, [
    { value, status, method, source, weight: 10 },
    {
      value: predicted.value,
      status: predicted.status,
      method: predicted.method,
      source: predicted.sourceChain[0] ?? 'GIS prediction',
      weight: 3,
    },
  ])
}

function mergeProjectLayer(
  predicted: LayerEngineeringParameters,
  projectLayer: GeotechSoilLayer | undefined,
  siteCode: string
): LayerEngineeringParameters {
  if (!projectLayer) return predicted

  const src = `TAMS project ${siteCode}`
  const status: ResolutionStatus = 'PROJECT_DATA'

  const gravel = numOrNull(projectLayer.gravel_pct)
  const sand = numOrNull(projectLayer.sand_pct)
  const silt = numOrNull(projectLayer.silt_pct)
  const clay = numOrNull(projectLayer.clay_pct)

  return {
    ...predicted,
    gravelPct: overrideNumeric(predicted.gravelPct, gravel, status, 'Project soil layer', src),
    sandPct: overrideNumeric(predicted.sandPct, sand, status, 'Project soil layer', src),
    siltPct: overrideNumeric(predicted.siltPct, silt, status, 'Project soil layer', src),
    clayPct: overrideNumeric(predicted.clayPct, clay, status, 'Project soil layer', src),
    liquidLimit: overrideNumeric(predicted.liquidLimit, numOrNull(projectLayer.ll), status, 'Project Atterberg', src),
    plasticLimit: overrideNumeric(predicted.plasticLimit, numOrNull(projectLayer.pl), status, 'Project Atterberg', src),
    plasticityIndex: overrideNumeric(predicted.plasticityIndex, numOrNull(projectLayer.pi), status, 'Project PI', src),
    maximumDryDensityGcc: overrideNumeric(predicted.maximumDryDensityGcc, numOrNull(projectLayer.mdd), status, 'Project lab MDD', src),
    optimumMoistureContentPct: overrideNumeric(
      predicted.optimumMoistureContentPct,
      numOrNull(projectLayer.omc),
      status,
      'Project lab OMC',
      src
    ),
    dryDensityGcc: overrideNumeric(predicted.dryDensityGcc, numOrNull(projectLayer.dry_density), status, 'Project dry density', src),
    bulkDensityGcc: overrideNumeric(predicted.bulkDensityGcc, numOrNull(projectLayer.bulk_density), status, 'Project bulk density', src),
    freeSwellingIndexPct: overrideNumeric(predicted.freeSwellingIndexPct, numOrNull(projectLayer.fsi), status, 'Project FSI', src),
    ucsKgCm2: overrideNumeric(predicted.ucsKgCm2, numOrNull(projectLayer.ucs), status, 'Project UCS', src),
    specificGravity: overrideNumeric(predicted.specificGravity, numOrNull(projectLayer.sg), status, 'Project SG', src),
    estimatedCbrPct: overrideNumeric(predicted.estimatedCbrPct, numOrNull(projectLayer.cbr), status, 'Project CBR', src),
    isClassification: projectLayer.soil_class
      ? {
          value: projectLayer.soil_class,
          unit: 'IS class',
          status,
          method: 'Project soil classification',
          sourceChain: [src],
          confidence: 85,
          uncertaintyRange: null,
        }
      : predicted.isClassification,
  }
}

function extractSiteMeasured(input: ParameterResolutionInput): {
  cohesionKpa?: number | null
  phiDeg?: number | null
  gammaKnM3?: number | null
  sptN?: number | null
} {
  const user = input.measured ?? {}
  const project = input.projectData
  if (!project?.usedForMeasured) return user

  const dp = project.investigation?.design_params as Record<string, unknown> | undefined
  const cTm2 = numOrNull(dp?.c_tm2)
  const phi = numOrNull(dp?.phi_deg)
  const gammaTm3 = numOrNull(dp?.gamma_tm3)
  const spt = numOrNull(dp?.spt_n ?? dp?.equivalent_spt_n)

  return {
    cohesionKpa: user.cohesionKpa ?? (cTm2 != null ? cTm2 * 9.81 : null),
    phiDeg: user.phiDeg ?? phi,
    gammaKnM3: user.gammaKnM3 ?? (gammaTm3 != null ? gammaTm3 * 9.81 : null),
    sptN: user.sptN ?? spt,
  }
}

function buildSiteParameters(
  byLayer: LayerEngineeringParameters[],
  measured: ReturnType<typeof extractSiteMeasured>,
  project?: ProjectGeotechRecord | null
): SiteEngineeringParameters {
  const primary = byLayer.find((l) => l.reportDepth === '1.0-1.5m') ?? byLayer[1] ?? byLayer[0]

  const projectSrc = project?.siteCode ? `TAMS project ${project.siteCode}` : 'Project measured'

  const cohesionCandidates: SourceCandidate[] = [
    measured.cohesionKpa != null
      ? {
          value: measured.cohesionKpa,
          status: project?.usedForMeasured ? 'PROJECT_DATA' : 'MEASURED',
          method: 'Field / project investigation',
          source: projectSrc,
          weight: 10,
        }
      : null,
    primary
      ? {
          value: primary.cohesionKpa.value,
          status: primary.cohesionKpa.status,
          method: primary.cohesionKpa.method,
          source: primary.cohesionKpa.sourceChain[0] ?? 'Layer prediction',
          weight: 5,
        }
      : null,
  ].filter(Boolean) as SourceCandidate[]

  const phiCandidates: SourceCandidate[] = [
    measured.phiDeg != null
      ? {
          value: measured.phiDeg,
          status: project?.usedForMeasured ? 'PROJECT_DATA' : 'MEASURED',
          method: 'Field / project investigation',
          source: projectSrc,
          weight: 10,
        }
      : null,
    primary
      ? {
          value: primary.frictionAngleDeg.value,
          status: primary.frictionAngleDeg.status,
          method: primary.frictionAngleDeg.method,
          source: 'Layer prediction',
          weight: 5,
        }
      : null,
  ].filter(Boolean) as SourceCandidate[]

  const gammaCandidates: SourceCandidate[] = [
    measured.gammaKnM3 != null
      ? {
          value: measured.gammaKnM3,
          status: project?.usedForMeasured ? 'PROJECT_DATA' : 'MEASURED',
          method: 'Field / project investigation',
          source: projectSrc,
          weight: 10,
        }
      : null,
    primary
      ? {
          value: primary.unitWeightKnM3.value,
          status: primary.unitWeightKnM3.status,
          method: primary.unitWeightKnM3.method,
          source: 'SoilGrids density',
          weight: 5,
        }
      : null,
  ].filter(Boolean) as SourceCandidate[]

  const sptCandidates: SourceCandidate[] = [
    measured.sptN != null
      ? {
          value: measured.sptN,
          status: project?.usedForMeasured ? 'PROJECT_DATA' : 'MEASURED',
          method: 'Field SPT / project record',
          source: projectSrc,
          weight: 10,
        }
      : null,
    primary
      ? {
          value: primary.equivalentSptN.value,
          status: primary.equivalentSptN.status,
          method: primary.equivalentSptN.method,
          source: 'GIS equivalent SPT',
          weight: 4,
        }
      : null,
  ].filter(Boolean) as SourceCandidate[]

  const cohesion = fuseNumeric('kPa', cohesionCandidates)
  const phi = fuseNumeric('°', phiCandidates)
  const gammaKn = fuseNumeric('kN/m³', gammaCandidates)
  const sptN = fuseNumeric('—', sptCandidates)

  return {
    cohesionKpa: cohesion,
    frictionAngleDeg: phi,
    unitWeightKnM3: gammaKn,
    unitWeightTm3: {
      ...gammaKn,
      value: Number((gammaKn.value / 9.81).toFixed(3)),
      unit: 'T/m³',
      method: 'γ (T/m³) = γ (kN/m³) / 9.81',
    },
    equivalentSptN: sptN,
    notes: [
      'Central parameter resolution PR-1 + G1 project fusion',
      project?.usedForMeasured
        ? `Project data from ${project.siteCode} (${project.distanceKm.toFixed(2)} km) overrides GIS where available`
        : 'GIS / correlation / model — no same-site project override',
    ],
  }
}

/** Single entry: predict → merge project layers → fuse site parameters. */
export function mergeResolvedParameters(input: ParameterResolutionInput): ResolvedParameterContext {
  const { profile, soilLayers, screeningTextureClass, projectData } = input
  const projectLayers = mapProjectLayersByReportDepth(projectData?.investigation?.soil_layers)
  const siteCode = projectData?.siteCode ?? 'project'

  const byLayer: LayerEngineeringParameters[] = soilLayers.map((layer) => {
    const prof = profile.find((p) => p.reportDepth === layer.reportDepth)
    const mid = layerMidM(layer.depthFromM, layer.depthToM)
    const predicted = predictLayerParameters(layer, prof, screeningTextureClass ?? null, mid)
    const pl = projectData?.usedForMeasured ? projectLayers[layer.reportDepth] : undefined
    return mergeProjectLayer(predicted, pl, siteCode)
  })

  const measured = extractSiteMeasured(input)
  const site = buildSiteParameters(byLayer, measured, projectData)

  return {
    version: 'PR-1',
    generatedAt: new Date().toISOString(),
    site,
    byLayer,
  }
}

/** Build measured CBR map from project cbr_by_depth when same-site match. */
export function mapProjectCbrByDepth(
  investigation: GeotechInvestigation | null | undefined
): Partial<Record<ReportDepthId, number>> {
  const out: Partial<Record<ReportDepthId, number>> = {}
  if (!investigation?.cbr_by_depth?.length) return out

  for (const row of investigation.cbr_by_depth) {
    const mid = layerMidM(row.depth_from_m, row.depth_to_m)
    const id = reportDepthForMid(mid)
    if (Number.isFinite(row.cbr_pct)) out[id] = row.cbr_pct
  }
  return out
}
