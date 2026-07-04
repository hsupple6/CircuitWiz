import type { ReactNode } from 'react'

interface FloatingPanelProps {
  children: ReactNode
  side?: 'left' | 'right'
  className?: string
  /** Vertical anchor — top (default), bottom, or fill (uses heightClass) */
  vertical?: 'top' | 'bottom' | 'fill'
  /** Tailwind top offset when vertical is top (e.g. top-16 to clear grid controls) */
  topClass?: string
  /** Fixed height, e.g. h-[95%] — optional; prefer fillTopClass + fillBottomClass */
  heightClass?: string
  /** Top inset when vertical is fill */
  fillTopClass?: string
  /** Bottom inset when vertical is fill */
  fillBottomClass?: string
  /** Override horizontal inset (e.g. left-2) */
  sideClass?: string
  /** Tailwind bottom offset when vertical is bottom */
  bottomClass?: string
  /** fixed = absolute overlay (default); flex = child in a flex stack (no positioning) */
  layout?: 'fixed' | 'flex'
}

const PANEL_SHELL =
  'pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white backdrop-blur-sm dark:border-white/[0.08] dark:bg-carbon-card'

export function FloatingPanel({
  children,
  side = 'right',
  vertical = 'top',
  className = '',
  topClass = 'top-4',
  bottomClass = 'bottom-4',
  heightClass,
  fillTopClass = 'top-[2.5%]',
  fillBottomClass = 'bottom-[2.5%]',
  sideClass,
  layout = 'fixed',
}: FloatingPanelProps) {
  if (layout === 'flex') {
    return <div className={`${PANEL_SHELL} ${className}`}>{children}</div>
  }

  const horizontal = sideClass ?? (side === 'right' ? 'right-4' : 'left-4')
  const isFill = vertical === 'fill'
  const verticalPos = isFill
    ? `${fillTopClass} ${fillBottomClass}`
    : vertical === 'top'
      ? topClass
      : bottomClass
  const sizeClass = isFill ? heightClass ?? '' : 'max-h-[calc(100%-2rem)]'
  const innerSizeClass = isFill ? 'h-full min-h-0' : 'h-auto max-h-full min-h-0'

  return (
    <div
      className={`pointer-events-none absolute ${horizontal} ${verticalPos} z-40 flex flex-col ${sizeClass} ${className}`}
    >
      <div className={`${PANEL_SHELL} ${innerSizeClass}`}>{children}</div>
    </div>
  )
}
