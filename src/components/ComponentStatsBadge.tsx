import type { ComponentState } from '../systems/ElectricalSystem'

interface ComponentStatsBadgeProps {
  state?: ComponentState | null
  label?: string
  compact?: boolean
}

function formatCurrent(amps: number): string {
  if (amps >= 1) return `${amps.toFixed(2)}A`
  if (amps >= 0.001) return `${(amps * 1000).toFixed(1)}mA`
  return `${(amps * 1e6).toFixed(0)}µA`
}

export function ComponentStatsBadge({ state, label, compact }: ComponentStatsBadgeProps) {
  if (!state) return null

  const voltage = state.outputVoltage ?? 0
  const current = state.outputCurrent ?? 0
  const power = state.power ?? voltage * current
  const active = state.isPowered || state.isOn || voltage > 0.05 || current > 1e-6
  const rpm = state?.instantaneousRPM ?? state?.motorRPM

  if (!active && !compact) {
    return (
      <div className="absolute bottom-0 left-0 right-0 text-center pb-0.5 pointer-events-none">
        <span className="text-[9px] font-mono text-gray-400 bg-black/60 px-1 rounded">off</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10">
        <span className="text-[9px] font-mono text-green-400 bg-black/75 px-1 rounded">
          {voltage.toFixed(1)}V · {formatCurrent(current)}
        </span>
      </div>
    )
  }

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-0.5 pointer-events-none z-10">
      {label && (
        <span className="text-[8px] font-semibold text-gray-300 bg-black/70 px-1 rounded mb-0.5">{label}</span>
      )}
      <div className="flex flex-col gap-0.5 items-center">
        <span className="text-[9px] font-mono text-green-400 bg-black/75 px-1 rounded">
          {voltage.toFixed(2)}V
        </span>
        <span className="text-[9px] font-mono text-blue-300 bg-black/75 px-1 rounded">
          {formatCurrent(current)}
        </span>
        <span className="text-[9px] font-mono text-amber-300 bg-black/75 px-1 rounded">
          {(power * 1000).toFixed(1)}mW
        </span>
        {rpm !== undefined && rpm > 0 && (
          <span className="text-[9px] font-mono text-purple-300 bg-black/75 px-1 rounded">
            {rpm.toFixed(0)} RPM
          </span>
        )}
      </div>
    </div>
  )
}
