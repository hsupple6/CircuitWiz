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
import type { ProjectFolder, ProductDefinition } from '../types/workspace'
import { runAgentTurn } from '../agent/claude/runTurn'
import { ClaudeApiError } from '../agent/claude/types'
import { runSwitchControlledLedPlacementTest } from '../agent/schematic/devTestCases'
import { appendAgentDevLog } from '../services/agentDevLog'
import { clearProductSuiteSession } from '../agent/product/operations'
import { startMultiMicrocontrollerGPIO } from '../systems/ElectricalSystem'

export type AgentRevealPhase = 'hidden' | 'header' | 'expanded'

export type AgentChatEntry =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string }
  | { id: string; role: 'error'; text: string }
  | {
      id: string
      role: 'tool'
      toolName: string
      label: string
      status: 'running' | 'completed'
      success?: boolean
    }

function formatToolLabel(toolName: string): string {
  return toolName.replace(/_/g, ' ')
}

interface AgentContextValue {
  revealPhase: AgentRevealPhase
  isExpanded: boolean
  setIsExpanded: (value: boolean | ((prev: boolean) => boolean)) => void
  toggleExpanded: () => void
  ensureExpanded: () => void
  hideAgent: () => void
  showAgentChrome: () => void
  projectsAgentColumnOpen: boolean
  setProjectsAgentColumnOpen: (open: boolean) => void
  chat: AgentChatEntry[]
  isLoading: boolean
  isStreaming: boolean
  streamingMessageId: string | null
  statusHint: string | null
  error: string | null
  setError: (error: string | null) => void
  sendMessage: (text: string) => Promise<void>
  stopAgent: () => void
  submitProductIdea: (idea: string) => Promise<void>
  submitProductSuiteCompletion: (folder: ProjectFolder) => Promise<void>
  projectContext: AgentProjectContext | null
  productSuiteOpen: boolean
  productSuiteLoading: boolean
  openProductSuite: () => void
  closeProductSuite: () => void
  runDevTestCase: () => Promise<{ success: boolean; message: string }>
}

const AgentContext = createContext<AgentContextValue | null>(null)

export { AgentContext }

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildProductIdeaContinuationMessage(idea: string): string {
  return `[Product Suite continuation] The user described what they want to build:
"${idea}"

Generate 6–12 product-specific custom questions for this exact product and call product_open_new_product_suite with phase "questions", the idea, and those questions (with suggestedAnswer pre-fills for human review). Questions must be tailored to this product — not a generic template. You may add 1–2 optional general questions (budget, unit count) at the very end only. Mark technical questions with technical:true.`
}

function buildProductSuiteCompletionMessage(definition: ProductDefinition): string {
  const answersBlock = definition.answers
    .map((a) => `- ${a.prompt}: ${a.answer}`)
    .join('\n')

  return `[Product Suite completed] The user reviewed and saved their product definition.

Product idea: ${definition.idea}

Summary: ${definition.summary}

Confirmed answers:
${answersBlock}

Continue immediately: load plan_space, document, and project tool categories (not product — definition is already saved above). Create a detailed development roadmap. Use plan space bubbles for major phases/subsystems, capture requirements, and outline concrete CircuitWiz next steps (schematics, firmware, BOM). Never call product_open_new_product_suite again for this project.`
}

interface AgentProviderProps {
  children: ReactNode
  projectContext: AgentProjectContext | null
  onProjectUpdate?: (
    folder: ProjectFolder,
    options?: { openSchematicId?: string | null }
  ) => void
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
  const [projectsAgentColumnOpen, setProjectsAgentColumnOpen] = useState(false)

  const claudeHistoryRef = useRef<ClaudeMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const projectContextRef = useRef(projectContext)
  const loadedToolCategoriesRef = useRef<Set<string>>(new Set())
  const productSuiteSaveInFlightRef = useRef(false)
  const productSuiteHandoffRef = useRef(false)
  const currentAssistantIdRef = useRef<string | null>(null)
  projectContextRef.current = projectContext

