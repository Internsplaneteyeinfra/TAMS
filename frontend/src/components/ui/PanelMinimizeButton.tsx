import React from 'react'

import { ChevronDown, Maximize2, X } from 'lucide-react'



interface PanelMinimizeButtonProps {

  minimized?: boolean

  onClick: (e: React.MouseEvent) => void

  title?: string

  'aria-label'?: string

  variant?: 'icon' | 'hide' | 'close'

}



export default function PanelMinimizeButton({

  minimized = false,

  onClick,

  title,

  'aria-label': ariaLabel,

  variant = 'icon',

}: PanelMinimizeButtonProps) {

  const label = ariaLabel || title || (minimized ? 'Expand' : 'Minimize')



  if (variant === 'hide') {

    return (

      <button

        type="button"

        onClick={onClick}

        title={title || label}

        aria-label={label}

        className="h-6 px-2 flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-400 hover:bg-slate-700 transition shrink-0"

      >

        {minimized ? <Maximize2 className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}

        <span className="text-[8px] font-bold uppercase tracking-wider">{minimized ? 'Show' : 'Hide'}</span>

      </button>

    )

  }



  if (variant === 'close') {

    return (

      <button

        type="button"

        onClick={onClick}

        title={title || 'Close panel'}

        aria-label={ariaLabel || 'Close panel'}

        className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-slate-300 hover:text-white hover:border-red-400/50 hover:bg-slate-700 transition shrink-0"

      >

        <X className="w-3.5 h-3.5" />

      </button>

    )

  }



  return (

    <button

      type="button"

      onClick={onClick}

      title={title || label}

      aria-label={label}

      className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-slate-300 hover:text-white hover:border-blue-400/50 hover:bg-slate-700 transition shrink-0"

    >

      {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}

    </button>

  )

}


