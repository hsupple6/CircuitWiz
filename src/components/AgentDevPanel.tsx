import { useEffect, useState } from 'react'
import { Bug, Copy, Play, Trash2, X } from 'lucide-react'
import {
  clearAgentDevLog,
  getAgentDevLog,
  subscribeAgentDevLog,
  type AgentDevLogEntry,
} from '../services/agentDevLog'
import { useAgent } from '../contexts/AgentContext'

function formatPayload(payload: unknown): string {
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function entryColor(type: AgentDevLogEntry['type']): string {
  switch (type) {
    case 'tool_call':
      return 'text-sky-300'
    case 'tool_result':
      return 'text-emerald-300'
    case 'error':
      return 'text-red-300'
    case 'api_response':
      return 'text-violet-300'
    case 'assistant_text':
      return 'text-zinc-300'
    case 'turn_start':
    case 'turn_end':
      return 'text-amber-300'
    default:
      return 'text-zinc-400'
  }
}

function EntryBlock({ entry }: { entry: AgentDevLogEntry }) {
  const payload = formatPayload(entry.payload)
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/40 p-2.5 text-[11px] leading-relaxed font-mono">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={`font-semibold uppercase tracking-wide ${entryColor(entry.type)}`}>
          {entry.type}
        </span>
        {entry.toolName && <span className="text-zinc-500">{entry.toolName}</span>}
        {entry.round != null && <span className="text-zinc-600">round {entry.round}</span>}
        <span className="ml-auto text-zinc-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      </div>
      {payload && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-zinc-400">{payload}</pre>
      )}
    </div>
  )
}

export function AgentDevPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [entries, setEntries] = useState<AgentDevLogEntry[]>(() => getAgentDevLog())
  const [testRunning, setTestRunning] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const { runDevTestCase } = useAgent()

  useEffect(() => {
    return subscribeAgentDevLog(() => setEntries(getAgentDevLog()))
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const copyAll = async () => {
    const text = entries
      .map((e) => `[${e.timestamp}] ${e.type}${e.toolName ? ` ${e.toolName}` : ''}\n${formatPayload(e.payload)}`)
      .join('\n\n---\n\n')
    await navigator.clipboard.writeText(text)
  }

  const runPlacementTest = async () => {
    setTestRunning(true)
    setTestMessage(null)
    try {
      const result = await runDevTestCase()
      setTestMessage(result.message)
    } finally {
      setTestRunning(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/40" aria-hidden onClick={onClose} />
      <aside
        className="fixed right-0 top-0 z-[121] flex h-full w-full max-w-2xl flex-col border-l border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
        aria-label="Agent dev log"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-amber-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Agent Dev Log</h2>
              <p className="text-xs text-zinc-500">Raw tool calls, API responses, and results</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void runPlacementTest()}
              disabled={testRunning}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
              title="Run switch-controlled LED via schematic_place_component + schematic_connect_pins"
            >
              <span className="inline-flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5" />
                {testRunning ? 'Running…' : 'Switch LED test'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void copyAll()}
              className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
              title="Copy all"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => clearAgentDevLog()}
              className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
              title="Clear log"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {testMessage && (
          <p
            className={`border-b border-white/[0.06] px-4 py-2 text-xs ${
              testMessage.includes('passed') ? 'text-emerald-400' : 'text-red-300'
            }`}
          >
            {testMessage}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-600">
              No agent activity yet. Send a message to Carbon Agent to populate the log.
            </p>
          ) : (
            [...entries].reverse().map((entry) => <EntryBlock key={entry.id} entry={entry} />)
          )}
        </div>
      </aside>
    </>
  )
}

export function AgentDevToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-amber-400"
      title="Open agent dev log"
      aria-label="Open agent dev log"
    >
      <Bug className="h-4 w-4" />
    </button>
  )
}
