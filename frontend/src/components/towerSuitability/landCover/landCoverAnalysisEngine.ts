/**
 * Land cover analysis — OSM tags + Nominatim supplement.
 */

import { queryOverpass } from '../siteSignals/overpassClient'
import type { LandCoverAnalysisResult, LandCoverClass } from '../siteSignals/types'

function hintFromClass(c: LandCoverClass): LandCoverAnalysisResult['hint'] {
  switch (c) {
    case 'barren':
    case 'rocky':
      return 'barren'
    case 'agriculture':
    case 'forest':
    case 'scrubland':
      return 'vegetation'
    case 'urban':
      return 'built'
    case 'water':
    case 'wetland':
      return 'water'
    default:
      return 'unknown'
  }
}

function classifyFromTags(tags: Record<string, string>): LandCoverClass {
  const t = `${tags.landuse ?? ''} ${tags.natural ?? ''} ${tags.leisure ?? ''}`.toLowerCase()
  if (/residential|industrial|commercial|retail/.test(t)) return 'urban'
  if (/forest|wood/.test(t)) return 'forest'
  if (/farmland|farm|meadow|orchard|crop/.test(t)) return 'agriculture'
  if (/water|wetland|marsh/.test(t)) return 'wetland'
  if (/scrub|heath|grass/.test(t)) return 'scrubland'
  if (/bare|rock|quarry|sand/.test(t)) return 'barren'
  return 'unknown'
}

async function nominatimLandHint(lat: number, lon: number): Promise<LandCoverClass> {
  const json = (await fetch(`/api/geo/nominatim?lat=${lat}&lon=${lon}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)) as { type?: string; class?: string; display_name?: string } | null
  const named = `${json?.type ?? ''} ${json?.class ?? ''} ${json?.display_name ?? ''}`.toLowerCase()
  if (/water|river|lake|reservoir/.test(named)) return 'water'
  if (/industrial|residential|commercial|building/.test(named)) return 'urban'
  if (/forest|wood|farm|meadow|grass|orchard|scrub|field/.test(named)) return 'agriculture'
  if (/quarry|bare|rock|heath|sand/.test(named)) return 'barren'
  return 'unknown'
}

export async function analyzeLandCover(lat: number, lon: number): Promise<LandCoverAnalysisResult> {
  const query = `[out:json][timeout:14];(
    way["landuse"](around:600,${lat},${lon});
    way["natural"](around:600,${lat},${lon});
  );out tags center 20;`
  const elements = await queryOverpass(query, 16000)
  let dominant: LandCoverClass = 'unknown'
  let source = 'OSM Overpass'

  if (elements?.length) {
    const counts = new Map<LandCoverClass, number>()
    for (const el of elements) {
      if (!el.tags) continue
      const c = classifyFromTags(el.tags)
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    let best = 0
    for (const [c, n] of counts) {
      if (n > best && c !== 'unknown') {
        best = n
        dominant = c
      }
    }
  }

  if (dominant === 'unknown') {
    dominant = await nominatimLandHint(lat, lon)
    source = 'Nominatim geographic context'
  }

  const constraint =
    dominant === 'urban' || dominant === 'wetland' ? 'HIGH' : dominant === 'forest' ? 'MODERATE' : 'LOW'

  const impact =
    dominant === 'barren' || dominant === 'agriculture'
      ? 'Open land — favourable for tower corridor screening'
      : dominant === 'urban'
        ? 'Built-up — settlement clearance review required'
        : dominant === 'forest'
          ? 'Vegetation — ROW / environmental review may apply'
          : 'Standard screening — confirm on survey'

  return {
    dominant,
    hint: hintFromClass(dominant),
    constraintLevel: constraint,
    towerSuitabilityImpact: impact,
    confidence: dominant !== 'unknown' ? 70 : 45,
    source,
  }
}

export function landCoverHintToLegacy(hint: LandCoverAnalysisResult['hint']): 'barren' | 'vegetation' | 'built' | 'water' | 'unknown' {
  return hint
}
