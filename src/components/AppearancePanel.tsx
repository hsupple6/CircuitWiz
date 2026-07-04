import { useEffect, useRef, useState } from 'react'
import { Moon, Palette, RotateCcw, Sun, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { DEFAULT_ACCENT } from '../utils/accentColor'
import { DEFAULT_COLOR_MODE, WIRE_COLORS } from '../theme/colors'

interface AppearancePanelProps {
  className?: string
}

export function AppearancePanel({ className = '' }: AppearancePanelProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const {
    colorMode,
    accentColor,
    accentPresets,
    setColorMode,
    setAccentColor,
    resetAccentColor,
    resetColorMode,
  } = useTheme()

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
            : 'border-gray-200 bg-white hover:border-primary-400/35 dark:border-white/[0.08] dark:bg-carbon-surface'
        }`}
        aria-label="Appearance settings"
        aria-expanded={open}
      >
        <Palette className="h-4 w-4 text-primary-500 dark:text-primary-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setOpen(false)} />

          <aside
            className="fixed right-0 top-[10vh] z-50 flex h-[90vh] w-80 flex-col border-l border-gray-200 bg-white shadow-2xl shadow-black/10 dark:border-white/[0.08] dark:bg-carbon-card dark:shadow-black/60"
            aria-label="Appearance settings"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Appearance</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-500">Theme, accent & wire colors</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-500 dark:hover:bg-white/[0.05] dark:hover:text-zinc-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                  Theme
                </h3>
                <div className="flex gap-2">
                  {([
                    { mode: 'light' as const, label: 'Light', icon: Sun },
                    { mode: 'dark' as const, label: 'Dark', icon: Moon },
                  ]).map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setColorMode(mode)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        colorMode === mode
                          ? 'border-primary-400/50 bg-primary-400/10 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-white/[0.08] dark:text-zinc-400 dark:hover:border-white/[0.12] dark:hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
                  Applies to the whole app and wire color palette.
                </p>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">
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
                          selected
                            ? 'bg-primary-400/10 ring-1 ring-primary-400/50'
                            : 'hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <span
                          className="h-8 w-8 rounded-full border border-gray-200 shadow-inner dark:border-white/10"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="text-[10px] text-gray-500 group-hover:text-gray-600 dark:text-zinc-500 dark:group-hover:text-zinc-400">
                          {preset.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                  Custom accent
                </h3>
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-white/[0.06] dark:bg-carbon-surface">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    aria-label="Pick accent color"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-200">{accentColor.toUpperCase()}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">Buttons, links, glow & logo</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                  Wire colors ({colorMode})
                </h3>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {WIRE_COLORS.map((def) => (
                    <div
                      key={def.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-white/[0.06] dark:bg-carbon-surface"
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-gray-300 dark:border-white/10"
                        style={{ backgroundColor: def.colors[colorMode] }}
                      />
                      <span className="truncate text-[11px] text-gray-600 dark:text-zinc-400">{def.name}</span>
                      <span className="ml-auto font-mono text-[10px] text-gray-400 dark:text-zinc-600">
                        {def.colors[colorMode].toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                  Preview
                </h3>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-white/[0.06] dark:bg-carbon-matte">
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

            <div className="border-t border-gray-200 px-5 py-4 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  resetAccentColor()
                  resetColorMode()
                }}
                disabled={
                  accentColor.toLowerCase() === DEFAULT_ACCENT.toLowerCase() &&
                  colorMode === DEFAULT_COLOR_MODE
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:text-zinc-400 dark:hover:border-white/[0.12] dark:hover:text-zinc-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset appearance
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
