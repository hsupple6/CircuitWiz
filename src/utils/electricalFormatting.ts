/**
 * Utility functions for formatting electrical values with appropriate units
 */

/**
 * Format current values with appropriate units (A, mA, μA)
 */
export function formatCurrent(amperes: number): string {
  if (amperes >= 1) {
    return `${amperes.toFixed(3)}A`
  } else if (amperes >= 0.001) {
    return `${(amperes * 1000).toFixed(1)}mA`
  } else if (amperes >= 0.000001) {
    return `${(amperes * 1000000).toFixed(1)}μA`
  } else {
    return `${(amperes * 1000000000).toFixed(1)}nA`
  }
}

/**
 * Format power values with appropriate units (W, mW, μW)
 */
export function formatPower(watts: number): string {
  if (watts >= 1) {
    return `${watts.toFixed(3)}W`
  } else if (watts >= 0.001) {
    return `${(watts * 1000).toFixed(1)}mW`
  } else if (watts >= 0.000001) {
    return `${(watts * 1000000).toFixed(1)}μW`
  } else {
    return `${(watts * 1000000000).toFixed(1)}nW`
  }
}

/**
 * Format voltage values with appropriate units (V, mV, μV)
 */
export function formatVoltage(volts: number): string {
  if (volts >= 1) {
    return `${volts.toFixed(3)}V`
  } else if (volts >= 0.001) {
    return `${(volts * 1000).toFixed(1)}mV`
  } else if (volts >= 0.000001) {
    return `${(volts * 1000000).toFixed(1)}μV`
  } else {
    return `${(volts * 1000000000).toFixed(1)}nV`
  }
}

/**
 * Format resistance values with appropriate units (Ω, kΩ, MΩ)
 */
export function formatResistance(ohms: number): string {
  if (ohms >= 1000000) {
    return `${(ohms / 1000000).toFixed(2)}MΩ`
  } else if (ohms >= 1000) {
    return `${(ohms / 1000).toFixed(1)}kΩ`
  } else {
    return `${ohms.toFixed(1)}Ω`
  }
}

/**
 * Format electrical values with appropriate units for display
 */
export function formatElectricalValue(value: number, type: 'current' | 'power' | 'voltage' | 'resistance'): string {
  switch (type) {
    case 'current':
      return formatCurrent(value)
    case 'power':
      return formatPower(value)
    case 'voltage':
      return formatVoltage(value)
    case 'resistance':
      return formatResistance(value)
    default:
      return value.toFixed(3)
  }
}
