import { useCallback, useRef, type ReactNode } from 'react'

interface VerticalSplitPaneProps {
  ratio: number
  onRatioChange: (ratio: number) => void
  top: ReactNode
  bottom: ReactNode
  minFraction?: number
  maxFraction?: number
}

export function VerticalSplitPane({
  ratio,
  onRatioChange,
  top,
  bottom,
  minFraction = 0.2,
  maxFraction = 0.8,
}: VerticalSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return

      const startY = e.clientY
      const startRatio = ratio
      const height = container.clientHeight

      const onMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startY
        const next = Math.min(maxFraction, Math.max(minFraction, startRatio + delta / height))
        onRatioChange(next)
      }

      const onUp = () => {
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
    [ratio, onRatioChange, minFraction, maxFraction]
  )

  const topPct = ratio * 100
  const bottomPct = 100 - topPct

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 overflow-hidden" style={{ flex: `${topPct} 1 0%` }}>
        {top}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize agent and components panels"
        onMouseDown={startResize}
        className="relative z-10 h-1.5 shrink-0 cursor-row-resize touch-none bg-white/[0.04] hover:bg-primary-400/25 active:bg-primary-400/35"
      />
      <div className="min-h-0 overflow-hidden" style={{ flex: `${bottomPct} 1 0%` }}>
        {bottom}
      </div>
    </div>
  )
}

export const DEVICE_PANEL_SLOT_ID = 'device-panel-slot'
export const POWER_PANEL_SLOT_ID = 'power-panel-slot'
