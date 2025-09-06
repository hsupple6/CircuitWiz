import { ModuleDefinition } from './types'

// Import all module definitions
import ESP32 from './definitions/ESP32.json'
import ArduinoUno from './definitions/ArduinoUno.json'
import Battery from './definitions/Battery.json'
import LED from './definitions/LED.json'
import TemperatureSensor from './definitions/TemperatureSensor.json'
import Switch from './definitions/Switch.json'
import PowerSupply from './definitions/PowerSupply.json'

// Module registry - automatically loads all JSON definitions
export const moduleRegistry: Record<string, ModuleDefinition> = {
  'ESP32': ESP32 as ModuleDefinition,
  'Arduino Uno': ArduinoUno as ModuleDefinition,
  'Battery': Battery as ModuleDefinition,
  'LED': LED as ModuleDefinition,
  'Temperature Sensor': TemperatureSensor as ModuleDefinition,
  'Switch': Switch as ModuleDefinition,
  'PowerSupply': PowerSupply as ModuleDefinition
}

// Helper function to get module by name
export const getModule = (name: string): ModuleDefinition | undefined => {
  return moduleRegistry[name]
}

// Helper function to get all modules
export const getAllModules = (): ModuleDefinition[] => {
  return Object.values(moduleRegistry)
}

// Helper function to get modules by category
export const getModulesByCategory = (category: string): ModuleDefinition[] => {
  return Object.values(moduleRegistry).filter(module => module.category === category)
}

// Helper function to get all categories
export const getCategories = (): string[] => {
  const categories = new Set(Object.values(moduleRegistry).map(module => module.category))
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
