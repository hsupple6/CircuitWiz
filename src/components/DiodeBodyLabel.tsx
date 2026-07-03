interface DiodeBodyLabelProps {
  forwardVoltage: number
  compact?: boolean
}

const STROKE = '#e8e8e8'

export function DiodeBodyLabel({ forwardVoltage, compact = false }: DiodeBodyLabelProps) {
  const label = `${forwardVoltage.toFixed(1)}V`

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-[10%]">
      <svg viewBox="0 0 48 24" className="h-full w-full" aria-hidden>
        <line x1="2" y1="12" x2="14" y2="12" stroke={STROKE} strokeWidth="1.5" />
        <polygon
          points="14,5 14,19 28,12"
          fill="none"
          stroke={STROKE}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="28" y1="5" x2="28" y2="19" stroke={STROKE} strokeWidth="2.2" />
        <line x1="28" y1="12" x2="46" y2="12" stroke={STROKE} strokeWidth="1.5" />
      </svg>
      <span
        className={`absolute bottom-[6%] font-bold leading-none text-white bg-black/70 ${
          compact ? 'px-0.5 py-px text-[6px]' : 'px-1 py-0.5 text-[7px]'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
