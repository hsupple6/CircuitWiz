import type { ReactNode } from 'react'
import type { ComponentState } from '../../systems/ElectricalSystem'

const STROKE = '#1a1a1a'
const STROKE_WIDTH = 1.8

interface SymbolSvgProps {
  className?: string
}

/** US-style resistor zigzag between horizontal leads. */
export function ResistorSchematicSymbol({ className = '' }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 80 24" className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1="12" x2="10" y2="12" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
      <polyline
        points="10,12 14,4 20,20 26,4 32,20 38,4 44,20 50,4 56,20 62,12 70,12"
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line x1="70" y1="12" x2="80" y2="12" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
    </svg>
  )
}

/** Non-polarized capacitor — two parallel plates. */
export function CapacitorSchematicSymbol({ className = '' }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 80 24" className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1="12" x2="34" y2="12" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
      <line x1="34" y1="3" x2="34" y2="21" stroke={STROKE} strokeWidth={STROKE_WIDTH + 0.4} />
      <line x1="42" y1="3" x2="42" y2="21" stroke={STROKE} strokeWidth={STROKE_WIDTH + 0.4} />
      <line x1="42" y1="12" x2="80" y2="12" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
    </svg>
  )
}

/** Inductor — series of semicircular loops. */
export function InductorSchematicSymbol({ className = '' }: SymbolSvgProps) {
  return (
    <svg viewBox="0 0 80 24" className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      <line x1="0" y1="12" x2="8" y2="12" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
      <path
        d="M 8 12 A 6 6 0 0 1 20 12 A 6 6 0 0 1 32 12 A 6 6 0 0 1 44 12 A 6 6 0 0 1 56 12 A 6 6 0 0 1 68 12"
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <line x1="68" y1="12" x2="80" y2="12" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
    </svg>
  )
}

const LED_ON_COLORS: Record<string, { fill: string; glow: string }> = {
  Red: { fill: '#ef4444', glow: '#fca5a5' },
  Green: { fill: '#22c55e', glow: '#86efac' },
  Blue: { fill: '#3b82f6', glow: '#93c5fd' },
  Yellow: { fill: '#eab308', glow: '#fde047' },
  White: { fill: '#f8fafc', glow: '#e2e8f0' },
  Orange: { fill: '#f97316', glow: '#fdba74' },
}

function isLedLit(state: ComponentState | null | undefined, isOn: boolean): boolean {
  if (!isOn || !state) return false
  const anodeVoltage = state.inputVoltage ?? state.outputVoltage ?? 0
  const forwardV = state.forwardVoltage ?? 2
  const branchCurrent = state.outputCurrent ?? 0
  return anodeVoltage >= forwardV - 0.1 && branchCurrent > 1e-6
}

interface LedSchematicSymbolProps extends SymbolSvgProps {
  color: string
  isOn: boolean
  isPWM?: boolean
  state?: ComponentState | null
}

/** LED — diode triangle + cathode bar + emission arrows; fills when conducting. */
export function LedSchematicSymbol({
  className = '',
  color,
  isOn,
  isPWM = false,
  state = null,
}: LedSchematicSymbolProps) {
  const lit = isLedLit(state, isOn)
  const palette = LED_ON_COLORS[color] ?? LED_ON_COLORS.Red
  const fill = lit ? palette.fill : 'none'
  const stroke = lit ? palette.fill : STROKE
  const arrowStroke = lit ? palette.fill : STROKE

  return (
    <svg viewBox="0 0 80 32" className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      <g
        style={
          lit
            ? { filter: `drop-shadow(0 0 5px ${palette.glow}) drop-shadow(0 0 10px ${palette.glow})` }
            : undefined
        }
      >
        <line x1="0" y1="16" x2="22" y2="16" stroke={stroke} strokeWidth={STROKE_WIDTH} />
        <polygon
          points="22,8 22,24 38,16"
          fill={fill}
          stroke={stroke}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
          className={lit && isPWM ? 'animate-pulse' : lit ? '' : ''}
        />
        <line x1="38" y1="8" x2="38" y2="24" stroke={stroke} strokeWidth={STROKE_WIDTH + 0.6} />
        <line x1="38" y1="16" x2="58" y2="16" stroke={stroke} strokeWidth={STROKE_WIDTH} />
        {/* Emission arrows */}
        <line x1="30" y1="10" x2="26" y2="4" stroke={arrowStroke} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="34" y1="9" x2="34" y2="2" stroke={arrowStroke} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="38" y1="10" x2="42" y2="4" stroke={arrowStroke} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

interface SchematicSymbolSpanProps {
  gridX: number
  relativeX: number
  children: ReactNode
}

/** Span a symbol across the full module width from the body cell. */
export function SchematicSymbolSpan({ gridX, relativeX, children }: SchematicSymbolSpanProps) {
  return (
    <div
      className="pointer-events-none absolute z-[1] inset-y-0 flex items-center justify-center px-[4%]"
      style={{
        left: `${-relativeX * 100}%`,
        width: `${gridX * 100}%`,
      }}
    >
      <div className="h-[72%] w-full max-h-full">{children}</div>
    </div>
  )
}
