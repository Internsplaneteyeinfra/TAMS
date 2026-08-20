import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyBlendStyles,
  clearBlendStyles,
  useLandingTheme,
} from '@/theme/LandingThemeContext'
import {
  getSettledCelestialLayout,
  getTransitionArcLayout,
  horizonRiseClip,
} from '@/theme/celestialArc'
import CelestialBodySvg from './CelestialBodySvg'

const DRAG_COMMIT_PX = 110

/**
 * Settled sun/moon sits high in the sky. Drag horizontally to trigger theme change.
 * Theme transitions travel along the bottom horizon arc.
 */
export default function CelestialDragControl() {
  const {
    appearance,
    isTransitioning,
    celestial,
    dragArcURef,
    themeBlendRef,
    transitionLockRef,
    requestAppearance,
  } = useLandingTheme()

  const [mounted, setMounted] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragDx, setDragDx] = useState(0)
  const [viewport, setViewport] = useState({ w: 1200, h: 800 })
  const landingElRef = useRef<HTMLElement | null>(null)
  const dragStartXRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    onResize()
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    landingElRef.current = document.querySelector('.tams-landing') as HTMLElement | null
  }, [])

  const isLight = appearance === 'light'
  const showTransition = isTransitioning && celestial && celestial.bodyOpacity > 0.02
  const showSettled = !isTransitioning && mounted

  const settled = getSettledCelestialLayout(viewport.w, viewport.h)
  const size = 64 * settled.scale

  const previewBlend = dragging
    ? isLight
      ? Math.max(0, 1 - dragDx / (viewport.w * 0.22))
      : Math.min(1, -dragDx / (viewport.w * 0.22))
    : isLight
      ? 1
      : 0

  useEffect(() => {
    if (!dragging) return
    themeBlendRef.current = previewBlend
    applyBlendStyles(landingElRef.current, previewBlend)
  }, [dragDx, dragging, previewBlend, themeBlendRef])

  const endDrag = useCallback(
    (dx: number) => {
      setDragging(false)
      dragArcURef.current = null
      setDragDx(0)

      if (isLight && dx >= DRAG_COMMIT_PX) {
        requestAppearance('dark')
        return
      }
      if (!isLight && dx <= -DRAG_COMMIT_PX) {
        requestAppearance('light')
        return
      }

      transitionLockRef.current = false
      themeBlendRef.current = isLight ? 1 : 0
      clearBlendStyles(landingElRef.current)
    },
    [dragArcURef, isLight, requestAppearance, themeBlendRef, transitionLockRef]
  )

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartXRef.current
      const clamped = isLight ? Math.max(0, dx) : Math.min(0, dx)
      setDragDx(clamped)
    }

    const onUp = (e: PointerEvent) => {
      endDrag(e.clientX - dragStartXRef.current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, endDrag, isLight])

  if (!mounted) return null

  if (showTransition && celestial) {
    const { x, y, scale, bodyOpacity, sunOpacity, moonOpacity, arcU } = celestial
    const tSize = 64 * scale
    const transitionLayout = getTransitionArcLayout(viewport.w, viewport.h)
    const clip = horizonRiseClip(arcU, transitionLayout, tSize)
    return (
      <div
        className="tams-celestial-layer pointer-events-none fixed inset-0 z-[11] overflow-hidden"
        aria-hidden
      >
        <div
          className="tams-celestial-body absolute will-change-transform"
          style={{
            left: 0,
            top: 0,
            width: tSize,
            height: tSize,
            opacity: bodyOpacity,
            clipPath: clip,
            transform: `translate(${x - tSize / 2}px, ${y - tSize / 2}px)`,
          }}
        >
          <CelestialBodySvg sunOpacity={sunOpacity} moonOpacity={moonOpacity} />
        </div>
      </div>
    )
  }

  if (!showSettled) return null

  const offsetX = dragging ? dragDx * 0.35 : 0

  return (
    <div className="tams-celestial-drag fixed inset-0 z-[11] overflow-hidden pointer-events-none">
      <button
        type="button"
        className="tams-celestial-body tams-celestial-drag-handle absolute touch-none cursor-grab active:cursor-grabbing pointer-events-auto will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-full"
        style={{
          left: 0,
          top: 0,
          width: size,
          height: size,
          transform: `translate(${settled.x - size / 2 + offsetX}px, ${settled.y - size / 2}px)`,
          transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        aria-label={isLight ? 'Drag sun right for dark mode' : 'Drag moon left for light mode'}
        onPointerDown={(e) => {
          if (transitionLockRef.current) return
          e.currentTarget.setPointerCapture(e.pointerId)
          transitionLockRef.current = true
          dragStartXRef.current = e.clientX
          setDragging(true)
          setDragDx(0)
        }}
      >
        <CelestialBodySvg sunOpacity={isLight ? 1 : 0} moonOpacity={isLight ? 0 : 1} />
      </button>
    </div>
  )
}
