/**
 * Soil data fusion — wraps existing PR-1 parameter resolution pipeline.
 * Does NOT duplicate soil calculations.
 */

import type { SiteSignals } from '../scoring'
import type { GeotechnicalIntelligence } from '../geotech/types'
import { mergeResolvedParameters } from '../geotech/parameterResolution/projectDataFusion'

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
  if (signals.soilScreening?.source) chain.push(String(signals.soilScreening.source))
  if (signals.geotech?.site_name) chain.push(`TAMS geotech: ${signals.geotech.site_name}`)
  if (geo?.resolvedParameterContext?.layers?.length) {
    chain.push('PR-1 parameter resolution')
  }
  const ctx = geo?.resolvedParameterContext
  const primaryAvailable = Boolean(signals.soilScreening?.sandPct != null || signals.geotech?.full)
  const fallbackUsed = Boolean(!primaryAvailable && ctx?.layers?.length)
  const avgConf =
    ctx?.layers?.length
      ? ctx.layers.reduce((s, l) => s + (l.cohesionKpa?.confidence ?? 50), 0) / ctx.layers.length
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
