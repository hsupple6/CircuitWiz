import { getModuleType } from '../modules/registry'

export interface ConnectionValidationResult {
  isValid: boolean
  error?: string
  warning?: string
}

export interface PinInfo {
  type: string
  componentId: string
  componentModule: string
  position: { x: number; y: number }
}

/**
 * Validate a connection between two pins based on their type definitions
 */
export const validateConnection = (
  fromPin: PinInfo,
  toPin: PinInfo
): ConnectionValidationResult => {
  const fromType = getModuleType(fromPin.componentModule)
  const toType = getModuleType(toPin.componentModule)

  // If no type definitions exist, allow the connection
  if (!fromType || !toType) {
    return { isValid: true }
  }

  // Check connection rules for both components
  const fromRules = fromType.connectionRules || []
  const toRules = toType.connectionRules || []

  // Find matching rules
  const fromRule = fromRules.find(rule => 
    rule.fromType === fromPin.type && rule.toType === toPin.type
  )
  
  const toRule = toRules.find(rule => 
    rule.fromType === fromPin.type && rule.toType === toPin.type
  )

  // If both components have rules for this connection type
  if (fromRule && toRule) {
    // Both must allow the connection
    if (fromRule.allowed && toRule.allowed) {
      return { isValid: true }
    } else {
      return {
        isValid: false,
        error: `Connection not allowed: ${fromPin.type} → ${toPin.type}. ${fromRule.description || toRule.description || 'Invalid connection type'}`
      }
    }
  }

  // If only one component has rules
  if (fromRule) {
    if (fromRule.allowed) {
      return { isValid: true }
    } else {
      return {
        isValid: false,
        error: `Connection not allowed: ${fromRule.description || 'Invalid connection type'}`
      }
    }
  }

  if (toRule) {
    if (toRule.allowed) {
      return { isValid: true }
    } else {
      return {
        isValid: false,
        error: `Connection not allowed: ${toRule.description || 'Invalid connection type'}`
      }
    }
  }

  // No specific rules found - check for general compatibility
  return validateGeneralCompatibility(fromPin, toPin)
}

/**
 * Validate general electrical compatibility between pin types
 */
const validateGeneralCompatibility = (
  fromPin: PinInfo,
  toPin: PinInfo
): ConnectionValidationResult => {
  const { type: fromType, type: toType } = { type: fromPin.type, type: toPin.type }

  // Power connections
  if (fromType === 'VCC' && toType === 'VCC') {
    return { isValid: true }
  }
  
  if (fromType === 'GND' && toType === 'GND') {
    return { isValid: true }
  }

  // GPIO connections
  if ((fromType === 'GPIO' || fromType === 'ANALOG') && 
      (toType === 'GPIO' || toType === 'ANALOG')) {
    return { isValid: true }
  }

  // Communication protocols
  if (fromType === 'SDA' && toType === 'SDA') {
    return { isValid: true }
  }
  
  if (fromType === 'SCL' && toType === 'SCL') {
    return { isValid: true }
  }

  // PWM connections
  if (fromType === 'PWM' && toType === 'PWM') {
    return { isValid: true }
  }

  // Signal connections
  if (fromType === 'SIGNAL' && toType === 'GPIO') {
    return { isValid: true }
  }

  // Potentially problematic connections
  if (fromType === 'VCC' && toType === 'GPIO') {
    return {
      isValid: false,
      error: 'Power pins should not connect directly to GPIO pins. Use a resistor or other component for protection.'
    }
  }

  if (fromType === 'GPIO' && toType === 'VCC') {
    return {
      isValid: false,
      error: 'GPIO pins should not connect directly to power pins. Use a resistor or other component for protection.'
    }
  }

  // Unknown connection types - allow but warn
  return {
    isValid: true,
    warning: `Unknown connection type: ${fromType} → ${toType}. Verify this connection is correct.`
  }
}

/**
 * Get all valid connection types for a given pin type
 */
export const getValidConnectionTypes = (pinType: string): string[] => {
  const validTypes: string[] = []

  // Get all module types to check their connection rules
  const allModules = Object.values(require('../modules/registry').moduleRegistry)
  
  allModules.forEach(module => {
    if (module.type?.connectionRules) {
      module.type.connectionRules.forEach(rule => {
        if (rule.fromType === pinType && rule.allowed) {
          if (!validTypes.includes(rule.toType)) {
            validTypes.push(rule.toType)
          }
        }
      })
    }
  })

  // Add general compatibility types
  switch (pinType) {
    case 'VCC':
      validTypes.push('VCC')
      break
    case 'GND':
      validTypes.push('GND')
      break
    case 'GPIO':
    case 'ANALOG':
      validTypes.push('GPIO', 'ANALOG', 'SIGNAL')
      break
    case 'PWM':
      validTypes.push('PWM', 'GPIO')
      break
    case 'SDA':
      validTypes.push('SDA')
      break
    case 'SCL':
      validTypes.push('SCL')
      break
  }

  return [...new Set(validTypes)] // Remove duplicates
}

/**
 * Check if a connection would create a short circuit
 */
export const checkForShortCircuit = (
  connections: Array<{ from: PinInfo; to: PinInfo }>
): ConnectionValidationResult => {
  // Check for VCC to GND connections
  const vccToGnd = connections.find(conn => 
    conn.from.type === 'VCC' && conn.to.type === 'GND'
  )

  if (vccToGnd) {
    return {
      isValid: false,
      error: 'Short circuit detected: VCC connected directly to GND'
    }
  }

  // Check for multiple VCC sources connected together
  const vccConnections = connections.filter(conn => 
    conn.from.type === 'VCC' || conn.to.type === 'VCC'
  )

  if (vccConnections.length > 1) {
    return {
      isValid: true,
      warning: 'Multiple power sources detected. Ensure they have compatible voltages.'
    }
  }

  return { isValid: true }
}

export default {
  validateConnection,
  getValidConnectionTypes,
  checkForShortCircuit
}
