export function MicrocontrollerVoltageFlow(
  component: any, 
  inputVoltage: number, 
  circuitCurrent: number, 
  componentUpdates: Map<string, any>,
  _wires: any, 
  _gridData: any[][],
  componentId: string,
  gpioStates?: Map<number, any>
): { outputVoltage: number, isPowered: boolean, status: string } {
    // Microcontroller pins only transfer voltage when set to HIGH
    const moduleCell = component.moduleDefinition.grid[component.cellIndex || 0]
    const isGPIOPin = moduleCell?.type === 'GPIO' || moduleCell?.type === 'ANALOG'
    
    console.log(`[MCU_VOLTAGE] MicrocontrollerVoltageFlow called for ${componentId}, pin: ${moduleCell?.pin}, type: ${moduleCell?.type}, isGPIOPin: ${isGPIOPin}, inputVoltage: ${inputVoltage}`)
    console.log(`[MCU_VOLTAGE] Component details:`, {
      componentId,
      cellIndex: component.cellIndex,
      moduleCell,
      isGPIOPin,
      inputVoltage,
      gpioStates: gpioStates ? Array.from(gpioStates.entries()) : 'undefined'
    })
    
    // Debug: Check if this is pin 13 specifically
    if (moduleCell?.pin === 'D13/SCK') {
      console.log(`[MCU_VOLTAGE] DEBUG: Processing D13 pin specifically`)
      console.log(`[MCU_VOLTAGE] DEBUG: gpioStates for pin 13:`, gpioStates?.get(13))
    }
    
    // Create cell-specific ID for visited check (consistent with recursive calls)
    const cellComponentId = `${componentId}-${component.cellIndex || 0}`
    
    let outputVoltage = 0
    let isPowered = false
    let status = 'unpowered'
    
    if (isGPIOPin) {
      // Extract pin number from pin name (D2, A0, GPIO23, etc.)
      let pinNumber = 0
      
      if (moduleCell.pin?.startsWith('GPIO')) {
        // ESP32 GPIO pins (GPIO0, GPIO1, etc.)
        pinNumber = parseInt(moduleCell.pin.replace('GPIO', '') || '0')
      } else if (moduleCell.pin?.startsWith('D')) {
        // Arduino digital pins (D0, D1, etc.)
        pinNumber = parseInt(moduleCell.pin.replace('D', '') || '0')
      } else if (moduleCell.pin?.startsWith('A')) {
        // Arduino analog pins (A0-A5) by using pin numbers 100-105
        pinNumber = parseInt(moduleCell.pin.replace('A', '') || '0') + 100
      } else {
        // Fallback for other pin naming schemes
        pinNumber = parseInt(moduleCell.pin || '0')
      }
      
      // Debug: Log pin number extraction
      console.log(`[MCU_VOLTAGE] Pin extraction: "${moduleCell.pin}" -> pinNumber: ${pinNumber}`)
      
      // Check GPIO state - only generate voltage if pin is HIGH
      // If no GPIO states are provided (no program running), default to LOW
      const gpioState = gpioStates?.get(pinNumber)
      const pinIsHigh = gpioState && gpioState.state === 'HIGH'
      
      console.log(`[MCU_VOLTAGE] MCU pin ${moduleCell.pin} (pinNumber: ${pinNumber}): gpioState=${gpioState ? JSON.stringify(gpioState) : 'undefined'}, pinIsHigh=${pinIsHigh}`)
      
      if (pinIsHigh) {
        // Pin is HIGH - generate voltage (don't transfer input voltage)
        // Use appropriate voltage based on microcontroller type
        const moduleType = component.moduleDefinition.module
        outputVoltage = moduleType.includes('ESP32') ? 3.3 : 5.0
        isPowered = true
        status = 'active'
        console.log(`[MCU_VOLTAGE] MCU pin ${moduleCell.pin} (HIGH): generates ${outputVoltage}V`)
      } else {
        // Pin is LOW - no voltage output, regardless of input
        outputVoltage = 0
        isPowered = false
        status = 'inactive'
        console.log(`[MCU_VOLTAGE] MCU pin ${moduleCell.pin} (LOW): no voltage output`)
      }
      
      const componentUpdate = {
        outputVoltage,
        outputCurrent: circuitCurrent,
        power: outputVoltage * circuitCurrent,
        status,
        isPowered,
        isGrounded: false
      }
      
      componentUpdates.set(cellComponentId, componentUpdate)
      
      // Debug: Log component update for D13 specifically
      if (moduleCell.pin === 'D13/SCK') {
        console.log(`[MCU_VOLTAGE] MicrocontrollerVoltageFlow: D13 component update:`, {
          cellComponentId,
          componentUpdate,
          pinIsHigh,
          gpioState,
          pinNumber
        })
      }
    } else {
      // Non-GPIO cells (like VCC, GND) behave normally
      outputVoltage = inputVoltage
      isPowered = true
      status = 'active'
      
      componentUpdates.set(cellComponentId, {
        outputVoltage,
        outputCurrent: circuitCurrent,
        power: outputVoltage * circuitCurrent,
        status,
        isPowered,
        isGrounded: false
      })
    }
    
    // Return the calculated values
    return {
        outputVoltage,
        isPowered,
        status
    }
}