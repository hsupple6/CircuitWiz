/**
 * Electrical Circuit Analysis System
 * 
 * This system provides a clean, systematic approach to electrical circuit analysis:
 * 1. Finds complete circuit pathways
 * 2. Creates component arrays with proper specifications
 * 3. Each component has its own calculation function
 * 4. Uses component IDs for state management
 * 5. Handles series/parallel circuits properly
 */

// Import existing types from the modules
import { WireConnection } from '../modules/types'

export interface ComponentState {
  componentId: string
  componentType: string
  position: { x: number; y: number }
  outputVoltage: number
  outputCurrent: number
  power: number
  status: string
  [key: string]: any // Additional properties like voltageDrop, isOn, etc.
}

export interface CircuitPathway {
  id: string
  type: string
  position: { x: number; y: number }
  properties: any
}

export interface PowerSource {
  id: string
  voltage: number
  position: { x: number; y: number }
  maxCurrent: number
}

export interface GridCell {
  occupied?: boolean
  componentId?: string
  componentType?: string
  moduleDefinition?: any
  cellIndex?: number
  resistance?: number
  voltage?: number
  current?: number
  isPowered?: boolean
  x?: number
  y?: number
}

/**
 * Component Calculation Functions
 * Each component type has its own calculation function that takes input voltage/current
 * and returns output voltage/current with additional properties
 */
export const componentCalculators = {
  battery: (component: any, inputVoltage: number, inputCurrent: number) => {
    return {
      outputVoltage: component.voltage,
      outputCurrent: inputCurrent,
      power: component.voltage * inputCurrent,
      status: 'active'
    }
  },
  
  resistor: (component: any, inputVoltage: number, inputCurrent: number) => {
    const voltageDrop = inputCurrent * component.resistance
    const outputVoltage = Math.max(0, inputVoltage - voltageDrop)
    return {
      outputVoltage,
      outputCurrent: inputCurrent,
      power: voltageDrop * inputCurrent,
      voltageDrop,
      status: 'active'
    }
  },
  
  led: (component: any, inputVoltage: number, inputCurrent: number) => {
    const forwardVoltage = component.forwardVoltage || component.voltage || 2.0
    const outputVoltage = Math.max(0, inputVoltage - forwardVoltage)
    const isOn = inputVoltage >= forwardVoltage && inputCurrent > 0
    
    // LED power is forward voltage × current (this is the power the LED consumes)
    const ledPower = forwardVoltage * inputCurrent
    
    // Debug logging for LED calculations (only when LED state changes)
    if (isOn) {
      console.log(`💡 LED ON: ${inputVoltage.toFixed(1)}V → ${outputVoltage.toFixed(1)}V, ${(inputCurrent * 1000).toFixed(0)}mA`)
    }
    
    return {
      outputVoltage,
      outputCurrent: inputCurrent,
      power: ledPower,
      forwardVoltage,
      isOn,
      status: isOn ? 'on' : 'off'
    }
  },

  powersupply: (component: any, inputVoltage: number, inputCurrent: number) => {
    return {
      outputVoltage: component.voltage,
      outputCurrent: inputCurrent,
      power: component.voltage * inputCurrent,
      status: 'active'
    }
  }
}

/**
 * Find all power sources in the grid
 */
export function findPowerSources(gridData: GridCell[][]): PowerSource[] {
  const powerSources: PowerSource[] = []
  
  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (cell && cell.occupied && cell.componentId && cell.moduleDefinition) {
        const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
        if (moduleCell?.isPowerable && moduleCell?.voltage > 0 && 
            (moduleCell.type === 'VCC' || moduleCell.type === 'POSITIVE' || moduleCell.type === 'DIGITAL')) {
          powerSources.push({
            id: cell.componentId,
            voltage: moduleCell.voltage,
            maxCurrent: moduleCell.current || 0.1,
            position: { x, y }
          })
        }
      }
    })
  })
  
  return powerSources
}

/**
 * Create a map of all wire connections
 */
export function buildConnectionMap(wires: WireConnection[]): Map<string, Set<string>> {
  const connections = new Map<string, Set<string>>()
  
  wires.forEach((wire) => {
    wire.segments.forEach((segment) => {
      const fromKey = `${segment.from.x},${segment.from.y}`
      const toKey = `${segment.to.x},${segment.to.y}`
      
      if (!connections.has(fromKey)) connections.set(fromKey, new Set())
      if (!connections.has(toKey)) connections.set(toKey, new Set())
      
      connections.get(fromKey)!.add(toKey)
      connections.get(toKey)!.add(fromKey)
    })
  })
  
  return connections
}

/**
 * Find circuit pathway starting from a power source
 */type BranchPathway = CircuitPathway[][]; // Array of branches (each branch = linear array)

