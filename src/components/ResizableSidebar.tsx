import { useCallback, useRef, useState, type ReactNode } from 'react'

interface ResizableSidebarProps {
  children: ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidthFraction?: number
  className?: string
}

export function ResizableSidebar({
  children,
  defaultWidth = 320,
  minWidth = 220,
  maxWidthFraction = 0.5,
  className = '',
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(defaultWidth)
  const widthRef = useRef(width)
  const sidebarRef = useRef<HTMLDivElement>(null)
  widthRef.current = width

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthRef.current

      const onMove = (moveEvent: MouseEvent) => {
        const row = sidebarRef.current?.parentElement
        const containerWidth = row?.clientWidth ?? window.innerWidth
        const maxWidth = containerWidth * maxWidthFraction
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth + (moveEvent.clientX - startX)))
        setWidth(next)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [minWidth, maxWidthFraction]
  )

  return (
    <div
      ref={sidebarRef}
      className={`relative flex shrink-0 flex-col min-h-0 border-r border-gray-200 dark:border-dark-border ${className}`}
      style={{ width }}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize components panel"
        onMouseDown={startResize}
        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-primary-400/20 active:bg-primary-400/30"
      />
    </div>
  )
}
