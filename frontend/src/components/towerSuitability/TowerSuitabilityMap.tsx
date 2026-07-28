import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { GOOGLE_SATELLITE_URL, GOOGLE_SUBDOMAINS } from '@/lib/basemapTiles'
import type { KmlFeature } from './fetchSiteSignals'
import type { SuitabilityResult } from './scoring'
import { verdictColor } from './scoring'

export default function TowerSuitabilityMap({
  lat,
  lon,
  result,
  kmlFeatures,
  onPick,
}: {
  lat: number
  lon: number
  result: SuitabilityResult | null
  kmlFeatures: KmlFeature[]
  onPick: (lat: number, lon: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const ringRef = useRef<L.Circle | null>(null)
  const kmlLayerRef = useRef<L.LayerGroup | null>(null)
  const onPickRef = useRef(onPick)
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
    return () => {
      map.remove()
      mapRef.current = null
      kmlLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw / refresh KML outlines
  useEffect(() => {
    const map = mapRef.current
    const layer = kmlLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    if (!kmlFeatures.length) return

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
          fillOpacity: 0.22,
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
        const line = L.polyline(feat.latlngs, {
          color: '#a5f3fc',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        })
        // Halo for visibility on satellite
        L.polyline(feat.latlngs, {
          color: '#083344',
          weight: 8,
          opacity: 0.55,
        }).addTo(layer)
        line.addTo(layer)
        if (feat.name) {
          line.bindTooltip(feat.name, {
            sticky: true,
            className: 'ts-kml-label',
          })
        }
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

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18), { animate: true, maxZoom: 17 })
    }
  }, [kmlFeatures])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const color = result ? verdictColor(result.verdict) : '#22d3ee'

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

    // Only pan when no KML bounds (click-to-place)
    if (!kmlFeatures.length) {
      map.panTo([lat, lon], { animate: true })
    }
  }, [lat, lon, result, kmlFeatures.length])

  return <div ref={containerRef} className="absolute inset-0 w-full h-full ts-suitability-map" />
}
