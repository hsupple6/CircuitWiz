import { useEffect, useRef, useState } from 'react'
import { Palette, RotateCcw, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { DEFAULT_ACCENT } from '../utils/accentColor'

interface AppearancePanelProps {
  className?: string
}

export function AppearancePanel({ className = '' }: AppearancePanelProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { accentColor, accentPresets, setAccentColor, resetAccentColor } = useTheme()

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          open
            ? 'border-primary-400/50 bg-primary-400/10'
            : 'border-white/[0.08] bg-carbon-surface hover:border-primary-400/35'
        }`}
        aria-label="Appearance settings"
        aria-expanded={open}
      >
        <Palette className="h-4 w-4 text-primary-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setOpen(false)} />

          <aside
            className="fixed right-0 top-[10vh] z-50 flex h-[90vh] w-80 flex-col border-l border-white/[0.08] bg-carbon-card shadow-2xl shadow-black/60"
            aria-label="Appearance settings"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Appearance</h2>
                <p className="text-xs text-zinc-500">Customize accent color</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Accent color
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {accentPresets.map((preset) => {
                    const selected = accentColor.toLowerCase() === preset.hex.toLowerCase()
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        title={preset.name}
                        onClick={() => setAccentColor(preset.hex)}
                        className={`group flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors ${
                          selected ? 'bg-primary-400/10 ring-1 ring-primary-400/50' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <span
                          className="h-8 w-8 rounded-full border border-white/10 shadow-inner"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">{preset.name}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Custom
                </h3>
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-carbon-surface p-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    aria-label="Pick accent color"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-200">{accentColor.toUpperCase()}</p>
                    <p className="text-xs text-zinc-500">Used for buttons, links, glow & logo</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Preview
                </h3>
                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-carbon-matte">
                  <div
                    className="h-20 carbon-orb"
                    style={{
                      background: `radial-gradient(circle at 70% 80%, rgb(var(--accent-glow) / 0.35) 0%, transparent 65%)`,
                    }}
                  />
                  <div className="space-y-2 px-4 pb-4">
                    <div className="h-2 w-2/3 rounded-full bg-primary-400/80" />
                    <div className="h-2 w-1/2 rounded-full bg-primary-500/50" />
                    <button
                      type="button"
                      className="mt-2 rounded-lg bg-primary-400 px-3 py-1.5 text-xs font-medium text-black"
                    >
                      Accent button
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="border-t border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => resetAccentColor()}
                disabled={accentColor.toLowerCase() === DEFAULT_ACCENT.toLowerCase()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] py-2.5 text-sm text-zinc-400 transition-colors hover:border-white/[0.12] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to default
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
