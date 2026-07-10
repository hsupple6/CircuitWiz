import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, PenLine } from 'lucide-react'
import {
  COMPONENT_STYLE_OPTIONS,
  useComponentStyle,
  type ComponentVisualStyle,
} from '../contexts/ComponentStyleContext'

interface ComponentStyleDropdownProps {
  className?: string
  /** Always show the active style name (for fixed schematic chrome). */
  prominent?: boolean
}

export function ComponentStyleDropdown({ className = '', prominent = false }: ComponentStyleDropdownProps) {
  const { componentStyle, setComponentStyle } = useComponentStyle()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const activeLabel =
    COMPONENT_STYLE_OPTIONS.find((option) => option.id === componentStyle)?.label ?? 'Default'

  const selectStyle = (style: ComponentVisualStyle) => {
    setComponentStyle(style)
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 items-center gap-1.5 rounded-full border px-3 shadow-md shadow-black/10 backdrop-blur-xl transition-colors dark:shadow-black/40 ${
          open
            ? 'border-primary-400/50 bg-white/95 dark:bg-zinc-950/95'
            : 'border-gray-200/80 bg-white/92 hover:border-primary-400/35 dark:border-white/[0.08] dark:bg-zinc-950/88'
        } ${prominent ? 'sm:px-4' : 'sm:px-3'}`}
        aria-label="Component style"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <PenLine className="h-4 w-4 shrink-0 text-primary-500 dark:text-primary-400" />
        {prominent ? (
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-500">
            Style
          </span>
        ) : null}
        <span
          className={`max-w-[5.5rem] truncate text-sm text-gray-700 dark:text-zinc-200 ${
            prominent ? 'inline' : 'hidden sm:inline'
          }`}
        >
          {activeLabel}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform dark:text-zinc-500 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Component style"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-[80] min-w-[10.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl shadow-black/10 dark:border-white/[0.08] dark:bg-carbon-card dark:shadow-black/50"
        >
          {COMPONENT_STYLE_OPTIONS.map((option) => {
            const selected = componentStyle === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectStyle(option.id)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? 'bg-primary-400/10 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-white/[0.04]'
                }`}
              >
                <span>{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