export function findCircuitBranches(
    startPosition: { x: number; y: number },
    gridData: GridCell[][],
    connections: Map<string, Set<string>>,
    visited = new Set<string>()
  ): BranchPathway {
    const key = `${startPosition.x},${startPosition.y}`
    if (visited.has(key)) return []
    visited.add(key)
  
    const cell = gridData[startPosition.y]?.[startPosition.x]
    const pathway: CircuitPathway[] = []
  
    if (cell?.occupied && cell.componentId) {
      const moduleCell = cell.moduleDefinition?.grid?.[cell.cellIndex || 0]
      if (moduleCell) {
        // Check if this component is already in the pathway to avoid duplicates
        const componentAlreadyAdded = pathway.some(comp => comp.id === cell.componentId)
        if (!componentAlreadyAdded) {
          pathway.push({
            id: cell.componentId,
            type: cell.componentType || 'unknown',
            position: { x: startPosition.x, y: startPosition.y },
            properties: {
              ...moduleCell,
              resistance: cell.resistance || moduleCell.resistance,
              voltage: moduleCell.voltage,
              current: moduleCell.current,
              forwardVoltage: cell.moduleDefinition?.properties?.forwardVoltage?.default ||
                              moduleCell.properties?.forward_voltage ||
                              moduleCell.voltage || 2.0
            }
          })
        }
      }
    }
  
  const connectedCells = connections.get(key)
  if (!connectedCells || connectedCells.size === 0) return [pathway]

  // If multiple connections, create separate branches
  const branches: BranchPathway = []
  connectedCells.forEach(connectedKey => {
    const [x, y] = connectedKey.split(',').map(Number)
    
    // Check if this connected cell is part of the same component
    const connectedCell = gridData[y]?.[x]
    if (connectedCell?.occupied && connectedCell.componentId) {
      // If it's the same component, we need to find all other connection points for this component
      const componentId = connectedCell.componentId
      
      // Find all other connection points for this component
      const allComponentConnections = new Set<string>()
      connections.forEach((connectedCells, connectionKey) => {
        connectedCells.forEach(connectedCellKey => {
          const [cx, cy] = connectedCellKey.split(',').map(Number)
          const cell = gridData[cy]?.[cx]
          if (cell?.occupied && cell.componentId === componentId) {
            allComponentConnections.add(connectionKey)
            allComponentConnections.add(connectedCellKey)
          }
        })
      })
      
      // Explore all connections for this component
      allComponentConnections.forEach(componentConnectionKey => {
        if (componentConnectionKey !== key) {
          const [cx, cy] = componentConnectionKey.split(',').map(Number)
          const subBranches = findCircuitBranches({ x: cx, y: cy }, gridData, connections, visited)
          subBranches.forEach(sb => {
            // Merge pathways, avoiding duplicate components
            const mergedPathway = [...pathway]
            sb.forEach(comp => {
              if (!mergedPathway.some(existing => existing.id === comp.id)) {
                mergedPathway.push(comp)
              }
            })
            branches.push(mergedPathway)
          })
        }
      })
    } else {
      // Regular connection exploration
      const subBranches = findCircuitBranches({ x, y }, gridData, connections, visited)
      subBranches.forEach(sb => {
        // Merge pathways, avoiding duplicate components
        const mergedPathway = [...pathway]
        sb.forEach(comp => {
          if (!mergedPathway.some(existing => existing.id === comp.id)) {
            mergedPathway.push(comp)
          }
        })
        branches.push(mergedPathway)
      })
    }
  })
  
    return branches.length > 0 ? branches : [pathway]
  }
  
/**
 * Calculate circuit parameters for mixed load systems
 */
export function calculateCircuitParameters(pathway: CircuitPathway[]): {
  totalResistance: number
  totalVoltageDrop: number
  ledCurrentRequirement: number
  motorCurrentRequirement: number
  totalLoadCurrent: number
} {
  let totalResistance = 0
  let totalVoltageDrop = 0
  let ledCurrentRequirement = 0.02 // Default 20mA
  let motorCurrentRequirement = 0 // Default 0A
  let totalLoadCurrent = 0
  
  pathway.forEach(comp => {
    if (comp.type === 'Resistor') {
      totalResistance += comp.properties.resistance || 1000
    } else if (comp.type === 'LED') {
      // LED doesn't add significant resistance, just voltage drop
      totalVoltageDrop += comp.properties.forwardVoltage || comp.properties.voltage || 2.0
      // LED determines the current requirement
      ledCurrentRequirement = comp.properties.maxCurrent || comp.properties.current || 0.02
      totalLoadCurrent += ledCurrentRequirement
    } else if (comp.type === 'Motor') {
      // Motor adds voltage drop and current requirement
      totalVoltageDrop += comp.properties.nominalVoltage || comp.properties.voltage || 0
      motorCurrentRequirement = comp.properties.runningCurrent || comp.properties.current || 0
      totalLoadCurrent += motorCurrentRequirement
    }
  })
  
  return { 
    totalResistance, 
    totalVoltageDrop, 
    ledCurrentRequirement,
    motorCurrentRequirement,
    totalLoadCurrent 
  }
}

