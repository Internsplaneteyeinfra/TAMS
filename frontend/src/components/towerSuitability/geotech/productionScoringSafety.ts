/**
 * PRODUCTION SCORING SAFETY — Geotech factor weight 0.08
 *
 * VERIFICATION (2026-08-27, pre-G5 gate):
 *
 * 1. Did weight 0.08 exist BEFORE G1–G4?
 *    YES. Introduced in commit b86e2d72 (2026-08-21)
 *    "India-first analyzer and suitability updates"
 *    — weeks before GEO-1 / G1–G4 work.
 *
 * 2. Connection to production scoring:
 *    - scoreSiteSignals() pushes factor id:'geotech', weight:0.08
 *    - Inputs: signals.geotech (field nearest) OR signals.soilScreening
 *      (SoilGrids texture → indicative confidencePct → factor score)
 *    - Feeds weighted finalScore and Preferred/Conditional/Unsuitable
 *      gates (>=7 / <4.5)
 *    - There is no separate "soilStability" factor id; geotech IS the
 *      production soil/SBC screening factor.
 *
 * 3. Did G1–G4 introduce or modify this weight?
 *    NO. G1–G4 only added optional SuitabilityResult.geotechnicalIntelligence
 *    (type field). scoreSiteSignals() body for geotech factor is unchanged.
 *    GEO block is built OUTSIDE the scorer after scoring completes.
 *
 * RULE: Do NOT remove 0.08. Do NOT feed geotechnicalIntelligence into
 * finalScore. Keep SoilGrids production texture on 0–30 cm average only.
 */

export const PRODUCTION_GEOTECH_FACTOR = {
  id: 'geotech' as const,
  weight: 0.08 as const,
  introducedInCommit: 'b86e2d72',
  introducedDate: '2026-08-21',
  g1g4ModifiedWeightOrLogic: false,
  geoIntelligenceAffectsScore: false,
}
