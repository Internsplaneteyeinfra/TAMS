/**
 * Phase F — Pile foundation matrix orchestrator.
 * Reuses Phase E shared soil parameter resolution — no duplicate derivation.
 */

import { fieldTestRequired, provenance, noData } from '../provenance'
import type { BoreholeInvestigationPlan } from '../boreholePlanning'
import type { EngineeringParameterSet, SoilLayerParameters, SoilProfileInterval } from '../types'
import { buildPileLayerProfile, tipSoilAtDepth } from './layerProfile'
import { calculateLateralCapacity } from './lateralCapacity'
import { pileGeometryParameters } from './pileParameters'
import { buildBoreholePileMatrix } from './pileSummary'
import {
  aggregatePileStatus,
  overallSoilCondition,
  validateLayerSoilInputs,
  validatePileGeometry,
} from './pileValidation'
import { calculateUpliftCapacity } from './upliftCapacity'
import { calculateVerticalCapacity, pileParam } from './verticalCapacity'
import type {
  BoreholePileAnalysis,
  PileCellAnalysis,
  PileEngineAnalysis,
  PileCalculationStatus,
} from './types'
import { PILE_DEPTHS_M, PILE_DIAMETERS_MM } from './types'

function confidenceFromStatuses(phiStatus: string, cStatus: string): number {
  if (phiStatus === 'MEASURED' && cStatus === 'MEASURED') return 70
  if (phiStatus === 'ESTIMATED') return 32
  return 42
}

