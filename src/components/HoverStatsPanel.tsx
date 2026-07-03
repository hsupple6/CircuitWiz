import { useState } from 'react'
import {
  Activity,
  Battery,
  Cable,
  ChevronLeft,
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
}

const METRIC_ACCENTS: Record<string, string> = {
  voltage: 'text-emerald-400',
  current: 'text-sky-400',
  power: 'text-amber-400',
}

const DETAIL_ACCENTS: Record<string, string> = {
  voltage: 'text-emerald-300/90',
  current: 'text-sky-300/90',
  power: 'text-amber-300/90',
  success: 'text-emerald-400',
  warn: 'text-orange-400',
  info: 'text-zinc-300',
  idle: 'text-zinc-500',
  status: 'text-primary-300',
}

const STATUS_STYLES: Record<
  NonNullable<HoverStats['status']>['tone'],
  string
> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  idle: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/20',
  warn: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  error: 'bg-red-500/15 text-red-300 ring-red-500/30',
  pwm: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
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

function MetricCard({ row }: { row: HoverStatRow }) {
  const accent = row.accent ? METRIC_ACCENTS[row.accent] : 'text-zinc-100'
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{row.label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${accent}`}>{row.value}</div>
    </div>
  )
}

function DetailRow({ row }: { row: HoverStatRow }) {
  const accent = row.accent ? DETAIL_ACCENTS[row.accent] : 'text-zinc-300'
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-zinc-500">{row.label}</span>
      <span className={`font-mono text-right tabular-nums ${accent}`}>{row.value}</span>
    </div>
  )
}

export function HoverStatsPanel({ stats }: HoverStatsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = stats ? pickIcon(stats) : Activity
  const visible = stats !== null

  if (!expanded) {
    return (
      <aside
        className="relative flex w-11 shrink-0 flex-col border-l border-white/[0.06] bg-carbon-card/95 backdrop-blur-md"
        aria-label="Live circuit stats"
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
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
          onClick={() => setExpanded(false)}
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
        <div
          className={`transition-all duration-300 ease-out ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
          }`}
        >
          {stats && (
            <>
              <div className="mb-1">
                <h3 className="text-xl font-bold tracking-tight text-zinc-50">{stats.title}</h3>
                {stats.subtitle && stats.kind !== 'cell' && (
                  <p className="mt-0.5 text-xs font-mono text-zinc-500">{stats.subtitle}</p>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2">
                {stats.metrics.map((row) => (
                  <MetricCard key={row.label} row={row} />
                ))}
              </div>

              {stats.details.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Details
                  </h4>
                  <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] bg-black/20 px-3">
                    {stats.details.map((row) => (
                      <DetailRow key={`${row.label}-${row.value}`} row={row} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/[0.05] bg-carbon-surface/60 px-3 py-2 text-xs text-zinc-500">
                <MousePointer2 className="h-3.5 w-3.5 shrink-0 text-primary-400/70" />
                Grid ({stats.position.x}, {stats.position.y})
              </div>
            </>
          )}
        </div>

        {!visible && (
          <div className="absolute inset-x-5 top-5 flex flex-col items-center justify-center text-center">
            <div className="pointer-events-none absolute inset-0 rounded-2xl carbon-orb-sm opacity-20" aria-hidden />
            <div className="relative max-w-[220px]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/30">
                <Activity className="h-6 w-6 text-zinc-600" />
              </div>
              <p className="text-sm font-medium text-zinc-300">Inspect the circuit</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Move your cursor over wires, LEDs, capacitors, motors, or any component to see voltage, current, power, and status here.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
