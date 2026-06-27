import { formatInductance } from './InductanceSelector'
import { InscribedCircle } from './InscribedCircle'

const COPPER = '#B87333'

interface InductorBodyLabelProps {
  inductance: number
  compact?: boolean
}

export function InductorBodyLabel({ inductance, compact = false }: InductorBodyLabelProps) {
  const label = formatInductance(inductance)

  return (
    <InscribedCircle
      inset={2}
      className="border-2 bg-black"
      style={{ borderColor: COPPER }}
    >
      <span
        className={`font-bold leading-none text-white bg-black ${
          compact ? 'px-0.5 py-px text-[7px]' : 'px-1 py-0.5 text-[9px]'
        }`}
      >
        {label}
      </span>
    </InscribedCircle>
  )
}
