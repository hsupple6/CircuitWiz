import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'
import { SensorType } from '../types/Sensor'

import TemperatureSensor from './definitions/TemperatureSensor.json'

export const sensorAnchors: Record<string, ModuleRegistryEntry> = {
  'Temperature Sensor': {
    definition: TemperatureSensor as ModuleDefinition,
    type: SensorType,
    category: 'sensors',
    keywords: ['temperature', 'thermistor', 'ds18b20'],
  },
}

export const sensorAliases: never[] = []
