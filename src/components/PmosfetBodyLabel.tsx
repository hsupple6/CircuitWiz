const STROKE = '#e8e8e8'

export function PmosfetBodyLabel() {
  return (
    <div
      className="pointer-events-none absolute z-[1]"
      style={{ left: '-100%', top: '-100%', width: '300%', height: '300%' }}
    >
      <div className="absolute inset-[22%] flex items-center justify-center">
        <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
          <line x1="10" y1="32" x2="22" y2="32" stroke={STROKE} strokeWidth="1.5" />
          <line x1="22" y1="14" x2="22" y2="50" stroke={STROKE} strokeWidth="2" />
          <line x1="22" y1="14" x2="54" y2="14" stroke={STROKE} strokeWidth="1.5" />
          <line x1="22" y1="50" x2="54" y2="50" stroke={STROKE} strokeWidth="1.5" />
          <line x1="22" y1="32" x2="54" y2="32" stroke={STROKE} strokeWidth="1.5" />
          <circle cx="28" cy="32" r="3" fill="none" stroke={STROKE} strokeWidth="1.2" />
          <polygon points="36,32 44,28 44,36" fill={STROKE} stroke={STROKE} strokeWidth="0.5" />
        </svg>
      </div>
      <span className="absolute left-1/2 top-[62%] -translate-x-1/2 rounded bg-black/75 px-1 py-px text-[7px] font-bold text-zinc-300">
        PMOS
      </span>
    </div>
  )
}
