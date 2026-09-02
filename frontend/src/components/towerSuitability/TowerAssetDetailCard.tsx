import React from 'react'

import { X, MapPin, Zap, Building2, Radio, Route, ArrowRightLeft } from 'lucide-react'



import type { NearbyPowerAsset } from './nearbyPowerSupply'

import { powerKindLabel } from './nearbyPowerSupply'

import type { PlannedTowerAdvice } from './corridorPlacementAdvice'

import type { TowerConnectionOverlay } from './towerConnection'

import { formatMeters } from './towerConnection'



export type SelectedTowerDetail =

  | {

      kind: 'planned'

      index: number

      lat: number

      lon: number

      voltageKv: number | null

      spanM?: number

      advice?: PlannedTowerAdvice

      isBestPad?: boolean

    }

  | {

      kind: 'existing'

      asset: NearbyPowerAsset

    }



function verdictLabel(v: PlannedTowerAdvice['verdict']): string {

  switch (v) {

    case 'place':

      return 'Suggest place — open corridor'

    case 'skip_existing':

      return 'Suggest skip — reuse existing tower nearby'

    case 'too_close':

      return 'Suggest shift — under min span'

    default:

      return 'Review — confirm on survey'

  }

}



export default function TowerAssetDetailCard({

  detail,

  connection,

  onClose,

  onToggleConnection,

}: {

  detail: SelectedTowerDetail

  connection?: TowerConnectionOverlay | null

  onClose: () => void

  onToggleConnection?: () => void

}) {

  const isPlanned = detail.kind === 'planned'

  const lat = isPlanned ? detail.lat : detail.asset.lat

  const lon = isPlanned ? detail.lon : detail.asset.lon

  const advice = isPlanned ? detail.advice : undefined



  return (

    <div className="pointer-events-auto absolute z-[1200] left-3 bottom-[5.5rem] md:bottom-4 md:left-4 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-[rgba(51,65,85,0.2)] bg-[rgba(248,247,241,0.97)] shadow-xl backdrop-blur-sm overflow-hidden">

      <div className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-[rgba(51,65,85,0.12)] bg-white/60">

        <div className="min-w-0">

          <p className="text-[10px] font-black uppercase tracking-wider text-[#17879a]">

            {isPlanned ? 'Suggested transmission pad' : 'Existing grid asset'}

          </p>

          <p className="text-sm font-black text-[#263238] truncate">

            {isPlanned

              ? `T${detail.index}${detail.isBestPad ? ' · ★ power take-off pad' : ''}`

              : detail.asset.name}

          </p>

        </div>

        <button

          type="button"

          onClick={onClose}

          className="shrink-0 rounded-lg p-1 hover:bg-black/5"

          aria-label="Close"

        >

          <X className="w-4 h-4" />

        </button>

      </div>



      <div className="px-3 py-2.5 space-y-2 text-[11px] text-[#263238]">

        <div className="flex items-start gap-2">

          <MapPin className="w-3.5 h-3.5 shrink-0 text-[#17879a] mt-0.5" />

          <div className="tabular-nums">

            <p>

              <span className="font-bold">Latitude:</span> {lat.toFixed(6)}°N

            </p>

            <p>

              <span className="font-bold">Longitude:</span> {lon.toFixed(6)}°E

            </p>

          </div>

        </div>



        {isPlanned ? (

          <>

            <div className="flex items-center gap-2">

              <Zap className="w-3.5 h-3.5 text-[#b97816]" />

              <span>

                Planning class:{' '}

                <strong>{detail.voltageKv != null ? `${detail.voltageKv} kV` : 'Select kV class'}</strong>

                {detail.spanM != null ? ` · ${detail.spanM} m span` : ''}

              </span>

            </div>

            {advice && (

              <div className="rounded-lg border border-[rgba(51,65,85,0.14)] bg-white/70 px-2 py-1.5 leading-snug">

                <p className="font-black text-[10px] uppercase text-[#126b79]">

                  {verdictLabel(advice.verdict)}

                </p>

                <p className="mt-0.5 text-[#66727a]">{advice.reason}</p>

                {advice.nearestExistingM != null && (

                  <p className="mt-1 text-[#263238]">

                    Nearest existing:{' '}

                    <strong>{advice.nearestExistingName ?? 'mapped tower'}</strong> ·{' '}

                    {formatMeters(advice.nearestExistingM)} straight-line

                  </p>

                )}

                {advice.connectRationale && (

                  <p className="mt-1 text-[#0f766e] leading-snug">{advice.connectRationale}</p>

                )}

                {advice.suggestedLat != null && advice.suggestedLon != null && (

                  <p className="mt-1 text-[#b97816] tabular-nums">

                    Suggested position: {advice.suggestedLat.toFixed(6)}, {advice.suggestedLon.toFixed(6)}

                    {advice.verdict === 'too_close' ? ' (shift ghost on map)' : ' (reuse existing)'}

                  </p>

                )}

              </div>

            )}

          </>

        ) : (

          <>

            <div className="flex items-center gap-2">

              {detail.asset.kind === 'substation' || detail.asset.kind === 'plant' ? (

                <Building2 className="w-3.5 h-3.5 text-[#7e22ce]" />

              ) : (

                <Radio className="w-3.5 h-3.5 text-[#1d4ed8]" />

              )}

              <span>

                {powerKindLabel(detail.asset.kind)} ·{' '}

                <strong>

                  {detail.asset.voltageKv != null

                    ? `${detail.asset.voltageInferred ? '~' : ''}${detail.asset.voltageKv} kV`

                    : 'kV not tagged'}

                </strong>

              </span>

            </div>

            {connection?.corridorDistM != null && (
              <p className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[#eff6ff] px-2 py-1.5 leading-snug">
                <span className="font-black text-[10px] uppercase text-[#1d4ed8]">To your line</span>
                <br />
                Minimum perpendicular: <strong>{formatMeters(connection.corridorDistM)}</strong>
                {connection.roadDirection ? ` · direction ${connection.roadDirection}` : ''}
              </p>
            )}

            {connection?.nearestStation && (
              <p className="rounded-lg border border-[rgba(126,34,206,0.2)] bg-[#faf5ff] px-2 py-1.5 leading-snug">
                <span className="font-black text-[10px] uppercase text-[#7e22ce]">Nearest power station</span>
                <br />
                <strong>{connection.nearestStation.name}</strong> ·{' '}
                {formatMeters(connection.nearestStation.distM)} · {connection.nearestStation.direction}
              </p>
            )}

            <p>

              Distance from corridor/search:{' '}

              <strong>

                {detail.asset.distanceKm < 1

                  ? `${Math.round(detail.asset.distanceKm * 1000)} m`

                  : `${detail.asset.distanceKm.toFixed(2)} km`}

              </strong>{' '}

              straight-line

            </p>

            <p>

              Source: <strong>{detail.asset.source === 'tams' ? 'TAMS GIS' : 'OpenStreetMap'}</strong>

              {detail.asset.operator ? ` · ${detail.asset.operator}` : ''}

            </p>

            <p className="text-[10px] text-[#66727a]">ID: {detail.asset.id}</p>

          </>

        )}



        {connection && (

          <div className="rounded-lg border border-[#f97316]/35 bg-[#fff7ed] px-2 py-1.5 space-y-1">

            <p className="text-[9px] font-black uppercase text-[#c2410c] flex items-center gap-1">

              <Route className="w-3 h-3" />

              Line connect · {connection.from.label} → {connection.to.label}

            </p>

            <p className="tabular-nums">

              Straight-line: <strong>{formatMeters(connection.straightM)}</strong>
              {connection.roadDirection ? ` · ${connection.roadDirection}` : ''}

            </p>

            <p className="tabular-nums">

              By road:{' '}

              {connection.roadLoading ? (

                <span className="text-[#66727a]">loading OSRM route…</span>

              ) : connection.roadKm != null ? (

                <strong>{formatMeters(connection.roadKm * 1000)}</strong>

              ) : (

                <span className="text-[#66727a]">route unavailable</span>

              )}

            </p>

            {connection.rationale && (

              <p className="text-[10px] text-[#66727a] leading-snug">{connection.rationale}</p>

            )}

            {onToggleConnection && (

              <button

                type="button"

                onClick={onToggleConnection}

                className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase text-[#c2410c] hover:underline"

              >

                <ArrowRightLeft className="w-3 h-3" />

                {connection.showRoad ? 'Hide road route (keep straight line)' : 'Show road route again'}

              </button>

            )}

          </div>

        )}

      </div>

    </div>

  )

}

