/** EIA 4-band color codes and SMD resistor display helpers */

export const RESISTOR_BAND_COLORS: Record<number, string> = {
  0: '#1a1a1a',
  1: '#8B4513',
  2: '#DC2626',
  3: '#EA580C',
  4: '#EAB308',
  5: '#16A34A',
  6: '#2563EB',
  7: '#7C3AED',
  8: '#6B7280',
  9: '#F5F5F5',
}

export function getResistorColorBands(resistance: number): string[] {
  if (!resistance || resistance <= 0) return []

  let mult = 0
  let value = resistance
  while (value >= 100) {
    value /= 10
    mult++
  }
  while (value < 10 && mult > 0) {
    value *= 10
    mult--
  }

  const d1 = Math.floor(value / 10)
  const d2 = Math.floor(value % 10)

  return [
    RESISTOR_BAND_COLORS[d1] ?? '#000',
    RESISTOR_BAND_COLORS[d2] ?? '#000',
    RESISTOR_BAND_COLORS[mult] ?? '#000',
    '#C0C0C0',
  ]
}

export function getResistorDisplayValue(resistance: number): string {
  if (resistance >= 1_000_000) {
    const m = resistance / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}MΩ`
  }
  if (resistance >= 1000) {
    const k = resistance / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}kΩ`
  }
  return `${resistance}Ω`
}

export function resolveCellResistance(
  cellResistance: unknown,
  moduleProperties?: Record<string, unknown>
): number {
  if (typeof cellResistance === 'number' && cellResistance > 0) return cellResistance
  const prop = moduleProperties?.resistance
  if (typeof prop === 'number' && prop > 0) return prop
  if (prop && typeof prop === 'object' && 'default' in (prop as object)) {
    const d = (prop as { default: number }).default
    if (typeof d === 'number' && d > 0) return d
  }
  return 1000
}
