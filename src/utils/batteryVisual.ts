import type { ModuleDefinition } from '../modules/types'

export function formatBatteryVoltage(volts: number): string {
  if (volts >= 10 && Number.isInteger(volts)) return `${volts}V`
  return `${volts.toFixed(1).replace(/\.0$/, '')}V`
}

export function formatBatteryCapacity(mAh: number): string {
  if (mAh >= 1000) {
    const ah = mAh / 1000
    return Number.isInteger(ah) ? `${ah}Ah` : `${ah.toFixed(1)}Ah`
  }
  return `${mAh}mAh`
}

function isPositiveTerminal(type?: string): boolean {
  return type === 'VCC' || type === 'POSITIVE'
}

/** Apply nominal voltage + capacity to a battery module definition. */
export function applyBatteryProperties(
  module: ModuleDefinition,
  voltage: number,
  capacityMah: number
): ModuleDefinition {
  const props = (module as ModuleDefinition & { properties?: Record<string, unknown> }).properties
  const nextGrid = module.grid.map((moduleCell) => {
    if (!isPositiveTerminal(moduleCell.type)) return moduleCell
    return {
      ...moduleCell,
      voltage,
      isPowered: Math.abs(voltage) > 1e-6,
    }
  })

  return {
    ...module,
    grid: nextGrid,
    properties: {
      ...props,
      voltage,
      capacity: capacityMah,
    },
  } as ModuleDefinition
}

export function readBatteryCapacity(
  properties: Record<string, unknown> | undefined,
  fallback = 2000
): number {
  const val = properties?.capacity
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (val && typeof val === 'object' && 'default' in val && typeof (val as { default: unknown }).default === 'number') {
    return (val as { default: number }).default
  }
  return fallback
}
