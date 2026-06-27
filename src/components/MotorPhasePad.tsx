interface MotorPhasePadProps {
  label: 'IN1' | 'IN2' | 'IN3'
}

const COPPER =
  'linear-gradient(180deg, #e8c872 0%, #c9a227 35%, #b87333 65%, #8b6914 100%)'

export function MotorPhasePad({ label }: MotorPhasePadProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0a0a0a]">
      <div
        className="absolute inset-y-[10%] left-1/2 w-[14%] min-w-[2px] max-w-[4px] -translate-x-1/2 rounded-full"
        style={{ background: COPPER, boxShadow: '0 0 3px rgba(201, 162, 39, 0.35)' }}
      />
      <span className="absolute inset-x-0 bottom-[8%] text-center text-[7px] font-bold tracking-wide text-zinc-500">
        {label}
      </span>
    </div>
  )
}
