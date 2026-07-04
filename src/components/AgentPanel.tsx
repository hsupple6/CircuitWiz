import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Bug,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react'
import { useAgent } from '../contexts/AgentContext'
import { useAgentApiKey } from '../hooks/useAgentApiKey'
import {
  getAgentBackendOfflineHint,
  getAnthropicApiKeySetupHint,
} from '../services/anthropicEnv'
import { AgentDevPanel } from './AgentDevPanel'
import { MarkdownPreview } from './MarkdownPreview'

export function AgentPanel({
  embedded = false,
  floating = false,
  docked = false,
  onHeaderToggle,
  className = '',
}: {
  embedded?: boolean
  floating?: boolean
  docked?: boolean
  onHeaderToggle?: () => void
  className?: string
}) {
  const {
    revealPhase,
    isExpanded,
    toggleExpanded,
    ensureExpanded,
    chat,
    isLoading,
    isStreaming,
    streamingMessageId,
    statusHint,
    error,
    setError,
    sendMessage,
    stopAgent,
    projectContext,
  } = useAgent()

  const [input, setInput] = useState('')
  const [devOpen, setDevOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { hasApiKey, model, loading: statusLoading, backendOnline } = useAgentApiKey()
  const agentReady = backendOnline && hasApiKey

  useEffect(() => {
    if (revealPhase === 'expanded' && isExpanded && agentReady) {
      inputRef.current?.focus()
    }
  }, [revealPhase, isExpanded, agentReady])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, isLoading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    if (!backendOnline) {
      setError(getAgentBackendOfflineHint())
      ensureExpanded()
      return
    }

    if (!hasApiKey) {
      setError(getAnthropicApiKeySetupHint())
      ensureExpanded()
      return
    }

    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const showBody = docked || (revealPhase === 'expanded' && isExpanded)
  const headerVisible = !docked && revealPhase !== 'hidden'
  const hasRunningTool = chat.some((entry) => entry.role === 'tool' && entry.status === 'running')

  const handleHeaderToggle = () => {
    if (onHeaderToggle) onHeaderToggle()
    else toggleExpanded()
  }

  const statusLabel = statusLoading
    ? 'Claude · connecting…'
    : !backendOnline
      ? 'Claude · backend offline'
      : !hasApiKey
        ? 'Claude · API key missing'
        : `Claude · ${model || 'ready'}`

  return (
    <aside
      className={`agent-panel flex min-h-0 w-full flex-col ${
        embedded || floating ? 'h-full flex-1 p-0' : 'h-full p-4'
      } ${docked || headerVisible ? 'agent-panel--visible' : ''} ${className}`}
      aria-label="Carbon Agent"
    >
      <div
        className={`flex min-h-0 flex-col overflow-hidden ${
          floating
            ? 'h-full min-h-0'
            : `carbon-card border-primary-400/15 shadow-xl shadow-black/40 dark:bg-dark-card ${
                embedded && showBody ? 'h-full flex-1' : embedded ? '' : 'flex-1'
              }`
        }`}
      >
        {!docked && (
        <div
          role="button"
          tabIndex={0}
          onClick={handleHeaderToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleHeaderToggle()
            }
          }}
          className="flex w-full shrink-0 cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
          aria-expanded={showBody}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-400/15">
            <Sparkles className="h-4 w-4 text-primary-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Carbon Agent</h2>
            <p className="truncate text-xs text-gray-500 dark:text-zinc-500">{statusLabel}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDevOpen(true)
            }}
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/[0.05] hover:text-amber-400"
            title="Agent dev log"
            aria-label="Agent dev log"
          >
            <Bug className="h-4 w-4" />
          </button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
        </div>
        )}

        <div
          className={`agent-panel-body min-h-0 flex-1 ${docked ? '' : 'border-t border-white/[0.06]'} ${
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

              {chat.map((entry) => {
                if (entry.role === 'tool') {
                  const completed = entry.status === 'completed'
                  const failed = completed && entry.success === false
                  return (
                    <div
                      key={entry.id}
                      className={`mr-6 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                        completed
                          ? failed
                            ? 'border-red-500/20 bg-red-500/10 text-red-300'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/[0.06] bg-carbon-elevated text-zinc-400'
                      }`}
                    >
                      {completed ? (
                        <Check className={`h-3.5 w-3.5 shrink-0 ${failed ? 'text-red-400' : 'text-emerald-400'}`} />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-400" />
                      )}
                      <span>
                        {completed
                          ? failed
                            ? `Failed · ${entry.label}`
                            : `Completed · ${entry.label}`
                          : `Using ${entry.label}…`}
                      </span>
                    </div>
                  )
                }

                if (entry.role === 'assistant' && entry.text.trim().length === 0) {
                  return null
                }

                return (
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
                    {entry.role === 'assistant' ? (
                      <>
                        <MarkdownPreview content={entry.text} variant="agent" />
                        {entry.id === streamingMessageId && isStreaming && (
                          <span className="agent-stream-cursor ml-0.5 inline-block text-primary-400" />
                        )}
                      </>
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{entry.text}</span>
                    )}
                  </div>
                )
              })}

              {isLoading && !isStreaming && !hasRunningTool && (
                <div className="mr-6 flex items-center gap-2 rounded-lg bg-carbon-elevated px-3 py-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
                  {statusHint ?? 'Thinking…'}
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
                    agentReady ? 'Message Carbon Agent…' : 'Waiting for agent backend…'
                  }
                  className="input-field min-h-[2.75rem] flex-1 resize-none rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stopAgent}
                    className="btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                    aria-label="Stop agent"
                    title="Stop"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || !agentReady}
                    className="btn btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AgentDevPanel open={devOpen} onClose={() => setDevOpen(false)} />
    </aside>
  )
}
