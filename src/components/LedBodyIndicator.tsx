import type { ComponentState } from '../systems/ElectricalSystem'
import { ComponentStatsBadge } from './ComponentStatsBadge'

const LED_CLASS: Record<string, string> = {
  Red: 'bg-red-400 border-red-500',
  Green: 'bg-green-400 border-green-500',
  Blue: 'bg-blue-400 border-blue-500',
  Yellow: 'bg-yellow-300 border-yellow-400',
  White: 'bg-white border-gray-200',
  Orange: 'bg-orange-400 border-orange-500',
}

const LED_GLOW: Record<string, string> = {
  Red: '#ef4444',
  Green: '#10b981',
  Blue: '#3b82f6',
  Yellow: '#facc15',
  White: '#f3f4f6',
  Orange: '#fb923c',
}

interface LedBodyIndicatorProps {
  color: string
  isOn: boolean
  isPWM?: boolean
  state?: ComponentState | null
  compact?: boolean
}

export function resolveLedColor(
  moduleProperties?: Record<string, unknown>,
  cellProperties?: Record<string, unknown>
): string {
  const fromCell = cellProperties?.color
  if (typeof fromCell === 'string') return fromCell

  const colorProp = moduleProperties?.color
  if (typeof colorProp === 'string') return colorProp
  if (colorProp && typeof colorProp === 'object' && 'default' in colorProp) {
    const d = (colorProp as { default: string }).default
    if (typeof d === 'string') return d
  }
  return 'Red'
}

export function LedBodyIndicator({
  color,
  isOn,
  isPWM = false,
  state = null,
  compact = false,
}: LedBodyIndicatorProps) {
  const anodeVoltage = state?.inputVoltage ?? state?.outputVoltage ?? 0
  const forwardV = state?.forwardVoltage ?? 2
  const lit =
    isOn &&
    anodeVoltage > 0.01 &&
    anodeVoltage >= forwardV - 0.05 &&
    (state?.outputCurrent ?? 0) > 1e-6
  const ledClass = lit ? (LED_CLASS[color] ?? 'bg-yellow-300 border-yellow-400') : 'bg-gray-600 border-gray-400'
  const brightnessClass = lit ? 'opacity-100' : 'opacity-30'
  const glow = LED_GLOW[color] ?? '#facc15'
  const ledSize = compact ? 'h-[62%] w-[62%]' : 'h-[68%] w-[68%]'

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-px">
      <div className="flex h-full w-full items-center justify-center rounded-[2px] border border-[#333] bg-[#0d0d0d] [container-type:size]">
        <div
          className="relative flex items-center justify-center"
          style={{ width: 'min(82cqmin, 82%)', height: 'min(82cqmin, 82%)' }}
        >
          {lit && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`h-[88%] w-[88%] rounded-full border-2 ${ledClass} opacity-30 animate-ping`} />
              <div
                className={`absolute h-full w-full rounded-full border ${ledClass} opacity-20 animate-ping`}
                style={{ animationDelay: '0.5s' }}
              />
            </div>
          )}

          <div
            className={`relative rounded-full border-[3px] ${ledClass} ${brightnessClass} ${ledSize} ${
              lit ? (isPWM ? 'animate-ping shadow-lg' : 'animate-pulse shadow-lg') : ''
            }`}
            style={{
              boxShadow: lit ? `0 0 12px ${glow}, 0 0 24px ${glow}` : 'none',
            }}
          />

          {isPWM && lit && (
            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-purple-500 animate-pulse">
              <div className="absolute inset-0 animate-ping rounded-full bg-purple-400" />
            </div>
          )}

          {lit && <ComponentStatsBadge state={state} compact={compact} />}
        </div>
      </div>
    </div>
  )
}
