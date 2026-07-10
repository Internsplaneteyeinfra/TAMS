import React, { useState } from 'react'
import { Bot, Send, Sparkles, X } from 'lucide-react'

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
    <div className="absolute bottom-14 z-[2000] flex flex-col items-end gap-2" style={{ right: rightOffset }}>
      {open && (
        <div className="w-72 rounded-2xl bg-[#0e172a]/95 border border-slate-700 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Ask AI
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 flex flex-wrap gap-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="px-2 py-1 rounded-full text-[9px] font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300 transition"
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
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-indigo-500/50"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
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
        className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 border border-indigo-400/30 shadow-xl shadow-indigo-500/25 flex items-center justify-center text-white hover:scale-105 transition-transform"
        title="AI Assistant"
      >
        <Bot className="w-5 h-5" />
      </button>
    </div>
  )
}
