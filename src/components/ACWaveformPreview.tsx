import { useEffect, useRef } from 'react'
import {
  ACWaveform,
  formatACFrequency,
  formatACVoltage,
  sampleWaveform,
} from '../utils/acSourceVisual'

interface ACWaveformPreviewProps {
  waveform: ACWaveform
  vrms: number
  frequency: number
  compact?: boolean
  showLabels?: boolean
  className?: string
}

export function ACWaveformPreview({
  waveform,
  vrms,
  frequency,
  compact = false,
  showLabels = true,
  className = '',
}: ACWaveformPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (time: number) => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const padX = w * 0.06
      const padY = h * 0.14
      const plotW = w - padX * 2
      const plotH = h - padY * 2
      const midY = padY + plotH / 2

      ctx.fillStyle = '#020804'
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(34, 197, 94, 0.12)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = padY + (plotH * i) / 4
        ctx.beginPath()
        ctx.moveTo(padX, y)
        ctx.lineTo(padX + plotW, y)
        ctx.stroke()
      }
      for (let i = 0; i <= 6; i++) {
        const x = padX + (plotW * i) / 6
        ctx.beginPath()
        ctx.moveTo(x, padY)
        ctx.lineTo(x, padY + plotH)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)'
      ctx.beginPath()
      ctx.moveTo(padX, midY)
      ctx.lineTo(padX + plotW, midY)
      ctx.stroke()

      const cycles = compact ? 1.5 : 2.2
      const scrollPhase = (time / 1000) * frequency
      const glow = ctx.createLinearGradient(0, 0, plotW, 0)
      glow.addColorStop(0, 'rgba(74, 222, 128, 0.55)')
      glow.addColorStop(0.5, 'rgba(134, 239, 172, 1)')
      glow.addColorStop(1, 'rgba(74, 222, 128, 0.55)')

      ctx.strokeStyle = glow
      ctx.lineWidth = compact ? 1.6 * dpr : 2.2 * dpr
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.shadowColor = 'rgba(74, 222, 128, 0.85)'
      ctx.shadowBlur = compact ? 6 * dpr : 10 * dpr

      ctx.beginPath()
      const steps = compact ? 48 : 96
      for (let i = 0; i <= steps; i++) {
        const xNorm = i / steps
        const phase = scrollPhase + xNorm * cycles
        const yNorm = sampleWaveform(waveform, phase)
        const x = padX + xNorm * plotW
        const y = midY - yNorm * (plotH * 0.38)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [waveform, frequency, compact])

  return (
    <div
      className={`relative overflow-hidden border border-emerald-900/60 bg-[#020804] ${
        compact ? 'rounded-[2px]' : 'rounded-lg'
      } ${className}`}
      style={{
        boxShadow: compact
          ? 'inset 0 0 8px rgba(34,197,94,0.15), 0 0 0 1px rgba(0,0,0,0.8)'
          : 'inset 0 0 24px rgba(34,197,94,0.12), 0 0 20px rgba(34,197,94,0.08)',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {showLabels && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent ${
            compact ? 'px-1 pb-0.5 pt-2 text-[5px]' : 'px-2.5 pb-1.5 pt-4 text-[10px]'
          }`}
        >
          <span className="font-bold tracking-wide text-emerald-300">{formatACVoltage(vrms)}</span>
          <span className="text-emerald-400/80">{formatACFrequency(frequency)}</span>
        </div>
      )}
      {!compact && (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400/90">
          {waveform}
        </div>
      )}
    </div>
  )
}
