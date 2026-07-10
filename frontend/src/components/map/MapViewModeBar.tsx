import React from 'react'

import { Box, Globe, Map as MapIcon, Mountain, Satellite } from 'lucide-react'



export type MapBasemap = '3d' | '2d' | 'street' | 'satellite' | 'terrain'



const MODES: { id: MapBasemap; label: string; icon: React.ElementType }[] = [

  { id: '3d', label: '3D', icon: Box },

  { id: '2d', label: '2D', icon: MapIcon },

  { id: 'street', label: 'Street', icon: Globe },

  { id: 'satellite', label: 'Satellite', icon: Satellite },

  { id: 'terrain', label: 'Terrain', icon: Mountain },

]



interface MapViewModeBarProps {

  mode: MapBasemap

  onChange: (mode: MapBasemap) => void

  variant?: 'floating' | 'inline' | 'rail'

}



export default function MapViewModeBar({ mode, onChange, variant = 'floating' }: MapViewModeBarProps) {

  const isRail = variant === 'rail'



  return (

    <div

      className={`bg-[#0a1020]/95 backdrop-blur-xl rounded-lg p-0.5 border border-slate-700/80 shadow-xl gap-0.5 ${isRail

        ? 'flex flex-col w-9 shrink-0'

        : `flex shrink-0 ${variant === 'inline' ? '' : 'absolute top-3 right-14 z-[2001]'}`

        }`}

      role="group"

      aria-label="Map view mode"

    >

      {MODES.map((m) => {

        const Icon = m.icon

        return (

          <button

            key={m.id}

            type="button"

            title={m.label}

            onClick={() => onChange(m.id)}

            className={`${isRail ? 'w-full h-8' : variant === 'inline' ? 'px-1.5 py-1.5' : 'px-2 py-1.5'

              } text-[9px] font-extrabold uppercase tracking-wider rounded-md flex items-center justify-center gap-1 transition ${mode === m.id

                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'

                : 'text-slate-400 hover:text-white hover:bg-slate-800'

              }`}

          >

            <Icon className="w-3.5 h-3.5 shrink-0" />

            {!isRail && variant !== 'inline' && <span className="hidden sm:inline">{m.label}</span>}

          </button>

        )

      })}

    </div>

  )

}


