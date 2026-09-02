/**
 * Rainbow tower candidate colors — unique HSL distribution for T-01 … T-N.
 */

const BASE_RAINBOW = [
  { hex: '#ef4444', label: 'Red' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#eab308', label: 'Yellow' },
  { hex: '#22c55e', label: 'Green' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#a855f7', label: 'Purple' },
]

/** Color for tower index (1-based). */
export function rainbowColorForTower(index1Based: number): { hex: string; label: string } {
  if (index1Based <= BASE_RAINBOW.length) {
    return BASE_RAINBOW[index1Based - 1]
  }
  const hue = ((index1Based - 1) * 137.508) % 360
  return { hex: hslToHex(hue, 72, 48), label: `H${Math.round(hue)}` }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * color)
  }
  const r = f(0)
  const g = f(8)
  const b = f(4)
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

export function rainbowColorsForCount(count: number): Array<{ hex: string; label: string }> {
  return Array.from({ length: count }, (_, i) => rainbowColorForTower(i + 1))
}
