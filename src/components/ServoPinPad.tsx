interface ServoPinPadProps {
  label: 'VCC' | 'GND' | 'PWM'
}

export function ServoPinPad({ label }: ServoPinPadProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]">
      <div className="relative flex h-[38%] w-[38%] min-h-[7px] min-w-[7px] items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-black ring-2 ring-zinc-400/85 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
      </div>
      <span className="mt-[8%] text-[7px] font-bold tracking-wide text-zinc-500">{label}</span>
    </div>
  )
}
