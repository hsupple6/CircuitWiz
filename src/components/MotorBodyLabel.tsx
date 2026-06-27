import type { ComponentState } from '../systems/ElectricalSystem'

interface MotorBodyLabelProps {
  state: ComponentState | null
}

export function MotorBodyLabel({ state }: MotorBodyLabelProps) {
  const rpm = state?.instantaneousRPM ?? state?.motorRPM ?? 0
  const isActive = (state?.isPowered && rpm > 1) || rpm > 1

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
      {/* Motor can — rows 1–2 */}
      <div
        className="absolute left-[8%] right-[8%] top-[34%] bottom-[6%] rounded-md"
        style={{
          background:
            'linear-gradient(180deg, #2a2a2a 0%, #141414 18%, #0f0f0f 55%, #1a1a1a 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.5)',
        }}
      >
        {/* Stator copper band */}
        <div
          className="absolute left-[6%] right-[6%] top-[28%] h-[18%] rounded-sm opacity-90"
          style={{
            background:
              'linear-gradient(90deg, #6b4a1e 0%, #c9a227 20%, #e8c872 50%, #c9a227 80%, #6b4a1e 100%)',
            boxShadow: '0 0 6px rgba(201, 162, 39, 0.25)',
          }}
        />

        {/* Mounting holes */}
        {[
          { left: '10%', top: '12%' },
          { right: '10%', top: '12%' },
          { left: '10%', bottom: '18%' },
          { right: '10%', bottom: '18%' },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute h-[7%] w-[7%] min-h-[3px] min-w-[3px] rounded-full bg-[#080808] ring-1 ring-zinc-700/80"
            style={pos}
          />
        ))}

        {/* Shaft / bell */}
        <div className="absolute bottom-[8%] left-1/2 flex -translate-x-1/2 flex-col items-center">
          <div
            className={`relative flex h-[22%] min-h-[10px] w-[22%] min-w-[10px] items-center justify-center rounded-full bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-600 shadow-md ring-2 ring-zinc-700/60 ${
              isActive ? 'animate-[spin_2s_linear_infinite]' : ''
            }`}
          >
            <div className="h-[35%] w-[35%] rounded-full bg-zinc-800" />
          </div>
        </div>

        {/* Live stats */}
        {isActive && (
          <div className="absolute left-1/2 top-[6%] -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1 py-px text-[8px] font-bold text-emerald-300">
            {rpm.toFixed(0)} RPM
          </div>
        )}
      </div>
    </div>
  )
}
