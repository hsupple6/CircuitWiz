import { ReactNode, CSSProperties } from 'react'

interface InscribedCircleProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  inset?: number
}

/** Fits a true circle inside a grid cell (uses min of width/height). */
export function InscribedCircle({ children, className = '', style, inset = 0 }: InscribedCircleProps) {
  const size =
    inset > 0 ? `min(100cqmin, calc(100% - ${inset}px))` : 'min(100cqmin, 100%)'

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center [container-type:size]">
      <div
        className={`relative flex items-center justify-center rounded-full ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        {children}
      </div>
    </div>
  )
}
