export type LandingModuleId = 'suitability' | 'analyzer' | 'performance'

export type ViewportTier = 'desktop' | 'tablet' | 'mobile'

/** Intro behavior: full build-up, fast-forward (returning users), instant (reduced motion). */
export type NetworkMode = 'full' | 'fast' | 'instant'

export type NetworkEvent =
  | 'mapping' // towers being revealed
  | 'connecting' // conductor lines drawing
  | 'energizing' // energy wavefront traveling
  | 'pulse' // transformer activated
  | 'scanDone' // network scan finished
  | 'initialized' // UI may reveal
  | 'verified' // periodic ambient verification pass completed

/** Mutable per-frame progress shared between the timeline driver and scene parts. */
export interface NetProgress {
  towers: number[] // entrance 0..1 per tower
  transformer: number // entrance 0..1
  lineDraw: number // corridor connection 0..1
  wavefront: number // first energy pass 0..1 (-1 once steady flow takes over)
  energyOn: boolean
  pulse: number // transformer activation pulse, decays 1→0
  scan: number // scan position along corridor 0..1, -1 when inactive
  scanActive: boolean
  scanStrength: number // 1 = intro scan; ambient verification passes are subtler
  dim: number // ambient dim after UI appears, 0..1
  initialized: boolean
  hoverTower: number // pointer-hovered tower index, -1 when none
}

export function createProgress(towerCount: number): NetProgress {
  return {
    towers: Array(towerCount).fill(0),
    transformer: 0,
    lineDraw: 0,
    wavefront: 0,
    energyOn: false,
    pulse: 0,
    scan: -1,
    scanActive: false,
    scanStrength: 1,
    dim: 0,
    initialized: false,
    hoverTower: -1,
  }
}
