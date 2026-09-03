/**
 * Phase E — E1 Design parameters with provenance.
 */

import { provenance } from '../provenance'
import type { EngineeringParameterSet } from '../types'
import type { SbcDesignParameters, SbcFoundationInputs, SbcSoilInputs } from './types'

function engParam(
  value: number | null,
  unit: string,
  source: import('../types').GeoDataStatus,
  method: string,
  confidence: number | null,
  reference?: string
): import('./types').EngineeringParameter<number> {
  return { value, unit, source, method, confidence, reference }
}

export function buildDesignParameters(
  foundation: SbcFoundationInputs,
  soil: SbcSoilInputs,
  engineering: EngineeringParameterSet,
  foundationDepthM = 1.5
): SbcDesignParameters {
  return {
    foundationType: {
      value: foundation.foundationType,
      unit: 'text',
      source: foundation.assumedScreeningDefaults ? 'ESTIMATED' : 'MEASURED',
      method: foundation.assumedScreeningDefaults
        ? 'Screening default footing type for GIS preliminary analysis'
        : 'Engineer-specified foundation type',
      confidence: foundation.assumedScreeningDefaults ? 40 : 85,
      reference: 'IS 6403:1981',
    },
    footingWidthM: engParam(
      foundation.widthM,
      'm',
      foundation.assumedScreeningDefaults ? 'ESTIMATED' : 'MEASURED',
      'Footing width B',
      foundation.assumedScreeningDefaults ? 40 : 85,
      'IS 6403'
    ),
    footingLengthM: engParam(
      foundation.lengthM,
      'm',
      foundation.assumedScreeningDefaults ? 'ESTIMATED' : 'MEASURED',
      'Footing length L',
      foundation.assumedScreeningDefaults ? 40 : 85,
      'IS 6403'
    ),
    foundationDepthM: engParam(
      foundationDepthM,
      'm',
      'CALCULATED',
      'Foundation depth Df for design check',
      70,
      'IS 6403'
    ),
    factorOfSafety: engParam(
      foundation.fosShear,
      '—',
      'CALCULATED',
      'Factor of safety against shear failure (screening)',
      75,
      'IS 6403'
    ),
    allowableSettlementMm: engParam(
      foundation.allowableSettlementMm,
      'mm',
      foundation.allowableSettlementMm != null ? 'ESTIMATED' : 'NO_DATA',
      'Allowable total settlement for screening comparison',
      50,
      'IS 8009 (screening)'
    ),
    unitWeightGammaTm3: {
      value: soil.gammaTm3,
      unit: 'T/m³',
      source: soil.gammaStatus,
      method: soil.gammaSource,
      confidence: soil.gammaTm3 != null ? 45 : null,
      reference: 'SoilGrids bdod → γ proxy',
    },
    cohesionCTm2: {
      value: soil.cTm2,
      unit: 'T/m²',
      source: soil.cStatus,
      method: soil.cSource,
      confidence:
        soil.cStatus === 'MEASURED' ? 85 : soil.cStatus === 'ESTIMATED' ? 35 : null,
      reference: 'IS 6403',
    },
    frictionAnglePhiDeg: {
      value: soil.phiDeg,
      unit: '°',
      source: soil.phiStatus,
      method: soil.phiSource,
      confidence:
        soil.phiStatus === 'MEASURED' ? 85 : soil.phiStatus === 'ESTIMATED' ? 38 : null,
      reference: 'Texture correlation / engineering estimate',
    },
  }
}

export function designParametersToProvenance(dp: SbcDesignParameters) {
  return {
    foundationType: provenance(dp.foundationType.value, {
      unit: dp.foundationType.unit,
      source: 'Phase E design parameters',
      method: dp.foundationType.method,
      confidence: dp.foundationType.confidence,
      status: dp.foundationType.source,
    }),
    gamma: provenance(dp.unitWeightGammaTm3.value, {
      unit: dp.unitWeightGammaTm3.unit,
      source: dp.unitWeightGammaTm3.method,
      method: 'Unit weight for surcharge and bearing capacity',
      confidence: dp.unitWeightGammaTm3.confidence,
      status: dp.unitWeightGammaTm3.source,
    }),
    cohesion: provenance(dp.cohesionCTm2.value, {
      unit: dp.cohesionCTm2.unit,
      source: dp.cohesionCTm2.method,
      method: 'Cohesion for bearing capacity',
      confidence: dp.cohesionCTm2.confidence,
      status: dp.cohesionCTm2.source,
    }),
    phi: provenance(dp.frictionAnglePhiDeg.value, {
      unit: dp.frictionAnglePhiDeg.unit,
      source: dp.frictionAnglePhiDeg.method,
      method: 'Friction angle for bearing capacity factors',
      confidence: dp.frictionAnglePhiDeg.confidence,
      status: dp.frictionAnglePhiDeg.source,
    }),
  }
}
