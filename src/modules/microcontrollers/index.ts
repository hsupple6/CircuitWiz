import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'
import { MicrocontrollerType } from '../types/Microcontroller'

import ESP32 from './definitions/ESP32.json'
import ArduinoUno from './definitions/ArduinoUno.json'

export const microcontrollerAnchors: Record<string, ModuleRegistryEntry> = {
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
    disabled: true,
  },
}

export const microcontrollerAliases: never[] = []
