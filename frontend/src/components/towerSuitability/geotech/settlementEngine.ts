/**
 * Settlement screening (Phase G4).
 * Elastic settlement estimate only when foundation load + modulus inputs exist.
 * Without tower load → TOWER_LOAD_REQUIRED (never invent a settlement mm).
 *
 * Methodology: elastic settlement screening form of
 *   Si = q B (1−ν²) / Es · If   (IS 8009 / elastic theory screening)
 * Not a substitute for consolidation or IS code full settlement analysis.
 */

import { noData, provenance } from './provenance'
import type { GeoDataStatus, ProvenanceValue } from './types'
import type { SbcFoundationInputs } from './sbcEngine'

export type SettlementCalculationStatus =
  | 'TOWER_LOAD_REQUIRED'
  | 'INSUFFICIENT_DATA'
  | 'CALCULATED'
  | 'OUT_OF_RANGE'

export interface TowerLoadInput {
  /** Vertical service load on foundation (tonnes) — from tower structural design */
  verticalLoadT: number | null
  /** Or contact pressure (T/m²) if known directly */
  contactPressureTm2: number | null
  source: string
  status: GeoDataStatus
}

export interface SettlementSoilInputs {
  /** Young's modulus Es (T/m²) — MEASURED or ESTIMATED */
  esTm2: number | null
  esStatus: GeoDataStatus
  esSource: string
  esMethod: string
  poissonRatio: number | null
  poissonStatus: GeoDataStatus
  influenceFactorIf: number | null
  influenceStatus: GeoDataStatus
}

export interface SettlementStep {
  step: number
  name: string
  formula: string
  inputs: Record<string, number | string | null>
  result: number | string | null
  unit: string
  notes?: string
}

export interface SettlementAnalysisResult {
  calculationStatus: SettlementCalculationStatus
  message: string
  codeReference: string
  requiredInputs: string[]
  missingInputs: string[]
  readiness: {
    hasFoundationGeometry: boolean
    hasTowerLoad: boolean
    hasModulus: boolean
    hasPoisson: boolean
    hasInfluenceFactor: boolean
    canCalculate: boolean
  }
  /** Placeholder interface for future structural load injection */
  towerLoadPlaceholder: {
    verticalLoadT: number | null
    contactPressureTm2: number | null
    note: string
  }
  foundation: {
    widthM: number
    lengthM: number
    depthM: number
    assumedDefaults: boolean
  }
  soilInputs: SettlementSoilInputs
  steps: SettlementStep[]
  settlementMm: ProvenanceValue<number | null>
  allowableSettlementMm: number | null
  settlementStatus: 'Safe' | 'Review' | 'NotAssessed' | null
  assumptions: string[]
}

const REQUIRED = [
  'TOWER_FOUNDATION_LOAD',
  'FOUNDATION_DIMENSIONS',
  'SOIL_MODULUS_OR_EQUIVALENT',
  'POISSON_RATIO',
  'INFLUENCE_FACTOR',
] as const

/**
 * Es from SPT is common (e.g. Es ≈ α N) — we refuse without SPT.
 * Texture-based Es mid-ranges exist in handbooks but are very weak → we do NOT auto-estimate
 * Es from texture alone (would fabricate stiffness). Leave FIELD_TEST_REQUIRED / NO_DATA.
 */
export function resolveSettlementSoilInputs(opts?: {
  esTm2?: number | null
  esStatus?: GeoDataStatus
  esSource?: string
  esMethod?: string
  poissonRatio?: number | null
}): SettlementSoilInputs {
  const es =
    opts?.esTm2 != null && Number.isFinite(opts.esTm2)
      ? {
          esTm2: opts.esTm2,
          esStatus: opts.esStatus ?? 'MEASURED',
          esSource: opts.esSource ?? 'Engineer-supplied modulus',
          esMethod: opts.esMethod ?? 'Provided Es',
        }
      : {
          esTm2: null as number | null,
          esStatus: 'FIELD_TEST_REQUIRED' as GeoDataStatus,
          esSource: 'none',
          esMethod: 'Es requires plate load / SPT correlation / lab — not invented from SoilGrids',
        }

  // Poisson ratio: for drained sandy soils ν≈0.3 is a common screening assumption
  const poisson =
    opts?.poissonRatio != null && Number.isFinite(opts.poissonRatio)
      ? {
          poissonRatio: opts.poissonRatio,
          poissonStatus: 'MEASURED' as GeoDataStatus,
        }
      : {
          poissonRatio: 0.3,
          poissonStatus: 'ESTIMATED' as GeoDataStatus,
        }

  // Influence factor If for flexible square footing on deep deposit ≈ 0.82–0.88 (screening)
  return {
    ...es,
    poissonRatio: poisson.poissonRatio,
    poissonStatus: poisson.poissonStatus,
    influenceFactorIf: 0.82,
    influenceStatus: 'ESTIMATED',
  }
}

