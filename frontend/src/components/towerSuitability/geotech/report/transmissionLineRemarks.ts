/**
 * Material remarks matching Transmission line.docx reference style.
 * e.g. "Silty clay, medium stiff", "Dense sandy murum, suitable founding stratum"
 */

export function transmissionLineMaterialRemark(params: {
  sand: number | null | undefined
  silt: number | null | undefined
  clay: number | null | undefined
  dryDensityGcc: number | null | undefined
  soilClass?: string | null
  depthToM: number
  gravel?: number | null | undefined
}): string {
  const sa = params.sand ?? 0
  const si = params.silt ?? 0
  const cl = params.clay ?? 0
  const gr = params.gravel ?? 0
  const fines = si + cl
  const dd = params.dryDensityGcc ?? 1.62
  const depth = params.depthToM

  const consistency = dd >= 1.78 ? 'stiff' : dd >= 1.68 ? 'medium stiff' : 'soft'

  if (depth >= 1.5 && sa >= 45 && cl <= 10 && dd >= 1.75) {
    return gr >= 20
      ? 'Dense sandy murum with gravel, suitable founding layer'
      : 'Dense sandy murum, suitable founding stratum'
  }

  if (cl >= 30 && si >= 25) {
    return depth >= 1.0 && sa >= 35 ? 'Sandy clay with increasing density' : `Silty clay, ${consistency}`
  }

  if (cl >= 20 && si >= 30 && cl < 30) {
    return `Clayey silt, ${consistency}`
  }

  if (sa >= 40 && cl >= 10 && cl < 28) {
    return depth >= 1.0 ? 'Sandy clay with increasing density' : `Sandy clay, ${consistency}`
  }

  if (fines >= 50 && cl >= 28) {
    return `Brown silty clay, ${consistency}`
  }

  if (sa >= 50 && fines < 18 && dd >= 1.72) {
    return 'Dense sandy murum, suitable founding stratum'
  }

  const cls = (params.soilClass ?? '').split(/[\s(]/)[0]?.toUpperCase()
  if (cls === 'CH' || cls === 'CI') return `Silty clay, ${consistency}`
  if (cls === 'CL' || cls === 'CL-ML') return `Clayey silt, ${consistency}`
  if (cls === 'SM' || cls === 'SC') return `Sandy clay, ${consistency}`

  if (fines >= 45) return `Silty clay, ${consistency}`
  if (sa >= 35) return `Sandy clay, ${consistency}`

  return `Mixed soil, ${consistency}`
}
