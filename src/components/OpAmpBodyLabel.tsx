const STROKE = '#e8e8e8'

export function OpAmpBodyLabel() {
  return (
    <div
      className="pointer-events-none absolute z-[1]"
      style={{ left: '-100%', top: '-100%', width: '300%', height: '300%' }}
    >
      <div className="absolute inset-[18%] flex items-center justify-center">
        <svg viewBox="0 0 72 56" className="h-full w-full" aria-hidden>
          <polygon
            points="18,4 18,52 58,28"
            fill="none"
            stroke={STROKE}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <line x1="2" y1="16" x2="18" y2="16" stroke={STROKE} strokeWidth="1.5" />
          <line x1="2" y1="40" x2="18" y2="40" stroke={STROKE} strokeWidth="1.5" />
          <line x1="58" y1="28" x2="70" y2="28" stroke={STROKE} strokeWidth="1.5" />
          <text x="6" y="19" fill={STROKE} fontSize="9" fontWeight="700">
            −
          </text>
          <text x="6" y="43" fill={STROKE} fontSize="9" fontWeight="700">
            +
          </text>
        </svg>
      </div>
      <span className="absolute left-1/2 top-[66%] -translate-x-1/2 rounded bg-black/75 px-1 py-px text-[7px] font-bold text-zinc-300">
        OP
      </span>
    </div>
  )
}
