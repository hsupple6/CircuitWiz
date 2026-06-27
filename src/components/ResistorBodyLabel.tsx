import {
  getResistorColorBands,
  getResistorDisplayValue,
  resolveCellResistance,
} from '../utils/resistorVisual'

interface ResistorBodyLabelProps {
  resistance: number
  compact?: boolean
}

export function ResistorBodyLabel({ resistance, compact = false }: ResistorBodyLabelProps) {
  const bands = getResistorColorBands(resistance)
  const label = getResistorDisplayValue(resistance)

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-stretch gap-[2px]">
        {bands.map((color, index) => (
          <div
            key={index}
            className={compact ? 'w-[2px]' : 'w-[3px]'}
            style={{
              backgroundColor: color,
              border: color === '#F5F5F5' || color === '#EAB308' ? '1px solid #555' : undefined,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-bold leading-none text-white bg-black ${
            compact ? 'px-0.5 py-px text-[7px]' : 'px-1 py-0.5 text-[9px]'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
