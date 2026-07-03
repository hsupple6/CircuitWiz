import type { ModuleDefinition } from '../modules/types'

export type ACWaveform = 'sine' | 'square' | 'triangle' | 'sawtooth'

export interface ACSourceSettings {
  vrms: number
  frequency: number
  waveform: ACWaveform
}

export const AC_WAVEFORM_LABELS: Record<ACWaveform, string> = {
  sine: 'Sine',
  square: 'Square',
  triangle: 'Triangle',
  sawtooth: 'Sawtooth',
}

export function formatACVoltage(vrms: number): string {
  if (vrms >= 10 && Number.isInteger(vrms)) return `${vrms}Vrms`
  return `${vrms.toFixed(1).replace(/\.0$/, '')}Vrms`
}

export function formatACFrequency(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}kHz`
  return `${Number.isInteger(hz) ? hz : hz.toFixed(1)}Hz`
}

/** Peak voltage from RMS for each waveform shape. */
export function vrmsToVpeak(vrms: number, waveform: ACWaveform): number {
  switch (waveform) {
    case 'sine':
    case 'triangle':
    case 'sawtooth':
      return vrms * Math.SQRT2
    case 'square':
      return vrms
  }
}

export function sampleWaveform(waveform: ACWaveform, phase: number): number {
  const t = phase - Math.floor(phase)
  switch (waveform) {
    case 'sine':
      return Math.sin(phase * 2 * Math.PI)
    case 'square':
      return Math.sin(phase * 2 * Math.PI) >= 0 ? 1 : -1
    case 'triangle':
      return 2 * Math.abs(2 * t - 1) - 1
    case 'sawtooth':
      return 2 * t - 1
  }
}

export function readACWaveform(
  properties: Record<string, unknown> | undefined,
  fallback: ACWaveform = 'sine'
): ACWaveform {
  const val = properties?.waveform
  if (typeof val === 'string' && val in AC_WAVEFORM_LABELS) return val as ACWaveform
  if (val && typeof val === 'object' && 'default' in val) {
    const d = (val as { default: unknown }).default
    if (typeof d === 'string' && d in AC_WAVEFORM_LABELS) return d as ACWaveform
  }
  return fallback
}

function readNumericProperty(
  properties: Record<string, unknown> | undefined,
  key: string,
  fallback: number
): number {
  const val = properties?.[key]
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (val && typeof val === 'object' && 'default' in val && typeof (val as { default: unknown }).default === 'number') {
    return (val as { default: number }).default
  }
  return fallback
}

export function readACSourceSettings(
  properties: Record<string, unknown> | undefined,
  fallback: ACSourceSettings = { vrms: 12, frequency: 60, waveform: 'sine' }
): ACSourceSettings {
  return {
    vrms: readNumericProperty(properties, 'vrms', fallback.vrms),
    frequency: readNumericProperty(properties, 'frequency', fallback.frequency),
    waveform: readACWaveform(properties, fallback.waveform),
  }
}

export function applyACSourceProperties(
  module: ModuleDefinition,
  settings: ACSourceSettings
): ModuleDefinition {
  const props = (module as ModuleDefinition & { properties?: Record<string, unknown> }).properties
  const vpeak = vrmsToVpeak(settings.vrms, settings.waveform)
  const nextGrid = module.grid.map((moduleCell) => {
    if (moduleCell.pin !== 'AC1') return moduleCell
    return {
      ...moduleCell,
      voltage: vpeak,
      isPowered: settings.vrms > 1e-6,
    }
  })

  return {
    ...module,
    grid: nextGrid,
    properties: {
      ...props,
      vrms: settings.vrms,
      frequency: settings.frequency,
      waveform: settings.waveform,
    },
  } as ModuleDefinition
}
