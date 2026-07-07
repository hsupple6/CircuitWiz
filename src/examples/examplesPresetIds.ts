/** Stable IDs for built-in Examples folder content (survive reload / merge). */
export const EXAMPLE_SCHEMATIC_IDS: Record<string, string> = {
  'Voltage Divider': 'ex-schematic-voltage-divider',
  'LED + Resistor': 'ex-schematic-led-resistor',
  'Parallel Resistors': 'ex-schematic-parallel-resistors',
  'RC Circuit': 'ex-schematic-rc-circuit',
  'NPN Transistor Switch': 'ex-schematic-npn-switch',
  'Op-Amp Inverting Amplifier': 'ex-schematic-opamp-inverting',
  'Zener Voltage Clamp': 'ex-schematic-zener-clamp',
  'Bridge Rectifier': 'ex-schematic-bridge-rectifier',
  'BLDC Motor + ESC': 'ex-schematic-bldc-motor-esc',
  'MOSFET Boost Converter': 'ex-schematic-mosfet-boost',
  'LM317 + Potentiometer': 'ex-schematic-lm317-pot',
  'NPN Switch + LED': 'ex-schematic-npn-switch-led',
}

export const EXAMPLE_DOCUMENT_IDS: Record<string, string> = {
  'Simulation Test Reference': 'ex-doc-simulation-reference',
  'BLDC Motor Example': 'ex-doc-bldc-motor',
  'MOSFET Boost Example': 'ex-doc-mosfet-boost',
}

export const EXAMPLE_PROGRAM_IDS: Record<string, string> = {
  'LED Blink': 'ex-program-led-blink',
  'BLDC ESC Throttle': 'ex-program-bldc-esc-throttle',
  'MOSFET Boost PWM': 'ex-program-mosfet-boost-pwm',
}

function applyStableId<T extends { name: string; id: string }>(
  item: T,
  ids: Record<string, string>
): T {
  const stable = ids[item.name]
  return stable ? { ...item, id: stable } : item
}

export function applyExamplesPresetIds<T extends { name: string; id: string }>(
  items: T[],
  ids: Record<string, string>
): T[] {
  return items.map((item) => applyStableId(item, ids))
}

/** Keep the first item for each name — repairs duplicated Examples folder saves. */
export function dedupeWorkspaceItemsByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.name)) continue
    seen.add(item.name)
    result.push(item)
  }
  return result
}
