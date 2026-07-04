/** Universal theme colors — wire palette with light/dark variants. */

export type ColorMode = 'light' | 'dark'

export type WireColorId =
  | 'white'
  | 'gray'
  | 'black'
  | 'red'
  | 'green'
  | 'limeGreen'
  | 'navyBlue'
  | 'lightBlue'
  | 'yellow'
  | 'brown'
  | 'violet'
  | 'orange'
  | 'pink'

export interface ThemeColorPair {
  light: string
  dark: string
}

export interface WireColorDefinition {
  id: WireColorId
  name: string
  colors: ThemeColorPair
}

export const COLOR_MODE_STORAGE_KEY = 'carbon-color-mode'
export const WIRE_COLOR_MODE_STORAGE_KEY = 'carbon-wire-color-mode'
export const DEFAULT_COLOR_MODE: ColorMode = 'dark'
export const DEFAULT_WIRE_COLOR_MODE = DEFAULT_COLOR_MODE
export const DEFAULT_WIRE_COLOR_ID: WireColorId = 'gray'

export const WIRE_COLORS: WireColorDefinition[] = [
  { id: 'white', name: 'White', colors: { light: '#cbd5e1', dark: '#f8fafc' } },
  { id: 'gray', name: 'Gray', colors: { light: '#475569', dark: '#94a3b8' } },
  { id: 'black', name: 'Black', colors: { light: '#0f172a', dark: '#334155' } },
  { id: 'red', name: 'Red', colors: { light: '#b91c1c', dark: '#f87171' } },
  { id: 'green', name: 'Green', colors: { light: '#15803d', dark: '#4ade80' } },
  { id: 'limeGreen', name: 'Lime Green', colors: { light: '#4d7c0f', dark: '#bef264' } },
  { id: 'navyBlue', name: 'Navy Blue', colors: { light: '#1e3a8a', dark: '#60a5fa' } },
  { id: 'lightBlue', name: 'Light Blue', colors: { light: '#0284c7', dark: '#7dd3fc' } },
  { id: 'yellow', name: 'Yellow', colors: { light: '#a16207', dark: '#fde047' } },
  { id: 'brown', name: 'Brown', colors: { light: '#713f12', dark: '#fdba74' } },
  { id: 'violet', name: 'Violet', colors: { light: '#6d28d9', dark: '#c4b5fd' } },
  { id: 'orange', name: 'Orange', colors: { light: '#c2410c', dark: '#fb923c' } },
  { id: 'pink', name: 'Pink', colors: { light: '#be185d', dark: '#f9a8d4' } },
]

const WIRE_COLOR_BY_ID = new Map(WIRE_COLORS.map((c) => [c.id, c]))

export function getWireColorDefinition(id: WireColorId): WireColorDefinition {
  const def = WIRE_COLOR_BY_ID.get(id)
  if (!def) throw new Error(`Unknown wire color id: ${id}`)
  return def
}

export function getWireColorHex(id: WireColorId, mode: ColorMode): string {
  return getWireColorDefinition(id).colors[mode]
}

export function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase()
}

export function inferWireColorId(color: string | undefined): WireColorId | undefined {
  if (!color) return undefined
  const normalized = normalizeHex(color)
  for (const def of WIRE_COLORS) {
    if (
      normalizeHex(def.colors.light) === normalized ||
      normalizeHex(def.colors.dark) === normalized
    ) {
      return def.id
    }
  }
  return undefined
}

export interface WireColorSource {
  colorId?: WireColorId
  color?: string
}

export function resolveWireStrokeColor(
  source: WireColorSource,
  mode: ColorMode,
  fallbackId: WireColorId = DEFAULT_WIRE_COLOR_ID
): string {
  if (source.colorId) {
    return getWireColorHex(source.colorId, mode)
  }
  const inferred = inferWireColorId(source.color)
  if (inferred) {
    return getWireColorHex(inferred, mode)
  }
  return source.color ?? getWireColorHex(fallbackId, mode)
}

export function wireColorPatch(
  id: WireColorId,
  mode: ColorMode = DEFAULT_WIRE_COLOR_MODE
): { colorId: WireColorId; color: string } {
  return { colorId: id, color: getWireColorHex(id, mode) }
}

export function simulationWireColors(mode: ColorMode) {
  return {
    active: getWireColorHex('limeGreen', mode),
    inactive: getWireColorHex('gray', mode),
    poweredFlow: getWireColorHex('green', mode),
  }
}

export function isWireColorId(value: string): value is WireColorId {
  return WIRE_COLOR_BY_ID.has(value as WireColorId)
}

export function parseColorMode(value: string | null | undefined): ColorMode {
  return value === 'light' ? 'light' : 'dark'
}
