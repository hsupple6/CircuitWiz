import { logger } from "../../../services/Logger";

export function MicrocontrollerVoltageFlow(
  component: any, 
  inputVoltage: number, 
  circuitCurrent: number, 
  componentUpdates: Map<string, any>,
  wires: any, 
  gridData: any[][],
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
      // Extract pin number from pin name (D2, A0, etc.)
      let pinNumber = parseInt(moduleCell.pin?.replace('D', '').replace('A', '') || '0')
      
      // Handle analog pins (A0-A5) by using pin numbers 100-105
      if (moduleCell.type === 'ANALOG') {
        pinNumber = pinNumber + 100
      }
      
      // Check GPIO state - only transfer voltage if pin is HIGH
      const gpioState = gpioStates?.get(pinNumber)
      const pinIsHigh = gpioState && gpioState.state === 'HIGH'
      
      if (pinIsHigh) {
        // Pin is HIGH - can transfer voltage
        outputVoltage = inputVoltage
        isPowered = true
        status = 'active'
        console.log(`🔧 MCU pin ${moduleCell.pin} (HIGH): transfers ${outputVoltage}V`)
      } else {
        // Pin is LOW - blocks voltage transfer
        outputVoltage = 0
        isPowered = false
        status = 'inactive'
        console.log(`🔧 MCU pin ${moduleCell.pin} (LOW): blocks voltage transfer`)
      }
      
      componentUpdates.set(cellComponentId, {
        outputVoltage,
        outputCurrent: circuitCurrent,
        power: outputVoltage * circuitCurrent,
        status,
        isPowered,
        isGrounded: false
      })
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