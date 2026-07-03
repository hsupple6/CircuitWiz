export function BridgeRectifierBodyLabel() {
  return (
    <div
      className="pointer-events-none absolute z-[1]"
      style={{ left: '-100%', top: '-100%', width: '300%', height: '300%' }}
    >
      <div
        className="absolute inset-[18%] flex items-center justify-center rounded-sm border border-[#333]"
        style={{
          background:
            'linear-gradient(180deg, #2a2a2a 0%, #141414 22%, #0f0f0f 55%, #1a1a1a 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.5)',
        }}
      >
        <span className="rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-zinc-300">
          BRIDGE
        </span>
      </div>
    </div>
  )
}
