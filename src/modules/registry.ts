import { ModuleDefinition, ModuleType } from './types'

import { MicrocontrollerType } from './types/Microcontroller'
import { OutputType, MotorType } from './types/Output'
import { PowerType } from './types/Power'
import { SensorType } from './types/Sensor'

import ESP32 from './definitions/ESP32.json'
import ArduinoUno from './definitions/ArduinoUno.json'
import Battery from './definitions/Battery.json'
import LED from './definitions/LED.json'
import TemperatureSensor from './definitions/TemperatureSensor.json'
import Switch from './definitions/Switch.json'
import PushButton from './definitions/PushButton.json'
import LimitSwitch from './definitions/LimitSwitch.json'
import PowerSupply from './definitions/PowerSupply.json'
import Resistor from './definitions/Resistor.json'
import Capacitor from './definitions/Capacitor.json'
import Inductor from './definitions/Inductor.json'
import Motor from './definitions/Motor.json'
import Buzzer from './definitions/Buzzer.json'
import Speaker from './definitions/Speaker.json'
import Servo from './definitions/Servo.json'
import Potentiometer from './definitions/Potentiometer.json'

import { getOrderedCategoryIds } from './componentCatalog'
import type { OutputSubcategoryId } from './componentCatalog'

export interface ModuleRegistryEntry {
  definition: ModuleDefinition
  type?: ModuleType
  category: string
  subcategory?: OutputSubcategoryId
  keywords?: string[]
}

export const moduleRegistry: Record<string, ModuleRegistryEntry> = {
  'Arduino Uno R3': {
    definition: ArduinoUno as ModuleDefinition,
    type: MicrocontrollerType,
    category: 'microcontrollers',
    keywords: ['arduino', 'avr', 'uno', 'mcu', 'gpio', 'pwm'],
  },
  ESP32: {
    definition: ESP32 as ModuleDefinition,
    type: MicrocontrollerType,
    category: 'microcontrollers',
    keywords: ['esp32', 'wifi', 'bluetooth', 'mcu', 'gpio'],
  },
  Battery: {
    definition: Battery as ModuleDefinition,
    type: PowerType,
    category: 'power',
    keywords: ['battery', 'aa', '9v', 'lipo', 'cell'],
  },
  PowerSupply: {
    definition: PowerSupply as ModuleDefinition,
    type: PowerType,
    category: 'power',
    keywords: ['power supply', 'bench', '5v', 'barrel'],
  },
  Resistor: {
    definition: Resistor as ModuleDefinition,
    category: 'passives',
    keywords: ['resistor', 'ohm', 'pull-up'],
  },
  Capacitor: {
    definition: Capacitor as ModuleDefinition,
    category: 'passives',
    keywords: ['capacitor', 'ceramic', 'electrolytic', 'decouple', 'uf'],
  },
  Inductor: {
    definition: Inductor as ModuleDefinition,
    category: 'passives',
    keywords: ['inductor', 'coil', 'choke', 'ferrite'],
  },
  Switch: {
    definition: Switch as ModuleDefinition,
    category: 'switches',
    keywords: ['switch', 'toggle', 'spst'],
  },
  'Push Button': {
    definition: PushButton as ModuleDefinition,
    category: 'switches',
    keywords: ['button', 'push', 'momentary', 'tact'],
  },
  'Limit Switch': {
    definition: LimitSwitch as ModuleDefinition,
    category: 'switches',
    keywords: ['limit', 'endstop', 'normally open', 'no'],
  },
  LED: {
    definition: LED as ModuleDefinition,
    type: OutputType,
    category: 'output',
    subcategory: 'light',
    keywords: ['led', 'light', 'indicator'],
  },
  Motor: {
    definition: Motor as ModuleDefinition,
    type: MotorType,
    category: 'output',
    subcategory: 'electromechanical',
    keywords: ['motor', 'dc', 'bldc', 'rc car'],
  },
  Buzzer: {
    definition: Buzzer as ModuleDefinition,
    category: 'output',
    subcategory: 'electromechanical',
    keywords: ['buzzer', 'beep', 'alarm', 'piezo'],
  },
  Speaker: {
    definition: Speaker as ModuleDefinition,
    category: 'output',
    subcategory: 'electromechanical',
    keywords: ['speaker', 'audio', '8 ohm', 'sound'],
  },
  Servo: {
    definition: Servo as ModuleDefinition,
    category: 'output',
    subcategory: 'electromechanical',
    keywords: ['servo', 'rc', 'pwm', 'hobby'],
  },
  Potentiometer: {
    definition: Potentiometer as ModuleDefinition,
    category: 'output',
    subcategory: 'rotary',
    keywords: ['potentiometer', 'pot', 'knob', 'analog', 'divider'],
  },
  'Temperature Sensor': {
    definition: TemperatureSensor as ModuleDefinition,
    type: SensorType,
    category: 'sensors',
    keywords: ['temperature', 'thermistor', 'ds18b20'],
  },
}

export const getModule = (name: string): ModuleDefinition | undefined => {
  return moduleRegistry[name]?.definition
}

export const getModuleWithType = (name: string): ModuleRegistryEntry | undefined => {
  return moduleRegistry[name]
}

export const getModuleType = (name: string): ModuleType | undefined => {
  return moduleRegistry[name]?.type
}

export const getAllModules = (): ModuleDefinition[] => {
  return Object.values(moduleRegistry).map((entry) => entry.definition)
}

export const getAllModulesWithTypes = (): ModuleRegistryEntry[] => {
  return Object.values(moduleRegistry)
}

export const getModulesByCategory = (category: string): ModuleDefinition[] => {
  return Object.values(moduleRegistry)
    .filter((entry) => entry.category === category)
    .map((entry) => entry.definition)
}

export const getModulesWithTypesByCategory = (category: string): ModuleRegistryEntry[] => {
  return Object.values(moduleRegistry).filter((entry) => entry.category === category)
}

export const getCategories = (): string[] => {
  const used = new Set(Object.values(moduleRegistry).map((entry) => entry.category))
  return getOrderedCategoryIds().filter((id) => used.has(id))
}

export const OUTPUT_MODULE_NAMES = new Set([
  'LED',
  'Motor',
  'Buzzer',
  'Speaker',
  'Servo',
  'Potentiometer',
])

export const validateModule = (module: ModuleDefinition): boolean => {
  if (!module.module || !module.gridX || !module.gridY || !module.grid) {
    return false
  }

  const expectedCells = module.gridX * module.gridY
  if (module.grid.length !== expectedCells) {
    return false
  }

  return module.grid.every(
    (cell) =>
      typeof cell.x === 'number' &&
      typeof cell.y === 'number' &&
      typeof cell.isConnectable === 'boolean' &&
      typeof cell.type === 'string'
  )
}
