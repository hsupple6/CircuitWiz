import { logger } from "../../../services/Logger";

export function LEDVoltageFlow(
  component: any, 
  inputVoltage: number, 
  circuitCurrent: number, 
  componentUpdates: Map<string, any>,
  wires: any, 
  gridData: any[][],
  componentId: string
): { outputVoltage: number, isPowered: boolean, status: string } {
    console.log('[INPUT] ', inputVoltage)
    
    // Calculate LED voltage drop properly in voltage trace
    // Don't override inputVoltage - use what was passed in
    const forwardVoltage = component.moduleDefinition.grid[component.cellIndex || 0]?.voltage || 
                          component.moduleDefinition.properties?.forwardVoltage?.default
    
    // For voltage tracing, LED applies forward voltage drop
    // LED drops its forward voltage (2V) from the input voltage
    const outputVoltage = Math.max(0, inputVoltage - forwardVoltage)
    
    // Check if LED is connected to a grounded wire
    const isConnectedToGround = wires.some((wire: any) => 
      wire.isGrounded && wire.segments.some((segment: any) => 
        (segment.from.x === component.x && segment.from.y === component.y) ||
        (segment.to.x === component.x && segment.to.y === component.y)
      )
    )
    
    const isOn = inputVoltage >= forwardVoltage && circuitCurrent > 0 && isConnectedToGround
    const isPowered = inputVoltage > 0
    const status = isOn ? 'on' : 'off'
    
    console.log(`[LED STATUS DEBUG] inputVoltage: ${inputVoltage}V, forwardVoltage: ${forwardVoltage}V, circuitCurrent: ${circuitCurrent}A`)
    console.log(`[LED STATUS DEBUG] isConnectedToGround: ${isConnectedToGround}`)
    console.log(`[LED STATUS DEBUG] isOn: ${isOn}, isPowered: ${isPowered}, status: "${status}"`)

    // For LEDs, we need to process ALL cells of the component (like resistors)
    // Extract base component ID by removing the cell index suffix
    const baseComponentId = componentId
    
    
    
    const allLEDCells: Array<{id: string, position: {x: number, y: number}, cellIndex: number}> = []
    // Search the grid for all cells belonging to this resistor
    for (let y = 0; y < gridData.length; y++) {
      for (let x = 0; x < gridData[y].length; x++) {
        const cell = gridData[y][x]
        if (cell?.occupied) {
          console.log(`[LED DEBUG] Checking cell at (${x},${y}): componentId="${cell.componentId}", cellIndex=${cell.cellIndex}`)
        }
         if (cell?.occupied && cell.componentId === baseComponentId) {
          console.log('[LED DEBUG] Found cell: ', cell.componentId, cell.cellIndex)
           const cellId = `${cell.componentId}-${cell.cellIndex}`
           allLEDCells.push({
             id: cellId,
             position: { x, y },
             cellIndex: cell.cellIndex || 0
           })
         }
      }
    }

    console.log('[LED DEBUG] All cells: ', allLEDCells.map(cell => `${cell.id}: ${cell.position.x}, ${cell.position.y}`))
    
    // Update ALL cells of this LED with the same voltage calculation
      allLEDCells.forEach(cell => {
        const updateData = {
          componentId: cell.id,  // Use the correct cell ID
          inputVoltage,  // Add input voltage for debugging/UI
          outputVoltage,
          outputCurrent: circuitCurrent,
          power: forwardVoltage * circuitCurrent,
          forwardVoltage,
          isOn,
          status,
          isPowered: inputVoltage >= forwardVoltage,
          isGrounded: inputVoltage > 0
        }
        componentUpdates.set(cell.id, updateData)
        logger.componentsDebug(`[LED SYNC] Updated cell ${cell.id} at (${cell.position.x}, ${cell.position.y}) to ${outputVoltage}V`)
        console.log(`[LED DEBUG] Set ${cell.id} with status: "${status}", isOn: ${isOn}, isPowered: ${isPowered}`)
        console.log(`[LED DEBUG] Update data:`, updateData)
      })

    
    // Debug: Check what's actually in componentUpdates
    console.log(`🔧 [LED DEBUG] componentUpdates size: ${componentUpdates.size}`)
    console.log(`🔧 [LED DEBUG] componentUpdates keys:`, Array.from(componentUpdates.keys()))
    
    console.log('[LED DEBUG] All cells updated:', allLEDCells.map(cell => `${cell.id}: ${componentUpdates.get(cell.id)?.status}`))
    
    // Return the calculated values
    return {
        outputVoltage,
        isPowered,
        status
    }
}