function calculatePileCellF(
  diameterMm: number,
  depthM: number,
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayers: SoilLayerParameters[] | undefined,
  screeningTextureClass?: string | null
): PileCellAnalysis {
  const geomVal = validatePileGeometry(diameterMm, depthM)
  const geom = pileGeometryParameters(diameterMm, depthM)
  const layers = buildPileLayerProfile(
    depthM,
    geom.D_m.value as number,
    engineering,
    profile,
    soilLayers,
    screeningTextureClass
  )
  const tipSoil = tipSoilAtDepth(depthM, engineering, profile, soilLayers, screeningTextureClass)
  const soilValidation = validateLayerSoilInputs(tipSoil.phiDeg, tipSoil.gammaTm3, tipSoil.cTm2)
  const soilCondition = overallSoilCondition(layers.map((l) => l.soilCondition))

  const assumptions = [
    'IS 2911-aligned static layer-wise c–φ method — PRELIMINARY screening',
    'Reuses Phase E shared c/φ/γ resolution — consistent with SBC engine',
    'SPT N never fabricated — static c–φ only when defensible',
    'Mixed layers: cohesive + cohesionless methods applied per layer',
    `Soil condition: ${soilCondition}`,
  ]

  if (!geomVal.passed || !soilValidation.passed) {
    const status = soilValidation.status
    const msg = soilValidation.message
    const ftr = fieldTestRequired<number>('T', msg)
    return {
      diameterMm,
      depthM,
      soilCondition,
      calculationStatus: status,
      missingParameters: [...geomVal.missingParameters, ...soilValidation.missingParameters],
      confidencePct: null,
      parameters: {
        Ap_m2: geom.Ap_m2,
        As_m2: geom.As_m2,
        D_m: geom.D_m,
        L_m: geom.L_m,
        Nq: pileParam(null, '—', 'NO_DATA', 'Nq requires φ', null),
        Ngamma: pileParam(null, '—', 'NO_DATA', 'Nγ requires φ', null),
        PD_tip_Tm2: pileParam(null, 'T/m²', 'NO_DATA', 'PD requires γ', null),
        sptN: pileParam(null, '—', 'FIELD_TEST_REQUIRED', 'SPT N not derived from GIS', null),
      },
      layerCalculations: layers,
      verticalCapacity: {
        endBearing_T: null,
        shaftFriction_T: null,
        ultimateVertical_T: null,
        ultimate_T: null,
        safe_T: ftr,
        steps: [],
      },
      upliftCapacity: {
        selfWeight_T: null,
        shaftResistance_T: null,
        ultimateUplift_T: null,
        ultimate_T: null,
        safe_T: ftr,
        steps: [],
      },
      lateralCapacity: {
        method: 'Not calculated',
        lateralMethodNote: msg,
        ultimate_T: null,
        safe_T: ftr,
        steps: [],
      },
      validation: {
        passed: false,
        status,
        message: msg,
        provenanceSummary: soilValidation.provenanceSummary,
        missingParameters: soilValidation.missingParameters,
      },
      steps: [
        {
          step: 1,
          name: 'Validation gate',
          formula: 'Require defensible c, φ, γ',
          inputs: { missing: soilValidation.missingParameters.join(', ') },
          result: null,
          unit: '—',
          notes: msg,
        },
      ],
      assumptions,
    }
  }

  const conf = confidenceFromStatuses(tipSoil.phiStatus, tipSoil.cStatus)
  const vertical = calculateVerticalCapacity({
    Ap_m2: geom.Ap_m2.value as number,
    tipPhi: tipSoil.phiDeg as number,
    tipC: tipSoil.cTm2 as number,
    tipGamma: tipSoil.gammaTm3 as number,
    pileDepthM: depthM,
    layers,
    confidence: conf,
  })

  const uplift = calculateUpliftCapacity({
    Ap_m2: geom.Ap_m2.value as number,
    pileDepthM: depthM,
    shaftFriction_T: vertical.shaftFriction_T,
    confidence: conf,
  })

  const lateral = calculateLateralCapacity({
    diameterMm,
    depthM,
    soilCondition,
    phiDeg: tipSoil.phiDeg,
    cTm2: tipSoil.cTm2,
    gammaTm3: tipSoil.gammaTm3,
  })

  const calcStatus: PileCalculationStatus =
    vertical.safeVertical_T != null && uplift.safeUplift_T != null ? 'PARTIAL' : 'INSUFFICIENT_DATA'

  const allSteps = [...vertical.steps, ...uplift.steps, ...lateral.steps]

  return {
    diameterMm,
    depthM,
    soilCondition,
    calculationStatus: calcStatus,
    missingParameters: [
      'SPT_N_VALUE',
      'TOWER_LATERAL_LOAD',
      'PILE_HEAD_FIXITY',
      'GROUNDWATER_CONDITION',
    ],
    confidencePct: conf,
    parameters: {
      Ap_m2: geom.Ap_m2,
      As_m2: geom.As_m2,
      D_m: geom.D_m,
      L_m: geom.L_m,
      Nq: pileParam(vertical.Nq, '—', 'CALCULATED', 'Nq from tip φ', conf),
      Ngamma: pileParam(vertical.Ngamma, '—', 'CALCULATED', 'Nγ from tip φ', conf),
      PD_tip_Tm2: pileParam(vertical.PD_tip, 'T/m²', 'CALCULATED', 'PD = γ·L at tip', conf),
      sptN: pileParam(null, '—', 'FIELD_TEST_REQUIRED', 'SPT N requires field test — never fabricated', null),
    },
    layerCalculations: layers,
    verticalCapacity: {
      endBearing_T: vertical.endBearing_T,
      shaftFriction_T: vertical.shaftFriction_T,
      ultimateVertical_T: vertical.ultimateVertical_T,
      ultimate_T: vertical.ultimateVertical_T,
      safe_T: vertical.safe,
      steps: vertical.steps,
    },
    upliftCapacity: {
      selfWeight_T: uplift.selfWeight_T,
      shaftResistance_T: vertical.shaftFriction_T,
      ultimateUplift_T: uplift.ultimateUplift_T,
      ultimate_T: uplift.ultimateUplift_T,
      safe_T: uplift.safe,
      steps: uplift.steps,
    },
    lateralCapacity: {
      method: lateral.method,
      lateralMethodNote: lateral.lateralMethodNote,
      ultimate_T: null,
      safe_T: lateral.safe,
      steps: lateral.steps,
    },
    validation: {
      passed: true,
      status: calcStatus,
      message: 'Vertical and uplift calculated via layer-wise static method; lateral requires tower inputs',
      provenanceSummary: `φ: ${tipSoil.phiStatus} · c: ${tipSoil.cStatus} · γ: ${tipSoil.gammaStatus} · layers: ${layers.length}`,
      missingParameters: ['SPT_N_VALUE', 'TOWER_LATERAL_LOAD', 'PILE_HEAD_FIXITY'],
    },
    steps: allSteps,
    assumptions,
  }
}

