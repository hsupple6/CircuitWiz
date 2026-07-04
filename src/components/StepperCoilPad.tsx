interface StepperCoilPadProps {
  label: 'A+' | 'A-' | 'B+' | 'B-'
  active?: boolean
}

const COPPER =
  'linear-gradient(180deg, #e8c872 0%, #c9a227 35%, #b87333 65%, #8b6914 100%)'

export function StepperCoilPad({ label, active = false }: StepperCoilPadProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0a0a0a]">
      <div
        className="absolute inset-y-[10%] left-1/2 w-[14%] min-w-[2px] max-w-[4px] -translate-x-1/2 rounded-full transition-shadow"
        style={{
          background: COPPER,
          boxShadow: active
            ? '0 0 8px rgba(234, 179, 8, 0.8), 0 0 3px rgba(201, 162, 39, 0.55)'
            : '0 0 3px rgba(201, 162, 39, 0.35)',
        }}
      />
      <span
        className={`absolute inset-x-0 bottom-[8%] text-center text-[7px] font-bold tracking-wide ${
          active ? 'text-amber-300' : 'text-zinc-500'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
