import { useCallback, useEffect, type ReactNode } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { useAgent } from '../contexts/AgentContext'
import { AgentPanel } from './AgentPanel'

const AGENT_COLUMN_OPEN = 'min(420px,38vw)'
const AGENT_COLUMN_CLOSED = '3rem'

interface ProjectsAgentLayoutProps {
  children: ReactNode
}

export function ProjectsAgentLayout({ children }: ProjectsAgentLayoutProps) {
  const {
    projectsAgentColumnOpen: open,
    setProjectsAgentColumnOpen,
    ensureExpanded,
    hideAgent,
  } = useAgent()

  const openAgent = useCallback(() => {
    setProjectsAgentColumnOpen(true)
    ensureExpanded()
  }, [ensureExpanded, setProjectsAgentColumnOpen])

  const closeAgent = useCallback(() => {
    setProjectsAgentColumnOpen(false)
    hideAgent()
  }, [hideAgent, setProjectsAgentColumnOpen])

  useEffect(() => {
    if (open) ensureExpanded()
  }, [open, ensureExpanded])

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>

      <aside
        className="projects-agent-drawer-shell relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l-2 border-gray-300 transition-[width] duration-300 ease-out dark:border-gray-600"
        style={{ width: open ? AGENT_COLUMN_OPEN : AGENT_COLUMN_CLOSED }}
        aria-label="Carbon Agent"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-35 carbon-rotate-ombre"
          aria-hidden
        />

        <button
          type="button"
          onClick={open ? closeAgent : openAgent}
          className="relative z-10 flex w-full shrink-0 items-center border-b border-black/[0.06] bg-white/40 px-2 py-3 text-gray-800 backdrop-blur-sm transition-colors hover:bg-white/70 dark:border-white/[0.06] dark:bg-black/20 dark:text-zinc-100 dark:hover:bg-black/35"
          aria-expanded={open}
          aria-label={open ? 'Close Carbon Agent' : 'Open Carbon Agent'}
        >
          {open ? (
            <>
              <Sparkles className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
              <span className="ml-2 truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">
                Carbon Agent
              </span>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-70" aria-hidden />
            </>
          ) : (
            <span className="mx-auto flex flex-col items-center gap-2 py-1">
              <Sparkles className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                Agent
              </span>
            </span>
          )}
        </button>

        {open && (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <AgentPanel embedded floating docked className="h-full min-h-0 flex-1" />
          </div>
        )}
      </aside>
    </div>
  )
}
