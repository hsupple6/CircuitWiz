import { ModuleDefinition, ModuleType } from './types'

// Import type definitions
import { MicrocontrollerType } from './types/Microcontroller'
import { OutputType, MotorType } from './types/Output'
import { PowerType } from './types/Power'
import { SensorType } from './types/Sensor'
// import { ConnectorType } from './types/Connector' // Not used yet

// Import all module definitions
import ESP32 from './definitions/ESP32.json'
import ArduinoUno from './definitions/ArduinoUno.json'
import Battery from './definitions/Battery.json'
import LED from './definitions/LED.json'
import TemperatureSensor from './definitions/TemperatureSensor.json'
import Switch from './definitions/Switch.json'
import PowerSupply from './definitions/PowerSupply.json'
import Resistor from './definitions/Resistor.json'
import Motor from './definitions/Motor.json'

// Enhanced registry with both JSON and Type definitions
export interface ModuleRegistryEntry {
  definition: ModuleDefinition  // JSON definition (visual/placement)
  type?: ModuleType            // Type definition (parameters/validation)
  category: string
}

export const moduleRegistry: Record<string, ModuleRegistryEntry> = {
  'ESP32': {
    definition: ESP32 as ModuleDefinition,
    type: MicrocontrollerType,
    category: 'microcontrollers'
  },
  'Arduino Uno R3': {
    definition: ArduinoUno as ModuleDefinition,
    type: MicrocontrollerType,
    category: 'microcontrollers'
  },
  'Battery': {
    definition: Battery as ModuleDefinition,
    type: PowerType,
    category: 'power'
  },
  'LED': {
    definition: LED as ModuleDefinition,
    type: OutputType,
    category: 'output'
  },
  'Temperature Sensor': {
    definition: TemperatureSensor as ModuleDefinition,
    type: SensorType,
    category: 'sensors'
  },
  'Switch': {
    definition: Switch as ModuleDefinition,
    category: 'connectors'
  },
  'PowerSupply': {
    definition: PowerSupply as ModuleDefinition,
    type: PowerType,
    category: 'power'
  },
  'Resistor': {
    definition: Resistor as ModuleDefinition,
    category: 'passive'
  },
  'Motor': {
    definition: Motor as ModuleDefinition,
    type: MotorType,
    category: 'output'
  }
}

// Helper function to get module by name (backward compatibility)
export const getModule = (name: string): ModuleDefinition | undefined => {
  return moduleRegistry[name]?.definition
}

// Helper function to get module with both definition and type
export const getModuleWithType = (name: string): ModuleRegistryEntry | undefined => {
  return moduleRegistry[name]
}

// Helper function to get just the type definition
export const getModuleType = (name: string): ModuleType | undefined => {
  return moduleRegistry[name]?.type
}

// Helper function to get all modules (backward compatibility)
export const getAllModules = (): ModuleDefinition[] => {
  return Object.values(moduleRegistry).map(entry => entry.definition)
}

// Helper function to get all modules with types
export const getAllModulesWithTypes = (): ModuleRegistryEntry[] => {
  return Object.values(moduleRegistry)
}

// Helper function to get modules by category (backward compatibility)
export const getModulesByCategory = (category: string): ModuleDefinition[] => {
  return Object.values(moduleRegistry)
    .filter(entry => entry.category === category)
    .map(entry => entry.definition)
}

// Helper function to get modules with types by category
export const getModulesWithTypesByCategory = (category: string): ModuleRegistryEntry[] => {
  return Object.values(moduleRegistry).filter(entry => entry.category === category)
}

// Helper function to get all categories
export const getCategories = (): string[] => {
  const categories = new Set(Object.values(moduleRegistry).map(entry => entry.category))
  return Array.from(categories).sort()
}

// Helper function to validate module definition
export const validateModule = (module: ModuleDefinition): boolean => {
  if (!module.module || !module.gridX || !module.gridY || !module.grid) {
    return false
  }
  
  // Check if grid matches dimensions
  const expectedCells = module.gridX * module.gridY
  if (module.grid.length !== expectedCells) {
    return false
  }
  
  // Check if all cells have required properties
  return module.grid.every(cell => 
    typeof cell.x === 'number' && 
    typeof cell.y === 'number' && 
    typeof cell.isConnectable === 'boolean' && 
    typeof cell.type === 'string'
  )
}
