/**
 * Soil data fusion — wraps existing PR-1 parameter resolution pipeline.
 * Does NOT duplicate soil calculations.
 */

import type { SiteSignals } from '../../scoring'
import type { GeotechnicalIntelligence } from '../types'
import { mergeResolvedParameters } from '../parameterResolution/projectDataFusion'

export type SoilFusionResult = {
  sourceChain: string[]
  primaryAvailable: boolean
  fallbackUsed: boolean
  confidence: number
}

/** Describe soil fusion provenance from resolved geotech intelligence. */
export function describeSoilFusion(
  signals: SiteSignals,
  geo: GeotechnicalIntelligence | null
): SoilFusionResult {
  const chain: string[] = []
  if (signals.soilScreening?.provider) chain.push(String(signals.soilScreening.provider))
  if (signals.geotech?.site_name) chain.push(`TAMS geotech: ${signals.geotech.site_name}`)
  if (geo?.resolvedParameterContext?.byLayer?.length) {
    chain.push('PR-1 parameter resolution')
  }
  const ctx = geo?.resolvedParameterContext
  const primaryAvailable = Boolean(
    signals.soilScreening?.layers?.some((l) => l.sandPct != null) || signals.geotech?.full
  )
  const fallbackUsed = Boolean(!primaryAvailable && ctx?.byLayer?.length)
  const avgConf =
    ctx?.byLayer?.length
      ? ctx.byLayer.reduce((s: number, l) => s + (l.cohesionKpa?.confidence ?? 50), 0) / ctx.byLayer.length
      : primaryAvailable
        ? 68
        : 52
  return {
    sourceChain: chain.length ? chain : ['Engineering correlation model'],
    primaryAvailable,
    fallbackUsed,
    confidence: Math.round(avgConf),
  }
}

export { mergeResolvedParameters }
