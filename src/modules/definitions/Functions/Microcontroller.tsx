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
      
      
      // Check GPIO state - handle HIGH, LOW, and PWM (PULSING) states
      // If no GPIO states are provided (no program running), default to LOW
      const gpioState = gpioStates?.get(pinNumber)
      const pinState = gpioState?.state || 'LOW'
      
      if (pinState === 'HIGH') {
        // Pin is HIGH - generate full voltage (don't transfer input voltage)
        // Use appropriate voltage based on microcontroller type
        const moduleType = component.moduleDefinition.module
        outputVoltage = moduleType.includes('ESP32') ? 3.3 : 5.0
        isPowered = true
        status = 'active'
      } else if (pinState === 'PULSING') {
        // Pin is PWM - output full voltage but with PWM throttle percentage
        const moduleType = component.moduleDefinition.module
        outputVoltage = moduleType.includes('ESP32') ? 3.3 : 5.0
        isPowered = true
        status = 'pwm'
        
        // Debug: Log PWM signal generation
        const dutyCycle = gpioState?.value || 0.5 // Default to 50% duty cycle
        const throttlePercent = dutyCycle * 100
        console.log(`🔧 [MICROCONTROLLER] Pin ${pinNumber} PWM: ${outputVoltage}V (${throttlePercent.toFixed(1)}% throttle)`)
      } else {
        // Pin is LOW - no voltage output, regardless of input
        outputVoltage = 0
        isPowered = false
        status = 'inactive'
      }
      
      const componentUpdate = {
        outputVoltage,
        outputCurrent: circuitCurrent,
        power: outputVoltage * circuitCurrent,
        status,
        isPowered,
        isGrounded: false,
        ...(pinState === 'PULSING' && { pwm: (gpioState?.value || 0.5) * 100 }) // Add PWM throttle percentage
      }
      
      componentUpdates.set(cellComponentId, componentUpdate)
      
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