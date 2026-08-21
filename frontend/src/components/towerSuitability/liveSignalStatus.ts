import type { SiteSignals } from './scoring'
import { SUITABILITY_LIVE_SOURCES } from './liveDataCatalog'

export type SignalFetchStatus = 'live' | 'fallback' | 'failed' | 'na'

export function liveStatusBySource(signals?: SiteSignals | null): Record<string, SignalFetchStatus> {
  if (!signals) {
    return Object.fromEntries(SUITABILITY_LIVE_SOURCES.map((s) => [s.id, 'na' as const]))
  }
  const liveOk = signals.liveOk
  const fallback = signals.usedFallback
  const asFlag = (
    ok: boolean | undefined,
    usedFallback?: boolean
  ): SignalFetchStatus => {
    if (usedFallback) return 'fallback'
    if (ok === true) return 'live'
    if (ok === false) return 'failed'
    return 'na'
  }

  return {
    dem: asFlag(liveOk?.dem),
    road: asFlag(liveOk?.road),
    water: asFlag(liveOk?.water, fallback?.water),
    settlement: asFlag(liveOk?.settlement, fallback?.settlement),
    grid: asFlag(liveOk?.grid, fallback?.grid),
    wind: asFlag(liveOk?.wind),
    landcover: asFlag(liveOk?.landcover),
    power_supply: asFlag(signals.nearbyPower?.liveOk),
    location: 'live',
    geotech: asFlag(liveOk?.geotech),
    soilScreening: asFlag(liveOk?.soilScreening),
  }
}

export function liveStatusCounts(signals?: SiteSignals | null) {
  const byId = liveStatusBySource(signals)
  const values = SUITABILITY_LIVE_SOURCES.map((s) => byId[s.id] ?? 'na')
  return {
    live: values.filter((v) => v === 'live').length,
    fallback: values.filter((v) => v === 'fallback').length,
    na: values.filter((v) => v === 'na' || v === 'failed').length,
    total: SUITABILITY_LIVE_SOURCES.length,
    byId,
  }
}
