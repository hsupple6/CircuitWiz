import type { ModuleDefinition } from '../types'

export type ConnectorGender = 'plug' | 'socket'

const MAX_PINS = 16
const ROW_WIDTH = 8

function pinCss(
  gender: ConnectorGender,
  pinIndex: number,
  pinCount: number,
  col: number,
  row: number,
  cols: number,
  rows: number
): string {
  const isFirstCol = col === 0
  const isLastCol = col === cols - 1 || pinIndex === pinCount - 1
  const isTopRow = row === 0
  const isBottomRow = row === rows - 1

  let radius = ''
  if (isTopRow && isFirstCol) radius = 'border-radius:4px 0 0 0;'
  else if (isTopRow && isLastCol) radius = 'border-radius:0 4px 0 0;'
  else if (isBottomRow && isFirstCol) radius = 'border-radius:0 0 0 4px;'
  else if (isBottomRow && isLastCol) radius = 'border-radius:0 0 4px 0;'

  const base =
    'font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:1px solid #9CA3AF;'

  if (gender === 'plug') {
    return `${base}${radius}background:linear-gradient(180deg,#E5E7EB 0%,#9CA3AF 45%,#6B7280 100%);color:#111827;`
  }

  return `${base}${radius}background:linear-gradient(180deg,#374151 0%,#1F2937 55%,#111827 100%);color:#F3F4F6;box-shadow:inset 0 1px 3px rgba(0,0,0,0.45);`
}

/** Build a placed connector grid from pin count and plug/socket gender. */
export function buildNPinConnectorDefinition(
  pinCount: number,
  gender: ConnectorGender
): ModuleDefinition {
  const pins = Math.max(2, Math.min(MAX_PINS, Math.round(pinCount)))
  const cols = pins <= ROW_WIDTH ? pins : ROW_WIDTH
  const rows = Math.ceil(pins / cols)

  const grid: ModuleDefinition['grid'] = []
  for (let i = 0; i < pins; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    grid.push({
      x: col,
      y: row,
      type: 'PIN',
      pin: String(i + 1),
      isConnectable: true,
      isPowerable: true,
      isGroundable: true,
      css: pinCss(gender, i, pins, col, row, cols, rows),
    })
  }

  const genderLabel = gender === 'plug' ? 'plug (male)' : 'socket (female)'

  return {
    module: 'N Pin Connector',
    logicModule: 'NPinConnector',
    gridX: cols,
    gridY: rows,
    background: '#374151',
    css: 'border-radius: 4px; border: 1px solid #6B7280;',
    category: 'connectors',
    description: `${pins}-pin ${genderLabel} connector`,
    grid,
    properties: {
      pins: { type: 'number', default: pins, min: 2, max: MAX_PINS, description: 'Number of pins' },
      gender: {
        type: 'select',
        default: gender,
        options: ['plug', 'socket'],
        description: 'Plug (male) or socket (female)',
      },
    },
  }
}

export function isNPinConnectorModule(
  definition: Pick<ModuleDefinition, 'module' | 'logicModule'> | null | undefined
): boolean {
  if (!definition) return false
  const logic = definition.logicModule ?? definition.module
  return logic === 'NPinConnector' || logic === 'N Pin Connector'
}

export function connectorIsConfigured(
  definition: ModuleDefinition | null | undefined
): boolean {
  const props = (definition as ModuleDefinition & { properties?: Record<string, unknown> })?.properties
  if (!props) return false
  const pins = props.pins
  if (typeof pins === 'number' && pins >= 2) return true
  if (pins && typeof pins === 'object' && 'default' in pins) {
    return typeof (pins as { default: unknown }).default === 'number'
  }
  return false
}

export function readConnectorPins(definition: ModuleDefinition | null | undefined): number {
  const props = (definition as ModuleDefinition & { properties?: Record<string, unknown> })?.properties
  const pins = props?.pins
  if (typeof pins === 'number') return pins
  if (pins && typeof pins === 'object' && 'default' in pins) {
    const d = (pins as { default: unknown }).default
    if (typeof d === 'number') return d
  }
  return 2
}

export function readConnectorGender(definition: ModuleDefinition | null | undefined): ConnectorGender {
  const props = (definition as ModuleDefinition & { properties?: Record<string, unknown> })?.properties
  const gender = props?.gender
  if (gender === 'plug' || gender === 'socket') return gender
  if (gender && typeof gender === 'object' && 'default' in gender) {
    const d = (gender as { default: unknown }).default
    if (d === 'plug' || d === 'socket') return d
  }
  return 'plug'
}
