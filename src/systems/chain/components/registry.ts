import type {
  ComponentChainUnit,
  GraphTerminal,
  GridCellLike,
  InternalEdge,
  PlacedComponent,
  TerminalInfo,
} from '../types'
import { classifyTerminalPolarity, isConnectable, isGroundReference, isPositiveTerminal } from '../terminals'
import { parseNumericProperty, posKey } from '../utils'
import { resolveLogicModule } from '../../../modules/logicModule'
import { isDriverModule } from '../../../modules/drivers/logic'
import { isConnectorModule } from '../../../modules/connectors/logic'
import { isWirelessModule } from '../../../modules/wireless/logic'

function pairBidirectional(keys: string[]): InternalEdge[] {
  const edges: InternalEdge[] = []
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      edges.push({ from: keys[i], to: keys[j], bidirectional: true })
    }
  }
  return edges
}

function directedEdge(from: string, to: string): InternalEdge {
  return { from, to, bidirectional: false }
}

const MCU_POWER_INPUT_PINS = new Set(['VIN', '5V', '3V3'])

/** External power may be applied to VIN, 5V, or 3V3 (not IOREF / EN / RESET). */
export function isMcuPowerInput(moduleCell: any): boolean {
  if (!moduleCell?.isPowerable) return false
  return MCU_POWER_INPUT_PINS.has(moduleCell.pin)
}

export function isMicrocontrollerModule(moduleDefinition: { category?: string; module?: string }): boolean {
  if (moduleDefinition.category === 'microcontrollers') return true
  const moduleType = moduleDefinition.module ?? ''
  return moduleType.includes('Arduino') || moduleType.includes('ESP32')
}

function mcuInternalEdges(terminals: GraphTerminal[]): InternalEdge[] {
  const powerKeys = terminals.filter((t) => isMcuPowerInput(t.moduleCell)).map((t) => t.key)
  const gndKeys = terminals.filter((t) => isGroundReference(t.moduleCell)).map((t) => t.key)
  if (powerKeys.length === 0 || gndKeys.length === 0) return []

  const edges: InternalEdge[] = [...pairBidirectional(powerKeys)]
  for (const p of powerKeys) {
    for (const g of gndKeys) {
      edges.push({ from: p, to: g, bidirectional: true })
    }
  }
  return edges
}

/** High-Z signal pins that need a bleed resistor so the MNA matrix stays solvable. */
export function isMcuFloatingPin(moduleCell: any): boolean {
  if (!moduleCell) return false
  const type = moduleCell.type
  return (
    type === 'GPIO' ||
    type === 'ANALOG' ||
    type === 'RESET' ||
    type === 'EN' ||
    moduleCell.pin === 'IOREF'
  )
}

function isSwitchClosed(gridData: GridCellLike[][], componentId: string): boolean {
  for (const row of gridData) {
    if (!row) continue
    for (const cell of row) {
      if (cell?.componentId === componentId && cell.isOn) return true
    }
  }
  return false
}

function collectTerminals(gridData: GridCellLike[][], componentId: string): GraphTerminal[] {
  const terminals: GraphTerminal[] = []
  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (cell?.componentId !== componentId || !cell.moduleDefinition) return
      const moduleCell = cell.moduleDefinition.grid[cell.cellIndex ?? 0]
      if (!isConnectable(moduleCell)) return
      const moduleType = resolveLogicModule(cell.moduleDefinition)
      terminals.push({
        key: posKey(x, y),
        x,
        y,
        componentId,
        cellIndex: cell.cellIndex ?? 0,
        moduleType,
        moduleCell,
        polarity: classifyTerminalPolarity(moduleCell, moduleType),
      })
    })
  })
  return terminals
}

