/**
 * Educational Cesium scene: tower roles + voltage variants, lines, substation.
 * Solid demo ground (no map tiles). Camera always framed on the corridor.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react'

import { TOWER_TYPE_CATALOG, getTowerTypeById, type TowerTypeEntry } from '@/config/towerTypeCatalog'
import { loadCesium, type CesiumModule } from '@/lib/cesiumLoader'
import {
  addCatenaryConductors,
  addDemoGround,
  addProceduralTower,
  addSubstationYard,
  offsetMeters,
  zoomToShowcase,
  type SceneOrigin,
} from '@/components/towers/towerGeometry'

const ORIGIN: SceneOrigin = { lon: 72.57, lat: 23.03 }

export default function TowerTypesShowcase3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const cesiumRef = useRef<CesiumModule | null>(null)
  const orbitRef = useRef<number | null>(null)
  const headingRef = useRef(0.7)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>('dead-end')
  const [orbiting, setOrbiting] = useState(true)

  const buildScene = useCallback(
    (Cesium: CesiumModule, viewer: import('cesium').Viewer, selected: string | null) => {
      viewer.entities.removeAll()
      addDemoGround(Cesium, viewer, ORIGIN)
      addSubstationYard(Cesium, viewer, ORIGIN, 0, 0)

      const corridor = TOWER_TYPE_CATALOG.filter((t) => t.group === 'corridor')
      const variants = TOWER_TYPE_CATALOG.filter((t) => t.group === 'variants')
      const corridorPositions: { entry: TowerTypeEntry; east: number; north: number }[] = []

      corridor.forEach((entry, i) => {
        const east = 50 + i * 60
        const north = 0
        corridorPositions.push({ entry, east, north })
        addProceduralTower(Cesium, viewer, entry, ORIGIN, east, north, selected === entry.id)
      })

      variants.forEach((entry, i) => {
        addProceduralTower(Cesium, viewer, entry, ORIGIN, 45 + i * 48, 85, selected === entry.id)
      })

      for (let i = 0; i < corridorPositions.length; i++) {
        const cur = corridorPositions[i]
        const prev =
          i === 0
            ? { east: 24, north: 0, height: 22 }
            : {
                east: corridorPositions[i - 1].east,
                north: corridorPositions[i - 1].north,
                height: corridorPositions[i - 1].entry.heightM * 0.85,
              }
        addCatenaryConductors(Cesium, viewer, `span-${i}`, ORIGIN, prev, {
          east: cur.east,
          north: cur.north,
          height: cur.entry.heightM * 0.85,
        })
      }
    },
    []
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || viewerRef.current) return
    let cancelled = false
    let handler: import('cesium').ScreenSpaceEventHandler | null = null

    loadCesium()
      .then((Cesium) => {
        if (cancelled || !container) return
        cesiumRef.current = Cesium

        const viewer = new Cesium.Viewer(container, {
          animation: false,
          timeline: false,
          fullscreenButton: true,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          infoBox: false,
          selectionIndicator: true,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          // Enable requestRenderMode to avoid continuous redraws — request render only when needed
          requestRenderMode: true,
          // Cap target frame rate for animated elements
          targetFrameRate: 30,
        })

        viewer.imageryLayers.removeAll()
        viewer.scene.globe.show = true
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#14532d')
        viewer.scene.globe.enableLighting = false
        viewer.scene.fog.enabled = false
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020617')
        viewer.scene.globe.depthTestAgainstTerrain = false
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true

        buildScene(Cesium, viewer, 'dead-end')
        zoomToShowcase(Cesium, viewer, ORIGIN)

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((movement: { position: import('cesium').Cartesian2 }) => {
          const picked = viewer.scene.pick(movement.position)
          if (!Cesium.defined(picked)) return
          const entity = picked.id as import('cesium').Entity | undefined
          if (!entity) return
          const id = typeof entity.id === 'string' ? entity.id : ''
          if (id.startsWith('tower-')) {
            setSelectedId(id.replace(/^tower-/, '').replace(/-body$|-shaft$|-arm.*$|-cap$|-vl$|-vr$|-l$|-r$|-cross$/, ''))
            // Prefer root id: tower-dead-end
            const root = id.match(/^tower-([a-z0-9-]+?)(?:-|$)/)
            if (root?.[1]) {
              // handle tower-dead-end-body → dead-end
              const full = id.replace(/^tower-/, '')
              const known = TOWER_TYPE_CATALOG.find(
                (t) => full === t.id || full.startsWith(`${t.id}-`)
              )
              if (known) setSelectedId(known.id)
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        viewerRef.current = viewer
        setStatus('ready')
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load Cesium')
        setStatus('error')
      })

    return () => {
      cancelled = true
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current)
      handler?.destroy()
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [buildScene])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium || status !== 'ready') return
    buildScene(Cesium, viewer, selectedId)
  }, [selectedId, status, buildScene])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium || status !== 'ready' || !orbiting) {
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current)
      orbitRef.current = null
      return
    }

    const center = offsetMeters(Cesium, ORIGIN, 150, 30, 50)
    const tick = () => {
      headingRef.current += 0.003
      viewer.camera.lookAt(
        center,
        new Cesium.HeadingPitchRange(
          headingRef.current,
          Cesium.Math.toRadians(-28),
          420
        )
      )
      // When orbiting, explicitly request a render frame (requestRenderMode enabled above)
      viewer.scene.requestRender()
      orbitRef.current = requestAnimationFrame(tick)
    }
    orbitRef.current = requestAnimationFrame(tick)
    return () => {
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current)
      // Unlock camera when orbit stops so user can drag freely
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    }
  }, [orbiting, status])

  const flyToSelected = useCallback(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium || !selectedId) return
    setOrbiting(false)
    const entity = viewer.entities.getById(`tower-${selectedId}`)
    if (entity) {
      viewer.flyTo(entity, {
        duration: 1.0,
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 160),
      })
    } else {
      zoomToShowcase(Cesium, viewer, ORIGIN)
    }
  }, [selectedId])

  const resetView = useCallback(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) return
    setOrbiting(true)
    headingRef.current = 0.7
    zoomToShowcase(Cesium, viewer, ORIGIN)
  }, [])

  const selected = selectedId ? getTowerTypeById(selectedId) : undefined
  const corridor = TOWER_TYPE_CATALOG.filter((t) => t.group === 'corridor')
  const variants = TOWER_TYPE_CATALOG.filter((t) => t.group === 'variants')

  return (
    <div className="fixed inset-0 flex flex-col bg-[#060B17] text-slate-200">
      <header className="shrink-0 h-12 border-b border-slate-800/80 bg-[#070b14] flex items-center gap-3 px-3 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Live map
        </Link>
        <div className="h-4 w-px bg-slate-700" />
        <h1 className="text-sm font-semibold text-white tracking-tight">Tower Types 3D</h1>
        <span className="text-[10px] text-emerald-400/90 hidden sm:inline">
          {status === 'ready' ? `${TOWER_TYPE_CATALOG.length} towers · lines · substation` : 'Loading…'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOrbiting((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-700 text-[10px] hover:bg-slate-800"
          >
            {orbiting ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {orbiting ? 'Pause' : 'Orbit'}
          </button>
          <button
            type="button"
            onClick={flyToSelected}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-700 text-[10px] hover:bg-slate-800"
          >
            Focus
          </button>
          <button
            type="button"
            onClick={resetView}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-700 text-[10px] hover:bg-slate-800"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
        <div className="relative flex-1 min-h-[50vh] lg:min-h-0 bg-[#020617]">
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
          {status === 'loading' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060B17]/90">
              <p className="text-sm text-slate-300">Building 3D towers…</p>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060B17] p-6 text-center">
              <p className="text-sm text-red-400">{errorMsg}</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 z-10 pointer-events-none rounded-lg border border-emerald-700/40 bg-[#0a1020]/90 px-3 py-2 text-[10px] text-slate-300 max-w-[260px]">
            Green ground pad = demo terrain. You should see lattice towers, yellow lines, and a blue substation.
            Use <span className="text-white">Assets → Tower Types 3D</span>. App may be on port{' '}
            <span className="text-white">3001</span>.
          </div>
        </div>

        <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#070b14] overflow-y-auto">
          {selected && (
            <div className="p-3 border-b border-slate-800">
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Selected</p>
              <p className="text-sm font-semibold text-white mt-0.5">{selected.label}</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{selected.description}</p>
              <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded bg-slate-900/80 px-2 py-1.5">
                  <dt className="text-slate-500">Role</dt>
                  <dd className="text-slate-200 font-medium">{selected.roleLabel}</dd>
                </div>
                <div className="rounded bg-slate-900/80 px-2 py-1.5">
                  <dt className="text-slate-500">Voltage</dt>
                  <dd className="text-slate-200 font-medium">{selected.voltageKv} kV</dd>
                </div>
                <div className="rounded bg-slate-900/80 px-2 py-1.5">
                  <dt className="text-slate-500">Height</dt>
                  <dd className="text-slate-200 font-medium">{selected.heightM} m</dd>
                </div>
                <div className="rounded bg-slate-900/80 px-2 py-1.5">
                  <dt className="text-slate-500">Typical span</dt>
                  <dd className="text-slate-200 font-medium">{selected.spanM} m</dd>
                </div>
              </dl>
            </div>
          )}

          <CatalogSection title="Corridor roles" items={corridor} selectedId={selectedId} onSelect={setSelectedId} />
          <CatalogSection title="Voltage / lattice" items={variants} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
      </div>
    </div>
  )
}

function CatalogSection({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  items: TowerTypeEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="p-3 border-b border-slate-800/80">
      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((t) => {
          const active = t.id === selectedId
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className={`w-full text-left rounded-md px-2 py-1.5 border transition-colors ${
                  active
                    ? 'bg-blue-600/15 border-blue-500/40 text-blue-100'
                    : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-[11px] font-medium truncate">{t.label}</span>
                </span>
                <span className="block text-[9px] text-slate-500 mt-0.5 pl-4">
                  {t.voltageKv} kV · {t.heightM} m
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
