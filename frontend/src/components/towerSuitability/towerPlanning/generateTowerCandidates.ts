/**
 * Phase I — tower candidate generation (reuses existing line/corridor engines).
 */

import { analyzeCorridorPlacement } from '../corridorPlacementAdvice'
import type { KmlFeature } from '../fetchSiteSignals'
import type { GeotechnicalIntelligence } from '../geotech'
import { planTowersFromKml, standardForVoltageKv } from '../lineTowers'
import type { NearbyPowerSupply } from '../nearbyPowerSupply'
import type { SuitabilityResult } from '../scoring'
import { soilVerdictLabelForCandidate } from './buildTowerPlanningContext'
import type { PowerInfrastructureSummary, TowerCandidate, TowerCandidateRecommendation } from './types'
import { rainbowColorForTower } from './rainbowColors'
import { recommendFoundation } from '../geotech/foundationRecommendation'

function factorFromSuitability(suitability: SuitabilityResult | undefined, factorId: string): number | null {
  const f = suitability?.factors.find((x) => x.id === factorId)
  return f ? Math.round(f.score * 10) : null
}

function recommendationFrom(
  suitabilityScore: number,
  placementVerdict: string | null,
  soilVerdict: string
): TowerCandidateRecommendation {
  if (isApprovedForConstruction(soilVerdict)) return 'REQUIRES_REVIEW'
  if (placementVerdict === 'too_close' || placementVerdict === 'skip_existing') return 'REQUIRES_REVIEW'
  if (suitabilityScore >= 75) return 'RECOMMENDED_FOR_PRELIMINARY_ASSESSMENT'
  if (suitabilityScore >= 55) return 'CONDITIONALLY_SUITABLE'
  return 'NOT_RECOMMENDED'
}

function isApprovedForConstruction(_: string): boolean {
  return false
}

export function generateTowerCandidates(opts: {
  planningKmlFeatures: KmlFeature[]
  geo: GeotechnicalIntelligence
  power: NearbyPowerSupply | null
  powerSummary: PowerInfrastructureSummary
  searchRadiusKm: number
  voltageKv?: number | null
  baseSuitability?: SuitabilityResult
}): TowerCandidate[] {
  const plan = planTowersFromKml(opts.planningKmlFeatures, {
    voltageKv: opts.voltageKv ?? null,
    focus: {
      lat: opts.geo.location.lat,
      lon: opts.geo.location.lon,
    },
  })
  if (!plan?.towers.length) return []

  const pathFeat =
    opts.planningKmlFeatures.find((f) => f.type === 'LineString' && f.latlngs.length >= 2) ||
    opts.planningKmlFeatures.find((f) => f.type === 'Polygon' && f.latlngs.length >= 3)
  const corridorPath = pathFeat?.latlngs.map(([la, lo]) => ({ lat: la, lon: lo })) ?? plan.towers.map((t) => ({ lat: t.lat, lon: t.lon }))

  const std = standardForVoltageKv(opts.voltageKv ?? plan.voltageKv)
  const advice = analyzeCorridorPlacement({
    plannedTowers: plan.towers,
    corridorPath,
    existingAssets: opts.power?.assets ?? [],
    std,
    spanM: plan.spanM,
    voltageKv: plan.voltageKv,
    searchRadiusKm: opts.searchRadiusKm,
  })

  const soilLabel = soilVerdictLabelForCandidate(opts.geo)
  const baseScore = opts.baseSuitability ? Math.round(opts.baseSuitability.finalScore * 10) : 50

  return plan.towers.map((tower, idx) => {
    const item = advice?.items.find((i) => i.index === tower.index)
    const padPenalty =
      item?.verdict === 'too_close' ? -15 : item?.verdict === 'skip_existing' ? -25 : item?.verdict === 'review' ? -8 : 0
    const suitabilityScore = Math.max(0, Math.min(100, baseScore + padPenalty))
    const recommendation = recommendationFrom(suitabilityScore, item?.verdict ?? null, soilLabel)
    const color = rainbowColorForTower(idx + 1)
    const foundation = opts.geo.foundationRecommendation?.category ?? recommendFoundation(opts.geo)?.category ?? null
    const kv = opts.voltageKv ?? plan.voltageKv ?? null

    return {
      id: `T-${String(idx + 1).padStart(2, '0')}`,
      index: tower.index,
      latitude: tower.lat,
      longitude: tower.lon,
      suitabilityScore,
      soilVerdictStatus: soilLabel,
      terrainScore: factorFromSuitability(opts.baseSuitability, 'elevation'),
      slopeScore: factorFromSuitability(opts.baseSuitability, 'slope'),
      accessibilityScore: factorFromSuitability(opts.baseSuitability, 'road'),
      powerInfrastructureStatus: opts.powerSummary.status,
      distanceToInfrastructureKm:
        item?.nearestExistingM != null ? item.nearestExistingM / 1000 : opts.powerSummary.distanceKm,
      placementVerdict: item?.verdict ?? null,
      constraints: [
        item?.verdict === 'skip_existing' ? 'Near existing tower — reuse review required' : '',
        opts.geo.soilVerdictAnalysis?.overall.investigationRequired
          ? 'Mandatory field investigation before final design'
          : '',
      ].filter(Boolean),
      recommendation,
      dataConfidence: opts.powerSummary.confidence === 'HIGH' ? 'MODERATE' : 'LOW',
      provenance: {
        scoringStatus: 'PRELIMINARY_ASSESSMENT',
        source: 'TAMS tower suitability screening + corridor placement',
      },
      colorHex: color.hex,
      colorLabel: color.label,
      recommendedKv: kv,
      recommendedTowerType: item?.verdict === 'skip_existing' ? 'Reuse existing structure' : 'Suspension Tower',
      recommendedFoundation: foundation ?? 'Review on survey',
    }
  })
}
