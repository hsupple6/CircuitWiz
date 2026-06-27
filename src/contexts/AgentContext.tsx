import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AgentProjectContext, AgentUiAction } from '../agent/types'
import type { ClaudeMessage } from '../agent/claude/types'
import type { ProjectFolder } from '../types/workspace'
import { runAgentTurn } from '../agent/claude/runTurn'
import { ClaudeApiError } from '../agent/claude/types'
import { clearProductSuiteSession } from '../agent/product/operations'

export type AgentRevealPhase = 'hidden' | 'header' | 'expanded'

export interface AgentChatEntry {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
}

interface AgentContextValue {
  revealPhase: AgentRevealPhase
  isExpanded: boolean
  setIsExpanded: (value: boolean | ((prev: boolean) => boolean)) => void
  toggleExpanded: () => void
  ensureExpanded: () => void
  chat: AgentChatEntry[]
  isLoading: boolean
  isStreaming: boolean
  streamingMessageId: string | null
  statusHint: string | null
  error: string | null
  setError: (error: string | null) => void
  sendMessage: (text: string) => Promise<void>
  submitProductIdea: (idea: string) => Promise<void>
  projectContext: AgentProjectContext | null
  productSuiteOpen: boolean
  productSuiteLoading: boolean
  openProductSuite: () => void
  closeProductSuite: () => void
}

const AgentContext = createContext<AgentContextValue | null>(null)

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildProductIdeaContinuationMessage(idea: string): string {
  return `[Product Suite continuation] The user described what they want to build:
"${idea}"

Generate 6–12 product-specific custom questions for this exact product and call product_open_new_product_suite with phase "questions", the idea, and those questions (with suggestedAnswer pre-fills for human review). Questions must be tailored to this product — not a generic template. You may add 1–2 optional general questions (budget, unit count) at the very end only. Mark technical questions with technical:true.`
}

interface AgentProviderProps {
  children: ReactNode
  projectContext: AgentProjectContext | null
  onProjectUpdate?: (folder: ProjectFolder) => void
}

