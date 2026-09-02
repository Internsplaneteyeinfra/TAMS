import React from 'react'

import { SEARCH_RADIUS_OPTIONS_KM } from '../nearbyPowerSupply'

export default function SearchRadiusPicker({
  value,
  onChange,
  compact = false,
}: {
  value: number
  onChange: (km: number) => void
  /** Shorter helper text for the top map bar */
  compact?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-[#263238]">Search radius</p>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
          <button
            key={km}
            type="button"
            title={`Search existing grid within ${km} km of the focus point`}
            onClick={() => onChange(km)}
            className={`h-8 rounded-lg text-[10px] font-black border ${
              value === km
                ? 'bg-[#17879a] text-white border-[#126b79]'
                : 'bg-white/55 text-[#263238] border-[rgba(51,65,85,0.16)] hover:border-[#17879a]'
            }`}
          >
            {km} km
          </button>
        ))}
      </div>
      {!compact && (
        <p className="mt-1 text-[10px] text-[#263238] leading-snug">
          Ground distance from the start point (not map pixels). 8 km = 8,000 m around the pad — it looks
          large on satellite zoom because a village is only a few km across. The cyan ring is this radius.
          Live TAMS + OSM search existing grid inside it. Max 50 km.
        </p>
      )}
      {compact && (
        <p className="mt-1 text-[9px] text-[#66727a] leading-snug">
          Ground km from start · cyan ring on map · TAMS + OSM grid search
        </p>
      )}
    </div>
  )
}
