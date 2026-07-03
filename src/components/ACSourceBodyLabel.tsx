import { ACSourceSettings, readACSourceSettings } from '../utils/acSourceVisual'
import { ACWaveformPreview } from './ACWaveformPreview'

interface ACSourceBodyLabelProps {
  properties?: Record<string, unknown>
  compact?: boolean
}

export function ACSourceBodyLabel({ properties, compact = false }: ACSourceBodyLabelProps) {
  const settings: ACSourceSettings = readACSourceSettings(properties)

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-[1]"
      style={{ width: '200%' }}
    >
      <div className={`absolute inset-y-[10%] left-[12%] right-[12%] ${compact ? '' : ''}`}>
        <ACWaveformPreview
          compact
          showLabels
          waveform={settings.waveform}
          vrms={settings.vrms}
          frequency={settings.frequency}
          className="h-full w-full"
        />
      </div>
    </div>
  )
}
