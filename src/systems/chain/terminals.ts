import type { TerminalPolarity } from './types'

export function classifyTerminalPolarity(moduleCell: any, _moduleType?: string): TerminalPolarity {
  if (!moduleCell) return 'bidirectional'

  const pin = moduleCell.pin
  if (pin === '+' || pin === '5V' || pin === 'V+' || pin === 'AC1' || pin === 'A') return 'positive'
  if (pin === '-' || pin === 'GND' || pin === 'V-' || pin === 'AC2' || pin === 'K') return 'negative'

  const type = moduleCell.type
  if (
    type === 'POSITIVE' ||
    type === 'VCC' ||
    type === 'LED_POSITIVE' ||
    type === 'ANODE' ||
    type === 'IN_POSITIVE' ||
    type === 'OUTPUT'
  ) {
    return 'positive'
  }
  if (
    type === 'NEGATIVE' ||
    type === 'GND' ||
    type === 'LED_NEGATIVE' ||
    type === 'CATHODE' ||
    type === 'IN_NEGATIVE' ||
    type === 'INPUT'
  ) {
    return 'negative'
  }

  if (type === 'LEAD' || type === 'AC') return 'bidirectional'
  if (moduleCell.isPowerable && moduleCell.isGroundable) return 'bidirectional'

  return 'bidirectional'
}

export function isPositiveTerminal(moduleCell: any): boolean {
  return classifyTerminalPolarity(moduleCell) === 'positive'
}

/** Ground reference nodes only — not cathodes or generic negative pins. */
export function isGroundReference(moduleCell: any): boolean {
  if (!moduleCell) return false
  return (
    moduleCell.type === 'GND' ||
    moduleCell.type === 'NEGATIVE' ||
    moduleCell.type === 'LED_NEGATIVE' ||
    moduleCell.pin === '-' ||
    moduleCell.pin === 'GND' ||
    moduleCell.pin === 'V-' ||
    moduleCell.pin === 'AC2'
  )
}

export function isGroundTerminal(moduleCell: any): boolean {
  return isGroundReference(moduleCell)
}

export function isConnectable(moduleCell: any): boolean {
  return Boolean(moduleCell?.isConnectable)
}
