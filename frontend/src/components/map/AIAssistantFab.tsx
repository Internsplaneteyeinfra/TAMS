import React, { useState } from 'react'
import { Bot, Send, X } from 'lucide-react'

import { MAP_BOTTOM_INSET } from '@/components/map/mapLayout'

const SUGGESTIONS = [
  'Show critical towers',
  'Show Maharashtra alerts',
  'Locate Tower TX-11',
  'Show wildfire risk',
  'Generate report',
]

interface AIAssistantFabProps {
  onPrompt?: (text: string) => void
  rightOffset?: string
}

export default function AIAssistantFab({ onPrompt, rightOffset = '1rem' }: AIAssistantFabProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')

  const submit = (text: string) => {
    onPrompt?.(text)
    setInput('')
    setOpen(false)
  }

  return (
    <div
      className="absolute z-[2000] flex flex-col items-end gap-2"
      style={{ right: rightOffset, bottom: MAP_BOTTOM_INSET }}
    >
      {open && (
        <div className="w-72 rounded-lg bg-[#0b1220] border border-slate-700 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-[#080d18]">
            <span className="text-[11px] font-semibold text-slate-200">Ask AI</span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 flex flex-wrap gap-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="px-2 py-1 rounded text-[9px] font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-600 hover:text-slate-100 transition"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex gap-1 p-2 border-t border-slate-800"
            onSubmit={(e) => {
              e.preventDefault()
              if (input.trim()) submit(input.trim())
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about grid assets…"
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-slate-600"
            />
            <button
              type="submit"
              className="p-1.5 rounded bg-slate-200 hover:bg-white text-slate-900"
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-lg bg-[#0b1220] border border-slate-700 flex items-center justify-center text-slate-200 hover:border-slate-500 hover:text-white transition"
        title="AI Assistant"
      >
        <Bot className="w-4.5 h-4.5" />
      </button>
    </div>
  )
}
