/**
 * Compact geotechnical summary for Gemini — minimal tokens, all engineering values.
 */

import type { GeotechnicalIntelligence } from '../geotech'
import type { SiteSignals } from '../scoring'

function n(v: number | null | undefined, d = 2): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return Number(Number(v).toFixed(d))
}

function pv(p: { value?: number | null } | undefined): number | null {
  return n(p?.value ?? null)
}

function ps(p: { value?: string | null } | undefined): string | null {
  const v = p?.value
  return v != null ? String(v) : null
}

export function buildGeminiGeoSummary(
  geo: GeotechnicalIntelligence,
  lat: number,
  lon: number,
  placeLabel: string,
  signals?: SiteSignals | null
): Record<string, unknown> {
  const records = geo.soilTestSummary?.records ?? []
  const layers =
    records.length > 0
      ? records.slice(0, 12).map((r) => ({
          bh: r.boreholeId,
          lat: n(r.latitude, 6),
          lon: n(r.longitude, 6),
          depth: r.layerDepthLabel,
          t_m: n(r.layerThicknessM, 1),
          gravel: pv(r.gravelPct),
          sand: pv(r.sandPct),
          silt: pv(r.siltPct),
          clay: pv(r.clayPct),
          ll: pv(r.liquidLimit),
          pl: pv(r.plasticLimit),
          pi: pv(r.plasticityIndex),
          class: ps(r.soilClassification),
          mdd: pv(r.maximumDryDensityGcc),
          omc: pv(r.optimumMoistureContentPct),
          dry_d: pv(r.dryDensityGcc),
          bulk_d: pv(r.bulkDensityGcc),
          fsi: pv(r.freeSwellingIndexPct),
          ucs: pv(r.ucsKgCm2),
          sg: pv(r.specificGravity),
          sbc: pv(r.sbcTm2),
          cbr: pv(r.cbrPct),
          gwt: pv(r.groundWaterTableM),
          remark: r.remarks.slice(0, 120),
        }))
      : geo.soilProfile.map((L) => ({
          depth: L.reportDepthLabel,
          sand: pv(L.sandPct),
          silt: pv(L.siltPct),
          clay: pv(L.clayPct),
          gravel: pv(L.gravelPct),
          dry_d: pv(L.dryDensityGcc),
          bulk_d: pv(L.bulkDensityGcc),
          class: ps(L.isSoilClassification),
        }))

  const sbc = (geo.sbcAnalysis?.byDepth ?? []).map((d) => ({
    depth_m: d.depthM,
    sbc_tm2: pv(d.netSafeBearingCapacityTm2),
    gov: d.governingCondition ?? null,
  }))

  const pile: Array<Record<string, unknown>> = []
  for (const diam of ['450mm', '600mm'] as const) {
    const block = geo.pileAnalysis?.[diam]
    if (!block) continue
    for (const depth of ['1.0m', '1.5m', '2.0m'] as const) {
      const cell = block[depth]
      if (!cell) continue
      pile.push({
        dia: diam,
        depth,
        vert_t: pv(cell.vertical),
        uplift_t: pv(cell.uplift),
        lat_t: pv(cell.lateral),
      })
    }
  }

  const cbr = [
    ...(geo.cbrAnalysis?.measuredByDepth ?? []).map((r) => ({
      depth: r.reportDepth,
      cbr: pv(r.measuredCBR),
      type: 'measured',
    })),
    ...(geo.cbrAnalysis?.estimatedByDepth ?? []).map((r) => ({
      depth: r.reportDepth,
      cbr: r.estimatedCBR.value ? `${r.estimatedCBR.value.low}-${r.estimatedCBR.value.high}` : null,
      type: 'estimated',
    })),
  ]

  const resistivity = geo.resistivityAnalysis
    ? {
        est_ohm_m: pv(geo.resistivityAnalysis.estimated),
        meas_ohm_m: pv(geo.resistivityAnalysis.measured as { value?: number | null }),
        layers: (geo.resistivityAnalysis.layers ?? []).slice(0, 4).map((L) => ({
          from: L.depthFromM,
          to: L.depthToM,
          ohm_m: pv(L.resistivity as { value?: number | null }),
        })),
      }
    : null

  const boreholes = (geo.boreholeInvestigationPlan?.points ?? []).slice(0, 8).map((p) => ({
    id: p.boreholeId,
    lat: n(p.latitude, 6),
    lon: n(p.longitude, 6),
    depth_m: p.recommendedInvestigationDepthM,
  }))

  return {
    site: {
      lat: n(lat, 6),
      lon: n(lon, 6),
      place: placeLabel,
      region: ps(geo.location.landCover) ?? signals?.placeLabel ?? null,
      elevation_m: pv(geo.location.elevationM),
      slope_deg: pv(geo.location.slopeDeg),
    },
    boreholes,
    soil_layers: layers,
    sbc,
    pile,
    cbr,
    resistivity,
    design: {
      gamma_kn_m3: pv(geo.engineeringParameters?.gammaKnM3),
      phi_deg: pv(geo.engineeringParameters?.phiDeg),
      cohesion_kpa: pv(geo.engineeringParameters?.cohesionKpa),
    },
    verdict: geo.soilVerdictAnalysis?.overall?.status ?? null,
  }
}

export function geminiReportCacheKey(lat: number, lon: number): string {
  return `tams_gemini_geo_${lat.toFixed(5)}_${lon.toFixed(5)}`
}
