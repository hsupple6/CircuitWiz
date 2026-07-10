import type { ModuleDefinition } from '../modules/types'
import { formatCapacitance } from '../components/CapacitanceSelector'
import { formatInductance } from '../components/InductanceSelector'
import { resolveLogicModule } from '../modules/logicModule'
import {
  formatACFrequency,
  formatACVoltage,
  readACSourceSettings,
} from './acSourceVisual'
import { formatResistance, formatVoltage } from './electricalFormatting'
import { getResistorDisplayValue } from './resistorVisual'
import { readSupplyVoltageAndCurrent } from './powerSupplies'

export interface PlacedModuleValues {
  resistance?: number
  capacitance?: number
  inductance?: number
}

export interface SchematicModuleLabel {
  name: string
  specs: string[]
}

type PropertySchema = {
  default?: unknown
  unit?: string
  options?: string[]
}

function getNumericProperty(
  properties: Record<string, unknown> | undefined,
  key: string,
  fallback: number
): number {
  const val = properties?.[key]
  if (typeof val === 'number') return val
  if (val && typeof val === 'object' && 'default' in val && typeof (val as PropertySchema).default === 'number') {
    return (val as PropertySchema).default as number
  }
  return fallback
}

function getStringProperty(
  properties: Record<string, unknown> | undefined,
  key: string,
  fallback = ''
): string {
  const val = properties?.[key]
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'default' in val) {
    const d = (val as PropertySchema).default
    if (typeof d === 'string') return d
    if (d !== undefined && d !== null) return String(d)
  }
  return fallback
}

function pushUnique(lines: string[], value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || lines.includes(trimmed)) return
  lines.push(trimmed)
}

function formatSchemaProperty(prop: unknown): string | null {
  if (typeof prop === 'string' || typeof prop === 'number' || typeof prop === 'boolean') {
    return String(prop)
  }
  if (!prop || typeof prop !== 'object' || !('default' in prop)) return null
  const schema = prop as PropertySchema
  if (schema.default === undefined || schema.default === null) return null
  const value = String(schema.default)
  return schema.unit ? `${value}${schema.unit}` : value
}

function collectGenericPropertySpecs(properties: Record<string, unknown> | undefined): string[] {
  if (!properties) return []
  const lines: string[] = []
  const skipKeys = new Set(['behavior', 'color'])

  for (const [key, prop] of Object.entries(properties)) {
    if (skipKeys.has(key)) continue
    const formatted = formatSchemaProperty(prop)
    if (formatted) lines.push(formatted)
  }

  return lines
}

export function buildSchematicModuleLabel(
  definition: ModuleDefinition,
  placed: PlacedModuleValues = {}
): SchematicModuleLabel {
  const logic = resolveLogicModule(definition)
  const props = (definition as ModuleDefinition & { properties?: Record<string, unknown> }).properties
  const specs: string[] = []

  pushUnique(specs, definition.partNumber)
  pushUnique(specs, definition.manufacturer)

  switch (logic) {
    case 'Resistor': {
      const r = placed.resistance ?? getNumericProperty(props, 'resistance', 1000)
      pushUnique(specs, getResistorDisplayValue(r))
      pushUnique(specs, formatSchemaProperty(props?.tolerance))
      pushUnique(specs, formatSchemaProperty(props?.powerRating))
      break
    }
    case 'Capacitor': {
      const c = placed.capacitance ?? getNumericProperty(props, 'capacitance', 0.0001)
      pushUnique(specs, formatCapacitance(c))
      pushUnique(specs, formatSchemaProperty(props?.voltageRating))
      break
    }
    case 'Inductor': {
      const l = placed.inductance ?? getNumericProperty(props, 'inductance', 0.001)
      pushUnique(specs, formatInductance(l))
      pushUnique(specs, formatSchemaProperty(props?.currentRating))
      break
    }
    case 'LED': {
      pushUnique(specs, getStringProperty(props, 'color', 'Red'))
      pushUnique(specs, `Vf ${formatVoltage(getNumericProperty(props, 'forwardVoltage', 2))}`)
      break
    }
    case 'RGBLED': {
      pushUnique(
        specs,
        `Vf R${formatVoltage(getNumericProperty(props, 'forwardVoltageR', 2))}`
      )
      break
    }
    case 'Diode':
      pushUnique(specs, `Vf ${formatVoltage(getNumericProperty(props, 'forwardVoltage', 0.7))}`)
      break
    case 'ZenerDiode':
      pushUnique(specs, `Vz ${formatVoltage(getNumericProperty(props, 'zenerVoltage', 5.1))}`)
      break
    case 'NPNTransistor':
    case 'PNPTransistor':
      pushUnique(specs, `β ${getNumericProperty(props, 'beta', 100)}`)
      pushUnique(specs, `Vbe ${formatVoltage(getNumericProperty(props, 'vbe', 0.65))}`)
      break
    case 'MOSFET':
    case 'PMOSFET':
      pushUnique(specs, `Vth ${formatVoltage(getNumericProperty(props, 'vth', 2.5))}`)
      pushUnique(specs, `Rds ${formatResistance(getNumericProperty(props, 'rdsOn', 0.05))}`)
      break
    case 'OpAmp':
      pushUnique(specs, `±${formatVoltage(getNumericProperty(props, 'supplyVoltage', 5))}`)
      break
    case 'BridgeRectifier':
      pushUnique(specs, `Vf ${formatVoltage(getNumericProperty(props, 'forwardVoltage', 0.7))}`)
      break
    case 'ACSource': {
      const ac = readACSourceSettings(props)
      pushUnique(specs, formatACVoltage(ac.vrms))
      pushUnique(specs, formatACFrequency(ac.frequency))
      pushUnique(specs, ac.waveform)
      break
    }
    case 'Potentiometer':
      pushUnique(specs, formatResistance(getNumericProperty(props, 'resistance', 10000)))
      break
    case 'PowerSupply':
    case 'LiIonPack':
    case 'Battery': {
      const supply = readSupplyVoltageAndCurrent(definition)
      if (supply.voltage > 0) pushUnique(specs, formatVoltage(supply.voltage))
      if (supply.current > 0) pushUnique(specs, `${supply.current}A`)
      break
    }
    case 'LinearRegulator':
      pushUnique(specs, `Out ${formatVoltage(getNumericProperty(props, 'outputVoltage', 5))}`)
      pushUnique(specs, `Max ${getNumericProperty(props, 'maxCurrent', 1)}A`)
      break
    case 'NPinConnector': {
      const pins = getNumericProperty(props, 'pins', definition.grid.filter((c) => c.isConnectable).length || 2)
      pushUnique(specs, `${pins}-pin`)
      const gender = getStringProperty(props, 'gender')
      if (gender) pushUnique(specs, gender === 'plug' ? 'plug' : 'socket')
      break
    }
    default:
      for (const line of collectGenericPropertySpecs(props)) {
        pushUnique(specs, line)
      }
      break
  }

  return {
    name: definition.module,
    specs,
  }
}

export function formatSchematicModuleSpecLine(specs: string[]): string {
  return specs.join(' · ')
}