export function emptyTowerLoad(): TowerLoadInput {
  return {
    verticalLoadT: null,
    contactPressureTm2: null,
    source: 'none',
    status: 'NO_DATA',
  }
}

export function runSettlementAnalysis(opts: {
  foundation: SbcFoundationInputs
  foundationDepthM?: number
  towerLoad?: TowerLoadInput
  soil?: SettlementSoilInputs
  allowableSettlementMm?: number | null
}): SettlementAnalysisResult {
  const foundation = opts.foundation
  const Df = opts.foundationDepthM ?? 1.5
  const load = opts.towerLoad ?? emptyTowerLoad()
  const soil = opts.soil ?? resolveSettlementSoilInputs()
  const allowable = opts.allowableSettlementMm ?? foundation.allowableSettlementMm ?? 25

  const assumptions: string[] = [
    'Elastic settlement screening: Si = q·B·(1−ν²)/Es · If',
    'Not a full consolidation settlement analysis (IS 8009 Part 1)',
    'No secondary compression / creep included',
    foundation.assumedScreeningDefaults
      ? 'Foundation geometry is screening default'
      : 'Foundation geometry from provided inputs',
  ]

  const hasGeometry = foundation.widthM > 0 && foundation.lengthM > 0
  const hasLoad =
    (load.verticalLoadT != null && load.verticalLoadT > 0) ||
    (load.contactPressureTm2 != null && load.contactPressureTm2 > 0)
  const hasModulus = soil.esTm2 != null && soil.esTm2 > 0
  const hasPoisson = soil.poissonRatio != null && Number.isFinite(soil.poissonRatio)
  const hasIf = soil.influenceFactorIf != null && Number.isFinite(soil.influenceFactorIf)

  const missing: string[] = []
  if (!hasLoad) missing.push('TOWER_FOUNDATION_LOAD')
  if (!hasGeometry) missing.push('FOUNDATION_DIMENSIONS')
  if (!hasModulus) missing.push('SOIL_MODULUS_OR_EQUIVALENT')
  if (!hasPoisson) missing.push('POISSON_RATIO')
  if (!hasIf) missing.push('INFLUENCE_FACTOR')

  const readiness = {
    hasFoundationGeometry: hasGeometry,
    hasTowerLoad: hasLoad,
    hasModulus,
    hasPoisson,
    hasInfluenceFactor: hasIf,
    canCalculate: missing.length === 0,
  }

  const base = {
    codeReference:
      'Elastic settlement screening (form consistent with IS 8009 elastic approach) — preliminary only',
    requiredInputs: [...REQUIRED],
    missingInputs: missing,
    readiness,
    towerLoadPlaceholder: {
      verticalLoadT: load.verticalLoadT,
      contactPressureTm2: load.contactPressureTm2,
      note: 'Inject tower stub/foundation service load (T) or contact pressure (T/m²) from structural design to unlock settlement calculation',
    },
    foundation: {
      widthM: foundation.widthM,
      lengthM: foundation.lengthM,
      depthM: Df,
      assumedDefaults: foundation.assumedScreeningDefaults,
    },
    soilInputs: soil,
    assumptions,
    allowableSettlementMm: allowable,
  }

  if (!hasLoad) {
    return {
      ...base,
      calculationStatus: 'TOWER_LOAD_REQUIRED',
      message:
        'Final settlement not computed — tower foundation load / contact pressure required from structural design',
      steps: [
        {
          step: 1,
          name: 'Input validation',
          formula: 'require q or P; Es; ν; If; B',
          inputs: {
            verticalLoadT: load.verticalLoadT,
            contactPressureTm2: load.contactPressureTm2,
            Es: soil.esTm2,
          },
          result: null,
          unit: '—',
          notes: 'TOWER_LOAD_REQUIRED',
        },
      ],
      settlementMm: noData(
        'mm',
        'Tower load required before settlement can be calculated',
        'INSUFFICIENT_DATA'
      ),
      settlementStatus: 'NotAssessed',
    }
  }

  if (!hasModulus) {
    return {
      ...base,
      calculationStatus: 'INSUFFICIENT_DATA',
      message:
        'Soil modulus Es unavailable — do not invent Es from SoilGrids texture. Provide plate-load / SPT-correlated / lab Es.',
      steps: [
        {
          step: 1,
          name: 'Input validation',
          formula: 'Es required',
          inputs: { Es: null },
          result: null,
          unit: '—',
          notes: 'FIELD_TEST_REQUIRED for Es',
        },
      ],
      settlementMm: noData(
        'mm',
        'Soil modulus Es missing — FIELD_TEST_REQUIRED',
        'FIELD_TEST_REQUIRED'
      ),
      settlementStatus: 'NotAssessed',
    }
  }

  if (!hasGeometry || !hasPoisson || !hasIf) {
    return {
      ...base,
      calculationStatus: 'INSUFFICIENT_DATA',
      message: `Missing settlement inputs: ${missing.join(', ')}`,
      steps: [],
      settlementMm: noData('mm', `Missing: ${missing.join(', ')}`, 'INSUFFICIENT_DATA'),
      settlementStatus: 'NotAssessed',
    }
  }

  const B = foundation.widthM
  const L = foundation.lengthM
  const area = B * L
  let q: number
  if (load.contactPressureTm2 != null && load.contactPressureTm2 > 0) {
    q = load.contactPressureTm2
  } else {
    q = (load.verticalLoadT as number) / area
  }

  const Es = soil.esTm2 as number
  const nu = soil.poissonRatio as number
  const If = soil.influenceFactorIf as number

  if (Es < 50 || Es > 50000) {
    return {
      ...base,
      calculationStatus: 'OUT_OF_RANGE',
      message: 'Es outside plausible screening range 50–50000 T/m²',
      steps: [],
      settlementMm: noData('mm', 'Es OUT_OF_RANGE', 'OUT_OF_RANGE'),
      settlementStatus: 'NotAssessed',
    }
  }

  // Si (m) = q B (1-ν²) / Es * If  → convert to mm
  const Si_m = ((q * B * (1 - nu * nu)) / Es) * If
  const Si_mm = Si_m * 1000

  if (!Number.isFinite(Si_mm) || Si_mm < 0) {
    return {
      ...base,
      calculationStatus: 'INSUFFICIENT_DATA',
      message: 'Settlement result non-finite',
      steps: [],
      settlementMm: noData('mm', 'Non-finite settlement', 'INSUFFICIENT_DATA'),
      settlementStatus: 'NotAssessed',
    }
  }

  const steps: SettlementStep[] = [
    {
      step: 1,
      name: 'Input parameters',
      formula: 'q, B, Es, ν, If',
      inputs: {
        q_Tm2: Number(q.toFixed(3)),
        B_m: B,
        L_m: L,
        Es_Tm2: Es,
        nu,
        If,
        loadSource: load.source,
      },
      result: null,
      unit: '—',
    },
    {
      step: 2,
      name: 'Contact pressure',
      formula:
        load.contactPressureTm2 != null
          ? 'q provided'
          : 'q = P / (B·L)',
      inputs: {
        P_T: load.verticalLoadT,
        area_m2: area,
        q_Tm2: Number(q.toFixed(3)),
      },
      result: Number(q.toFixed(3)),
      unit: 'T/m²',
    },
    {
      step: 3,
      name: 'Elastic settlement',
      formula: 'Si = q · B · (1 − ν²) / Es · If',
      inputs: {
        q: Number(q.toFixed(3)),
        B,
        nu,
        Es,
        If,
      },
      result: Number(Si_mm.toFixed(2)),
      unit: 'mm',
    },
    {
      step: 4,
      name: 'Allowable settlement check',
      formula: 'compare Si to allowable',
      inputs: {
        Si_mm: Number(Si_mm.toFixed(2)),
        allowable_mm: allowable,
      },
      result: Si_mm <= (allowable ?? 25) ? 'Safe' : 'Review',
      unit: '—',
    },
  ]

  const status: 'Safe' | 'Review' = Si_mm <= (allowable ?? 25) ? 'Safe' : 'Review'
  const conf = soil.esStatus === 'MEASURED' ? 70 : 40

  return {
    ...base,
    calculationStatus: 'CALCULATED',
    message: `Preliminary elastic settlement Si = ${Si_mm.toFixed(1)} mm (${status} vs allowable ${allowable} mm)`,
    steps,
    settlementMm: provenance(Number(Si_mm.toFixed(1)), {
      unit: 'mm',
      source: 'Elastic settlement screening',
      method: 'Si = q B (1−ν²)/Es · If',
      formula: 'Si = q · B · (1 − ν²) / Es · If',
      inputValues: {
        q_Tm2: Number(q.toFixed(3)),
        B_m: B,
        Es_Tm2: Es,
        nu,
        If,
      },
      confidence: conf,
      status: 'CALCULATED',
      assumptions,
      engineeringLimitation:
        'Preliminary elastic estimate only — not consolidation settlement; requires verified Es and tower load',
    }),
    settlementStatus: status,
  }
}
