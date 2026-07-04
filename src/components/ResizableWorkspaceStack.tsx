import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type WorkspaceStackSectionId = 'device' | 'power' | 'monitor' | 'agent'

const STORAGE_KEY = 'circuitwiz-workspace-panel-weights'

const DEFAULT_WEIGHTS: Record<WorkspaceStackSectionId, number> = {
  device: 4,
  power: 1.5,
  monitor: 1.5,
  agent: 3,
}

const MIN_WEIGHT = 0.75

function loadWeights(): Record<WorkspaceStackSectionId, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WEIGHTS }
    const parsed = JSON.parse(raw) as Partial<Record<WorkspaceStackSectionId, number>>
    return {
      device: parsed.device ?? DEFAULT_WEIGHTS.device,
      power: parsed.power ?? DEFAULT_WEIGHTS.power,
      monitor: parsed.monitor ?? DEFAULT_WEIGHTS.monitor,
      agent: parsed.agent ?? DEFAULT_WEIGHTS.agent,
    }
  } catch {
    return { ...DEFAULT_WEIGHTS }
  }
}

function saveWeights(weights: Record<WorkspaceStackSectionId, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights))
  } catch {
    // ignore quota errors
  }
}

interface StackSectionProps {
  weight: number
  expanded: boolean
  children: ReactNode
}

function StackSection({ weight, expanded, children }: StackSectionProps) {
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden ${
        expanded ? 'min-h-[72px]' : 'shrink-0'
      }`}
      style={expanded ? { flex: `${weight} 1 0%` } : { flex: '0 0 auto' }}
    >
      {children}
    </div>
  )
}

interface ResizeHandleProps {
  label: string
  onDragStart: () => { startTop: number; startBottom: number }
  onDrag: (deltaY: number, startTop: number, startBottom: number) => void
}

function ResizeHandle({ label, onDragStart, onDrag }: ResizeHandleProps) {
  const dragStartYRef = useRef(0)
  const dragStartWeightsRef = useRef<{ startTop: number; startBottom: number } | null>(null)

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragStartYRef.current = e.clientY
      dragStartWeightsRef.current = onDragStart()

      const onMove = (moveEvent: MouseEvent) => {
        const start = dragStartWeightsRef.current
        if (!start) return
        onDrag(moveEvent.clientY - dragStartYRef.current, start.startTop, start.startBottom)
      }

      const onUp = () => {
        dragStartWeightsRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [onDrag, onDragStart]
  )

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      onMouseDown={startResize}
      className="group relative z-10 h-2 shrink-0 cursor-row-resize touch-none"
    >
      <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-black/[0.08] transition-colors group-hover:bg-primary-400/40 group-active:bg-primary-400/60 dark:bg-white/[0.08]" />
    </div>
  )
}

export interface ResizableWorkspaceStackProps {
  device: ReactNode
  power: ReactNode
  monitor: ReactNode
  agent: ReactNode
  footer?: ReactNode
  deviceExpanded?: boolean
  powerExpanded?: boolean
  monitorExpanded?: boolean
  agentExpanded?: boolean
}

export function ResizableWorkspaceStack({
  device,
  power,
  monitor,
  agent,
  footer,
  deviceExpanded = true,
  powerExpanded = false,
  monitorExpanded = false,
  agentExpanded = true,
}: ResizableWorkspaceStackProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [weights, setWeights] = useState(loadWeights)
  const weightsRef = useRef(weights)
  weightsRef.current = weights

  useEffect(() => {
    saveWeights(weights)
  }, [weights])

  const applyPairResize = useCallback(
    (
      topId: WorkspaceStackSectionId,
      bottomId: WorkspaceStackSectionId,
      deltaY: number,
      startTop: number,
      startBottom: number
    ) => {
      const container = containerRef.current
      if (!container) return

      const height = container.clientHeight || 1
      const pairTotal = startTop + startBottom
      const delta = (deltaY / height) * pairTotal

      let top = startTop + delta
      let bottom = startBottom - delta

      if (top < MIN_WEIGHT) {
        bottom -= MIN_WEIGHT - top
        top = MIN_WEIGHT
      }
      if (bottom < MIN_WEIGHT) {
        top -= MIN_WEIGHT - bottom
        bottom = MIN_WEIGHT
      }

      setWeights((prev) => ({
        ...prev,
        [topId]: top,
        [bottomId]: bottom,
      }))
    },
    []
  )

  const sections: Array<{
    id: WorkspaceStackSectionId
    node: ReactNode
    expanded: boolean
  }> = [
    { id: 'device', node: device, expanded: deviceExpanded },
    { id: 'power', node: power, expanded: powerExpanded },
    { id: 'monitor', node: monitor, expanded: monitorExpanded },
    { id: 'agent', node: agent, expanded: agentExpanded },
  ]

  return (
    <div ref={containerRef} className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {sections.map((section, index) => {
        const nextExpanded = sections.slice(index + 1).find((candidate) => candidate.expanded)
        const showHandle = section.expanded && nextExpanded != null

        return (
          <Fragment key={section.id}>
            <StackSection weight={weights[section.id]} expanded={section.expanded}>
              {section.node}
            </StackSection>
            {showHandle && nextExpanded && (
              <ResizeHandle
                label={`Resize ${section.id} and ${nextExpanded.id} panels`}
                onDragStart={() => ({
                  startTop: weightsRef.current[section.id],
                  startBottom: weightsRef.current[nextExpanded.id],
                })}
                onDrag={(deltaY, startTop, startBottom) =>
                  applyPairResize(section.id, nextExpanded.id, deltaY, startTop, startBottom)
                }
              />
            )}
          </Fragment>
        )
      })}
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  )
}
