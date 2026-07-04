import type { ModuleDefinition } from '../types'
import type { ModuleRegistryEntry } from '../core/registryTypes'

import StepperDriver from './definitions/StepperDriver.json'
import BrushedDriver from './definitions/BrushedDriver.json'
import EscDriver from './definitions/EscDriver.json'
import LEDDriver from './definitions/LEDDriver.json'
import DisplayDriver from './definitions/DisplayDriver.json'
import RelayDriver from './definitions/RelayDriver.json'
import AudioDriver from './definitions/AudioDriver.json'
import PowerDriver from './definitions/PowerDriver.json'
import SerialDriver from './definitions/SerialDriver.json'

export const driverAnchors: Record<string, ModuleRegistryEntry> = {
  StepperDriver: {
    definition: StepperDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['stepper driver', 'a4988', 'drv8825', 'tmc2208', 'step dir'],
  },
  BrushedDriver: {
    definition: BrushedDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['brushed driver', 'h-bridge', 'l298', 'drv8833', 'dc motor driver'],
  },
  EscDriver: {
    definition: EscDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['esc', 'bldc', 'electronic speed controller', '3 phase', 'drone esc'],
  },
  LEDDriver: {
    definition: LEDDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['led driver', 'pwm dimmer', 'constant current', 'tlc5940'],
  },
  DisplayDriver: {
    definition: DisplayDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['display driver', 'oled', 'ssd1306', 'ili9341', 'lcd', 'i2c', 'spi'],
  },
  RelayDriver: {
    definition: RelayDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['relay driver', 'solenoid driver', 'uln2003', 'tip120', 'coil'],
  },
  AudioDriver: {
    definition: AudioDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['audio amplifier', 'class-d', 'lm386', 'pam8403', 'speaker amp'],
  },
  PowerDriver: {
    definition: PowerDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['ldo', 'buck', 'regulator', 'ams1117', 'lm2596', 'power module'],
  },
  SerialDriver: {
    definition: SerialDriver as ModuleDefinition,
    category: 'drivers',
    keywords: ['usb serial', 'uart', 'cp2102', 'ch340', 'ft232', 'level shifter'],
  },
}
