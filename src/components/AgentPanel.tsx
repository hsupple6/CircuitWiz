import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import type { AgentProjectContext } from '../agent/types'
import type { ProjectFolder } from '../types/workspace'
import { runAgentTurn } from '../agent/claude/runTurn'
import { ClaudeApiError, type ClaudeMessage } from '../agent/claude/types'
import { useAgentApiKey } from '../hooks/useAgentApiKey'
import {
  getAgentBackendOfflineHint,
  getAnthropicApiKeySetupHint,
} from '../services/anthropicEnv'

type RevealPhase = 'hidden' | 'header' | 'expanded'

export interface AgentPanelProps {
  projectContext?: AgentProjectContext | null
  onProjectUpdate?: (folder: ProjectFolder) => void
}

interface ChatEntry {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function AgentPanel({ projectContext = null, onProjectUpdate }: AgentPanelProps) {
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('hidden')
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const claudeHistoryRef = useRef<ClaudeMessage[]>([])

  const { hasApiKey, model, loading: statusLoading, backendOnline } = useAgentApiKey()
  const agentReady = backendOnline && hasApiKey

  useEffect(() => {
    const headerTimer = window.setTimeout(() => setRevealPhase('header'), 80)
    const expandTimer = window.setTimeout(() => {
      setRevealPhase('expanded')
      setIsExpanded(true)
    }, 520)

    return () => {
      window.clearTimeout(headerTimer)
      window.clearTimeout(expandTimer)
    }
  }, [])

  useEffect(() => {
    if (revealPhase === 'expanded' && isExpanded && agentReady) {
      inputRef.current?.focus()
    }
  }, [revealPhase, isExpanded, agentReady])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, isLoading])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const toggleExpanded = useCallback(() => {
    setIsExpanded((v) => !v)
    if (revealPhase !== 'expanded') setRevealPhase('expanded')
  }, [revealPhase])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    if (!backendOnline) {
      setError(getAgentBackendOfflineHint())
      setRevealPhase('expanded')
      setIsExpanded(true)
      return
    }

    if (!hasApiKey) {
      setError(getAnthropicApiKeySetupHint())
      setRevealPhase('expanded')
      setIsExpanded(true)
      return
    }

    setError(null)
    setInput('')
    setChat((prev) => [...prev, { id: makeId(), role: 'user', text }])
    setIsLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await runAgentTurn({
        history: claudeHistoryRef.current,
        userMessage: text,
        projectContext,
        signal: controller.signal,
      })

      claudeHistoryRef.current = result.messages

      if (result.updatedContext?.folder && onProjectUpdate) {
        onProjectUpdate(result.updatedContext.folder)
      }

      setChat((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: result.assistantText || '(No response)',
        },
      ])
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return

      const message =
        err instanceof ClaudeApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong'

      setChat((prev) => [...prev, { id: makeId(), role: 'error', text: message }])
      setError(message)
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [backendOnline, hasApiKey, input, isLoading, onProjectUpdate, projectContext])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const showBody = revealPhase === 'expanded' && isExpanded
  const headerVisible = revealPhase !== 'hidden'

  const statusLabel = statusLoading
    ? 'Claude · connecting…'
    : !backendOnline
      ? 'Claude · backend offline'
      : !hasApiKey
        ? 'Claude · API key missing'
        : `Claude · ${model || 'ready'}`

  return (
    <aside
      className={`agent-panel flex h-full min-h-0 w-full flex-col p-4 ${
        headerVisible ? 'agent-panel--visible' : ''
      }`}
      aria-label="Carbon Agent"
    >
      <div className="carbon-card flex min-h-0 flex-1 flex-col overflow-hidden border-primary-400/15 shadow-xl shadow-black/40">
        <div
          role="button"
          tabIndex={0}
          onClick={toggleExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleExpanded()
            }
          }}
          className="flex w-full shrink-0 cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
          aria-expanded={showBody}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-400/15">
            <Sparkles className="h-4 w-4 text-primary-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">Carbon Agent</h2>
            <p className="truncate text-xs text-zinc-500">{statusLabel}</p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
        </div>

        <div
          className={`agent-panel-body min-h-0 flex-1 border-t border-white/[0.06] ${
            showBody ? 'agent-panel-body--expanded' : ''
          }`}
        >
          <div className="agent-panel-body-inner flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
              {!statusLoading && !backendOnline && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                  {getAgentBackendOfflineHint()}
                </div>
              )}

              {!statusLoading && backendOnline && !hasApiKey && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                  {getAnthropicApiKeySetupHint()}
                </div>
              )}

              {chat.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Bot className="mb-3 h-8 w-8 text-zinc-600" />
                  <p className="text-sm text-zinc-400">
                    Ask about circuits, firmware, or project planning.
                  </p>
                  {!projectContext && (
                    <p className="mt-2 text-xs text-zinc-600">
                      Open a project to enable design tools.
                    </p>
                  )}
                </div>
              )}

              {chat.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    entry.role === 'user'
                      ? 'ml-6 bg-primary-400/10 text-zinc-100'
                      : entry.role === 'error'
                        ? 'mr-6 border border-red-500/20 bg-red-500/10 text-red-300'
                        : 'mr-6 bg-carbon-elevated text-zinc-300'
                  }`}
                >
                  {entry.text}
                </div>
              ))}

              {isLoading && (
                <div className="mr-6 flex items-center gap-2 rounded-lg bg-carbon-elevated px-3 py-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
                  Thinking…
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="mx-4 mb-2 flex shrink-0 items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="shrink-0 text-red-400 hover:text-red-200"
                  aria-label="Dismiss error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="shrink-0 border-t border-white/[0.06] p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  disabled={isLoading || !agentReady}
                  placeholder={
                    agentReady
                      ? 'Message Carbon Agent…'
                      : 'Waiting for agent backend…'
                  }
                  className="input-field min-h-[2.75rem] flex-1 resize-none rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isLoading || !input.trim() || !agentReady}
                  className="btn btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
