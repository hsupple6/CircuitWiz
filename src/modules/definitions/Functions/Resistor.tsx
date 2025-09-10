import { logger } from "../../../services/Logger";

export function ResistorVoltageFlow(
  component: any, 
  inputVoltage: number, 
  circuitCurrent: number, 
  componentUpdates: Map<string, any>,
  wires: any, 
  gridData: any[][],
  componentId: string
): { outputVoltage: number, isPowered: boolean, status: string } {
    console.log(`🔍 [BRANCH] Taking Resistor branch for ${componentId}`)
    const resistance = component.moduleDefinition.grid[component.cellIndex || 0]?.resistance || 
                      component.moduleDefinition.properties?.resistance || 1000
    const voltageDrop = circuitCurrent * resistance
    const outputVoltage = Math.max(0, inputVoltage - voltageDrop)
    const isPowered = outputVoltage > 0
    const status = isPowered ? 'active' : 'unpowered'
    
    console.log(`[RESISTOR CALC] ${componentId}: ${inputVoltage}V input → ${outputVoltage}V output (${voltageDrop}V drop, ${resistance}Ω, ${circuitCurrent}A)`)
    logger.componentsDebug(`[RESISTOR TRACKING] ${componentId}: ${voltageDrop}V drop, input: ${inputVoltage}V, output: ${outputVoltage}V`)
    
    // For resistors, we need to process ALL cells of the component
    // Find all cells of this resistor component in the grid
    const baseComponentId = componentId.replace(/-\d+$/, '')
    
    // Find all cells of this resistor component
    const allResistorCells: Array<{id: string, position: {x: number, y: number}, cellIndex: number}> = []
    
    // Search the grid for all cells belonging to this resistor
    for (let y = 0; y < gridData.length; y++) {
      for (let x = 0; x < gridData[y].length; x++) {
        const cell = gridData[y][x]
        if (cell?.occupied && cell.componentId === baseComponentId) {
          const cellId = `${baseComponentId}-${cell.cellIndex || 0}`
          allResistorCells.push({
            id: cellId,
            position: { x, y },
            cellIndex: cell.cellIndex || 0
          })
        }
      }
    }
    
    console.log(`🔧 Found ${allResistorCells.length} cells for resistor ${baseComponentId}:`, allResistorCells.map(c => c.id))
    
    // Update ALL cells of this resistor with the same voltage
    allResistorCells.forEach(cell => {
      componentUpdates.set(cell.id, {
        outputVoltage: outputVoltage,
        outputCurrent: circuitCurrent,
        power: voltageDrop * circuitCurrent,
        voltageDrop,
        status,
        isPowered,
        isGrounded: false
      })
      logger.componentsDebug(`[RESISTOR SYNC] Updated cell ${cell.id} at (${cell.position.x}, ${cell.position.y}) to ${outputVoltage}V`)
    })
    
    // Return the calculated values
    return {
        outputVoltage,
        isPowered,
        status
    }
}