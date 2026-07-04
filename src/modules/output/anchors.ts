import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'
import { OutputType, MotorType } from '../types/Output'

import LED from './definitions/LED.json'
import Motor from './definitions/Motor.json'
import Buzzer from './definitions/Buzzer.json'
import Speaker from './definitions/Speaker.json'
import Servo from './definitions/Servo.json'

export const outputAnchors: Record<string, ModuleRegistryEntry> = {
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
}