/**
 * Process a single circuit pathway and calculate component states
 */
export function processCircuitPathway(
  pathway: CircuitPathway[],
  sourceVoltage: number,
  maxCurrent: number
): Map<string, ComponentState> {
  const componentStates = new Map<string, ComponentState>()
  
  if (pathway.length === 0) return componentStates
  
  // Calculate circuit current based on LED requirements
  const { totalResistance, totalVoltageDrop, ledCurrentRequirement } = calculateCircuitParameters(pathway)
  const effectiveVoltage = sourceVoltage - totalVoltageDrop
  
  // Calculate what current the resistor would allow
  const resistorCurrent = effectiveVoltage > 0 && totalResistance > 0 ? 
    effectiveVoltage / totalResistance : 0
  
  // Use the smaller of: LED requirement, resistor limit, or power source limit
  const circuitCurrent = Math.min(ledCurrentRequirement, resistorCurrent, maxCurrent)
  
  console.log(`⚡ Circuit analysis:`)
  console.log(`   LED wants: ${(ledCurrentRequirement * 1000).toFixed(1)}mA`)
  console.log(`   Resistor allows: ${(resistorCurrent * 1000).toFixed(1)}mA`)
  console.log(`   Power source limit: ${(maxCurrent * 1000).toFixed(1)}mA`)
  console.log(`   Final current: ${(circuitCurrent * 1000).toFixed(1)}mA`)
  console.log(`   Total R: ${totalResistance}Ω, V_drop: ${totalVoltageDrop}V`)
  
  // Process each component in the pathway
  let currentVoltage = sourceVoltage
  let currentCurrent = circuitCurrent
  
  pathway.forEach((comp) => {
    const calculator = componentCalculators[comp.type.toLowerCase() as keyof typeof componentCalculators]
    if (calculator) {
      const result = calculator(comp.properties, currentVoltage, currentCurrent)
      
      // Store component state
      componentStates.set(comp.id, {
        ...result,
        componentId: comp.id,
        componentType: comp.type,
        position: comp.position
      })
      
      console.log(`  ${comp.type} (${comp.id}): ${currentVoltage.toFixed(2)}V -> ${result.outputVoltage.toFixed(2)}V, ${(currentCurrent * 1000).toFixed(1)}mA`)
      
      // Update for next component
      currentVoltage = result.outputVoltage
      currentCurrent = result.outputCurrent
    }
  })
  
  return componentStates
}

/**
 * Update wire states based on component states
 */
export function updateWireStates(
  wires: WireConnection[],
  componentStates: Map<string, ComponentState>,
  circuitCurrent: number = 0
): WireConnection[] {
  return wires.map(wire => {
    let wireVoltage = 0
    let wireCurrent = 0
    let wirePower = 0
    let isPowered = false
    
    // Find the component states that this wire connects to
    const connectedStates: ComponentState[] = []
    
    for (const segment of wire.segments) {
      const fromKey = `${segment.from.x},${segment.from.y}`
      const toKey = `${segment.to.x},${segment.to.y}`
      
      // Check if this segment connects to a component with state
      componentStates.forEach((state) => {
        const componentKey = `${state.position.x},${state.position.y}`
        if (fromKey === componentKey || toKey === componentKey) {
          connectedStates.push(state)
        }
      })
    }
    
    // If no direct connections found, try to find components within a small radius
    if (connectedStates.length === 0) {
      for (const segment of wire.segments) {
        componentStates.forEach((state) => {
          const dx = Math.abs(segment.from.x - state.position.x)
          const dy = Math.abs(segment.from.y - state.position.y)
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          // If component is within 2 grid units of wire segment
          if (distance <= 2) {
            connectedStates.push(state)
          }
        })
      }
    }
    
    // Calculate wire properties based on connected components
    if (connectedStates.length > 0) {
      // In a series circuit, ALL wires have the SAME current
      wireCurrent = circuitCurrent
      
      // Voltage varies along the circuit (drops across components)
      // Use the highest voltage from connected components
      wireVoltage = Math.max(...connectedStates.map(s => s.outputVoltage || 0))
      wirePower = wireVoltage * wireCurrent
      isPowered = wireVoltage > 0
      
      console.log(`🔌 Wire ${wire.id}: Connected to ${connectedStates.length} components`)
      console.log(`   Voltage: ${wireVoltage.toFixed(2)}V, Current: ${(wireCurrent * 1000).toFixed(1)}mA (SERIES)`)
    }
    
    return {
      ...wire,
      voltage: wireVoltage,
      current: wireCurrent,
      power: wirePower,
      isPowered,
      segments: wire.segments.map(segment => ({
        ...segment,
        isPowered,
        voltage: wireVoltage,
        current: wireCurrent
      }))
    }
  })
}

