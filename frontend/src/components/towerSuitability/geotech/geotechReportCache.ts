import type { GeotechnicalIntelligence } from './types'
import {
  buildGeotechInvestigationDocx,
  geotechDocxFileName,
  type GeotechDocxInput,
} from './report/buildGeotechInvestigationDocx'
import { buildGeotechReportData, ReportValidationError } from './report/buildGeotechReportData'
import { buildDynamicPurpose } from './report/reportDynamicScope'

type CacheEntry = {
  key: string
  blob: Blob
  fileName: string
}

let cache: CacheEntry | null = null
let inflight: Promise<CacheEntry | null> | null = null
const listeners = new Set<() => void>()

function notifyListeners(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeGeotechDocxCache(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isGeotechDocxInflight(): boolean {
  return inflight != null
}

/** Warm docx module during analyze so first build is faster. */
export function warmGeotechDocxModules(): void {
  void import('./report/buildGeotechInvestigationDocx')
  void import('./report/buildGeotechReportData')
  void import('docx')
}

function cacheKey(input: GeotechDocxInput): string {
  const geo = input.geo
  const phaseIKey = input.phaseI
    ? `|p${input.phaseI.towerCandidates.length}|pw${input.phaseI.powerInfrastructureSummary ? 1 : 0}|sel${input.phaseI.selectedTowerAnalysis?.candidate.id ?? ''}`
    : ''
  return `${geo.location.lat.toFixed(5)},${geo.location.lon.toFixed(5)},${geo.version}${phaseIKey}|fmt${input.reportFormat ?? 'transmission-line'}`
}

export function defaultGeotechDocxInput(geo: GeotechnicalIntelligence): GeotechDocxInput {
  return {
    geo,
    projectName: 'Transmission line',
    clientName: '--------------------------------------',
    consultant: 'Planeteye Infra AI',
    purpose: 'Construction of Transmission Tower',
    reportFormat: 'transmission-line',
  }
}

export function isGeotechDocxCached(input: GeotechDocxInput | GeotechnicalIntelligence): boolean {
  const key = 'geo' in input ? cacheKey(input) : cacheKey(defaultGeotechDocxInput(input))
  return cache?.key === key
}

export async function prebuildGeotechDocx(
  geoOrInput: GeotechnicalIntelligence | GeotechDocxInput
): Promise<CacheEntry | null> {
  const input: GeotechDocxInput = 'geo' in geoOrInput ? geoOrInput : defaultGeotechDocxInput(geoOrInput)
  const key = cacheKey(input)
  if (cache?.key === key) return cache
  if (inflight) return inflight

  inflight = (async () => {
    try {
      buildGeotechReportData(input)
      const blob = (await buildGeotechInvestigationDocx(input)) as Blob
      const location =
        (input.geo.location.placeLabel.value as string) ||
        `${input.geo.location.lat.toFixed(4)}_${input.geo.location.lon.toFixed(4)}`
      const entry: CacheEntry = { key, blob, fileName: geotechDocxFileName(location) }
      cache = entry
      notifyListeners()
      return entry
    } catch (e) {
      notifyListeners()
      if (e instanceof ReportValidationError) throw e
      return null
    } finally {
      inflight = null
      notifyListeners()
    }
  })()

  return inflight
}

export async function downloadCachedGeotechDocx(
  geoOrInput: GeotechnicalIntelligence | GeotechDocxInput
): Promise<void> {
  const input: GeotechDocxInput = 'geo' in geoOrInput ? geoOrInput : defaultGeotechDocxInput(geoOrInput)
  const entry = (await prebuildGeotechDocx(input)) ?? cache
  if (!entry || entry.key !== cacheKey(input)) {
    throw new Error('Geotechnical report could not be built')
  }
  const url = URL.createObjectURL(entry.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = entry.fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function invalidateGeotechDocxCache(): void {
  cache = null
  inflight = null
  notifyListeners()
}

export { ReportValidationError } from './report/buildGeotechReportData'
