/** SMD-style components keep pin names for wiring but hide on-canvas labels. */
export const SMD_VISUAL_MODULES = new Set([
  'Resistor',
  'Capacitor',
  'Inductor',
  'LED',
  'ACSource',
  'Diode',
  'ZenerDiode',
  'NPNTransistor',
  'MOSFET',
  'OpAmp',
  'BridgeRectifier',
])

export function getDisplayPin(moduleName: string, pin: string | undefined, logicModule?: string): string {
  const logic = logicModule ?? moduleName
  if (SMD_VISUAL_MODULES.has(logic)) return ''
  return pin || ''
}