/**
 * Update grid data with component states
 */
export function updateGridData(
  gridData: GridCell[][],
  componentStates: Map<string, ComponentState>
): GridCell[][] {
  const newGrid = [...gridData]
  let hasChanges = false
  
  componentStates.forEach((state) => {
    const { position } = state
    if (newGrid[position.y]?.[position.x]) {
      const currentVoltage = newGrid[position.y][position.x].voltage || 0
      if (Math.abs(currentVoltage - state.outputVoltage) > 0.01) {
        if (!hasChanges) {
          newGrid[position.y] = [...newGrid[position.y]]
          hasChanges = true
        }
        newGrid[position.y][position.x] = {
          ...newGrid[position.y][position.x],
          voltage: state.outputVoltage,
          current: state.outputCurrent,
          isPowered: state.outputVoltage > 0
        }
      }
    }
  })
  
  return hasChanges ? newGrid : gridData
}

/**
 * Main electrical calculation function
 * This is the entry point for the entire electrical system
 */
export function calculateElectricalFlow(
  gridData: GridCell[][],
  wires: WireConnection[]
): {
  componentStates: Map<string, ComponentState>
  updatedWires: WireConnection[]
  updatedGridData: GridCell[][]
} {
  const powerSources = findPowerSources(gridData)
  const connections = buildConnectionMap(wires)
  
  // Debug: Show connection count only
  console.log(`🔗 Found ${connections.size} wire connection points`)
  
  const allComponentStates = new Map<string, ComponentState>()
  let globalCircuitCurrent = 0

  powerSources.forEach((source, sourceIndex) => {
    const branches = findCircuitBranches(source.position, gridData, connections)
    console.log(`🔌 Power source ${source.id}: Found ${branches.length} branches`)

    branches.forEach((branch, branchIndex) => {
      console.log(`📡 Branch ${branchIndex + 1}: ${branch.length} components - ${branch.map(c => c.type).join(' → ')}`)
      const branchStates = processBranch(branch, source.voltage, source.maxCurrent)
      branchStates.forEach((state, id) => allComponentStates.set(id, state))
      if (branchStates.size > 0 && globalCircuitCurrent === 0) {
        globalCircuitCurrent = Array.from(branchStates.values())[0].outputCurrent
      }
    })
  })

  console.log(`📊 Total component states: ${allComponentStates.size}`)

  const updatedWires = updateWireStates(wires, allComponentStates, globalCircuitCurrent)
  const updatedGridData = updateGridData(gridData, allComponentStates)

  return {
    componentStates: allComponentStates,
    updatedWires,
    updatedGridData
  }
}


export function processBranch(
    branch: CircuitPathway[],
    sourceVoltage: number,
    maxCurrent: number
  ): Map<string, ComponentState> {
    const states = new Map<string, ComponentState>()
    if (branch.length === 0) return states
  
  // Compute branch voltage drop & total resistance
  const { totalResistance, totalVoltageDrop, ledCurrentRequirement, motorCurrentRequirement } = calculateCircuitParameters(branch)
  const effectiveVoltage = Math.max(0, sourceVoltage - totalVoltageDrop)
  const resistorCurrent = totalResistance > 0 ? effectiveVoltage / totalResistance : maxCurrent

  // Current through branch = min(limit by resistor, LED/motor requirement, source)
  const branchCurrent = Math.min(ledCurrentRequirement + motorCurrentRequirement, resistorCurrent, maxCurrent)

  console.log(`⚡ Circuit: ${sourceVoltage}V → ${(branchCurrent * 1000).toFixed(0)}mA, R=${totalResistance}Ω`)

  let currentVoltage = sourceVoltage
  let currentCurrent = branchCurrent

  branch.forEach((comp, index) => {
    const calculator = componentCalculators[comp.type.toLowerCase() as keyof typeof componentCalculators]
    if (calculator) {
      const result = calculator(comp.properties, currentVoltage, currentCurrent)
      states.set(comp.id, {
        ...result,
        componentId: comp.id,
        componentType: comp.type,
        position: comp.position
      })
      
      currentVoltage = result.outputVoltage
      currentCurrent = result.outputCurrent
    }
  })
    return states
  }
  