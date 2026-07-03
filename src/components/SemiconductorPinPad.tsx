interface SemiconductorPinPadProps {
  label: string
  edge: 'top' | 'bottom' | 'left' | 'right'
}

const COPPER =
  'linear-gradient(180deg, #e8c872 0%, #c9a227 35%, #b87333 65%, #8b6914 100%)'

export function SemiconductorPinPad({ label, edge }: SemiconductorPinPadProps) {
  const isVertical = edge === 'top' || edge === 'bottom'

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0a0a0a]">
      <div
        className={`absolute rounded-full ${
          isVertical
            ? 'left-1/2 w-[14%] min-w-[2px] max-w-[4px] -translate-x-1/2'
            : 'top-1/2 h-[14%] min-h-[2px] max-h-[4px] -translate-y-1/2'
        }`}
        style={{
          background: COPPER,
          boxShadow: '0 0 3px rgba(201, 162, 39, 0.35)',
          ...(edge === 'top' && { top: '10%', bottom: '38%' }),
          ...(edge === 'bottom' && { top: '38%', bottom: '10%' }),
          ...(edge === 'left' && { left: '10%', right: '38%' }),
          ...(edge === 'right' && { left: '38%', right: '10%' }),
        }}
      />
      <span
        className={`absolute font-bold tracking-wide text-zinc-500 ${
          edge === 'top'
            ? 'inset-x-0 bottom-[8%] text-center text-[7px]'
            : edge === 'bottom'
              ? 'inset-x-0 top-[8%] text-center text-[7px]'
              : edge === 'left'
                ? 'right-[6%] top-1/2 -translate-y-1/2 text-[7px]'
                : 'left-[6%] top-1/2 -translate-y-1/2 text-[7px]'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
