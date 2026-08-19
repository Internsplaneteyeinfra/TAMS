import React from 'react'

import LiveDataProvenancePanel from '../LiveDataProvenancePanel'
import type { SiteSignals } from '../scoring'

export default function LiveSignalsPanel({
  signals,
  hasTowerPlan,
}: {
  signals?: SiteSignals | null
  hasTowerPlan?: boolean
}) {
  return <LiveDataProvenancePanel signals={signals} hasTowerPlan={hasTowerPlan} embedded />
}
