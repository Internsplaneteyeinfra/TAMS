/**
 * Central parameter resolution types — single source for SBC, pile, CBR, resistivity, reports.
 */

import type { GeoDataStatus, ProvenanceValue, ReportDepthId, SoilLayerParameters, SoilProfileInterval } from '../types'

export type ResolutionStatus =
  | 'MEASURED'
  | 'PROJECT_DATA'
  | 'REFERENCE_CALIBRATED'
  | 'GIS_DERIVED'
  | 'SATELLITE_DERIVED'
  | 'ENGINEERING_CORRELATED'
  | 'MODEL_PREDICTED'
  | 'CALCULATED'
  | 'ESTIMATED'

export interface ResolvedParameter<T = number> {
  value: T
  unit: string
  status: ResolutionStatus
  method: string
  sourceChain: string[]
  confidence: number
  uncertaintyRange?: { low: number; high: number } | null
}

export interface LayerEngineeringParameters {
  reportDepth: ReportDepthId
  reportDepthLabel: string
  depthMidM: number
  gravelPct: ResolvedParameter
  sandPct: ResolvedParameter
  siltPct: ResolvedParameter
  clayPct: ResolvedParameter
  liquidLimit: ResolvedParameter
  plasticLimit: ResolvedParameter
  plasticityIndex: ResolvedParameter
  isClassification: ResolvedParameter<string>
  maximumDryDensityGcc: ResolvedParameter
  optimumMoistureContentPct: ResolvedParameter
  dryDensityGcc: ResolvedParameter
  bulkDensityGcc: ResolvedParameter
  freeSwellingIndexPct: ResolvedParameter
  ucsKgCm2: ResolvedParameter
  specificGravity: ResolvedParameter
  cohesionKpa: ResolvedParameter
  frictionAngleDeg: ResolvedParameter
  unitWeightKnM3: ResolvedParameter
  unitWeightTm3: ResolvedParameter
  equivalentSptN: ResolvedParameter
  estimatedCbrPct: ResolvedParameter
  estimatedResistivityOhmM: ResolvedParameter
}

export interface SiteEngineeringParameters {
  cohesionKpa: ResolvedParameter
  frictionAngleDeg: ResolvedParameter
  unitWeightKnM3: ResolvedParameter
  unitWeightTm3: ResolvedParameter
  equivalentSptN: ResolvedParameter
  notes: string[]
}

export interface ResolvedParameterContext {
  version: 'PR-1'
  generatedAt: string
  site: SiteEngineeringParameters
  byLayer: LayerEngineeringParameters[]
}

export interface ParameterResolutionInput {
  profile: SoilProfileInterval[]
  soilLayers: SoilLayerParameters[]
  screeningTextureClass?: string | null
  elevationM?: number | null
  slopeDeg?: number | null
  /** Field measured overrides (same-site ≤250 m) */
  measured?: {
    cohesionKpa?: number | null
    phiDeg?: number | null
    gammaKnM3?: number | null
    sptN?: number | null
  }
  /** Backend / project geotechnical record (G1 fusion) */
  projectData?: import('./projectDataFusion').ProjectGeotechRecord | null
}

export function toProvenance<T extends number | string | null>(
  r: ResolvedParameter<T extends number ? number : string> | ResolvedParameter<number>
): ProvenanceValue<T extends number ? number : string> {
  const status = r.status as GeoDataStatus
  return {
    value: r.value as T extends number ? number : string,
    unit: r.unit,
    source: r.sourceChain[0] ?? 'Parameter resolution engine',
    method: r.method,
    confidence: r.confidence,
    status,
    engineeringLimitation:
      r.status === 'MEASURED'
        ? undefined
        : 'GIS / engineering-correlated estimate — not laboratory or field measurement',
    inputValues: r.uncertaintyRange
      ? { low: r.uncertaintyRange.low, high: r.uncertaintyRange.high }
      : undefined,
  }
}
