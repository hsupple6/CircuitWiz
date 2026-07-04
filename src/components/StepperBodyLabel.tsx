import type { ComponentState } from '../systems/ElectricalSystem'

interface StepperBodyLabelProps {
  coilAActive: boolean
  coilBActive: boolean
  stepAngle?: number
}

export function StepperBodyLabel({
  coilAActive,
  coilBActive,
  stepAngle = 0,
}: StepperBodyLabelProps) {
  const isActive = coilAActive || coilBActive

  return (
    <div
      className="pointer-events-none absolute z-[1]"
      style={{ left: '-100%', top: '-50%', width: '300%', height: '200%' }}
    >
      <div
        className="absolute left-[8%] right-[8%] top-[20%] bottom-[10%] rounded-md"
        style={{
          background:
            'linear-gradient(180deg, #2a2a2a 0%, #141414 18%, #0f0f0f 55%, #1a1a1a 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.5)',
        }}
      >
        <div className="absolute left-[12%] top-[18%] flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${coilAActive ? 'bg-amber-400' : 'bg-zinc-700'}`} />
            <span className="text-[7px] font-bold text-zinc-400">A</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${coilBActive ? 'bg-amber-400' : 'bg-zinc-700'}`} />
            <span className="text-[7px] font-bold text-zinc-400">B</span>
          </div>
        </div>

        <div className="absolute bottom-[12%] left-1/2 flex -translate-x-1/2 flex-col items-center">
          <div
            className={`relative flex h-[28%] min-h-[12px] w-[28%] min-w-[12px] items-center justify-center rounded-full bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-600 shadow-md ring-2 ring-zinc-700/60 ${
              isActive ? 'animate-[spin_4s_steps(8)_infinite]' : ''
            }`}
            style={{ transform: `rotate(${stepAngle}deg)` }}
          >
            <div className="absolute h-[30%] w-[30%] rounded-full bg-zinc-800" />
            <div className="absolute top-[8%] h-[18%] w-[12%] rounded-sm bg-zinc-600" />
          </div>
        </div>

        {isActive && (
          <div className="absolute left-1/2 top-[6%] -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1 py-px text-[8px] font-bold text-amber-300">
            {coilAActive && coilBActive ? 'A+B' : coilAActive ? 'Coil A' : 'Coil B'}
          </div>
        )}
      </div>
    </div>
  )
}

export function findStepperCoilStates(
  componentId: string,
  componentStates: Map<string, ComponentState>
): { coilAActive: boolean; coilBActive: boolean } {
  let coilAActive = false
  let coilBActive = false

  for (const [key, state] of componentStates) {
    if (!key.startsWith(`${componentId}-`)) continue
    if (state.stepperCoilA) coilAActive = true
    if (state.stepperCoilB) coilBActive = true
    if (state.coilPair === 'A' && state.isPowered) coilAActive = true
    if (state.coilPair === 'B' && state.isPowered) coilBActive = true
  }

  return { coilAActive, coilBActive }
}
