import { useId } from 'react'

interface CarbonLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const heights = { sm: 28, md: 36, lg: 56, xl: 80 }

function hexPoints(cx: number, cy: number, r: number, rotation = 0) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i + rotation)
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const
  })
}

function hexPath(cx: number, cy: number, r: number, rotation = -90) {
  const pts = hexPoints(cx, cy, r, rotation)
  return `M ${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`
}

export function CarbonLogo({ className = '', size = 'md' }: CarbonLogoProps) {
  const uid = useId().replace(/:/g, '')
  const h = heights[size]

  const markCx = 22
  const markCy = 22
  const outerR = 15
  const innerR = 8.5
  const bondR = 11.5

  const outerHex = hexPath(markCx, markCy, outerR)
  const innerHex = hexPath(markCx, markCy, innerR, -60)
  const bondAngles = [-90, 30, 150]
  const bonds = bondAngles.map((deg) => {
    const rad = (Math.PI / 180) * deg
    return {
      x2: markCx + bondR * Math.cos(rad),
      y2: markCy + bondR * Math.sin(rad),
    }
  })

  return (
    <svg
      viewBox="0 0 196 44"
      height={h}
      className={className}
      aria-label="Carbon"
      role="img"
    >
      <defs>
        <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f4f4f5" />
          <stop offset="100%" stopColor="#d4d4d8" />
        </linearGradient>
        <linearGradient id={`${uid}-mark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e4e4e7" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="blur" />
          <feOffset in="blur" dx="0" dy="0.5" result="offsetBlur" />
          <feFlood floodColor="#ffffff" floodOpacity="0.35" result="glowColor" />
          <feComposite in="glowColor" in2="offsetBlur" operator="in" result="softGlow" />
          <feMerge>
            <feMergeNode in="softGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g fill="none" stroke={`url(#${uid}-mark)`} strokeLinecap="round" strokeLinejoin="round">
        <path d={outerHex} strokeWidth="1.75" />
        <path d={innerHex} strokeWidth="1.35" opacity="0.55" />
        {bonds.map((bond, i) => (
          <line
            key={i}
            x1={markCx}
            y1={markCy}
            x2={bond.x2}
            y2={bond.y2}
            strokeWidth="1.35"
            opacity="0.85"
          />
        ))}
        <circle cx={markCx} cy={markCy} r="2.1" fill="#ffffff" stroke="none" />
      </g>

      <text
        x="50"
        y="29.5"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="600"
        fontSize="26"
        letterSpacing="-0.02em"
        fill={`url(#${uid}-shine)`}
        filter={`url(#${uid}-glow)`}
      >
        Carbon
      </text>
    </svg>
  )
}
