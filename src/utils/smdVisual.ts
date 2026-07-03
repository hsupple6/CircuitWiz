/** SMD-style components keep pin names for wiring but hide on-canvas labels. */
export const SMD_VISUAL_MODULES = new Set([
  'Resistor',
  'Capacitor',
  'Inductor',
  'LED',
  'Battery',
  'ACSource',
  'Diode',
  'ZenerDiode',
  'NPNTransistor',
  'OpAmp',
  'BridgeRectifier',
])

export function getDisplayPin(moduleName: string, pin: string | undefined): string {
  if (SMD_VISUAL_MODULES.has(moduleName)) return ''
  return pin || ''
}