/** Internal conductive paths for continuity traversal. */
export function getComponentConductivity(
  moduleType: string,
  terminals: GraphTerminal[],
  gridData: GridCellLike[][],
  category?: string
): InternalEdge[] {
  if (category === 'microcontrollers' || isMicrocontrollerModule({ category, module: moduleType })) {
    return mcuInternalEdges(terminals)
  }
  const byType = (type: string) => terminals.filter((t) => t.moduleCell.type === type).map((t) => t.key)
  const byPolarity = (p: 'positive' | 'negative' | 'bidirectional') =>
    terminals.filter((t) => t.polarity === p).map((t) => t.key)
  const componentId = terminals[0]?.componentId ?? ''

  switch (moduleType) {
    case 'Resistor':
    case 'Capacitor':
    case 'Inductor':
    case 'Potentiometer':
      return pairBidirectional(byType('LEAD'))

    case 'LED': {
      const pos = byPolarity('positive')
      const neg = byPolarity('negative')
      if (pos.length && neg.length) return [directedEdge(pos[0], neg[0])]
      return []
    }

    case 'RGBLED': {
      const pos = byPolarity('positive')
      const neg = byPolarity('negative')
      if (!neg.length) return []
      const edges: InternalEdge[] = []
      for (const p of pos) edges.push(directedEdge(p, neg[0]))
      return edges
    }

    case 'ZenerDiode': {
      const anode = byType('ANODE')
      const cathode = byType('CATHODE')
      if (anode.length && cathode.length) return pairBidirectional([...anode, ...cathode])
      return []
    }

    case 'Diode': {
      const anode = byType('ANODE')
      const cathode = byType('CATHODE')
      if (anode.length && cathode.length) return [directedEdge(anode[0], cathode[0])]
      return []
    }

    case 'NPNTransistor':
    case 'PNPTransistor': {
      const c = byType('COLLECTOR')
      const e = byType('EMITTER')
      if (c.length && e.length) return pairBidirectional([c[0], e[0]])
      return []
    }

    case 'MOSFET':
    case 'PMOSFET': {
      const d = byType('DRAIN')
      const s = byType('SOURCE')
      if (d.length && s.length) return pairBidirectional([d[0], s[0]])
      return []
    }

    case 'BridgeRectifier':
      return []

    case 'ACSource':
      return pairBidirectional(byType('AC'))

    case 'Switch':
    case 'Push Button':
    case 'Limit Switch':
      if (!isSwitchClosed(gridData, componentId)) return []
      return pairBidirectional([...byType('INPUT'), ...byType('OUTPUT')])

    case 'Buzzer':
    case 'Speaker':
    case 'Motor':
    case 'StepperMotor':
    case 'Servo':
      return pairBidirectional(terminals.map((t) => t.key))

    case 'OpAmp':
      return []

    case 'LogicGateIC': {
      const vcc = terminals.find(
        (t) => t.moduleCell.pin === 'VCC' || t.moduleCell.type === 'DRIVER_PWR'
      )
      const gnd = terminals.find(
        (t) => t.moduleCell.pin === 'GND' || t.moduleCell.type === 'GND'
      )
      if (vcc && gnd) return [directedEdge(vcc.key, gnd.key)]
      return []
    }

    case 'LinearRegulator':
    case 'PowerDriver':
    case 'FixedRegulator': {
      const vin = terminals.find(
        (t) => t.moduleCell.pin === 'VIN' || t.moduleCell.type === 'DRIVER_PWR'
      )
      const vout = terminals.find(
        (t) => t.moduleCell.pin === 'VOUT' || t.moduleCell.type === 'DRIVER_OUT'
      )
      if (vin && vout) return [directedEdge(vin.key, vout.key)]
      return []
    }

    default:
      if (isConnectorModule(moduleType) || moduleType === 'NPinConnector') return []
      if (isDriverModule(moduleType)) return []
      if (isWirelessModule(moduleType)) return []
      return []
  }
}

const BIDIRECTIONAL_MODULES = new Set([
  'Resistor',
  'Capacitor',
  'Inductor',
  'Potentiometer',
  'ACSource',
  'Switch',
  'Push Button',
  'Limit Switch',
  'Buzzer',
  'Speaker',
  'Motor',
  'StepperMotor',
  'Servo',
])

/** Chain unit metadata for a placed component. */
export function getComponentChainUnit(
  moduleType: string,
  componentId: string,
  gridData: GridCellLike[][]
): ComponentChainUnit | null {
  const terminals = collectTerminals(gridData, componentId)
  if (terminals.length === 0) return null

  const pinKeys = terminals.map((t) => t.key)
  const bidirectional = BIDIRECTIONAL_MODULES.has(moduleType) || moduleType === 'ZenerDiode'

  if (moduleType === 'LED' || moduleType === 'Diode') {
    const pos = terminals.find((t) => t.polarity === 'positive')
    const neg = terminals.find((t) => t.polarity === 'negative')
    if (pos && neg) {
      return { componentId, moduleType, pinKeys: [pos.key, neg.key], bidirectional: false }
    }
  }

  if (moduleType === 'RGBLED') {
    const pos = terminals.filter((t) => t.polarity === 'positive')
    const neg = terminals.find((t) => t.polarity === 'negative')
    if (neg) {
      return {
        componentId,
        moduleType,
        pinKeys: [...pos.map((t) => t.key), neg.key],
        bidirectional: false,
      }
    }
  }

  return { componentId, moduleType, pinKeys, bidirectional }
}

