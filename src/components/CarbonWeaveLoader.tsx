import type { CSSProperties } from 'react'

/** Carbon fiber weave loading animation — fibers converge, lock, burst, repeat */
export function CarbonWeaveLoader({ className = '' }: { className?: string }) {
  const hLines = 7
  const vLines = 7
  const size = 120
  const gap = size / (hLines + 1)

  return (
    <div className={`carbon-weave-loader ${className}`} aria-hidden>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="carbon-weave-svg"
      >
        {Array.from({ length: hLines }, (_, i) => {
          const y = gap * (i + 1)
          return (
            <line
              key={`h-${i}`}
              className="carbon-weave-fiber carbon-weave-fiber-h"
              style={{ '--fiber-i': i, '--fiber-total': hLines } as CSSProperties}
              x1={0}
              y1={y}
              x2={size}
              y2={y}
            />
          )
        })}
        {Array.from({ length: vLines }, (_, i) => {
          const x = gap * (i + 1)
          return (
            <line
              key={`v-${i}`}
              className="carbon-weave-fiber carbon-weave-fiber-v"
              style={{ '--fiber-i': i, '--fiber-total': vLines } as CSSProperties}
              x1={x}
              y1={0}
              x2={x}
              y2={size}
            />
          )
        })}
        <rect
          className="carbon-weave-core"
          x={size * 0.2}
          y={size * 0.2}
          width={size * 0.6}
          height={size * 0.6}
          rx={4}
        />
      </svg>
      <p className="carbon-weave-label">Preparing your suite…</p>
    </div>
  )
}
