import { formatBatteryCapacity, formatBatteryVoltage } from '../utils/batteryVisual'

interface BatteryBodyLabelProps {
  voltage: number
  capacityMah: number
  compact?: boolean
}

export function BatteryBodyLabel({ voltage, capacityMah, compact = false }: BatteryBodyLabelProps) {
  const vLabel = formatBatteryVoltage(voltage)
  const cLabel = formatBatteryCapacity(capacityMah)

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-[1]"
      style={{ width: '200%' }}
    >
      <div className="absolute inset-y-[12%] left-[20%] right-[20%] flex flex-col items-center justify-center border border-[#333] bg-black">
        <span
          className={`font-bold leading-none text-white ${
            compact ? 'text-[7px]' : 'text-[9px]'
          }`}
        >
          {vLabel}
        </span>
        <span
          className={`leading-none text-zinc-400 ${
            compact ? 'mt-px text-[6px]' : 'mt-0.5 text-[7px]'
          }`}
        >
          {cLabel}
        </span>
      </div>
    </div>
  )
}
