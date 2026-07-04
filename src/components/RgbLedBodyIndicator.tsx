import type { ComponentState } from '../systems/ElectricalSystem'

interface RgbLedBodyIndicatorProps {
  rOn: boolean
  gOn: boolean
  bOn: boolean
  compact?: boolean
}

export function RgbLedBodyIndicator({ rOn, gOn, bOn, compact = false }: RgbLedBodyIndicatorProps) {
  const lit = rOn || gOn || bOn
  const mixedColor = lit
    ? `rgb(${rOn ? 239 : 20}, ${gOn ? 68 : 20}, ${bOn ? 68 : 20})`
    : '#374151'
  const ledSize = compact ? 'h-[62%] w-[62%]' : 'h-[68%] w-[68%]'

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-px">
      <div className="flex h-full w-full items-center justify-center rounded-[2px] border border-[#333] bg-[#0d0d0d] [container-type:size]">
        <div
          className="relative flex items-center justify-center"
          style={{ width: 'min(82cqmin, 82%)', height: 'min(82cqmin, 82%)' }}
        >
          {lit && (
            <div
              className="absolute inset-0 rounded-full opacity-30 animate-pulse"
              style={{ boxShadow: `0 0 16px ${mixedColor}, 0 0 32px ${mixedColor}` }}
            />
          )}
          <div
            className={`relative rounded-full border-[3px] ${ledSize} ${lit ? 'opacity-100' : 'opacity-30'}`}
            style={{
              backgroundColor: mixedColor,
              borderColor: lit ? mixedColor : '#6B7280',
              boxShadow: lit ? `0 0 12px ${mixedColor}` : 'none',
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1">
            <span className={`h-1 w-1 rounded-full ${rOn ? 'bg-red-500' : 'bg-zinc-700'}`} />
            <span className={`h-1 w-1 rounded-full ${gOn ? 'bg-green-500' : 'bg-zinc-700'}`} />
            <span className={`h-1 w-1 rounded-full ${bOn ? 'bg-blue-500' : 'bg-zinc-700'}`} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function findRgbChannelStates(
  componentId: string,
  componentStates: Map<string, ComponentState>
): { rOn: boolean; gOn: boolean; bOn: boolean } {
  let rOn = false
  let gOn = false
  let bOn = false

  for (const [key, state] of componentStates) {
    if (!key.startsWith(`${componentId}-`) || !state.isOn) continue
    if (state.ledChannel === 'R') rOn = true
    if (state.ledChannel === 'G') gOn = true
    if (state.ledChannel === 'B') bOn = true
  }

  return { rOn, gOn, bOn }
}
