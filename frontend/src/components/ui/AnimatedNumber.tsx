import React from 'react'

import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return Math.round(n).toLocaleString()
  if (abs >= 100) return String(Math.round(n))
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

interface AnimatedNumberProps {
  value: number
  className?: string
  /** Force integer display (default true for counts). */
  integer?: boolean
  format?: (n: number) => string
  durationMs?: number
}

export default function AnimatedNumber({
  value,
  className,
  integer = true,
  format,
  durationMs = 260,
}: AnimatedNumberProps) {
  const animated = useAnimatedNumber(value, durationMs)
  const shown = integer ? Math.round(animated) : animated
  let text: string
  try {
    text = format ? format(shown) : formatCompact(shown)
  } catch {
    text = String(Math.round(value))
  }
  return (
    <span className={className} aria-label={String(Math.round(value))}>
      {text}
    </span>
  )
}
