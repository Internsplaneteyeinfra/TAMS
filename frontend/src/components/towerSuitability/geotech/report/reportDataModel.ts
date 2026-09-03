/**
 * K — Unified report data model (single source of truth for DOCX).
 */

import type { GeotechnicalIntelligence } from '../types'
import type { PhaseIReportBundle } from '../../towerPlanning/types'
import type { FoundationRecommendation } from '../foundationRecommendation'
import type { ParameterCompletenessResult } from '../parameterResolution/completenessEngine'
import {
  buildGeotechReportData,
  type GeotechDocxInput,
  type ValidatedGeotechnicalReportData,
} from './buildGeotechReportData'

export interface GeotechnicalReportDataModel {
  geo: GeotechnicalIntelligence
  metadata: ValidatedGeotechnicalReportData['metadata']
  location: ValidatedGeotechnicalReportData['location']
  sections: ValidatedGeotechnicalReportData['sections']
  investigationArea: {
    geometryLabel: string | null
    boreholeCount: number
  }
  investigationMethodology: string[]
  boreholePlan: GeotechnicalIntelligence['boreholeInvestigationPlan']
  soilProfiles: GeotechnicalIntelligence['soilProfile']
  soilSummary: GeotechnicalIntelligence['soilTestSummary']
  engineeringParameters: GeotechnicalIntelligence['engineeringParameters']
  sbcAnalysis: GeotechnicalIntelligence['sbcEngineAnalysis']
  pileAnalysis: GeotechnicalIntelligence['pileEngineAnalysis']
  cbrAnalysis: GeotechnicalIntelligence['cbrEngineAnalysis']
  resistivityAnalysis: GeotechnicalIntelligence['resistivityEngineAnalysis']
  soilVerdict: GeotechnicalIntelligence['soilVerdictAnalysis']
  foundationRecommendation: FoundationRecommendation | null
  parameterCompleteness: ParameterCompletenessResult | null
  powerInfrastructure: PhaseIReportBundle['power'] | null
  towerSuitability: PhaseIReportBundle | null
  limitations: string[]
  provenanceSummary: string
  validation: ValidatedGeotechnicalReportData['validation']
}

export function buildReportDataModel(input: GeotechDocxInput & {
  foundationRecommendation?: FoundationRecommendation | null
  parameterCompleteness?: ParameterCompletenessResult | null
}): GeotechnicalReportDataModel {
  const validated = buildGeotechReportData(input)
  const geo = validated.geo

  return {
    geo,
    metadata: validated.metadata,
    location: validated.location,
    sections: validated.sections,
    investigationArea: {
      geometryLabel: validated.location.investigationGeometryLabel,
      boreholeCount: geo.boreholeInvestigationPlan?.totalPoints ?? 0,
    },
    investigationMethodology: [
      'GIS and satellite terrain screening',
      'ISRIC SoilGrids 2.0 texture and density',
      'Engineering correlation and model prediction (PR-1)',
      geo.fieldInvestigationMatch.usedForMeasuredParams
        ? 'Project / field investigation data (same-site)'
        : 'No same-site field data — GIS estimates only',
    ],
    boreholePlan: geo.boreholeInvestigationPlan,
    soilProfiles: geo.soilProfile,
    soilSummary: geo.soilTestSummary,
    engineeringParameters: geo.engineeringParameters,
    sbcAnalysis: geo.sbcEngineAnalysis,
    pileAnalysis: geo.pileEngineAnalysis,
    cbrAnalysis: geo.cbrEngineAnalysis,
    resistivityAnalysis: geo.resistivityEngineAnalysis,
    soilVerdict: geo.soilVerdictAnalysis,
    foundationRecommendation: input.foundationRecommendation ?? null,
    parameterCompleteness: input.parameterCompleteness ?? null,
    powerInfrastructure: input.phaseI?.power ?? null,
    towerSuitability: input.phaseI ?? null,
    limitations: geo.limitations,
    provenanceSummary:
      'All GIS/model values labelled with status, method, and confidence — never presented as laboratory measurements unless PROJECT_DATA or MEASURED.',
    validation: validated.validation,
  }
}