export function getPlacedComponents(gridData: GridCellLike[][]): PlacedComponent[] {
  const byId = new Map<string, PlacedComponent>()

  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (!cell?.occupied || !cell.componentId || !cell.moduleDefinition) return

      const existing = byId.get(cell.componentId)
      if (!existing) {
        byId.set(cell.componentId, {
          componentId: cell.componentId,
          baseX: x,
          baseY: y,
          moduleDefinition: cell.moduleDefinition,
          resistance: cell.resistance,
        })
      } else {
        if ((cell.cellIndex ?? 0) === 0) {
          existing.baseX = x
          existing.baseY = y
        }
        if (cell.resistance !== undefined) existing.resistance = cell.resistance
        if (cell.capacitance !== undefined) existing.capacitance = cell.capacitance
      }
    })
  })

  return Array.from(byId.values())
}

export function getTerminals(component: PlacedComponent): TerminalInfo[] {
  const terminals: TerminalInfo[] = []
  component.moduleDefinition.grid.forEach((moduleCell: any, cellIndex: number) => {
    if (!isConnectable(moduleCell)) return
    terminals.push({
      x: component.baseX + moduleCell.x,
      y: component.baseY + moduleCell.y,
      cellIndex,
      moduleCell,
    })
  })
  return terminals
}

export function findAnodeCathode(terminals: TerminalInfo[]): {
  anode?: TerminalInfo
  cathode?: TerminalInfo
} {
  const anode = terminals.find(
    (t) =>
      t.moduleCell.type === 'ANODE' ||
      t.moduleCell.type === 'LED_POSITIVE' ||
      t.moduleCell.pin === 'A' ||
      t.moduleCell.pin === '+'
  )
  const cathode = terminals.find(
    (t) =>
      t.moduleCell.type === 'CATHODE' ||
      t.moduleCell.type === 'LED_NEGATIVE' ||
      t.moduleCell.pin === 'K' ||
      t.moduleCell.pin === '-'
  )
  return { anode, cathode }
}

export function isSwitchClosedOnGrid(gridData: GridCellLike[][], componentId: string): boolean {
  return isSwitchClosed(gridData, componentId)
}

export function gridCellAt(gridData: GridCellLike[][], x: number, y: number): GridCellLike | undefined {
  return gridData[y]?.[x]
}

export function getWiperRatio(
  gridData: GridCellLike[][],
  wiperX: number,
  wiperY: number,
  fallback = 0.5
): number {
  const cell = gridCellAt(gridData, wiperX, wiperY)
  const w = cell?.wiperPosition
  if (typeof w === 'number') return Math.max(0.05, Math.min(0.95, w))
  return fallback
}

export function gpioPinNumber(moduleCell: any): number | null {
  const gpioProp = moduleCell?.properties?.gpio
  if (gpioProp !== undefined && gpioProp !== null) {
    const raw = String(gpioProp)
    const fromProp = raw.startsWith('GPIO')
      ? parseInt(raw.replace('GPIO', ''), 10)
      : parseInt(raw, 10)
    if (Number.isFinite(fromProp)) return fromProp
  }

  const pin = moduleCell?.pin
  if (!pin || typeof pin !== 'string') return null
  if (pin.startsWith('GPIO')) return parseInt(pin.replace('GPIO', ''), 10)
  if (pin.startsWith('D')) return parseInt(pin.replace('D', ''), 10)
  if (pin.startsWith('A')) return parseInt(pin.replace('A', ''), 10) + 100
  const parsed = parseInt(pin, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function gpioOutputVoltage(
  moduleType: string,
  gpioState: any
): { voltage: number; pwm?: number; active: boolean } {
  const state = gpioState?.state ?? 'LOW'
  const fullVoltage = moduleType.includes('ESP32') ? 3.3 : 5.0

  if (state === 'HIGH') return { voltage: fullVoltage, active: true }
  if (state === 'PULSING') {
    const duty = typeof gpioState?.value === 'number' ? gpioState.value : 0.5
    return { voltage: fullVoltage * duty, pwm: duty * 100, active: duty > 0 }
  }
  return { voltage: 0, active: false }
}

export { isPositiveTerminal, isGroundReference, parseNumericProperty }