  useEffect(() => {
    return () => {
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

  const hideAgent = useCallback(() => {
    setRevealPhase('hidden')
    setIsExpanded(false)
  }, [])

  const showAgentChrome = useCallback(() => {
    setRevealPhase('expanded')
  }, [])

  const openProductSuite = useCallback(() => {
    setProductSuiteOpen(true)
  }, [])

  const closeProductSuite = useCallback(() => {
    setProductSuiteOpen(false)
    setProductSuiteLoading(false)
  }, [])

  useEffect(() => {
    if (productSuiteHandoffRef.current) return
    const session = projectContext?.folder.productSuiteSession
    if (session) {
      setProductSuiteOpen(true)
      setProductSuiteLoading(false)
      return
    }
    if (!productSuiteLoading && !isLoading) {
      setProductSuiteOpen(false)
    }
  }, [projectContext?.folder.productSuiteSession?.id, productSuiteLoading, isLoading])

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
      currentAssistantIdRef.current = assistantId
      setStreamingMessageId(assistantId)
      setChat((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }])

      const controller = new AbortController()
      abortRef.current = controller

      const ensureAssistantBubble = (): string => {
        if (currentAssistantIdRef.current) return currentAssistantIdRef.current
        const id = makeId()
        currentAssistantIdRef.current = id
        setStreamingMessageId(id)
        setChat((prev) => [...prev, { id, role: 'assistant', text: '' }])
        return id
      }

      const finalizeEmptyAssistant = (activeId: string | null) => {
        if (!activeId) return
        setChat((prev) =>
          prev.filter(
            (entry) =>
              !(entry.id === activeId && entry.role === 'assistant' && entry.text.trim().length === 0)
          )
        )
      }

      try {
        const result = await runAgentTurn({
          history: claudeHistoryRef.current,
          userMessage: trimmed,
          projectContext: projectContextRef.current,
          loadedToolCategories: loadedToolCategoriesRef.current,
          signal: controller.signal,
          onTextDelta: (delta) => {
            setIsStreaming(true)
            setStatusHint(null)
            const targetId = ensureAssistantBubble()
            setStreamingMessageId(targetId)
            setChat((prev) =>
              prev.map((entry) =>
                entry.id === targetId && entry.role === 'assistant'
                  ? { ...entry, text: entry.text + delta }
                  : entry
              )
            )
          },
          onToolUseStart: (toolName) => {
            setIsStreaming(false)
            setStatusHint(null)
            finalizeEmptyAssistant(currentAssistantIdRef.current)
            currentAssistantIdRef.current = null
            setStreamingMessageId(null)

            const toolId = makeId()
            setChat((prev) => [
              ...prev,
              {
                id: toolId,
                role: 'tool',
                toolName,
                label: formatToolLabel(toolName),
                status: 'running',
              },
            ])

            if (toolName === 'product_open_new_product_suite') {
              setProductSuiteOpen(true)
              setProductSuiteLoading(true)
            }
          },
          onToolUseComplete: (toolName, success) => {
            setChat((prev) => {
              const runningIndex = prev.findIndex(
                (entry) => entry.role === 'tool' && entry.status === 'running'
              )
              if (runningIndex === -1) return prev
              return prev.map((entry, index) =>
                index === runningIndex && entry.role === 'tool'
                  ? { ...entry, status: 'completed', success }
                  : entry
              )
            })
            if (toolName === 'product_open_new_product_suite' && success) {
              setProductSuiteLoading(false)
            }
            currentAssistantIdRef.current = null
          },
          onFolderUpdate: (folder, meta) => {
            onProjectUpdate?.(folder, {
              openSchematicId: meta?.activeSchematicId ?? undefined,
            })
          },
        })

        claudeHistoryRef.current = result.messages

        if (result.loadedToolCategories) {
          loadedToolCategoriesRef.current = new Set(result.loadedToolCategories)
        }

        if (result.updatedContext?.folder && onProjectUpdate) {
          onProjectUpdate(result.updatedContext.folder, {
            openSchematicId:
              result.openSchematicId ?? result.updatedContext.activeSchematicId ?? undefined,
          })
        }

        if (result.uiActions?.some((a: AgentUiAction) => a.type === 'open_product_suite')) {
          setProductSuiteOpen(true)
          setProductSuiteLoading(false)
        }

        for (const action of result.uiActions ?? []) {
          if (action.type === 'flash_program') {
            startMultiMicrocontrollerGPIO(action.componentId, action.code)
          }
        }

        setChat((prev) => {
          const withoutEmpty = prev.filter(
            (entry) => !(entry.role === 'assistant' && entry.text.trim().length === 0)
          )
          const hasAssistantText = withoutEmpty.some(
            (entry) => entry.role === 'assistant' && entry.text.trim().length > 0
          )
          if (hasAssistantText || !result.assistantText.trim()) {
            return withoutEmpty
          }
          return [
            ...withoutEmpty,
            { id: makeId(), role: 'assistant' as const, text: result.assistantText },
          ]
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setChat((prev) => {
            const marked = prev.map((entry) =>
              entry.role === 'tool' && entry.status === 'running'
                ? { ...entry, status: 'completed' as const, success: false }
                : entry
            )
            const activeId = currentAssistantIdRef.current
            return marked.filter(
              (entry) =>
                !(
                  entry.role === 'assistant' &&
                  entry.id === activeId &&
                  entry.text.trim().length === 0
                )
            )
          })
          setProductSuiteLoading(false)
          appendAgentDevLog({ type: 'turn_end', payload: { cancelled: true } })
          return
        }

        const message =
          err instanceof ClaudeApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong'

        setChat((prev) => {
          const marked = prev.map((entry) =>
            entry.role === 'tool' && entry.status === 'running'
              ? { ...entry, status: 'completed' as const, success: false }
              : entry
          )
          const activeId = currentAssistantIdRef.current
          const withoutEmptyAssistant = marked.filter(
            (entry) =>
              !(
                entry.role === 'assistant' &&
                entry.id === activeId &&
                entry.text.length === 0
              )
          )
          return [...withoutEmptyAssistant, { id: makeId(), role: 'error', text: message }]
        })
        appendAgentDevLog({ type: 'error', payload: { message, err: String(err) } })
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
        currentAssistantIdRef.current = null
        abortRef.current = null
      }
    },
    [isLoading, onProjectUpdate]
  )

  const stopAgent = useCallback(() => {
    abortRef.current?.abort()
  }, [])

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

  const submitProductSuiteCompletion = useCallback(
    async (folder: ProjectFolder) => {
      const definition = folder.productDefinition
      if (!definition || productSuiteSaveInFlightRef.current) return

      productSuiteSaveInFlightRef.current = true
      productSuiteHandoffRef.current = true

      onProjectUpdate?.(folder)
      closeProductSuite()
      ensureExpanded()

      for (const category of ['plan_space', 'document', 'project'] as const) {
        loadedToolCategoriesRef.current.add(category)
      }

      try {
        await runTurn(buildProductSuiteCompletionMessage(definition), {
          chatUserText: 'Product definition saved — build my development plan.',
        })
      } finally {
        productSuiteSaveInFlightRef.current = false
        productSuiteHandoffRef.current = false
      }
    },
    [runTurn, onProjectUpdate, ensureExpanded, closeProductSuite]
  )

  const runDevTestCase = useCallback(async () => {
    const ctx = projectContextRef.current
    if (!ctx) {
      return { success: false, message: 'Open a project first.' }
    }
    const result = runSwitchControlledLedPlacementTest(ctx)
    if (result.folder && onProjectUpdate) {
      onProjectUpdate(result.folder, { openSchematicId: result.activeSchematicId ?? null })
    }
    return { success: result.success, message: result.message }
  }, [onProjectUpdate])

  const value = useMemo<AgentContextValue>(
    () => ({
      revealPhase,
      isExpanded,
      setIsExpanded,
      toggleExpanded,
      ensureExpanded,
      hideAgent,
      showAgentChrome,
      projectsAgentColumnOpen,
      setProjectsAgentColumnOpen,
      chat,
      isLoading,
      isStreaming,
      streamingMessageId,
      statusHint,
      error,
      setError,
      sendMessage,
      stopAgent,
      submitProductIdea,
      submitProductSuiteCompletion,
      projectContext,
      productSuiteOpen,
      productSuiteLoading,
      openProductSuite,
      closeProductSuite,
      runDevTestCase,
    }),
    [
      revealPhase,
      isExpanded,
      toggleExpanded,
      ensureExpanded,
      hideAgent,
      showAgentChrome,
      projectsAgentColumnOpen,
      chat,
      isLoading,
      isStreaming,
      streamingMessageId,
      statusHint,
      error,
      sendMessage,
      stopAgent,
      submitProductIdea,
      submitProductSuiteCompletion,
      projectContext,
      productSuiteOpen,
      productSuiteLoading,
      openProductSuite,
      closeProductSuite,
      runDevTestCase,
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
