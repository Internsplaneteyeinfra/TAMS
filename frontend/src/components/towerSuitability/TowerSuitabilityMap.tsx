import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { GOOGLE_SATELLITE_URL, GOOGLE_SUBDOMAINS } from '@/lib/basemapTiles'
import type { KmlFeature } from './fetchSiteSignals'
import type { PlannedTower } from './lineTowers'
import { voltageLabel } from './lineTowers'
import type { SuitabilityResult } from './scoring'
import { verdictColor } from './scoring'

export default function TowerSuitabilityMap({
  lat,
  lon,
  result,
  kmlFeatures,
  plannedTowers = [],
  voltageKv = null,
  spanM,
  onPick,
}: {
  lat: number
  lon: number
  result: SuitabilityResult | null
  kmlFeatures: KmlFeature[]
  plannedTowers?: PlannedTower[]
  voltageKv?: number | null
  spanM?: number
  onPick: (lat: number, lon: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const ringRef = useRef<L.Circle | null>(null)
  const kmlLayerRef = useRef<L.LayerGroup | null>(null)
  const onPickRef = useRef(onPick)
  const [mapReady, setMapReady] = useState(0)
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom: 14,
      zoomControl: true,
    })
    L.tileLayer(GOOGLE_SATELLITE_URL, {
      maxZoom: 20,
      subdomains: [...GOOGLE_SUBDOMAINS],
      attribution: '© Google',
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      onPickRef.current(e.latlng.lat, e.latlng.lng)
    })

    kmlLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    setMapReady((n) => n + 1)
    requestAnimationFrame(() => map.invalidateSize())
    return () => {
      map.remove()
      mapRef.current = null
      kmlLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = window.setTimeout(() => map.invalidateSize(), 80)
    return () => window.clearTimeout(t)
  }, [result, plannedTowers.length, kmlFeatures.length])

  useEffect(() => {
    const map = mapRef.current
    const layer = kmlLayerRef.current
    if (!map || !layer || !mapReady) return
    layer.clearLayers()

    if (!kmlFeatures.length && !plannedTowers.length) return

    const outline = '#22d3ee'
    const fill = '#22d3ee'
    const bounds = L.latLngBounds([])

    kmlFeatures.forEach((feat) => {
      if (feat.type === 'Polygon') {
        const poly = L.polygon(feat.latlngs, {
          color: outline,
          weight: 3.5,
          opacity: 1,
          fillColor: fill,
          fillOpacity: 0.18,
          lineJoin: 'round',
        })
        if (feat.name) {
          poly.bindTooltip(feat.name, {
            permanent: true,
            direction: 'center',
            className: 'ts-kml-label',
          })
        }
        poly.addTo(layer)
        bounds.extend(poly.getBounds())
      } else if (feat.type === 'LineString') {
        L.polyline(feat.latlngs, {
          color: '#111827',
          weight: 14,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer)
        const line = L.polyline(feat.latlngs, {
          color: '#fbbf24',
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        })
        line.addTo(layer)
        const label = [feat.name || 'Drawn site', voltageKv != null ? `${voltageKv} kV` : null]
          .filter(Boolean)
          .join(' · ')
        line.bindTooltip(label, { sticky: true, className: 'ts-kml-label' })
        bounds.extend(line.getBounds())
      } else if (feat.type === 'Point') {
        feat.latlngs.forEach(([la, lo]) => {
          const m = L.circleMarker([la, lo], {
            radius: 8,
            color: '#fff',
            weight: 2,
            fillColor: outline,
            fillOpacity: 0.95,
          })
          if (feat.name) {
            m.bindTooltip(feat.name, { permanent: true, direction: 'top', className: 'ts-kml-label' })
          }
          m.addTo(layer)
          bounds.extend([la, lo])
        })
      }
    })

    const dense = plannedTowers.length > 60
    plannedTowers.forEach((tower) => {
      L.circleMarker([tower.lat, tower.lon], {
        radius: dense ? 7 : 11,
        color: '#ffffff',
        weight: 3,
        fillColor: '#f59e0b',
        fillOpacity: 1,
        pane: 'markerPane',
      })
        .bindTooltip(`T${tower.index}`, {
          permanent: !dense || tower.index === 1 || tower.index === plannedTowers.length || tower.index % 5 === 0,
          direction: 'top',
          offset: [0, -8],
          className: 'ts-tower-label',
        })
        .bindPopup(
          `<strong>Tower T${tower.index}</strong><br/>${voltageLabel(voltageKv)}<br/>${
            spanM ? `${spanM} m span` : ''
          }<br/>${tower.lat.toFixed(5)}, ${tower.lon.toFixed(5)}`
        )
        .addTo(layer)
      bounds.extend([tower.lat, tower.lon])
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 16 })
    }
  }, [kmlFeatures, plannedTowers, voltageKv, spanM, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const color = result ? verdictColor(result.verdict) : '#22d3ee'
    const hidePad = plannedTowers.length > 0

    if (!markerRef.current) {
      markerRef.current = L.circleMarker([lat, lon], {
        radius: 11,
        color: '#fff',
        weight: 3,
        fillColor: color,
        fillOpacity: 0.95,
      }).addTo(map)
    } else {
      markerRef.current.setLatLng([lat, lon])
      markerRef.current.setStyle({ fillColor: color })
    }

    if (!ringRef.current) {
      ringRef.current = L.circle([lat, lon], {
        radius: 140,
        color,
        weight: 2.5,
        fillColor: color,
        fillOpacity: 0.14,
      }).addTo(map)
    } else {
      ringRef.current.setLatLng([lat, lon])
      ringRef.current.setStyle({ color, fillColor: color })
    }

    if (hidePad) {
      markerRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
      ringRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
    } else {
      markerRef.current.setStyle({ opacity: 1, fillOpacity: 0.95 })
      ringRef.current.setStyle({ opacity: 1, fillOpacity: 0.14 })
    }

    if (!kmlFeatures.length) {
      map.panTo([lat, lon], { animate: true })
    }
  }, [lat, lon, result, kmlFeatures.length, plannedTowers.length, mapReady])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 w-full h-full ts-suitability-map" />
      {(plannedTowers.length > 0 || kmlFeatures.length > 0) && (
        <div className="absolute top-3 left-1/2 z-[1200] -translate-x-1/2 pointer-events-none max-w-[min(520px,calc(100%-7rem))]">
          <div className="rounded-2xl border-2 border-amber-300 bg-slate-950/92 px-4 py-2.5 shadow-2xl backdrop-blur-md text-center">
            {plannedTowers.length > 0 ? (
              <>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
                  Planned towers on this site
                </p>
                <p className="mt-1 text-2xl font-black text-white tabular-nums leading-none">
                  {plannedTowers.length}
                  <span className="ml-2 text-sm font-bold text-slate-300">towers</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-lg text-amber-200">{voltageLabel(voltageKv)}</span>
                </p>
                {spanM != null && (
                  <p className="mt-1 text-xs font-semibold text-slate-300">
                    {spanM} m span · orange dots T1…T{plannedTowers.length} · click a dot for details
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-bold text-slate-200">KML outline loaded — no tower path yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