function analyzeBoreholePiles(
  borehole: {
    boreholeId: string
    latitude: number
    longitude: number
  },
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayers: SoilLayerParameters[] | undefined,
  screeningTextureClass?: string | null
): BoreholePileAnalysis {
  const matrix: PileCellAnalysis[] = []
  for (const mm of PILE_DIAMETERS_MM) {
    for (const L of PILE_DEPTHS_M) {
      matrix.push(calculatePileCellF(mm, L, engineering, profile, soilLayers, screeningTextureClass))
    }
  }
  const statuses = matrix.map((c) => c.calculationStatus)
  const calcStatus = aggregatePileStatus(statuses)
  const calculated = matrix.filter((c) => c.verticalCapacity.safe_T.value != null).length

  return {
    boreholeId: borehole.boreholeId,
    latitude: borehole.latitude,
    longitude: borehole.longitude,
    soilCondition: overallSoilCondition(matrix[0]?.layerCalculations.map((l) => l.soilCondition) ?? []),
    calculationStatus: calcStatus,
    message:
      calculated > 0
        ? `Layer-wise pile vertical/uplift for ${calculated}/6 configurations at ${borehole.boreholeId}. Lateral blocked without tower loads.`
        : `Pile capacities require verified c/φ/γ — REQUIRES ADDITIONAL VERIFIED INPUT (${borehole.boreholeId})`,
    matrix,
    byDiameter: buildBoreholePileMatrix(matrix),
  }
}

export function runPileEngineAnalysis(opts: {
  engineering: EngineeringParameterSet
  profile: SoilProfileInterval[]
  soilLayerParameters?: SoilLayerParameters[]
  boreholePlan?: BoreholeInvestigationPlan | null
  screeningTextureClass?: string | null
  lat?: number
  lon?: number
}): PileEngineAnalysis {
  const points = opts.boreholePlan?.points?.length
    ? opts.boreholePlan.points
    : [
        {
          boreholeId: 'BH-01',
          latitude: opts.lat ?? 0,
          longitude: opts.lon ?? 0,
          recommendedInvestigationDepthM: 2.0,
          spacingM: null,
          selectionReason: 'Site focus',
          coverageZone: 'Centroid',
          dataConfidencePct: 70,
          status: 'PROPOSED_GIS_INVESTIGATION_POINT' as const,
        },
      ]

  const byBorehole = points.map((p) =>
    analyzeBoreholePiles(
      { boreholeId: p.boreholeId, latitude: p.latitude, longitude: p.longitude },
      opts.engineering,
      opts.profile,
      opts.soilLayerParameters,
      opts.screeningTextureClass
    )
  )

  const primary = byBorehole[0]
  const calcStatus = aggregatePileStatus(byBorehole.map((b) => b.calculationStatus))

  return {
    version: 'PILE-F1',
    codeReference: 'IS 2911 (Part 1/Sec 2):2010 — bored cast-in-situ piles (layer-wise static screening)',
    method: 'Layer-wise mixed c–φ static method; shared Phase E soil parameters; SPT N never fabricated',
    calculationStatus: calcStatus,
    message: primary?.message ?? 'Pile analysis not run',
    byBorehole,
    siteSummary: primary,
  }
}

