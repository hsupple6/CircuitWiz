import { EXAMPLE_SCHEMATIC_IDS } from '../examplesPresetIds'
import { bldcMotorTheory } from './bldcMotor'
import { bridgeRectifierTheory } from './bridgeRectifier'
import { ledResistorTheory } from './ledResistor'
import { lm317PotTheory } from './lm317Pot'
import { mosfetBoostTheory } from './mosfetBoost'
import { npnSwitchLedTheory } from './npnSwitchLed'
import { npnSwitchTheory } from './npnSwitch'
import { opAmpInvertingTheory } from './opAmpInverting'
import { parallelResistorsTheory } from './parallelResistors'
import { rcCircuitTheory } from './rcCircuit'
import type { ExampleTheoryDoc } from './types'
import { voltageDividerTheory } from './voltageDivider'
import { zenerClampTheory } from './zenerClamp'

export type { ExampleTheoryDoc } from './types'

/** All built-in example theory guides keyed by schematic name. */
const THEORY_BY_NAME: Record<string, ExampleTheoryDoc> = {
  'Voltage Divider': voltageDividerTheory,
  'LED + Resistor': ledResistorTheory,
  'Parallel Resistors': parallelResistorsTheory,
  'RC Circuit': rcCircuitTheory,
  'NPN Transistor Switch': npnSwitchTheory,
  'NPN Switch + LED': npnSwitchLedTheory,
  'Op-Amp Inverting Amplifier': opAmpInvertingTheory,
  'Zener Voltage Clamp': zenerClampTheory,
  'Bridge Rectifier': bridgeRectifierTheory,
  'BLDC Motor + ESC': bldcMotorTheory,
  'MOSFET Boost Converter': mosfetBoostTheory,
  'LM317 + Potentiometer': lm317PotTheory,
}

const THEORY_BY_SCHEMATIC_ID: Record<string, ExampleTheoryDoc> = Object.fromEntries(
  Object.entries(EXAMPLE_SCHEMATIC_IDS).map(([name, id]) => {
    const doc = THEORY_BY_NAME[name]
    return doc ? [id, doc] : []
  }).filter((entry): entry is [string, ExampleTheoryDoc] => entry.length === 2)
)

export function getExampleTheoryDoc(
  schematicId?: string,
  schematicName?: string
): ExampleTheoryDoc | null {
  if (schematicId && THEORY_BY_SCHEMATIC_ID[schematicId]) {
    return THEORY_BY_SCHEMATIC_ID[schematicId]
  }
  if (schematicName && THEORY_BY_NAME[schematicName]) {
    return THEORY_BY_NAME[schematicName]
  }
  return null
}

export function hasExampleTheoryDoc(schematicId?: string, schematicName?: string): boolean {
  return getExampleTheoryDoc(schematicId, schematicName) !== null
}

export function listExampleTheoryDocNames(): string[] {
  return Object.keys(THEORY_BY_NAME)
}
