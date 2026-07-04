/** Nested palette folders within a top-level category (or output subcategory). */
export const PALETTE_SUBGROUPS: Record<string, Array<{ id: string; label: string }>> = {
  passives: [
    { id: 'capacitors', label: 'Capacitors' },
    { id: 'inductors', label: 'Inductors' },
    { id: 'resistors', label: 'Resistors' },
    { id: 'potentiometers', label: 'Potentiometers' },
  ],
  semiconductors: [
    { id: 'diodes', label: 'Diodes' },
    { id: 'transistors', label: 'Transistors' },
  ],
  power: [{ id: 'batteries', label: 'Batteries' }],
  connectors: [],
  drivers: [
    { id: 'stepper', label: 'Stepper' },
    { id: 'brushed', label: 'Brushed' },
    { id: 'esc', label: 'ESC' },
    { id: 'led', label: 'LED' },
    { id: 'display', label: 'Display' },
    { id: 'relay', label: 'Relay & Solenoid' },
    { id: 'audio', label: 'Audio' },
    { id: 'power', label: 'Power' },
    { id: 'communication', label: 'Communication' },
  ],
}

export const OUTPUT_PALETTE_SUBGROUPS: Record<string, Array<{ id: string; label: string }>> = {
  light: [{ id: 'leds', label: 'LEDs' }],
  electromechanical: [{ id: 'motors', label: 'Motors' }],
}

const subgroupLabelIndex = new Map<string, string>()
for (const subs of Object.values(PALETTE_SUBGROUPS)) {
  for (const s of subs) subgroupLabelIndex.set(s.id, s.label)
}
for (const subs of Object.values(OUTPUT_PALETTE_SUBGROUPS)) {
  for (const s of subs) subgroupLabelIndex.set(s.id, s.label)
}

export function getPaletteSubgroupLabel(subgroupId: string | undefined): string {
  if (!subgroupId) return ''
  return subgroupLabelIndex.get(subgroupId) ?? subgroupId
}