export function AgentProvider({
  children,
  projectContext,
  onProjectUpdate,
}: AgentProviderProps) {
  const [revealPhase, setRevealPhase] = useState<AgentRevealPhase>('hidden')
  const [isExpanded, setIsExpanded] = useState(false)
  const [chat, setChat] = useState<AgentChatEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [productSuiteOpen, setProductSuiteOpen] = useState(false)
  const [productSuiteLoading, setProductSuiteLoading] = useState(false)

  const claudeHistoryRef = useRef<ClaudeMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const projectContextRef = useRef(projectContext)
  projectContextRef.current = projectContext

  useEffect(() => {
    const headerTimer = window.setTimeout(() => setRevealPhase('header'), 80)
    const expandTimer = window.setTimeout(() => {
      setRevealPhase('expanded')
      setIsExpanded(true)
    }, 520)

    return () => {
      window.clearTimeout(headerTimer)
      window.clearTimeout(expandTimer)
      abortRef.current?.abort()
    }
  }, [])

  const toggleExpanded = useCallback(() => {
    setIsExpanded((v) => !v)
    setRevealPhase((phase) => (phase === 'expanded' ? phase : 'expanded'))
  }, [])

  const ensureExpanded = useCallback(() => {
    setRevealPhase('expanded')
    setIsExpanded(true)
  }, [])

  const openProductSuite = useCallback(() => {
    setProductSuiteOpen(true)
  }, [])

  const closeProductSuite = useCallback(() => {
    setProductSuiteOpen(false)
    setProductSuiteLoading(false)
  }, [])

  useEffect(() => {
    if (projectContext?.folder.productSuiteSession) {
      setProductSuiteOpen(true)
      setProductSuiteLoading(false)
    }
  }, [projectContext?.folder.productSuiteSession?.id])

  const runTurn = useCallback(
    async (userMessage: string, options?: { chatUserText?: string }) => {
      const trimmed = userMessage.trim()
      if (!trimmed || isLoading) return

      setError(null)
      setStatusHint(null)

      if (options?.chatUserText) {
        setChat((prev) => [...prev, { id: makeId(), role: 'user', text: options.chatUserText! }])
      }

      setIsLoading(true)
      setIsStreaming(false)

      const assistantId = makeId()
      setStreamingMessageId(assistantId)
      setChat((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const result = await runAgentTurn({
          history: claudeHistoryRef.current,
          userMessage: trimmed,
          projectContext: projectContextRef.current,
          signal: controller.signal,
          onTextDelta: (delta) => {
            setIsStreaming(true)
            setStatusHint(null)
            setChat((prev) =>
              prev.map((entry) =>
                entry.id === assistantId ? { ...entry, text: entry.text + delta } : entry
              )
            )
          },
          onToolUseStart: (toolName) => {
            setIsStreaming(false)
            setStatusHint(`Using ${toolName.replace(/_/g, ' ')}…`)
            if (toolName === 'product_open_new_product_suite') {
              setProductSuiteOpen(true)
              setProductSuiteLoading(true)
            }
          },
        })

        claudeHistoryRef.current = result.messages

        if (result.updatedContext?.folder && onProjectUpdate) {
          onProjectUpdate(result.updatedContext.folder)
        }

        if (result.uiActions?.some((a: AgentUiAction) => a.type === 'open_product_suite')) {
          setProductSuiteOpen(true)
          setProductSuiteLoading(false)
        }

        setChat((prev) =>
          prev.map((entry) => {
            if (entry.id !== assistantId) return entry
            if (entry.text.trim().length > 0) return entry
            return { ...entry, text: result.assistantText || '(No response)' }
          })
        )
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return

        const message =
          err instanceof ClaudeApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong'

        setChat((prev) => {
          const withoutEmptyAssistant = prev.filter(
            (entry) => !(entry.id === assistantId && entry.text.length === 0)
          )
          return [...withoutEmptyAssistant, { id: makeId(), role: 'error', text: message }]
        })
        setError(message)
        setProductSuiteLoading(false)
        if (!projectContextRef.current?.folder.productSuiteSession) {
          setProductSuiteOpen(false)
        }
      } finally {
        setIsLoading(false)
        setIsStreaming(false)
        setStreamingMessageId(null)
        setStatusHint(null)
        abortRef.current = null
      }
    },
    [isLoading, onProjectUpdate]
  )

  const sendMessage = useCallback(
    async (text: string) => {
      await runTurn(text, { chatUserText: text.trim() })
    },
    [runTurn]
  )

  const submitProductIdea = useCallback(
    async (idea: string) => {
      const trimmed = idea.trim()
      if (!trimmed) return

      const folder = projectContextRef.current?.folder
      if (folder && onProjectUpdate) {
        onProjectUpdate(clearProductSuiteSession(folder))
      }

      setProductSuiteOpen(true)
      setProductSuiteLoading(true)
      ensureExpanded()

      await runTurn(buildProductIdeaContinuationMessage(trimmed), {
        chatUserText: `Product idea: ${trimmed}`,
      })
    },
    [runTurn, onProjectUpdate, ensureExpanded]
  )

  const value = useMemo<AgentContextValue>(
    () => ({
      revealPhase,
      isExpanded,
      setIsExpanded,
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
      submitProductIdea,
      projectContext,
      productSuiteOpen,
      productSuiteLoading,
      openProductSuite,
      closeProductSuite,
    }),
    [
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
      sendMessage,
      submitProductIdea,
      projectContext,
      productSuiteOpen,
      productSuiteLoading,
      openProductSuite,
      closeProductSuite,
    ]
  )

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext)
  if (!ctx) {
    throw new Error('useAgent must be used within AgentProvider')
  }
  return ctx
}
