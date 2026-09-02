/**
 * Dynamic scope text for Transmission-line geotechnical reports — any lat/lon in India.
 */

import type { GeotechnicalIntelligence } from '../types'
import type { ValidatedGeotechnicalReportData } from './buildGeotechReportData'
import { fmtLat, fmtLon, provenanceDisplay } from './reportFormatting'

export function buildDynamicPurpose(geo: GeotechnicalIntelligence): string {
  const place = (geo.location.placeLabel.value as string)?.trim()
  const coord = `${fmtLat(geo.location.lat)}, ${fmtLon(geo.location.lon)}`
  const region = provenanceDisplay(geo.location.landCover)
  const regionPhrase = region && region !== 'NO DATA' ? `${region} terrain` : 'investigation terrain'
  if (place) {
    return `Construction suitability assessment for transmission tower foundation at ${coord} (${place}) — ${regionPhrase}; geotechnical investigation and soil analysis to 2.0 m depth`
  }
  return `Construction suitability assessment for transmission tower foundation at ${coord} — ${regionPhrase}; geotechnical investigation and soil analysis to 2.0 m depth`
}

export function buildInvestigationLocationLines(geo: GeotechnicalIntelligence): string[] {
  const points = geo.boreholeInvestigationPlan?.points ?? []
  if (!points.length) {
    return [
      `Location 1: ${fmtLat(geo.location.lat)} ${fmtLon(geo.location.lon)} — site centroid (proposed GIS investigation point)`,
    ]
  }
  return points.map(
    (p, i) =>
      `Location ${i + 1} (${p.boreholeId}): ${fmtLat(p.latitude)} ${fmtLon(p.longitude)} — ${p.selectionReason}`
  )
}

export function buildDynamicScopeIntro(
  geo: GeotechnicalIntelligence,
  reportData: ValidatedGeotechnicalReportData
): string {
  const loc = reportData.location
  const area =
    loc.areaLabel && !loc.coordinateFallback
      ? [loc.areaLabel, loc.district, loc.state].filter(Boolean).join(', ')
      : `${loc.latitudeDisplay}, ${loc.longitudeDisplay}`
  const region = provenanceDisplay(geo.location.landCover)
  const regionLabel = region && region !== 'NO DATA' ? region : 'Open / mixed land'
  const bhCount = geo.boreholeInvestigationPlan?.points?.length ?? 1
  return (
    `Targeted area for geotechnical investigation: ${area}. ` +
    `Region of investigation: ${regionLabel}. ` +
    `${bhCount} investigation point(s) analysed to 2.0 m depth with complete soil test summary tables ` +
    `(grain size, Atterberg limits, IS classification, MDD, OMC, densities, FSI, UCS, SG, SBC, CBR, earth resistivity). ` +
    `Coordinates ${loc.latitudeDisplay}, ${loc.longitudeDisplay} drive all GIS queries and calculations.`
  )
}

export function buildDynamicMethodologyNote(geo: GeotechnicalIntelligence): string {
  const texture = geo.soilScreeningSummary?.textureClass
    ? provenanceDisplay(geo.soilScreeningSummary.textureClass)
    : 'modelled from SoilGrids'
  return (
    `Soil parameters at this location are resolved dynamically from ISRIC SoilGrids 2.0 and PR-1 engineering parameter resolution ` +
    `(USDA texture: ${texture}). IS 6403 net safe bearing capacity, IS 2911 pile capacities (450 mm & 600 mm at 1.0 / 1.5 / 2.0 m), ` +
    `CBR screening, and earth resistivity correlation are computed from location-specific inputs — not from any fixed reference site.`
  )
}
