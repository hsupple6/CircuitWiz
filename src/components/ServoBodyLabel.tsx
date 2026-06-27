import type { ComponentState } from '../systems/ElectricalSystem'

interface ServoBodyLabelProps {
  state: ComponentState | null
}

/** Rest horizontal → right (0°). PWM sweeps ±90° around that when powered. */
function hornAngleFromState(state: ComponentState | null): number {
  if (!state?.isPowered) return 0
  if (state.pwm !== undefined && Number.isFinite(state.pwm)) {
    return ((state.pwm / 100) - 0.5) * 180
  }
  return 0
}

export function ServoBodyLabel({ state }: ServoBodyLabelProps) {
  const isActive = Boolean(state?.isPowered)
  const angle = hornAngleFromState(state)

  return (
    <div
      className="pointer-events-none absolute z-[1]"
      style={{
        left: '-100%',
        top: '-100%',
        width: '300%',
        height: '300%',
      }}
    >
      {/* Black servo housing */}
      <div
        className="absolute left-[6%] right-[6%] top-[34%] bottom-[6%] rounded-md bg-black"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -2px 5px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Pivot hub */}
        <div className="absolute left-1/2 top-[38%] h-[16%] w-[16%] min-h-[7px] min-w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 ring-1 ring-zinc-700" />

        {/* White rounded horn — default horizontal to the right */}
        <div
          className="absolute left-1/2 top-[38%]"
          style={{ transform: `translateY(-50%) rotate(${angle}deg)`, transformOrigin: '0% 50%' }}
        >
          <div
            className={`h-[18%] min-h-[6px] w-[62%] min-w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${
              isActive ? 'ring-1 ring-white/40' : ''
            }`}
          />
        </div>

        {isActive && (
          <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 rounded bg-black/70 px-1 py-px text-[7px] font-medium text-emerald-300/90">
            Active
          </div>
        )}
      </div>
    </div>
  )
}
