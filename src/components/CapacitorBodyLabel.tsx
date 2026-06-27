import { formatCapacitance } from './CapacitanceSelector'
import { InscribedCircle } from './InscribedCircle'

interface CapacitorBodyLabelProps {
  capacitance: number
  compact?: boolean
}

export function CapacitorBodyLabel({ capacitance, compact = false }: CapacitorBodyLabelProps) {
  const label = formatCapacitance(capacitance)

  return (
    <InscribedCircle className="overflow-hidden border border-[#dcdcdc] bg-[#c0c0c0]">
      <div className="absolute inset-y-0 left-0 bg-black" style={{ width: '30%' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-bold leading-none text-white bg-black/50 ${
            compact ? 'px-0.5 py-px text-[7px]' : 'px-1 py-0.5 text-[9px]'
          }`}
        >
          {label}
        </span>
      </div>
    </InscribedCircle>
  )
}
