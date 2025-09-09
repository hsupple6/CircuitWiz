import React, { useState, useEffect } from 'react'

interface ElectricalValidation {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  componentId: string
  componentType: string
  message: string
  timestamp: number
}

interface ElectricalValidatorProps {
  gridData: any[][]
  wires: any[]
  onValidationUpdate: (validations: ElectricalValidation[]) => void
}

export function ElectricalValidator({ gridData, wires, onValidationUpdate }: ElectricalValidatorProps) {
  const [validations, setValidations] = useState<ElectricalValidation[]>([])

  // Validate electrical circuits
  const validateCircuit = () => {
    const newValidations: ElectricalValidation[] = []
    
    // Find all components
    const components = new Map<string, any>()
    gridData.forEach((row, y) => {
      if (!row || !Array.isArray(row)) return
      row.forEach((cell, x) => {
        if (cell.occupied && cell.componentId) {
          if (!components.has(cell.componentId)) {
            components.set(cell.componentId, {
              id: cell.componentId,
              type: cell.componentType,
              definition: cell.moduleDefinition,
              position: { x, y },
              cells: []
            })
          }
          components.get(cell.componentId).cells.push({ x, y, ...cell })
        }
      })
    })

    // Validate each component
    components.forEach((component) => {
      validateComponent(component, newValidations)
    })

    // Validate wire networks
    validateWireNetworks(wires, newValidations)

    setValidations(newValidations)
    onValidationUpdate(newValidations)
  }

  const validateComponent = (component: any, validations: ElectricalValidation[]) => {
    const { id, type, definition, cells } = component

    switch (type) {
      case 'LED':
        validateLED(component, validations)
        break
      case 'Resistor':
        validateResistor(component, validations)
        break
      case 'Battery':
        validateBattery(component, validations)
        break
      case 'PowerSupply':
        validatePowerSupply(component, validations)
        break
    }
  }

  const validateLED = (component: any, validations: ElectricalValidation[]) => {
    const { id, cells } = component
    
    // Check if LED has proper current limiting
    const hasResistor = checkForCurrentLimitingResistor(component)
    const voltage = getComponentVoltage(component)
    const current = getComponentCurrent(component)
    
    if (!hasResistor && voltage > 0) {
      validations.push({
        id: `led-no-resistor-${id}`,
        type: 'error',
        componentId: id,
        componentType: 'LED',
        message: `⚠️ LED without current limiting resistor! Voltage: ${voltage}V. Add a resistor to prevent damage.`,
        timestamp: Date.now()
      })
    }
    
    if (current > 0.02) { // 20mA typical LED current
      validations.push({
        id: `led-high-current-${id}`,
        type: 'warning',
        componentId: id,
        componentType: 'LED',
        message: `⚠️ LED current too high: ${(current * 1000).toFixed(1)}mA. Recommended: <20mA`,
        timestamp: Date.now()
      })
    }
    
    if (voltage > 3.3) {
      validations.push({
        id: `led-high-voltage-${id}`,
        type: 'error',
        componentId: id,
        componentType: 'LED',
        message: `❌ LED voltage too high: ${voltage}V. Most LEDs need 1.8-3.3V`,
        timestamp: Date.now()
      })
    }
  }

  const validateResistor = (component: any, validations: ElectricalValidation[]) => {
    const { id, cells } = component
    const resistance = getComponentResistance(component)
    const voltage = getComponentVoltage(component)
    const current = getComponentCurrent(component)
    
    // Check for valid values before calculating power
    if (resistance <= 0 || !isFinite(resistance) || !isFinite(voltage) || !isFinite(current)) {
      return // Skip validation if we have invalid values
    }
    
    const power = voltage * current
    
    // Check for valid power value
    if (!isFinite(power) || power < 0) {
      return // Skip validation if power is invalid
    }
    
    if (power > 0.25) { // 0.25W typical resistor rating
      validations.push({
        id: `resistor-overpower-${id}`,
        type: 'warning',
        componentId: id,
        componentType: 'Resistor',
        message: `⚠️ Resistor power rating exceeded: ${power.toFixed(3)}W. Consider higher wattage resistor.`,
        timestamp: Date.now()
      })
    }
  }

  const validateBattery = (component: any, validations: ElectricalValidation[]) => {
    const { id, cells } = component
    const voltage = getComponentVoltage(component)
    const current = getComponentCurrent(component)
    
    if (current > 1.0) { // 1A typical battery limit
      validations.push({
        id: `battery-high-current-${id}`,
        type: 'warning',
        componentId: id,
        componentType: 'Battery',
        message: `⚠️ Battery current high: ${current.toFixed(2)}A. Check for short circuits.`,
        timestamp: Date.now()
      })
    }
  }

  const validatePowerSupply = (component: any, validations: ElectricalValidation[]) => {
    const { id, cells } = component
    const voltage = getComponentVoltage(component)
    const current = getComponentCurrent(component)
    
    if (current > 2.0) { // 2A typical power supply limit
      validations.push({
        id: `psu-high-current-${id}`,
        type: 'warning',
        componentId: id,
        componentType: 'PowerSupply',
        message: `⚠️ Power supply current high: ${current.toFixed(2)}A. Check circuit design.`,
        timestamp: Date.now()
      })
    }
  }

  const validateWireNetworks = (wires: any[], validations: ElectricalValidation[]) => {
    wires.forEach((wire) => {
      const { id, current, maxCurrent, voltage, maxPower } = wire
      
      if (current > maxCurrent) {
        validations.push({
          id: `wire-overcurrent-${id}`,
          type: 'error',
          componentId: id,
          componentType: 'Wire',
          message: `❌ Wire overcurrent: ${current.toFixed(2)}A > ${maxCurrent}A max. Wire may overheat!`,
          timestamp: Date.now()
        })
      }
      
      const power = voltage * current
      if (power > maxPower) {
        validations.push({
          id: `wire-overpower-${id}`,
          type: 'error',
          componentId: id,
          componentType: 'Wire',
          message: `❌ Wire overpower: ${power.toFixed(1)}W > ${maxPower}W max. Wire may overheat!`,
          timestamp: Date.now()
        })
      }
    })
  }

  // Helper functions
  const checkForCurrentLimitingResistor = (component: any): boolean => {
    // Check if there's a resistor in the same wire network
    const componentWires = getComponentWires(component)
    return componentWires.some(wire => 
      wire.segments.some((segment: any) => 
        gridData[segment.from.y]?.[segment.from.x]?.componentType === 'Resistor' ||
        gridData[segment.to.y]?.[segment.to.x]?.componentType === 'Resistor'
      )
    )
  }

  const getComponentVoltage = (component: any): number => {
    // Get voltage from connected power sources
    const componentWires = getComponentWires(component)
    return Math.max(...componentWires.map((wire: any) => wire.voltage || 0))
  }

  const getComponentCurrent = (component: any): number => {
    // Calculate current based on voltage and resistance
    const voltage = getComponentVoltage(component)
    const resistance = getComponentResistance(component)
    return resistance > 0 ? voltage / resistance : 0
  }

  const getComponentResistance = (component: any): number => {
    if (component.type === 'Resistor') {
      // Get resistance from the actual cell data
      const resistorCell = component.cells.find((cell: any) => cell.type === 'BODY')
      if (resistorCell?.resistance && resistorCell.resistance > 0) {
        return resistorCell.resistance
      }
      // Fallback to definition default
      return component.definition?.properties?.resistance?.default || 1000
    }
    return 0
  }

  const getComponentWires = (component: any): any[] => {
    // Find wires connected to this component
    return wires.filter(wire => 
      wire.segments.some((segment: any) => 
        component.cells.some((cell: any) => 
          (segment.from.x === cell.x && segment.from.y === cell.y) ||
          (segment.to.x === cell.x && segment.to.y === cell.y)
        )
      )
    )
  }

  // Run validation when grid or wires change
  useEffect(() => {
    validateCircuit()
  }, [gridData, wires])

  return null // This component doesn't render anything, just validates
}

// Helper function to calculate proper resistor value for LED
export const calculateLEDResistor = (supplyVoltage: number, ledVoltage: number, ledCurrent: number): number => {
  const voltageDrop = supplyVoltage - ledVoltage
  return voltageDrop / ledCurrent
}

// Helper function to get LED specifications
export const getLEDSpecs = (ledType: string = 'standard') => {
  const specs = {
    standard: { voltage: 2.0, current: 0.02 }, // 2V, 20mA
    red: { voltage: 1.8, current: 0.02 },
    green: { voltage: 2.2, current: 0.02 },
    blue: { voltage: 3.3, current: 0.02 },
    white: { voltage: 3.3, current: 0.02 },
    yellow: { voltage: 2.1, current: 0.02 }
  }
  return specs[ledType as keyof typeof specs] || specs.standard
}
