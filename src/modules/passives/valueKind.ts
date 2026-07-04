import type { ModuleDefinition } from '../types'
import { resolveLogicModule } from '../core/logicModule'

export type PassiveValueKind = 'resistor' | 'capacitor' | 'inductor' | 'ac'

export function getPassiveValueKind(
  definition: Pick<ModuleDefinition, 'module' | 'logicModule'> | null | undefined
): PassiveValueKind | null {
  if (!definition) return null
  switch (resolveLogicModule(definition)) {
    case 'Resistor':
      return 'resistor'
    case 'Capacitor':
      return 'capacitor'
    case 'Inductor':
      return 'inductor'
    case 'ACSource':
      return 'ac'
    default:
      return null
  }
}

export function passiveValuePropertyKey(kind: PassiveValueKind): 'resistance' | 'capacitance' | 'inductance' {
  switch (kind) {
    case 'resistor':
      return 'resistance'
    case 'capacitor':
      return 'capacitance'
    case 'inductor':
      return 'inductance'
    default:
      return 'resistance'
  }
}

export function passiveValueDefault(kind: PassiveValueKind): number {
  switch (kind) {
    case 'resistor':
      return 1000
    case 'capacitor':
      return 0.0001
    case 'inductor':
      return 0.001
    default:
      return 0
  }
}

export function passiveValueSelectorTitle(
  kind: PassiveValueKind,
  displayName?: string
): string {
  const name = displayName ?? kind
  switch (kind) {
    case 'resistor':
      return `Select ${name} Value`
    case 'capacitor':
      return `Select ${name} Capacitance`
    case 'inductor':
      return `Select ${name} Inductance`
    case 'ac':
      return 'Configure AC Source'
  }
}
