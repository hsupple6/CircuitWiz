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
import { logger } from '../services/Logger'

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

export interface ParallelBranch {
  id: string
  components: CircuitPathway[]
  totalResistance: number
  current: number
  voltage: number
}

export interface CircuitNode {
  id: string
  position: { x: number; y: number }
  connections: string[]
  isJunction: boolean
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
  battery: (component: any, _inputVoltage: number, inputCurrent: number) => {
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
    
    // Log LED state changes
    if (isOn) {
      logger.componentState('LED', component.id || 'unknown', inputVoltage, inputCurrent, 'on')
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

  powersupply: (component: any, _inputVoltage: number, inputCurrent: number) => {
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
 * Find circuit nodes (junctions where multiple wires connect)
 */
export function findCircuitNodes(
  gridData: GridCell[][],
  connections: Map<string, Set<string>>
): Map<string, CircuitNode> {
  const nodes = new Map<string, CircuitNode>()
  
  connections.forEach((connectedPositions, positionKey) => {
    const [x, y] = positionKey.split(',').map(Number)
    const cell = gridData[y]?.[x]
    
    // A node is a junction if it has more than 2 connections
    const isJunction = connectedPositions.size > 2
    
    // Or if it's a component with multiple connection points
    const isComponentJunction = cell?.occupied && cell.componentId && connectedPositions.size >= 2
    
    if (isJunction || isComponentJunction) {
      nodes.set(positionKey, {
        id: positionKey,
        position: { x, y },
        connections: Array.from(connectedPositions),
        isJunction: true
      })
    }
  })
  
  return nodes
}

/**
 * Simple parallel resistor detection - find resistors connected to the same junction points
 */
export function findParallelResistors(
  gridData: GridCell[][],
  connections: Map<string, Set<string>>
): ParallelBranch[] {
  const parallelBranches: ParallelBranch[] = []
  const processedResistors = new Set<string>()
  
  // Find all resistors in the grid
  const resistors: Array<{id: string, position: {x: number, y: number}, resistance: number}> = []
  
  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.componentId && cell.componentType === 'Resistor') {
        resistors.push({
          id: cell.componentId,
          position: { x, y },
          resistance: cell.resistance || 1000
        })
      }
    })
  })
  
  logger.debug(`Found ${resistors.length} resistors in grid`)
  
  // Group resistors that share connection points (indicating parallel connection)
  for (let i = 0; i < resistors.length; i++) {
    if (processedResistors.has(resistors[i].id)) continue
    
    const resistor1 = resistors[i]
    const resistor1Pos = `${resistor1.position.x},${resistor1.position.y}`
    const resistor1Connections = connections.get(resistor1Pos) || new Set()
    
    // Find other resistors that share connection points with this one
    const parallelGroup = [resistor1]
    processedResistors.add(resistor1.id)
    
    for (let j = i + 1; j < resistors.length; j++) {
      if (processedResistors.has(resistors[j].id)) continue
      
      const resistor2 = resistors[j]
      const resistor2Pos = `${resistor2.position.x},${resistor2.position.y}`
      const resistor2Connections = connections.get(resistor2Pos) || new Set()
      
      // Check if these resistors share any connection points
      const sharedConnections = new Set([...resistor1Connections].filter(pos => resistor2Connections.has(pos)))
      
      if (sharedConnections.size >= 2) {
        // These resistors are connected in parallel
        parallelGroup.push(resistor2)
        processedResistors.add(resistor2.id)
        logger.debug(`Found parallel resistors: ${resistor1.id} and ${resistor2.id} share ${sharedConnections.size} connection points`)
      }
    }
    
    // If we found multiple resistors in parallel, create a parallel branch
    if (parallelGroup.length > 1) {
      const branch: ParallelBranch = {
        id: `parallel-${parallelGroup.map(r => r.id).join('-')}`,
        components: parallelGroup.map(resistor => ({
          id: resistor.id,
          type: 'Resistor',
          position: resistor.position,
          properties: {
            resistance: resistor.resistance,
            voltage: 0,
            current: 0
          }
        })),
        totalResistance: 0,
        current: 0,
        voltage: 0
      }
      
      parallelBranches.push(branch)
      logger.parallelBranch(parallelGroup.length, calculateParallelResistance(parallelGroup.map(r => r.resistance)))
    }
  }
  
  return parallelBranches
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
 * Calculate parallel resistance using the formula: 1/R_total = 1/R1 + 1/R2 + ... + 1/Rn
 */