/** Map Phase F cell to legacy PileCellResult shape */
export function toLegacyPileCell(cell: PileCellAnalysis) {
  return {
    diameterMm: cell.diameterMm,
    depthM: cell.depthM,
    calculationStatus:
      cell.calculationStatus === 'REQUIRES_ADDITIONAL_VERIFIED_INPUT'
        ? ('INSUFFICIENT_DATA' as const)
        : cell.calculationStatus === 'CALCULATED' || cell.calculationStatus === 'PARTIAL'
          ? cell.calculationStatus
          : ('INSUFFICIENT_DATA' as const),
    missingParameters: cell.missingParameters,
    inputs: {
      Ap_m2: cell.parameters.Ap_m2.value,
      perimeter_m: cell.parameters.D_m.value != null ? Math.PI * (cell.parameters.D_m.value as number) : null,
      D_m: cell.parameters.D_m.value,
      L_m: cell.parameters.L_m.value,
      c_Tm2: cell.layerCalculations[0]?.cTm2.value ?? null,
      phi_deg: cell.layerCalculations[0]?.phiDeg.value ?? null,
      gamma_Tm3: cell.layerCalculations[0]?.gammaTm3.value ?? null,
      PD_tip_Tm2: cell.parameters.PD_tip_Tm2.value,
      Ki: cell.layerCalculations[0]?.Ki.value ?? null,
      delta_deg: cell.layerCalculations[0]?.deltaDeg.value ?? null,
      Nq: cell.parameters.Nq.value,
      Ngamma: cell.parameters.Ngamma.value,
      fosCompression: 2.5,
      fosUplift: 3.0,
      cStatus: cell.layerCalculations[0]?.cTm2.source ?? 'NO_DATA',
      phiStatus: cell.layerCalculations[0]?.phiDeg.source ?? 'NO_DATA',
    },
    layerProfile: cell.layerCalculations.map((l) => ({
      depthFromM: l.depthFromM,
      depthToM: l.depthToM,
      thicknessM: l.thicknessM,
      midDepthM: l.midDepthM,
      overburdenMidTm2: l.overburdenMidTm2.value,
      soilCondition: l.soilCondition,
      shaftContribution_T: l.shaftFrictionContributionT,
    })),
    endBearing: { Qb_T: cell.verticalCapacity.endBearing_T, steps: cell.verticalCapacity.steps.slice(0, 1) },
    shaftFriction: { Qs_T: cell.verticalCapacity.shaftFriction_T, steps: [] },
    ultimateVertical_T: cell.verticalCapacity.ultimateVertical_T,
    safeVertical: cell.verticalCapacity.safe_T,
    ultimateUplift_T: cell.upliftCapacity.ultimateUplift_T,
    safeUplift: cell.upliftCapacity.safe_T,
    safeLateral: cell.lateralCapacity.safe_T,
    vertical: cell.verticalCapacity.safe_T,
    uplift: cell.upliftCapacity.safe_T,
    lateral: cell.lateralCapacity.safe_T,
    steps: cell.steps,
    assumptions: cell.assumptions,
    soilCondition: cell.soilCondition,
    confidencePct: cell.confidencePct,
    validation: cell.validation,
  }
}

export function toLegacyPileAnalysis(engine: PileEngineAnalysis) {
  const bh = engine.siteSummary
  const out = {
    codeReference: engine.codeReference,
    method: engine.method,
    message: engine.message,
    soilInputs: null as unknown,
    '450mm': {} as Record<'1.0m' | '1.5m' | '2.0m', ReturnType<typeof toLegacyPileCell>>,
    '600mm': {} as Record<'1.0m' | '1.5m' | '2.0m', ReturnType<typeof toLegacyPileCell>>,
  }
  for (const c of bh.matrix) {
    const key = `${c.diameterMm}mm` as '450mm' | '600mm'
    const dep = `${c.depthM.toFixed(1)}m` as '1.0m' | '1.5m' | '2.0m'
    out[key][dep] = toLegacyPileCell(c)
  }
  return out
}

/** Legacy entry point */
export function runPileAnalysis(
  engineering: EngineeringParameterSet,
  profile: SoilProfileInterval[],
  soilLayerParameters?: SoilLayerParameters[],
  screeningTextureClass?: string | null
) {
  const engine = runPileEngineAnalysis({
    engineering,
    profile,
    soilLayerParameters,
    screeningTextureClass,
  })
  return toLegacyPileAnalysis(engine)
}

/** Legacy calculatePileCell — uniform soil from SbcSoilInputs (unit tests / backward compat). */
export function calculatePileCell(
  diameterMm: number,
  depthM: number,
  soil: import('../sbc/types').SbcSoilInputs
): import('./legacyTypes').PileCellResult {
  const engineering: EngineeringParameterSet = {
    gammaKnM3: provenance(
      soil.gammaTm3 != null ? Number((soil.gammaTm3 * 9.81).toFixed(2)) : null,
      {
        unit: 'kN/m³',
        source: soil.gammaSource,
        method: 'From SbcSoilInputs',
        confidence: 45,
        status: soil.gammaStatus,
      }
    ),
    phiDeg: provenance(soil.phiDeg, {
      unit: '°',
      source: soil.phiSource,
      method: 'From SbcSoilInputs',
      confidence: 38,
      status: soil.phiStatus,
    }),
    cohesionKpa: provenance(
      soil.cTm2 != null ? Number((soil.cTm2 * 9.81).toFixed(2)) : null,
      {
        unit: 'kPa',
        source: soil.cSource,
        method: 'From SbcSoilInputs',
        confidence: soil.cStatus === 'ESTIMATED' ? 35 : 70,
        status: soil.cStatus,
      }
    ),
    dryDensityGcc: noData('g/cm³', 'Not used for legacy pile cell'),
    notes: [],
  }
  const cell = calculatePileCellF(
    diameterMm,
    depthM,
    engineering,
    [],
    undefined,
    soil.textureHint
  )
  return toLegacyPileCell(cell)
}
