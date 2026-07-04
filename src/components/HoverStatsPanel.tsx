import { useState } from 'react'
import {
  Activity,
  Battery,
  Cable,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleDot,
  Cpu,
  Gauge,
  Lightbulb,
  MousePointer2,
  Zap,
} from 'lucide-react'
import type { HoverStats, HoverStatRow } from '../utils/hoverStats'

interface HoverStatsPanelProps {
  stats: HoverStats | null
  embedded?: boolean
  floating?: boolean
  stacked?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

const METRIC_ACCENTS: Record<string, string> = {
  voltage: 'text-emerald-600 dark:text-emerald-400',
  current: 'text-sky-600 dark:text-sky-400',
  power: 'text-amber-600 dark:text-amber-400',
}

const DETAIL_ACCENTS: Record<string, string> = {
  voltage: 'text-emerald-700 dark:text-emerald-300/90',
  current: 'text-sky-700 dark:text-sky-300/90',
  power: 'text-amber-700 dark:text-amber-300/90',
  success: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-orange-600 dark:text-orange-400',
  info: 'text-gray-700 dark:text-zinc-300',
  idle: 'text-gray-500 dark:text-zinc-500',
  status: 'text-primary-700 dark:text-primary-300',
}

const STATUS_STYLES: Record<
  NonNullable<HoverStats['status']>['tone'],
  string
> = {
  active: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  idle: 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/20 dark:text-zinc-400',
  warn: 'bg-orange-500/15 text-orange-700 ring-orange-500/30 dark:text-orange-300',
  error: 'bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-300',
  pwm: 'bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300',
}

function pickIcon(stats: HoverStats) {
  if (stats.kind === 'wire') return Cable
  switch (stats.componentType) {
    case 'LED':
      return Lightbulb
    case 'Motor':
      return Gauge
    case 'PowerSupply':
      return Battery
    case 'Capacitor':
    case 'Inductor':
    case 'Resistor':
      return Zap
    default:
      if (stats.componentType?.toLowerCase().includes('arduino') || stats.componentType?.includes('ESP')) {
        return Cpu
      }
      return stats.kind === 'cell' ? MousePointer2 : CircleDot
  }
}

function MetricCard({ row, embedded = false }: { row: HoverStatRow; embedded?: boolean }) {
  const accent = row.accent ? METRIC_ACCENTS[row.accent] : 'text-gray-900 dark:text-zinc-100'
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        embedded
          ? 'border-black/[0.06] bg-gray-50 dark:border-white/[0.06] dark:bg-black/30'
          : 'border-white/[0.06] bg-black/30'
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">
        {row.label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${accent}`}>{row.value}</div>
    </div>
  )
}

function DetailRow({ row, embedded = false }: { row: HoverStatRow; embedded?: boolean }) {
  const accent = row.accent ? DETAIL_ACCENTS[row.accent] : 'text-gray-800 dark:text-zinc-300'
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-gray-500 dark:text-zinc-500">{row.label}</span>
      <span className={`font-mono text-right tabular-nums ${accent}`}>{row.value}</span>
    </div>
  )
}

function HoverStatsContent({
  stats,
  embedded = false,
}: {
  stats: HoverStats | null
  embedded?: boolean
}) {
  const visible = stats !== null

  if (!visible) {
    return (
      <div className={`text-center ${embedded ? 'py-4' : 'absolute inset-x-5 top-5 flex flex-col items-center justify-center'}`}>
        {!embedded && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl carbon-orb-sm opacity-20" aria-hidden />
        )}
        <div className={`relative ${embedded ? 'max-w-none px-1' : 'max-w-[220px]'}`}>
          <div
            className={`mx-auto mb-3 flex items-center justify-center rounded-2xl border border-dashed ${
              embedded
                ? 'h-10 w-10 border-black/10 bg-gray-50 dark:border-white/10 dark:bg-black/30'
                : 'mb-4 h-14 w-14 border-white/10 bg-black/30'
            }`}
          >
            <Activity className={`${embedded ? 'h-5 w-5' : 'h-6 w-6'} text-gray-400 dark:text-zinc-600`} />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Inspect the circuit</p>
          <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-zinc-500">
            Hover wires, components, or cells to see live voltage, current, and status.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-1">
        <h3 className={`font-bold tracking-tight text-gray-900 dark:text-zinc-50 ${embedded ? 'text-base' : 'text-xl'}`}>
          {stats.title}
        </h3>
        {stats.subtitle && stats.kind !== 'cell' && (
          <p className="mt-0.5 text-xs font-mono text-gray-500 dark:text-zinc-500">{stats.subtitle}</p>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-2 ${embedded ? 'mt-3' : 'mt-5'}`}>
        {stats.metrics.map((row) => (
          <MetricCard key={row.label} row={row} embedded={embedded} />
        ))}
      </div>

      {stats.details.length > 0 && (
        <div className={embedded ? 'mt-4' : 'mt-6'}>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
            Details
          </h4>
          <div
            className={`divide-y rounded-xl border px-3 ${
              embedded
                ? 'divide-black/[0.05] border-black/[0.06] bg-gray-50 dark:divide-white/[0.05] dark:border-white/[0.06] dark:bg-black/20'
                : 'divide-white/[0.05] border-white/[0.06] bg-black/20'
            }`}
          >
            {stats.details.map((row) => (
              <DetailRow key={`${row.label}-${row.value}`} row={row} embedded={embedded} />
            ))}
          </div>
        </div>
      )}

      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-gray-500 dark:text-zinc-500 ${
          embedded
            ? 'mt-4 border-black/[0.06] bg-gray-50 dark:border-white/[0.06] dark:bg-carbon-surface/60'
            : 'mt-6 border-white/[0.05] bg-carbon-surface/60'
        }`}
      >
        <MousePointer2 className="h-3.5 w-3.5 shrink-0 text-primary-500/80 dark:text-primary-400/70" />
        Grid ({stats.position.x}, {stats.position.y})
      </div>
    </>
  )
}

export function HoverStatsPanel({
  stats,
  embedded = false,
  floating = false,
  stacked = false,
  onExpandedChange,
}: HoverStatsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [dockExpanded, setDockExpanded] = useState(false)
  const Icon = stats ? pickIcon(stats) : Activity
  const visible = stats !== null

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev
      onExpandedChange?.(next)
      return next
    })
  }

  if (embedded || floating) {
    return (
      <aside
        className={`live-monitor-panel flex w-full flex-col ${
          stacked ? 'h-full min-h-0 flex-1' : floating ? 'min-h-0 shrink-0' : ''
        }`}
        aria-label="Live Monitor"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={toggleExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleExpanded()
            }
          }}
          className="flex w-full shrink-0 cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
          aria-expanded={expanded}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              visible
                ? 'bg-primary-400/15 text-primary-600 dark:text-primary-400'
                : 'bg-gray-100 text-gray-500 dark:bg-carbon-surface dark:text-zinc-500'
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Live Monitor</h2>
            <p className="truncate text-xs text-gray-500 dark:text-zinc-500">
              {visible ? stats!.subtitle ?? stats!.title : 'Hover any wire or component'}
            </p>
          </div>
          {stats?.status && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[stats.status.tone]}`}
            >
              {stats.status.label}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-gray-500 dark:text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 dark:text-zinc-500" />
          )}
        </div>

        {expanded && (
          <div
            className={`border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.06] ${
              stacked
                ? 'flex min-h-0 flex-1 flex-col overflow-y-auto'
                : 'max-h-[min(28vh,240px)] overflow-y-auto'
            }`}
          >
            <HoverStatsContent stats={stats} embedded />
          </div>
        )}
      </aside>
    )
  }

  if (!dockExpanded) {
    return (
      <aside
        className="relative flex w-11 shrink-0 flex-col border-l border-white/[0.06] bg-carbon-card/95 backdrop-blur-md"
        aria-label="Live circuit stats"
      >
        <button
          type="button"
          onClick={() => setDockExpanded(true)}
          className="flex h-full min-h-0 flex-col items-center gap-3 px-2 py-4 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-primary-300"
          title="Open Live Stats"
        >
          <Activity className="h-5 w-5 shrink-0" />
          <span
            className="text-[10px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180"
          >
            Live Stats
          </span>
          {stats?.status && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ring-2 ring-carbon-card ${
                stats.status.tone === 'active'
                  ? 'bg-emerald-400'
                  : stats.status.tone === 'warn'
                    ? 'bg-orange-400'
                    : stats.status.tone === 'error'
                      ? 'bg-red-400'
                      : 'bg-zinc-500'
              }`}
              title={stats.status.label}
            />
          )}
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="relative flex w-80 shrink-0 flex-col border-l border-white/[0.06] bg-carbon-card/95 backdrop-blur-md"
      aria-label="Live circuit stats"
    >
      <div className="pointer-events-none absolute -left-20 top-1/4 h-40 w-40 rounded-full carbon-orb-sm opacity-40" aria-hidden />

      <div className="relative flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <button
          type="button"
          onClick={() => setDockExpanded(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          title="Retract Live Stats"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
            visible
              ? 'border-primary-400/30 bg-primary-400/10 text-primary-300'
              : 'border-white/[0.06] bg-carbon-surface text-zinc-500'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-100">Live Stats</h2>
          <p className="truncate text-xs text-zinc-500">
            {visible ? stats!.subtitle ?? stats!.title : 'Hover any wire or component'}
          </p>
        </div>
        {stats?.status && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[stats.status.tone]}`}
          >
            {stats.status.label}
          </span>
        )}
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 py-5">
        <HoverStatsContent stats={stats} />
      </div>
    </aside>
  )
}
