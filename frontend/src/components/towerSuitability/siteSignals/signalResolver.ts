/**
 * Universal signal resolution — primary → secondary → tertiary → engineering model.
 * Provider timeout ≠ analysis failure.
 */

export type SignalSourceType =
  | 'LIVE_API'
  | 'GIS'
  | 'SATELLITE'
  | 'MODEL'
  | 'ENGINEERING_CORRELATION'
  | 'PROJECT_DATA'
  | 'REFERENCE_CALIBRATED'

export type SignalResolveStatus = 'RESOLVED' | 'MODELLED' | 'PARTIAL'

export interface SignalResult<T> {
  value: T | null
  source: string
  sourceType: SignalSourceType
  method: string
  confidence: number
  timestamp: string
  fallbackUsed: boolean
  providerChain: string[]
  status: SignalResolveStatus
}

export type SignalProvider<T> = () => Promise<T | null>

export interface ResolveSignalOptions<T> {
  id: string
  primary: SignalProvider<T>
  secondary?: SignalProvider<T>
  tertiary?: SignalProvider<T>
  engineeringFallback?: SignalProvider<T>
  /** Minimum confidence when engineering model succeeds (0–100). */
  modelConfidence?: number
  sourceTypeForModel?: SignalSourceType
  methodForModel?: string
}

function isUsable<T>(v: T | null | undefined): v is T {
  if (v == null) return false
  if (typeof v === 'number' && !Number.isFinite(v)) return false
  return true
}

export async function resolveSignal<T>(opts: ResolveSignalOptions<T>): Promise<SignalResult<T>> {
  const chain: string[] = []
  const ts = new Date().toISOString()
  const modelConf = opts.modelConfidence ?? 55

  const tryProvider = async (
    name: string,
    fn: SignalProvider<T> | undefined,
    sourceType: SignalSourceType,
    method: string,
    confidence: number
  ): Promise<SignalResult<T> | null> => {
    if (!fn) return null
    chain.push(name)
    try {
      const value = await fn()
      if (!isUsable(value)) return null
      return {
        value,
        source: name,
        sourceType,
        method,
        confidence,
        timestamp: ts,
        fallbackUsed: chain.length > 1,
        providerChain: [...chain],
        status: 'RESOLVED',
      }
    } catch {
      return null
    }
  }

  const primary = await tryProvider(`${opts.id}:primary`, opts.primary, 'LIVE_API', 'Primary provider', 85)
  if (primary) return primary

  const secondary = await tryProvider(`${opts.id}:secondary`, opts.secondary, 'GIS', 'Secondary GIS provider', 72)
  if (secondary) return secondary

  const tertiary = await tryProvider(`${opts.id}:tertiary`, opts.tertiary, 'GIS', 'Tertiary GIS provider', 65)
  if (tertiary) return tertiary

  const model = await tryProvider(
    `${opts.id}:model`,
    opts.engineeringFallback,
    opts.sourceTypeForModel ?? 'ENGINEERING_CORRELATION',
    opts.methodForModel ?? 'Engineering / terrain correlation model',
    modelConf
  )
  if (model) return { ...model, status: 'MODELLED', fallbackUsed: true }

  return {
    value: null,
    source: `${opts.id}:unresolved`,
    sourceType: 'MODEL',
    method: 'All providers exhausted — no defensible model path',
    confidence: 0,
    timestamp: ts,
    fallbackUsed: true,
    providerChain: chain,
    status: 'PARTIAL',
  }
}
