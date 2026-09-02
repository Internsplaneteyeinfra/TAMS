import { describe, expect, it } from 'vitest'

import { resolveSignal } from '../signalResolver'
import { rainbowColorForTower, rainbowColorsForCount } from '../../towerPlanning/rainbowColors'

describe('resolveSignal', () => {
  it('returns primary when primary succeeds', async () => {
    const r = await resolveSignal({
      id: 'test',
      primary: async () => 42,
    })
    expect(r.value).toBe(42)
    expect(r.status).toBe('RESOLVED')
    expect(r.fallbackUsed).toBe(false)
  })

  it('falls through to engineering model when providers fail', async () => {
    const r = await resolveSignal({
      id: 'test',
      primary: async () => null,
      secondary: async () => null,
      engineeringFallback: async () => 100,
      modelConfidence: 60,
    })
    expect(r.value).toBe(100)
    expect(r.status).toBe('MODELLED')
    expect(r.fallbackUsed).toBe(true)
  })

  it('never throws when all providers fail', async () => {
    const r = await resolveSignal({
      id: 'test',
      primary: async () => {
        throw new Error('timeout')
      },
      engineeringFallback: async () => null,
    })
    expect(r.status).toBe('PARTIAL')
    expect(r.value).toBeNull()
  })
})

describe('rainbowColors', () => {
  it('assigns distinct base colors for T-01 to T-06', () => {
    const colors = rainbowColorsForCount(6).map((c) => c.hex)
    expect(new Set(colors).size).toBe(6)
  })

  it('extends palette beyond six towers', () => {
    const c7 = rainbowColorForTower(7)
    expect(c7.hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