export function calculateParallelResistance(resistances: number[]): number {
  if (resistances.length === 0) return 0
  if (resistances.length === 1) return resistances[0]
  
  const reciprocalSum = resistances.reduce((sum, r) => sum + (1 / r), 0)
  return reciprocalSum > 0 ? 1 / reciprocalSum : 0
}

/**
 * Calculate circuit parameters for mixed load systems (including parallel circuits)
 */
export function calculateCircuitParameters(pathway: CircuitPathway[], parallelBranches: ParallelBranch[] = []): {
  totalResistance: number
  totalVoltageDrop: number
  ledCurrentRequirement: number
  motorCurrentRequirement: number
  totalLoadCurrent: number
  parallelResistance: number
} {
  let seriesResistance = 0
  let totalVoltageDrop = 0
  let ledCurrentRequirement = 0.02 // Default 20mA
  let motorCurrentRequirement = 0 // Default 0A
  let totalLoadCurrent = 0
  let parallelResistance = 0
  
  // Calculate series components
  pathway.forEach(comp => {
    if (comp.type === 'Resistor') {
      seriesResistance += comp.properties.resistance || 1000
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
  
  // Calculate parallel branches
  if (parallelBranches.length > 0) {
    const parallelResistances: number[] = []
    
    parallelBranches.forEach(branch => {
      let branchResistance = 0
      branch.components.forEach(comp => {
        if (comp.type === 'Resistor') {
          branchResistance += comp.properties.resistance || 1000
        }
      })
      
      if (branchResistance > 0) {
        parallelResistances.push(branchResistance)
      }
    })
    
    parallelResistance = calculateParallelResistance(parallelResistances)
  }
  
  // Total resistance = series resistance + parallel resistance
  const totalResistance = seriesResistance + parallelResistance
  
  return { 
    totalResistance, 
    totalVoltageDrop, 
    ledCurrentRequirement,
    motorCurrentRequirement,
    totalLoadCurrent,
    parallelResistance
  }
}

/**
 * Calculate current distribution in parallel branches
 */
export function calculateParallelBranchCurrents(
  parallelBranches: ParallelBranch[],
  totalVoltage: number
): ParallelBranch[] {
  return parallelBranches.map(branch => {
    let branchResistance = 0
    
    // Calculate total resistance for this branch
    branch.components.forEach(comp => {
      if (comp.type === 'Resistor') {
        branchResistance += comp.properties.resistance || 1000
      }
    })
    
    // Calculate current through this branch using Ohm's Law: I = V / R
    const branchCurrent = branchResistance > 0 ? totalVoltage / branchResistance : 0
    
    return {
      ...branch,
      totalResistance: branchResistance,
      current: branchCurrent,
      voltage: totalVoltage
    }
  })
}

/**
 * Process a single circuit pathway and calculate component states
 */
export function processCircuitPathway(
  pathway: CircuitPathway[],
  sourceVoltage: number,
  maxCurrent: number,
  parallelBranches: ParallelBranch[] = []
): Map<string, ComponentState> {
  const componentStates = new Map<string, ComponentState>()
  
  if (pathway.length === 0) return componentStates
  
  // Calculate circuit current including parallel branches
  const { totalResistance, totalVoltageDrop, ledCurrentRequirement } = calculateCircuitParameters(pathway, parallelBranches)
  const effectiveVoltage = sourceVoltage - totalVoltageDrop
  
  // Calculate what current the resistor would allow
  const resistorCurrent = effectiveVoltage > 0 && totalResistance > 0 ? 
    effectiveVoltage / totalResistance : 0
  
  // Use the smaller of: LED requirement, resistor limit, or power source limit
  const circuitCurrent = Math.min(ledCurrentRequirement, resistorCurrent, maxCurrent)
  
  logger.circuitAnalysis(effectiveVoltage, circuitCurrent, totalResistance)
  
  // Calculate parallel branch currents
  const updatedParallelBranches = calculateParallelBranchCurrents(parallelBranches, effectiveVoltage)
  
  // Log parallel branch information
  if (updatedParallelBranches.length > 0) {
    logger.info(`Parallel branches detected: ${updatedParallelBranches.length} branches`)
  }
  
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
      
      logger.componentState(comp.type, comp.id, currentVoltage, currentCurrent, result.status)
      
      // Update for next component
      currentVoltage = result.outputVoltage
      currentCurrent = result.outputCurrent
    }
  })
  
  // Process parallel branch components
  updatedParallelBranches.forEach((branch) => {
    branch.components.forEach((comp) => {
      const calculator = componentCalculators[comp.type.toLowerCase() as keyof typeof componentCalculators]
      if (calculator) {
        // Use the branch voltage and current for parallel components
        const result = calculator(comp.properties, branch.voltage, branch.current)
        
        // Store component state
        componentStates.set(comp.id, {
          ...result,
          componentId: comp.id,
          componentType: comp.type,
          position: comp.position
        })
        
        logger.componentState(comp.type, comp.id, branch.voltage, branch.current, result.status)
      }
    })
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
      
      logger.debug(`Wire ${wire.id}: Connected to ${connectedStates.length} components, ${wireVoltage.toFixed(2)}V, ${(wireCurrent * 1000).toFixed(1)}mA`)
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
  const nodes = findCircuitNodes(gridData, connections)
  
  // Log connection information
  logger.debug(`Found ${connections.size} wire connection points and ${nodes.size} circuit nodes`)
  
  const allComponentStates = new Map<string, ComponentState>()
  let globalCircuitCurrent = 0

  // Find parallel resistors first
  const parallelBranches = findParallelResistors(gridData, connections)
  
  powerSources.forEach((source, _sourceIndex) => {
    const branches = findCircuitBranches(source.position, gridData, connections)
    logger.info(`Power source ${source.id}: Found ${branches.length} branches`)

    branches.forEach((branch) => {
      logger.pathwayDetected(branch.map(c => c.id), source.voltage, 0) // Current will be calculated later
      
      const branchStates = processBranch(branch, source.voltage, source.maxCurrent, parallelBranches)
      branchStates.forEach((state, id) => allComponentStates.set(id, state))
      if (branchStates.size > 0 && globalCircuitCurrent === 0) {
        globalCircuitCurrent = Array.from(branchStates.values())[0].outputCurrent
      }
    })
  })

  logger.info(`Total component states: ${allComponentStates.size}`)

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
  maxCurrent: number,
  parallelBranches: ParallelBranch[] = []
): Map<string, ComponentState> {
  const states = new Map<string, ComponentState>()
  if (branch.length === 0) return states

  // Check if the branch connects to ground
  const hasGroundConnection = branch.some(comp => {
    const moduleCell = comp.properties
    return moduleCell?.type === 'GND' || moduleCell?.isGroundable === true
  })

  // If no ground connection, no current flows
  if (!hasGroundConnection) {
    logger.warn(`Circuit: No ground connection - no current flow`)
    return states
  }

  // Compute branch voltage drop & total resistance (including parallel)
  const { totalResistance, totalVoltageDrop, ledCurrentRequirement, motorCurrentRequirement } = calculateCircuitParameters(branch, parallelBranches)
  const effectiveVoltage = Math.max(0, sourceVoltage - totalVoltageDrop)
  const resistorCurrent = totalResistance > 0 ? effectiveVoltage / totalResistance : maxCurrent

  // Current through branch = min(limit by resistor, LED/motor requirement, source)
  const branchCurrent = Math.min(ledCurrentRequirement + motorCurrentRequirement, resistorCurrent, maxCurrent)

  logger.circuitAnalysis(effectiveVoltage, branchCurrent, totalResistance)
  
  // Calculate parallel branch currents
  const updatedParallelBranches = calculateParallelBranchCurrents(parallelBranches, effectiveVoltage)
  
  // Log parallel branch information
  if (updatedParallelBranches.length > 0) {
    logger.info(`Parallel branches in this circuit: ${updatedParallelBranches.length} branches`)
  }

  let currentVoltage = sourceVoltage
  let currentCurrent = branchCurrent

  branch.forEach((comp, _index) => {
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
  
  // Process parallel branch components
  updatedParallelBranches.forEach((branch) => {
    branch.components.forEach((comp) => {
      const calculator = componentCalculators[comp.type.toLowerCase() as keyof typeof componentCalculators]
      if (calculator) {
        // Use the branch voltage and current for parallel components
        const result = calculator(comp.properties, branch.voltage, branch.current)
        
        // Store component state
        states.set(comp.id, {
          ...result,
          componentId: comp.id,
          componentType: comp.type,
          position: comp.position
        })
        
        logger.componentState(comp.type, comp.id, branch.voltage, branch.current, result.status)
      }
    })
  })
  
  return states
}
  