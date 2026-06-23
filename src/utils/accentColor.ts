export const DEFAULT_ACCENT = '#38bdf8'

export const ACCENT_PRESETS = [
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Ice', hex: '#67e8f9' },
  { name: 'Teal', hex: '#2dd4bf' },
  { name: 'Blue', hex: '#60a5fa' },
  { name: 'Indigo', hex: '#818cf8' },
  { name: 'Violet', hex: '#a78bfa' },
  { name: 'Mint', hex: '#4ade80' },
] as const

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function clampRgb([r, g, b]: Rgb): Rgb {
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ]
}

export function normalizeAccentHex(hex: string): string {
  if (!/^#?[0-9a-fA-F]{3,6}$/.test(hex.trim())) return DEFAULT_ACCENT
  const withHash = hex.startsWith('#') ? hex : `#${hex}`
  return rgbToHex(hexToRgb(withHash))
}

/** Push accent scale to CSS variables used by Tailwind `primary-*` and orbs. */
export function applyAccentColor(hex: string): string {
  const normalized = normalizeAccentHex(hex)
  const base = hexToRgb(normalized)
  const white: Rgb = [255, 255, 255]
  const black: Rgb = [0, 0, 0]

  const scale: Record<string, Rgb> = {
    50: clampRgb(mix(base, white, 0.92)),
    100: clampRgb(mix(base, white, 0.84)),
    200: clampRgb(mix(base, white, 0.68)),
    300: clampRgb(mix(base, white, 0.38)),
    400: base,
    500: clampRgb(mix(base, black, 0.12)),
    600: clampRgb(mix(base, black, 0.28)),
    700: clampRgb(mix(base, black, 0.42)),
    800: clampRgb(mix(base, black, 0.55)),
    900: clampRgb(mix(base, black, 0.68)),
  }

  const root = document.documentElement
  Object.entries(scale).forEach(([step, rgb]) => {
    root.style.setProperty(`--accent-${step}`, rgb.join(' '))
  })
  root.style.setProperty('--accent-glow', base.join(' '))
  root.style.setProperty('--accent-hex', normalized)

  return normalized
}

export function accentRgbCss(hex: string): string {
  return hexToRgb(normalizeAccentHex(hex)).join(' ')
}

export function accentGradientStops(hex: string) {
  const base = hexToRgb(normalizeAccentHex(hex))
  const white: Rgb = [255, 255, 255]
  const black: Rgb = [0, 0, 0]
  return {
    deep: rgbToHex(clampRgb(mix(base, black, 0.72))),
    mid: rgbToHex(clampRgb(mix(base, black, 0.45))),
    core: rgbToHex(base),
    bright: rgbToHex(clampRgb(mix(base, white, 0.22))),
    rim: rgbToHex(clampRgb(mix(base, white, 0.55))),
  }
}
