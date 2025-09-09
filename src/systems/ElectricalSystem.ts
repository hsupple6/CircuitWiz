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
import { CalculateCircuit, convertGridToNodes, findCircuitPathways, checkContinuity } from '../services/EMPhysics'
import { extractOccupiedComponents } from '../utils/gridUtils'

export interface ComponentState {
  componentId: string
  componentType: string
  position: { x: number; y: number }
  outputVoltage: number
  outputCurrent: number
  power: number
  status: string
  isPowered: boolean
  isGrounded: boolean
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

export interface CircuitJunction {
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
    const voltage = component.voltage || component.properties?.voltage || 9.0
    return {
      outputVoltage: voltage,
      outputCurrent: inputCurrent,
      power: voltage * inputCurrent,
      status: 'active'
    }
  },
  
  resistor: (component: any, inputVoltage: number, inputCurrent: number) => {
    const resistance = component.resistance || component.properties?.resistance || 1000
    const voltageDrop = inputCurrent * resistance
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
    const forwardVoltage = component.forwardVoltage || component.properties?.forwardVoltage || component.voltage || component.properties?.voltage || 2.0
    const outputVoltage = Math.max(0, inputVoltage - forwardVoltage)
    const isOn = inputVoltage >= forwardVoltage && inputCurrent > 0
    
    // LED power is forward voltage × current (this is the power the LED consumes)
    const ledPower = forwardVoltage * inputCurrent
    
    // Log LED state changes
    if (isOn) {
      logger.components(`LED ${component.id || 'unknown'}: ${inputVoltage}V input, ${inputCurrent}A current, on`)
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
    const voltage = component.voltage || component.properties?.voltage || 5.0
    return {
      outputVoltage: voltage,
      outputCurrent: inputCurrent,
      power: voltage * inputCurrent,
      status: 'active'
    }
  },

  'arduino uno r3': (_component: any, inputVoltage: number, inputCurrent: number) => {
    // Arduino Uno consumes power and provides regulated outputs
    const isPowered = inputVoltage >= 4.5 // Minimum operating voltage
    return {
      outputVoltage: isPowered ? 5.0 : 0, // Regulated 5V output when powered
      outputCurrent: inputCurrent,
      power: isPowered ? 5.0 * inputCurrent : 0,
      status: isPowered ? 'powered' : 'unpowered',
      isPowered
    }
  }
}

/**
 * Find all power sources in the grid
 */
export function findPowerSources(gridData: GridCell[][]): PowerSource[] {
  const powerSources: PowerSource[] = []
  
  console.log('🔍 Finding power sources in grid...')
  
  gridData.forEach((row, y) => {
    if (!row || !Array.isArray(row)) return
    row.forEach((cell, x) => {
      if (cell && cell.occupied && cell.componentId && cell.moduleDefinition) {
        const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
        console.log(`Checking cell at (${x}, ${y}):`, {
          componentId: cell.componentId,
          moduleType: cell.moduleDefinition.module,
          cellType: moduleCell?.type,
          isPowerable: moduleCell?.isPowerable,
          voltage: moduleCell?.voltage,
          pin: moduleCell?.pin
        })
        
        // Only treat actual power source components as power sources, not microcontroller pins
        const isActualPowerSource = cell.moduleDefinition.module === 'PowerSupply' || 
                                   cell.moduleDefinition.module === 'Battery'
        
        if (isActualPowerSource && moduleCell?.isPowerable && moduleCell?.voltage > 0 && 
            (moduleCell.type === 'VCC' || moduleCell.type === 'POSITIVE')) {
          console.log(`✅ Found power source: ${cell.componentId} at (${x}, ${y}) with ${moduleCell.voltage}V`)
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
  
  console.log(`🔍 Found ${powerSources.length} power sources:`, powerSources)
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
): Map<string, CircuitJunction> {
  const nodes = new Map<string, CircuitJunction>()
  
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
    if (!row || !Array.isArray(row)) return
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
      logger.circuit(`Parallel resistors: ${parallelGroup.length} resistors, total resistance: ${calculateParallelResistance(parallelGroup.map(r => r.resistance))}Ω`)
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
  
  logger.circuit(`Circuit analysis: ${effectiveVoltage}V effective, ${circuitCurrent}A current, ${totalResistance}Ω resistance`)
  
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
        position: comp.position,
        isPowered: result.outputVoltage > 0,
        isGrounded: false // Will be updated by wire connections
      })
      
      logger.components(`${comp.type} ${comp.id}: ${currentVoltage}V input, ${result.status}`)
      
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
          position: comp.position,
          isPowered: result.outputVoltage > 0,
          isGrounded: false // Will be updated by wire connections
        })
        
        logger.components(`${comp.type} ${comp.id}: ${branch.voltage}V input, ${result.status}`)
      }
    })
  })
  
  return componentStates
}

/**
 * Analyze the complete circuit to find voltage drops and current flow
 * @deprecated - This function is no longer used as we now use EMPhysics CalculateCircuit
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function analyzeCircuit(
  wires: WireConnection[],
  gridData: GridCell[][],
  gpioStates?: Map<number, any>
): {
  wires: Map<string, { voltage: number; current: number; isPowered: boolean; isGrounded: boolean }>
  components: Map<string, { voltageDrop: number; current: number }>
} {
  console.log('🔍 Analyzing complete circuit...')
  
  const wireAnalysis = new Map<string, { voltage: number; current: number; isPowered: boolean; isGrounded: boolean }>()
  const componentAnalysis = new Map<string, { voltageDrop: number; current: number }>()
  
  // Find all power sources and ground connections
  const powerSources: Array<{ x: number; y: number; voltage: number; type: string }> = []
  const groundConnections: Array<{ x: number; y: number }> = []
  
  // Scan grid for power sources and grounds
  gridData.forEach((row, y) => {
    if (!row || !Array.isArray(row)) return
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.moduleDefinition) {
        const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
        if (moduleCell) {
          // Check for power sources
          if (moduleCell.isPowerable && moduleCell.voltage > 0 && 
              (cell.moduleDefinition.module === 'PowerSupply' || cell.moduleDefinition.module === 'Battery')) {
            powerSources.push({ x, y, voltage: moduleCell.voltage, type: cell.moduleDefinition.module })
          }
          // Check for GPIO pin HIGH state
          else if (moduleCell.type === 'GPIO' || moduleCell.type === 'ANALOG') {
            let pinNumber = parseInt(moduleCell.pin?.replace('D', '').replace('A', '') || '0')
            if (moduleCell.type === 'ANALOG') {
              pinNumber = pinNumber + 100
            }
            const gpioState = gpioStates?.get(pinNumber)
            if (gpioState && gpioState.state === 'HIGH') {
              powerSources.push({ x, y, voltage: 5.0, type: 'GPIO' })
            }
          }
          // Check for ground connections
          if (moduleCell.isGroundable && moduleCell.voltage === 0) {
            groundConnections.push({ x, y })
          }
        }
      }
    })
  })
  
  console.log('🔍 Found power sources:', powerSources)
  console.log('🔍 Found ground connections:', groundConnections)
  console.log('🔍 Total wires to analyze:', wires.length)
  
  // For each power source, trace the circuit path
  powerSources.forEach(powerSource => {
    console.log(`🔍 Tracing circuit from power source at (${powerSource.x}, ${powerSource.y})`)
    
    // Find wires connected to this power source
    const connectedWires = wires.filter(wire => 
      wire.segments.some(segment => 
        (segment.from.x === powerSource.x && segment.from.y === powerSource.y) ||
        (segment.to.x === powerSource.x && segment.to.y === powerSource.y)
      )
    )
    
    console.log(`🔍 Found ${connectedWires.length} wires connected to power source:`, connectedWires.map(w => w.id))
    
    // Trace each connected wire
    connectedWires.forEach(wire => {
      console.log(`🔍 Tracing wire ${wire.id}`)
      
      // Find the path from this wire to ground
      const circuitPath = findCircuitPath(wire, wires, gridData, groundConnections)
      console.log(`🔍 Circuit path for wire ${wire.id}:`, circuitPath.length, 'steps')
      if (circuitPath.length > 0) {
        console.log(`🔍 Path details:`, circuitPath.map(step => ({ type: step.type, hasComponent: !!step.component, hasWire: !!step.wire })))
      }
      
      if (circuitPath.length > 0) {
        // Calculate total resistance of the circuit
        let totalResistance = 0
        
        circuitPath.forEach((step) => {
          if (step.type === 'component') {
            const component = step.component
            const moduleType = component.moduleDefinition.module
            
            if (moduleType === 'Resistor') {
              const resistance = component.moduleDefinition.grid[component.cellIndex || 0]?.resistance || 
                                component.moduleDefinition.properties?.resistance || 1000
              totalResistance += resistance
              console.log(`🔍 Resistor in path: ${resistance}Ω`)
            } else if (moduleType === 'LED') {
              const forwardVoltage = component.moduleDefinition.grid[component.cellIndex || 0]?.voltage || 
                                   component.moduleDefinition.properties?.forwardVoltage || 2.0
              const maxCurrent = component.moduleDefinition.grid[component.cellIndex || 0]?.current || 
                                component.moduleDefinition.properties?.maxCurrent || 0.02
              const ledResistance = forwardVoltage / maxCurrent
              totalResistance += ledResistance
              console.log(`🔍 LED in path: ${ledResistance}Ω, forward voltage: ${forwardVoltage}V`)
            }
          }
        })
        
        // Calculate circuit current using the original source voltage
        const circuitCurrent = totalResistance > 0 ? powerSource.voltage / totalResistance : 0
        console.log(`🔍 Circuit current: ${powerSource.voltage}V / ${totalResistance}Ω = ${circuitCurrent}A`)
        
        // Calculate voltage at each point in the circuit
        let voltageAtPoint = powerSource.voltage
        
        // Update wire analysis for the starting wire
        wireAnalysis.set(wire.id, {
          voltage: voltageAtPoint,
          current: circuitCurrent,
          isPowered: true,
          isGrounded: circuitPath.some(step => step.type === 'ground')
        })
        
        // Calculate voltage drops across each component and update subsequent wires
        circuitPath.forEach((step) => {
          if (step.type === 'component') {
            const component = step.component
            const moduleType = component.moduleDefinition.module
            
            if (moduleType === 'Resistor') {
              const resistance = component.moduleDefinition.grid[component.cellIndex || 0]?.resistance || 
                                component.moduleDefinition.properties?.resistance || 1000
              const voltageDrop = circuitCurrent * resistance
              voltageAtPoint -= voltageDrop
              console.log(`🔍 Resistor voltage drop: ${voltageDrop}V, remaining voltage: ${voltageAtPoint}V`)
            } else if (moduleType === 'LED') {
              const forwardVoltage = component.moduleDefinition.grid[component.cellIndex || 0]?.voltage || 
                                   component.moduleDefinition.properties?.forwardVoltage || 2.0
              voltageAtPoint -= forwardVoltage
              console.log(`🔍 LED voltage drop: ${forwardVoltage}V, remaining voltage: ${voltageAtPoint}V`)
            }
            
            // Find the next wire connected to this component
            const nextWire = findNextWireInPath(step, circuitPath, 0, wires)
            if (nextWire) {
              wireAnalysis.set(nextWire.id, {
                voltage: voltageAtPoint,
                current: circuitCurrent,
                isPowered: true,
                isGrounded: circuitPath.some(step => step.type === 'ground')
              })
              console.log(`🔍 Updated wire ${nextWire.id} with voltage: ${voltageAtPoint}V`)
            }
          }
        })
      }
    })
  })
  
  return { wires: wireAnalysis, components: componentAnalysis }
}

/**
 * Find the next wire in the circuit path after a component
 */
function findNextWireInPath(
  _currentStep: { type: 'wire' | 'component' | 'ground'; wire?: WireConnection; component?: any; position?: { x: number; y: number } },
  circuitPath: Array<{ type: 'wire' | 'component' | 'ground'; wire?: WireConnection; component?: any; position?: { x: number; y: number } }>,
  currentIndex: number,
  _allWires: WireConnection[]
): WireConnection | null {
  // Look for the next wire in the path after this component
  for (let i = currentIndex + 1; i < circuitPath.length; i++) {
    const nextStep = circuitPath[i]
    if (nextStep.type === 'wire' && nextStep.wire) {
      return nextStep.wire
    }
  }
  return null
}

/**
 * Find the circuit path from a wire to ground
 */
function findCircuitPath(
  startWire: WireConnection,
  allWires: WireConnection[],
  gridData: GridCell[][],
  groundConnections: Array<{ x: number; y: number }>
): Array<{ type: 'wire' | 'component' | 'ground'; wire?: WireConnection; component?: any; position?: { x: number; y: number } }> {
  const path: Array<{ type: 'wire' | 'component' | 'ground'; wire?: WireConnection; component?: any; position?: { x: number; y: number } }> = []
  const visited = new Set<string>()
  
  function traceFromWire(wire: WireConnection): boolean {
    if (visited.has(wire.id)) return false
    visited.add(wire.id)
    path.push({ type: 'wire', wire })
    
    // Check if this wire connects to ground
    for (const segment of wire.segments) {
      for (const ground of groundConnections) {
        if ((segment.from.x === ground.x && segment.from.y === ground.y) ||
            (segment.to.x === ground.x && segment.to.y === ground.y)) {
          path.push({ type: 'ground', position: ground })
          return true
        }
      }
    }
    
    // Find components connected to this wire
    for (const segment of wire.segments) {
      const fromCell = gridData[segment.from.y]?.[segment.from.x]
      const toCell = gridData[segment.to.y]?.[segment.to.x]
      
      if (fromCell?.occupied && fromCell.moduleDefinition) {
        const moduleType = fromCell.moduleDefinition.module
        if (moduleType === 'Resistor' || moduleType === 'LED') {
          path.push({ type: 'component', component: fromCell })
          
          // Find other wires connected to this component
          const otherWires = allWires.filter(otherWire => 
            otherWire.id !== wire.id &&
            otherWire.segments.some(otherSegment =>
              (otherSegment.from.x === segment.from.x && otherSegment.from.y === segment.from.y) ||
              (otherSegment.to.x === segment.from.x && otherSegment.to.y === segment.from.y)
            )
          )
          
          for (const otherWire of otherWires) {
            if (traceFromWire(otherWire)) {
              return true
            }
          }
        }
      }
      
      if (toCell?.occupied && toCell.moduleDefinition) {
        const moduleType = toCell.moduleDefinition.module
        if (moduleType === 'Resistor' || moduleType === 'LED') {
          path.push({ type: 'component', component: toCell })
          
          // Find other wires connected to this component
          const otherWires = allWires.filter(otherWire => 
            otherWire.id !== wire.id &&
            otherWire.segments.some(otherSegment =>
              (otherSegment.from.x === segment.to.x && otherSegment.from.y === segment.to.y) ||
              (otherSegment.to.x === segment.to.x && otherSegment.to.y === segment.to.y)
            )
          )
          
          for (const otherWire of otherWires) {
            if (traceFromWire(otherWire)) {
              return true
            }
          }
        }
      }
    }
    
    return false
  }
  
  traceFromWire(startWire)
  return path
}

/**
 * SYSTEMATIC VOLTAGE CALCULATION APPROACH
 * 
 * This function implements the systematic approach where:
 * 1. Components calculate their output voltage based on input voltage from connected wires
 * 2. Wires inherit voltage from component output voltages
 * 3. Voltage flows systematically through the circuit path
 */
export function calculateSystematicVoltageFlow(
  gridData: GridCell[][],
  wires: WireConnection[],
  gpioStates?: Map<number, any>
): {
  componentStates: Map<string, ComponentState>
  updatedWires: WireConnection[]
} {
  logger.electrical('Starting systematic voltage calculation...')
  logger.electricalDebug(`Grid data: ${gridData.length} rows`)
  logger.electricalDebug(`Wires: ${wires.length} wires`)
  
  // Step 1: Initialize component states
  const componentStates = new Map<string, ComponentState>()
  
  // Find all components in the grid
  gridData.forEach((row, y) => {
    if (!row || !Array.isArray(row)) return
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
        const componentId = cell.componentId
        const moduleType = cell.moduleDefinition.module
        
        // Create unique component state ID for each cell of multi-cell components
        const cellComponentId = `${componentId}-${cell.cellIndex || 0}`
        
        // Initialize component state
        let componentState: ComponentState = {
          componentId: cellComponentId, // Use unique cell ID
          componentType: moduleType,
          position: { x, y },
          outputVoltage: 0,
          outputCurrent: 0,
          power: 0,
          status: 'unpowered',
          isPowered: false,
          isGrounded: false
        }
        
        // Set initial voltage for power sources
        if (moduleType === 'PowerSupply' || moduleType === 'Battery') {
          const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
          if (moduleCell?.isPowerable && moduleCell.voltage > 0) {
            componentState.outputVoltage = moduleCell.voltage
            componentState.isPowered = true
            componentState.status = 'active'
            console.log(`🔋 Power source ${cellComponentId}: ${componentState.outputVoltage}V`)
          }
        }
        
        componentStates.set(cellComponentId, componentState)
      }
    })
  })
  
  // Step 2: Calculate circuit current using EMPhysics
  const occupiedComponents = extractOccupiedComponents(gridData)
  console.log(`🔧 Found ${occupiedComponents.length} occupied components`)
  let resistorCount = 0
  occupiedComponents.forEach(comp => {
    console.log(`🔧 Component: ${comp.componentId} (${comp.moduleDefinition.module}) at (${comp.x}, ${comp.y})`)
    if (comp.moduleDefinition.module === 'Resistor') {
      resistorCount++
      console.log(`🔧 RESISTOR IN OCCUPIED COMPONENTS: ${comp.componentId}`)
    }
  })
  console.log(`🔧 Resistors in occupied components: ${resistorCount}`)
  
  const nodes = convertGridToNodes(gridData, wires)
  const hasContinuity = checkContinuity(nodes, wires)
  const physicsResult = CalculateCircuit(nodes, wires, hasContinuity)
  
  if (!physicsResult.works) {
    console.warn('⚠️ Circuit calculation failed:', physicsResult.reason)
    return { componentStates, updatedWires: wires }
  }
  
  const circuitCurrent = physicsResult.current || 0
  console.log(`⚡ Circuit current: ${circuitCurrent}A (${circuitCurrent * 1000}mA)`)
  console.log(`📊 Physics result:`, physicsResult)
  
  // Step 3: Systematic voltage flow calculation
  // Find power sources and trace voltage through circuit paths
  const powerSources = Array.from(componentStates.values()).filter(comp => 
    comp.componentType === 'PowerSupply' && comp.isPowered
  )
  
  // Only process the first power source to avoid multiple pathways
  if (powerSources.length > 0) {
    const powerSource = powerSources[0]
    console.log(`[VOLTAGE TRACE] Using only first power source: ${powerSource.componentId} to avoid multiple pathways`)
    
    logger.electrical(`Tracing voltage from power source ${powerSource.componentId}: ${powerSource.outputVoltage}V at (${powerSource.position.x}, ${powerSource.position.y})`)
    
    // Find wires connected to this power source
    const connectedWires = wires.filter(wire => 
      wire.segments.some(segment => 
        (segment.from.x === powerSource.position.x && segment.from.y === powerSource.position.y) ||
        (segment.to.x === powerSource.position.x && segment.to.y === powerSource.position.y)
      )
    )
    
    console.log(`[POWER SOURCE] ${powerSource.componentId} connected to wires:`, connectedWires.map(w => `${w.id} (${w.voltage}V)`))
    console.log(`[POWER SOURCE] Wire details:`, connectedWires.map(w => `${w.id}: ${w.segments.map(s => `(${s.from.x},${s.from.y})→(${s.to.x},${s.to.y})`).join(', ')}`))
    
    logger.wires(`Found ${connectedWires.length} wires connected to power source ${powerSource.componentId}`)
    connectedWires.forEach(wire => {
      logger.wiresDebug(`Connected wire: ${wire.id}`)
    })
    
    connectedWires.forEach(wire => {
      logger.wires(`Tracing wire ${wire.id} from power source`)
      logger.wiresDebug(`Wire ${wire.id} segments:`, wire.segments.map(s => `(${s.from.x},${s.from.y}) -> (${s.to.x},${s.to.y})`))
      
      // Set initial wire voltage from power source
      let currentVoltage = powerSource.outputVoltage
      
      // Trace through the circuit path
      const result = traceVoltageThroughCircuit(
        wire,
        currentVoltage,
        circuitCurrent,
        componentStates,
        wires,
        gridData
      )
      
      // Update component states with calculated voltages
      result.componentUpdates.forEach((update, componentId) => {
        const existingState = componentStates.get(componentId)
        if (existingState) {
          componentStates.set(componentId, {
            ...existingState,
            ...update
          })
        }
      })
      
      // Update wire voltage based on the traced voltage
      const wireIndex = wires.findIndex(w => w.id === wire.id)
      if (wireIndex !== -1) {
        wires[wireIndex] = {
          ...wires[wireIndex],
          voltage: currentVoltage
        }
        console.log(`🔌 Updated wire ${wire.id} voltage to ${currentVoltage}V`)
        console.log(`🔌 Wire ${wire.id} segments:`, wire.segments.map(s => `(${s.from.x},${s.from.y})→(${s.to.x},${s.to.y})`))
      }
    })
  }
  
  // Step 3.5: Post-processing is no longer needed since we handle multi-cell components
  // directly in the voltage tracing phase
  
  // Step 4: Wire voltage inheritance will happen after resistor synchronization

  // Step 5: Update component voltages based on connected wire voltages
  const updatedComponentStates = new Map(componentStates)
  
  updatedComponentStates.forEach((state, componentId) => {
    // Find wires connected to this component
    const connectedWires = wires.filter(wire => 
      wire.segments.some(segment => {
        const fromCell = gridData[segment.from.y]?.[segment.from.x]
        const toCell = gridData[segment.to.y]?.[segment.to.x]
        
        // Check if this component is connected to this wire (check base component ID)
        const fromBaseComponentId = fromCell?.occupied ? fromCell.componentId : null
        const toBaseComponentId = toCell?.occupied ? toCell.componentId : null
        const baseComponentId = componentId.replace(/-\d+$/, '') // Remove cell index
        
        return fromBaseComponentId === baseComponentId || toBaseComponentId === baseComponentId
      })
    )
    
    console.log(`🔍 ${state.componentType} ${componentId} at (${state.position.x}, ${state.position.y}) connected to ${connectedWires.length} wires:`, 
      connectedWires.map(w => `${w.id}(${w.voltage}V)`))
    
    if (connectedWires.length > 0) {
      // Find the wire with the highest voltage (input voltage)
      const maxVoltageWire = connectedWires.reduce((max, wire) => 
        (wire.voltage || 0) > (max.voltage || 0) ? wire : max
      )
      
      const inputVoltage = maxVoltageWire.voltage || 0
      
      console.log(`📊 ${state.componentType} ${componentId} input voltage: ${inputVoltage}V from wire ${maxVoltageWire.id}`)
      console.log(`📊 DEBUG: Wire ${maxVoltageWire.id} voltage: ${maxVoltageWire.voltage}V, segments:`, maxVoltageWire.segments.map(s => `(${s.from.x},${s.from.y})→(${s.to.x},${s.to.y})`))
      
      // Only recalculate if this component isn't a power source
      if (state.componentType !== 'PowerSupply' && state.componentType !== 'Battery') {
        // Recalculate component voltage using the input voltage from wires
        const calculator = componentCalculators[state.componentType.toLowerCase() as keyof typeof componentCalculators]
        if (calculator) {
          // Get component properties from grid data
          const cell = gridData[state.position.y]?.[state.position.x]
          let componentProperties = {}
          
          if (state.componentType === 'Resistor') {
            componentProperties = { resistance: cell?.resistance || 1000 }
            console.log(`🔧 Resistor ${componentId} properties:`, componentProperties)
          } else if (state.componentType === 'LED') {
            componentProperties = { 
              forwardVoltage: cell?.moduleDefinition?.properties?.forwardVoltage?.default || 2.0 
            }
            console.log(`🔧 LED ${componentId} properties:`, componentProperties)
            
            const result = calculator(componentProperties, inputVoltage, circuitCurrent)
            
            console.log(`🧮 ${state.componentType} ${componentId} calculation: ${inputVoltage}V input → ${result.outputVoltage}V output (current: ${circuitCurrent}A)`)
            
            // For LEDs, we need to process ALL cells of the component (like resistors)
            const baseComponentId = componentId.replace(/-\d+$/, '')
            
            // Find all cells of this LED component
            const allLedCells: Array<{id: string, position: {x: number, y: number}, cellIndex: number}> = []
            
            // Search the grid for all cells belonging to this LED
            for (let y = 0; y < gridData.length; y++) {
              for (let x = 0; x < gridData[y].length; x++) {
                const gridCell = gridData[y][x]
                if (gridCell?.occupied && gridCell.componentId === baseComponentId) {
                  const cellId = `${baseComponentId}-${gridCell.cellIndex || 0}`
                  allLedCells.push({
                    id: cellId,
                    position: { x, y },
                    cellIndex: gridCell.cellIndex || 0
                  })
                }
              }
            }
            
            console.log(`🔧 Found ${allLedCells.length} cells for LED ${baseComponentId}:`, allLedCells.map(c => c.id))
            
            // Update ALL cells of this LED with the same calculation result
            allLedCells.forEach(ledCell => {
              updatedComponentStates.set(ledCell.id, {
                ...state,
                outputVoltage: result.outputVoltage,
                outputCurrent: result.outputCurrent,
                power: result.power,
                status: result.status,
                isPowered: result.outputVoltage > 0,
                isOn: (result as any).isOn,
                forwardVoltage: (result as any).forwardVoltage
              })
              console.log(`🔧 Updated LED cell ${ledCell.id}: ${inputVoltage}V → ${result.outputVoltage}V (${result.status})`)
            })
            
            return // Skip the single cell update below since we handled all cells above
          }
          
          const result = calculator(componentProperties, inputVoltage, circuitCurrent)
          
          console.log(`🧮 ${state.componentType} ${componentId} calculation: ${inputVoltage}V input → ${result.outputVoltage}V output (current: ${circuitCurrent}A)`)
          
          // Update component state with new calculation
          updatedComponentStates.set(componentId, {
            ...state,
            outputVoltage: result.outputVoltage,
            outputCurrent: result.outputCurrent,
            power: result.power,
            status: result.status,
            isPowered: result.outputVoltage > 0
          })
          
          console.log(`🔧 Updated ${state.componentType} ${componentId}: ${inputVoltage}V → ${result.outputVoltage}V`)
        }
      }
    }
  })

  
  // Post-processing: Ensure all resistor and LED cells have matching voltages
  const resistorGroups = new Map<string, Array<{id: string, state: ComponentState}>>()
  const ledGroups = new Map<string, Array<{id: string, state: ComponentState}>>()
  
  // Group resistor and LED cells by base component ID
  updatedComponentStates.forEach((state, componentId) => {
    if (state.componentType === 'Resistor') {
      const baseComponentId = componentId.replace(/-\d+$/, '')
      if (!resistorGroups.has(baseComponentId)) {
        resistorGroups.set(baseComponentId, [])
      }
      resistorGroups.get(baseComponentId)!.push({ id: componentId, state })
    } else if (state.componentType === 'LED') {
      const baseComponentId = componentId.replace(/-\d+$/, '')
      if (!ledGroups.has(baseComponentId)) {
        ledGroups.set(baseComponentId, [])
      }
      ledGroups.get(baseComponentId)!.push({ id: componentId, state })
    }
  })
  
  // For each resistor group, ensure all cells have the same voltage as cell -0
  resistorGroups.forEach((resistorCells, baseComponentId) => {
    const cell0 = resistorCells.find(cell => cell.id.endsWith('-0'))
    if (cell0 && cell0.state.outputVoltage > 0) {
      const targetVoltage = cell0.state.outputVoltage
      console.log(`🔧 Synchronizing resistor ${baseComponentId}: setting all cells to ${targetVoltage}V`)
      
      resistorCells.forEach(cell => {
        if (cell.state.outputVoltage !== targetVoltage) {
          console.log(`🔧 Updating ${cell.id} from ${cell.state.outputVoltage}V to ${targetVoltage}V`)
          updatedComponentStates.set(cell.id, {
            ...cell.state,
            outputVoltage: targetVoltage,
            isPowered: targetVoltage > 0,
            status: targetVoltage > 0 ? 'active' : 'unpowered'
          })
        }
      })
    }
  })
  
  // For each LED group, ensure all cells have the same status and isPowered as cell -0
  ledGroups.forEach((ledCells, baseComponentId) => {
    const cell0 = ledCells.find(cell => cell.id.endsWith('-0'))
    if (cell0) {
      const targetStatus = cell0.state.status
      const targetIsPowered = cell0.state.isPowered
      const targetIsOn = cell0.state.isOn
      console.log(`🔧 Synchronizing LED ${baseComponentId}: setting all cells to status=${targetStatus}, isPowered=${targetIsPowered}, isOn=${targetIsOn}`)
      
      ledCells.forEach(cell => {
        if (cell.state.status !== targetStatus || cell.state.isPowered !== targetIsPowered || cell.state.isOn !== targetIsOn) {
          console.log(`🔧 Updating ${cell.id} from status=${cell.state.status}, isPowered=${cell.state.isPowered} to status=${targetStatus}, isPowered=${targetIsPowered}`)
          updatedComponentStates.set(cell.id, {
            ...cell.state,
            status: targetStatus,
            isPowered: targetIsPowered,
            isOn: targetIsOn
          })
        }
      })
    }
  })
  
  // Step 6: Update wires with inherited voltages from synchronized components
  console.log('🔌 Starting wire voltage inheritance...')
  const updatedWires = wires.map(wire => {
    let wireVoltage = 0
    let isPowered = false
    let isGrounded = false
    
    console.log(`🔌 Processing wire ${wire.id}...`)
    
    // Find components connected to this wire by checking grid data
    const connectedComponents: ComponentState[] = []
    
    wire.segments.forEach(segment => {
      // Check both from and to positions for connected components
      const fromCell = gridData[segment.from.y]?.[segment.from.x]
      const toCell = gridData[segment.to.y]?.[segment.to.x]
      
      // Find component state for from position
      if (fromCell?.occupied && fromCell.componentId) {
        const cellComponentId = `${fromCell.componentId}-${fromCell.cellIndex || 0}`
        const fromComponent = updatedComponentStates.get(cellComponentId)
        if (fromComponent) {
          connectedComponents.push(fromComponent)
          console.log(`🔍 Wire ${wire.id} connects from ${fromComponent.componentType} at (${segment.from.x}, ${segment.from.y}) with ${fromComponent.outputVoltage}V`)
        }
      }
      
      // Find component state for to position
      if (toCell?.occupied && toCell.componentId) {
        const cellComponentId = `${toCell.componentId}-${toCell.cellIndex || 0}`
        const toComponent = updatedComponentStates.get(cellComponentId)
        if (toComponent) {
          connectedComponents.push(toComponent)
          console.log(`🔍 Wire ${wire.id} connects to ${toComponent.componentType} at (${segment.to.x}, ${segment.to.y}) with ${toComponent.outputVoltage}V`)
        }
      }
    })
    
    // Wire inherits voltage from component with highest output voltage
    console.log(`🔌 Wire ${wire.id} found ${connectedComponents.length} connected components`)
    if (connectedComponents.length > 0) {
      const maxVoltageComponent = connectedComponents.reduce((max, comp) => 
        (comp.outputVoltage || 0) > (max.outputVoltage || 0) ? comp : max
      )
      
      wireVoltage = maxVoltageComponent.outputVoltage || 0
      isPowered = maxVoltageComponent.isPowered || false
      isGrounded = connectedComponents.some(comp => comp.isGrounded)
      
      console.log(`🔌 Wire ${wire.id} inherits ${wireVoltage}V from ${maxVoltageComponent.componentType} (connected to ${connectedComponents.length} components: ${connectedComponents.map(c => `${c.componentType}(${c.outputVoltage}V)`).join(', ')})`)
    } else {
      console.log(`🔌 Wire ${wire.id} has no connected components, keeping 0V`)
    }
    
    return {
      ...wire,
      voltage: wireVoltage,
      current: circuitCurrent,
      power: wireVoltage * circuitCurrent,
      isPowered,
      isGrounded,
      isPowerable: isPowered,
      isGroundable: isGrounded,
      segments: wire.segments.map(segment => ({
        ...segment,
        isPowered,
        isGrounded,
        voltage: wireVoltage,
        current: circuitCurrent
      }))
    }
  })
  
  console.log('✅ Systematic voltage calculation complete')
  return { componentStates: updatedComponentStates, updatedWires }
}

/**
 * Trace voltage through a circuit path starting from a wire
 * This implements the systematic approach: Component input voltage → Component calculation → Component output voltage → Wire voltage
 */
function traceVoltageThroughCircuit(
  startWire: WireConnection,
  initialVoltage: number,
  circuitCurrent: number,
  componentStates: Map<string, ComponentState>,
  wires: WireConnection[],
  gridData: GridCell[][]
): {
  componentUpdates: Map<string, Partial<ComponentState>>
} {
  const componentUpdates = new Map<string, Partial<ComponentState>>()
  let currentVoltage = initialVoltage
  const visitedComponents = new Set<string>()
  
  logger.electricalDebug(`Starting voltage trace from ${initialVoltage}V`)
  console.log(`[VOLTAGE TRACE START] Wire ${startWire.id} starting with ${initialVoltage}V`)
  console.log(`[VOLTAGE TRACE START] Wire segments:`, startWire.segments.map(s => `(${s.from.x},${s.from.y})→(${s.to.x},${s.to.y})`))
  
  // Find the destination of the start wire (where it connects to a component)
  const wireDestination = findWireDestination(startWire, gridData)
  if (!wireDestination) {
    logger.wires(`Could not find destination for wire ${startWire.id}`)
    logger.wiresDebug(`Wire segments:`, startWire.segments.map(s => `(${s.from.x},${s.from.y}) -> (${s.to.x},${s.to.y})`))
    return { componentUpdates }
  }
  
  console.log(`[WIRE DESTINATION] Wire ${startWire.id} destination: (${wireDestination.x}, ${wireDestination.y})`)
  
  logger.wiresDebug(`Wire ${startWire.id} connects to component at (${wireDestination.x}, ${wireDestination.y})`)
  
  // Find the component at the destination
  const component = findComponentAtPosition(wireDestination, gridData)
  if (!component) {
    logger.componentsError(`No component found at destination (${wireDestination.x}, ${wireDestination.y})`)
    return { componentUpdates }
  }
  
  console.log(`[COMPONENT FOUND] At (${wireDestination.x}, ${wireDestination.y}): ${component.componentId} (${component.moduleDefinition.module})`)
  
  logger.componentsDebug(`Found component at destination: ${component.componentId} (${component.moduleDefinition.module}) at (${component.x}, ${component.y})`)
  // Trace voltage through this component and continue the path
  const result = traceVoltageThroughComponent(
    component,
    currentVoltage,
    circuitCurrent,
    componentUpdates,
    visitedComponents,
    wires,
    gridData
  )
  
  return { componentUpdates: result.componentUpdates }
}

/**
 * Trace voltage through a single component and continue to connected components
 */
function traceVoltageThroughComponent(
  component: any,
  inputVoltage: number,
  circuitCurrent: number,
  componentUpdates: Map<string, Partial<ComponentState>>,
  visitedComponents: Set<string>,
  wires: WireConnection[],
  gridData: GridCell[][]
): {
  componentUpdates: Map<string, Partial<ComponentState>>
} {
  const componentId = component.componentId
  const moduleType = component.moduleDefinition.module
  console.log(`🔍 [TRACE START] Processing component: ${componentId}, moduleType: "${moduleType}"`)
  logger.componentsDebug(`[MODULE TYPE] ${moduleType}`)
  logger.componentsDebug(`[COMPONENT ID] ${componentId}`)
  
  // Create cell-specific ID for visited check (consistent with recursive calls)
  const cellComponentId = `${componentId}-${component.cellIndex || 0}`
  
  // Avoid infinite loops
  if (visitedComponents.has(cellComponentId)) {
    logger.componentsWarn(`Component ${cellComponentId} already visited, skipping`)
    return { componentUpdates }
  }
  
  visitedComponents.add(cellComponentId)
  logger.components(`Processing ${moduleType} ${componentId} with input voltage ${inputVoltage}V`)
  console.log(`🔍 [VOLTAGE TRACE] Processing ${moduleType} ${componentId} at (${component.x}, ${component.y}) with input voltage ${inputVoltage}V and circuit current ${circuitCurrent}A`)
  console.log(`🔍 [VOLTAGE TRACE] Component cellIndex: ${component.cellIndex}, cellComponentId: ${cellComponentId}`)
  
  // Debug: Check if this is a resistor
  if (moduleType === 'Resistor') {
    logger.componentsDebug(`[RESISTOR DEBUG] Found resistor component: ${componentId}`)
  }
  
  // Calculate component output voltage based on input voltage and circuit current
  let outputVoltage = 0
  let isPowered = false
  let status = 'unpowered'
  
  if (moduleType === 'Resistor') {
    console.log(`🔍 [BRANCH] Taking Resistor branch for ${componentId}`)
    const resistance = component.moduleDefinition.grid[component.cellIndex || 0]?.resistance || 
                      component.moduleDefinition.properties?.resistance || 1000
    const voltageDrop = circuitCurrent * resistance
    outputVoltage = Math.max(0, inputVoltage - voltageDrop)
    isPowered = outputVoltage > 0
    status = isPowered ? 'active' : 'unpowered'
    
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
  } else if (moduleType === 'LED') {
    console.log('[INPUT] ', inputVoltage)
    
    // Calculate LED voltage drop properly in voltage trace
    // Don't override inputVoltage - use what was passed in
    const forwardVoltage = component.moduleDefinition.grid[component.cellIndex || 0]?.voltage || 
                          component.moduleDefinition.properties?.forwardVoltage?.default
    
    // For voltage tracing, LED inherits the input voltage directly
    // The voltage drop is applied to the NEXT component, not this one
    outputVoltage = Math.max(0, inputVoltage - forwardVoltage)
    const isOn = inputVoltage >= forwardVoltage && circuitCurrent > 0
    isPowered = inputVoltage > 0
    status = isOn ? 'on' : 'off'

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
        componentUpdates.set(cell.id, {
          componentId: cell.id,  // Use the correct cell ID
          outputVoltage,
          outputCurrent: circuitCurrent,
          power: forwardVoltage * circuitCurrent,
          forwardVoltage,
          isOn,
          status,
          isPowered,
          isGrounded: inputVoltage > 0
        })
        logger.componentsDebug(`[LED SYNC] Updated cell ${cell.id} at (${cell.position.x}, ${cell.position.y}) to ${outputVoltage}V`)
        console.log('[LED DEBUG] Set ', cell.id, ' with status: ', status)
      })

    
    // Debug: Check what's actually in componentUpdates
    console.log(`🔧 [LED DEBUG] componentUpdates size: ${componentUpdates.size}`)
    console.log(`🔧 [LED DEBUG] componentUpdates keys:`, Array.from(componentUpdates.keys()))
    
    console.log('[LED DEBUG] All cells updated:', allLedCells.map(cell => `${cell.id}: ${componentUpdates.get(cell.id)?.status}`))
    
  } else if (moduleType === 'PowerSupply' || moduleType === 'Battery') {
    // Power sources maintain their voltage
    outputVoltage = inputVoltage
    isPowered = true
    status = 'active'
    
    console.log(`🔧 Power source ${componentId}: maintains ${outputVoltage}V`)
    
    componentUpdates.set(componentId, {
      outputVoltage,
      outputCurrent: circuitCurrent,
      power: outputVoltage * circuitCurrent,
      status,
      isPowered,
      isGrounded: false
    })
  }
  
  // Find the other terminal of this component and continue tracing
  const otherTerminal = findOtherTerminal(component, gridData)
  if (otherTerminal) {
    console.log(`🔗 Component ${componentId} has other terminal at (${otherTerminal.x}, ${otherTerminal.y})`)
    
    // Find wires connected to the other terminal
    const connectedWires = wires.filter(wire => 
      wire.segments.some(segment => 
        (segment.from.x === otherTerminal.x && segment.from.y === otherTerminal.y) ||
        (segment.to.x === otherTerminal.x && segment.to.y === otherTerminal.y)
      )
    )
    
    console.log(`[TERMINAL CONNECTIONS] Component ${componentId} terminal at (${otherTerminal.x}, ${otherTerminal.y}) connected to wires:`, connectedWires.map(w => `${w.id} (${w.voltage}V)`))
    
    // Find the wire with the highest voltage to continue tracing
    if (connectedWires.length > 0) {
      const highestVoltageWire = connectedWires.reduce((highest, current) => 
        current.voltage > highest.voltage ? current : highest
      )

      console.log('[WIRES]', connectedWires.map(w => `${w.id} (${w.voltage}V)`))
      
      console.log(`[RECURSIVE TRACE] 🔗 Continuing trace through highest voltage wire ${highestVoltageWire.id} (${highestVoltageWire.voltage}V)`)
      
      // Find the next component connected to this wire
      const nextDestination = findWireDestination(highestVoltageWire, gridData, otherTerminal)
      if (nextDestination) {
        const nextComponent = findComponentAtPosition(nextDestination, gridData)
        // Find the wire connected to the next component
        const connectedWire = wires.find(wire => 
          wire.segments.some(segment => 
            (segment.from.x === nextComponent.x && segment.from.y === nextComponent.y) ||
            (segment.to.x === nextComponent.x && segment.to.y === nextComponent.y)
          )
        )
        if (nextComponent) {
          // Create cell-specific ID for visited check
          const nextComponentCellId = `${nextComponent.componentId}-${nextComponent.cellIndex || 0}`
          if (!visitedComponents.has(nextComponentCellId)) {
            // Recursively trace through the next component
            console.log(`[RECURSIVE TRACE] Passing ${highestVoltageWire.voltage}V from ${componentId} to ${nextComponent.componentId} via wire ${highestVoltageWire.id}`)
            console.log('[VISITED COMPONENTS]', visitedComponents)
            if (nextComponent.moduleDefinition.module === 'LED') {
              console.log('[LED DEBUG] Passing voltage to LED', nextComponent.x, nextComponent.y, connectedWire?.id, 'from ', componentId)
              console.log('[LED DEBUG] Connected wire:', connectedWire?.id, 'voltage:', connectedWire?.voltage)
            }
            const nextResult = traceVoltageThroughComponent(
              nextComponent,
              connectedWire?.voltage || 0, // Use the highest voltage wire's voltage
              circuitCurrent,
              componentUpdates,
              visitedComponents,
              wires,
              gridData
            )
            
            // Merge component updates
            nextResult.componentUpdates.forEach((update, compId) => {
              componentUpdates.set(compId, update)
            })
          }
        }
      }
    }
  }
  
  return { componentUpdates }
}

/**
 * Find the destination of a wire (where it connects to a component)
 */
function findWireDestination(wire: WireConnection, gridData: GridCell[][], excludePosition?: { x: number; y: number }): { x: number; y: number } | null {
  for (const segment of wire.segments) {
    // Check if segment connects to a component
    const fromCell = gridData[segment.from.y]?.[segment.from.x]
    const toCell = gridData[segment.to.y]?.[segment.to.x]
    
    if (fromCell?.occupied && (!excludePosition || (segment.from.x !== excludePosition.x || segment.from.y !== excludePosition.y))) {
      return { x: segment.from.x, y: segment.from.y }
    }
    
    if (toCell?.occupied && (!excludePosition || (segment.to.x !== excludePosition.x || segment.to.y !== excludePosition.y))) {
      return { x: segment.to.x, y: segment.to.y }
    }
  }
  
  return null
}

/**
 * Find component at a specific position
 */
function findComponentAtPosition(position: { x: number; y: number }, gridData: GridCell[][]): any | null {
  const cell = gridData[position.y]?.[position.x]
  if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
    // Find the base position of the component (cellIndex 0)
    const basePosition = findComponentBasePosition(cell.componentId, gridData)
    
    return {
      componentId: cell.componentId,
      moduleDefinition: cell.moduleDefinition,
      cellIndex: cell.cellIndex,
      x: basePosition.x,
      y: basePosition.y
    }
  }
  return null
}

/**
 * Find the base position (cellIndex 0) of a component
 */
function findComponentBasePosition(componentId: string, gridData: GridCell[][]): { x: number; y: number } {
  for (let y = 0; y < gridData.length; y++) {
    for (let x = 0; x < gridData[y].length; x++) {
      const cell = gridData[y][x]
      if (cell?.occupied && cell.componentId === componentId && cell.cellIndex === 0) {
        return { x, y }
      }
    }
  }
  // Fallback: return the first found position if no cellIndex 0 found
  for (let y = 0; y < gridData.length; y++) {
    for (let x = 0; x < gridData[y].length; x++) {
      const cell = gridData[y][x]
      if (cell?.occupied && cell.componentId === componentId) {
        return { x, y }
      }
    }
  }
  return { x: 0, y: 0 } // Should never reach here
}

/**
 * Find the other terminal of a component (the one not at the given position)
 */
function findOtherTerminal(component: any, gridData: GridCell[][]): { x: number; y: number } | null {
  const terminals = component.moduleDefinition.grid.filter((cell: any) => 
    cell.isConnectable && (
      cell.type === 'LEAD' || 
      cell.type === 'LED_POSITIVE' || 
      cell.type === 'LED_NEGATIVE' ||
      cell.type === 'VCC' ||
      cell.type === 'GND' ||
      cell.type.includes('TERMINAL') ||
      cell.type.includes('PIN')
    )
  )
  
  console.log(`🔍 Finding other terminal for ${component.componentId} at (${component.x}, ${component.y})`)
  console.log(`🔍 Available terminals:`, terminals.map((t: any) => `(${component.x + t.x}, ${component.y + t.y}) type: ${t.type}`))
  
  // Find terminal that's not at the current position
  const otherTerminal = terminals.find((terminal: any) => {
    const terminalX = component.x + terminal.x
    const terminalY = component.y + terminal.y
    const isDifferentPosition = terminalX !== component.x || terminalY !== component.y
    console.log(`🔍 Checking terminal at (${terminalX}, ${terminalY}): different position = ${isDifferentPosition}`)
    return isDifferentPosition
  })
  
  if (otherTerminal) {
    const result = {
      x: component.x + otherTerminal.x,
      y: component.y + otherTerminal.y
    }
    console.log(`🔍 Found other terminal at (${result.x}, ${result.y})`)
    return result
  }
  
  console.log(`🔍 No other terminal found for ${component.componentId}`)
  return null
}

/**
 * Get the destination position of a wire
 */
function getWireDestination(wire: WireConnection, startPosition: { x: number; y: number }): { x: number; y: number } {
  const segment = wire.segments.find(seg => 
    seg.from.x === startPosition.x && seg.from.y === startPosition.y
  )
  
  if (segment) {
    return { x: segment.to.x, y: segment.to.y }
  }
  
  // If not found, try the reverse
  const reverseSegment = wire.segments.find(seg => 
    seg.to.x === startPosition.x && seg.to.y === startPosition.y
  )
  
  if (reverseSegment) {
    return { x: reverseSegment.from.x, y: reverseSegment.from.y }
  }
  
  // Fallback - return the last segment's destination
  const lastSegment = wire.segments[wire.segments.length - 1]
  return { x: lastSegment.to.x, y: lastSegment.to.y }
}

/**
 * Update wire states based on EMPhysics results
 */
export function updateWiresFromEMPhysics(
  wires: WireConnection[],
  componentStates: Map<string, ComponentState>,
  physicsResult: any,
  gridData: GridCell[][]
): WireConnection[] {
  console.log('🔌 Updating wire states from EMPhysics results...')
  
  return wires.map(wire => {
    // Find components connected to this wire
    let wireVoltage = 0
    let wireCurrent = 0
    let isPowered = false
    let isGrounded = false
    
    // Check if any components connected to this wire have power/ground
    const connectedComponents: ComponentState[] = []
    
    wire.segments.forEach(segment => {
      // Check both from and to positions for connected components
      const fromCell = gridData[segment.from.y]?.[segment.from.x]
      const toCell = gridData[segment.to.y]?.[segment.to.x]
      
      // Find component state for from position
      if (fromCell?.occupied && fromCell.componentId) {
        const cellComponentId = `${fromCell.componentId}-${fromCell.cellIndex || 0}`
        const fromComponent = componentStates.get(cellComponentId)
        if (fromComponent) {
          connectedComponents.push(fromComponent)
        }
      }
      
      // Find component state for to position
      if (toCell?.occupied && toCell.componentId) {
        const cellComponentId = `${toCell.componentId}-${toCell.cellIndex || 0}`
        const toComponent = componentStates.get(cellComponentId)
        if (toComponent) {
          connectedComponents.push(toComponent)
        }
      }
    })

    // Determine wire voltage based on connected components
    if (connectedComponents.length > 0) {
      console.log(`🔍 Wire ${wire.id} connected to components:`, connectedComponents.map(c => `${c.componentType}(${c.outputVoltage}V)`));
      
      // Check if any component is a voltage source (power supply positive)
      const voltageSource = connectedComponents.find(comp => 
        comp.componentType === 'PowerSupply' && comp.isPowered && !comp.isGrounded
      )
      
      if (voltageSource) {
        wireVoltage = voltageSource.outputVoltage || physicsResult.batteryVoltage || 5
        isPowered = true
        console.log(`🔋 Wire ${wire.id} connected to voltage source: ${wireVoltage}V`);
      } else {
        // Use the component with the highest output voltage (closest to power source)
        const maxVoltageComponent = connectedComponents.reduce((max, comp) => 
          (comp.outputVoltage || 0) > (max.outputVoltage || 0) ? comp : max
        )
        
        if (maxVoltageComponent) {
          wireVoltage = maxVoltageComponent.outputVoltage || 0
          isPowered = maxVoltageComponent.isPowered || false
          console.log(`⚡ Wire ${wire.id} using max voltage component: ${maxVoltageComponent.componentType} at ${wireVoltage}V`);
        }
      }

      // Check if any component is grounded
      const groundedComponent = connectedComponents.find(comp => comp.isGrounded)
      if (groundedComponent) {
        isGrounded = true
        // If grounded, voltage should be 0 or very low
        if (isGrounded && !isPowered) {
          wireVoltage = 0
        }
        console.log(`🔌 Wire ${wire.id} connected to ground`);
      }

      // Set current from physics result
      wireCurrent = physicsResult.current || 0
    }
    
    // If no components found, use circuit-wide values
    if (wireVoltage === 0 && physicsResult.works) {
      wireVoltage = physicsResult.batteryVoltage
      wireCurrent = physicsResult.current
      isPowered = true
    }
    
    console.log(`🔌 Wire ${wire.id} updated: ${wireVoltage}V, ${wireCurrent}A, powered: ${isPowered}, grounded: ${isGrounded}`)
    
    return {
      ...wire,
      voltage: wireVoltage,
      current: wireCurrent,
      power: wireVoltage * wireCurrent,
      isPowered,
      isGrounded,
      isPowerable: isPowered,
      isGroundable: isGrounded,
      segments: wire.segments.map(segment => ({
        ...segment,
        isPowered,
        isGrounded,
        voltage: wireVoltage,
        current: wireCurrent
      }))
    }
  })
}

/**
 * Update wire states based on power and ground propagation, including GPIO pin states
 * @deprecated - Use updateWiresFromEMPhysics instead
 */
export function updateWireStates(
  wires: WireConnection[],
  gridData: GridCell[][],
  _componentStates: Map<string, ComponentState>,
  gpioStates?: Map<number, any>
): WireConnection[] {
  console.log('🔌 Updating wire states...')
  
  // Use a simpler approach: propagate voltage through connected components
  const wireStates = new Map<string, { voltage: number; current: number; isPowered: boolean; isGrounded: boolean }>()
  
  // First pass: find all power sources and set initial wire voltages
  wires.forEach(wire => {
    let wireVoltage = 0
    let isPowered = false
    let isGrounded = false
    
    // Check each segment of the wire to see what it connects to
    for (const segment of wire.segments) {
      const fromCell = gridData[segment.from.y]?.[segment.from.x]
      const toCell = gridData[segment.to.y]?.[segment.to.x]
      
      // Check if this segment connects to a power source or ground
      if (fromCell?.occupied && fromCell.moduleDefinition) {
        const fromModuleCell = fromCell.moduleDefinition.grid[fromCell.cellIndex || 0]
        if (fromModuleCell) {
          // Check for power connection from power sources (PowerSupply, Battery)
          if (fromModuleCell.isPowerable && fromModuleCell.voltage > 0 && 
              (fromCell.moduleDefinition.module === 'PowerSupply' || fromCell.moduleDefinition.module === 'Battery')) {
            wireVoltage = Math.max(wireVoltage, fromModuleCell.voltage)
            isPowered = true
            console.log(`🔌 Wire ${wire.id} connected to power source: ${fromModuleCell.voltage}V at (${segment.from.x}, ${segment.from.y})`)
          }
          // Check for GPIO pin HIGH state
          else if (fromModuleCell.type === 'GPIO' || fromModuleCell.type === 'ANALOG') {
            let pinNumber = parseInt(fromModuleCell.pin?.replace('D', '').replace('A', '') || '0')
            
            // Handle analog pins (A0-A5) by using pin numbers 100-105
            if (fromModuleCell.type === 'ANALOG') {
              pinNumber = pinNumber + 100
            }
            
            const gpioState = gpioStates?.get(pinNumber)
            
            if (gpioState && gpioState.state === 'HIGH') {
              wireVoltage = Math.max(wireVoltage, 5.0) // GPIO pins provide 5V when HIGH
              isPowered = true
              const pinName = fromModuleCell.type === 'ANALOG' ? `A${pinNumber - 100}` : `D${pinNumber}`
              console.log(`🔌 Wire ${wire.id} connected to ${pinName} (HIGH): 5V at (${segment.from.x}, ${segment.from.y})`)
            }
          }
          // Check for ground connection
          if (fromModuleCell.isGroundable && fromModuleCell.voltage === 0) {
            isGrounded = true
            console.log(`🔌 Wire ${wire.id} connected to ground at (${segment.from.x}, ${segment.from.y})`)
          }
        }
      }
      
      if (toCell?.occupied && toCell.moduleDefinition) {
        const toModuleCell = toCell.moduleDefinition.grid[toCell.cellIndex || 0]
        if (toModuleCell) {
          // Check for power connection from power sources (PowerSupply, Battery)
          if (toModuleCell.isPowerable && toModuleCell.voltage > 0 && 
              (toCell.moduleDefinition.module === 'PowerSupply' || toCell.moduleDefinition.module === 'Battery')) {
            wireVoltage = Math.max(wireVoltage, toModuleCell.voltage)
            isPowered = true
            console.log(`🔌 Wire ${wire.id} connected to power source: ${toModuleCell.voltage}V at (${segment.to.x}, ${segment.to.y})`)
          }
          // Check for GPIO pin HIGH state
          else if (toModuleCell.type === 'GPIO' || toModuleCell.type === 'ANALOG') {
            let pinNumber = parseInt(toModuleCell.pin?.replace('D', '').replace('A', '') || '0')
            
            // Handle analog pins (A0-A5) by using pin numbers 100-105
            if (toModuleCell.type === 'ANALOG') {
              pinNumber = pinNumber + 100
            }
            
            const gpioState = gpioStates?.get(pinNumber)
            
            if (gpioState && gpioState.state === 'HIGH') {
              wireVoltage = Math.max(wireVoltage, 5.0) // GPIO pins provide 5V when HIGH
              isPowered = true
              const pinName = toModuleCell.type === 'ANALOG' ? `A${pinNumber - 100}` : `D${pinNumber}`
              console.log(`🔌 Wire ${wire.id} connected to ${pinName} (HIGH): 5V at (${segment.to.x}, ${segment.to.y})`)
            }
          }
          // Check for ground connection
          if (toModuleCell.isGroundable && toModuleCell.voltage === 0) {
            isGrounded = true
            console.log(`🔌 Wire ${wire.id} connected to ground at (${segment.to.x}, ${segment.to.y})`)
          }
        }
      }
    }
    
    wireStates.set(wire.id, { voltage: wireVoltage, current: 0, isPowered, isGrounded })
  })
  
  // Second pass: propagate voltage through components
  let changed = true
  let iterations = 0
  while (changed && iterations < 10) {
    changed = false
    iterations++
    console.log(`🔌 Voltage propagation iteration ${iterations}`)
    
    wires.forEach(wire => {
      const currentState = wireStates.get(wire.id)!
      let newVoltage = currentState.voltage
      let newCurrent = currentState.current
      
      // Check if this wire connects to a component that's connected to another powered wire
      for (const segment of wire.segments) {
        const fromCell = gridData[segment.from.y]?.[segment.from.x]
        const toCell = gridData[segment.to.y]?.[segment.to.x]
        
        // Check if this wire connects to a component
        if (fromCell?.occupied && fromCell.moduleDefinition) {
          const moduleType = fromCell.moduleDefinition.module
          if (moduleType === 'Resistor' || moduleType === 'LED') {
            // Find other wires connected to this component
            const otherWires = wires.filter(otherWire => 
              otherWire.id !== wire.id &&
              otherWire.segments.some(otherSegment =>
                (otherSegment.from.x === segment.from.x && otherSegment.from.y === segment.from.y) ||
                (otherSegment.to.x === segment.from.x && otherSegment.to.y === segment.from.y)
              )
            )
            
            // Check if any of these other wires have voltage
            for (const otherWire of otherWires) {
              const otherState = wireStates.get(otherWire.id)!
              if (otherState.voltage > newVoltage) {
                // Calculate voltage drop across component
                let voltageDrop = 0
                if (moduleType === 'Resistor') {
                  const resistance = fromCell.moduleDefinition.grid[fromCell.cellIndex || 0]?.resistance || 
                                    fromCell.moduleDefinition.properties?.resistance || 1000
                  // For now, assume a small current to calculate voltage drop
                  const estimatedCurrent = 0.005 // 5mA
                  voltageDrop = estimatedCurrent * resistance
                } else if (moduleType === 'LED') {
                  const forwardVoltage = fromCell.moduleDefinition.grid[fromCell.cellIndex || 0]?.voltage || 
                                       fromCell.moduleDefinition.properties?.forwardVoltage || 2.0
                  voltageDrop = forwardVoltage
                }
                
                newVoltage = Math.max(newVoltage, otherState.voltage - voltageDrop)
                newCurrent = Math.max(newCurrent, otherState.current)
                console.log(`🔌 Wire ${wire.id} voltage updated from ${currentState.voltage}V to ${newVoltage}V via ${moduleType}`)
              }
            }
          }
        }
        
        if (toCell?.occupied && toCell.moduleDefinition) {
          const moduleType = toCell.moduleDefinition.module
          if (moduleType === 'Resistor' || moduleType === 'LED') {
            // Find other wires connected to this component
            const otherWires = wires.filter(otherWire => 
              otherWire.id !== wire.id &&
              otherWire.segments.some(otherSegment =>
                (otherSegment.from.x === segment.to.x && otherSegment.from.y === segment.to.y) ||
                (otherSegment.to.x === segment.to.x && otherSegment.to.y === segment.to.y)
              )
            )
            
            // Check if any of these other wires have voltage
            for (const otherWire of otherWires) {
              const otherState = wireStates.get(otherWire.id)!
              if (otherState.voltage > newVoltage) {
                // Calculate voltage drop across component
                let voltageDrop = 0
                if (moduleType === 'Resistor') {
                  const resistance = toCell.moduleDefinition.grid[toCell.cellIndex || 0]?.resistance || 
                                    toCell.moduleDefinition.properties?.resistance || 1000
                  // For now, assume a small current to calculate voltage drop
                  const estimatedCurrent = 0.005 // 5mA
                  voltageDrop = estimatedCurrent * resistance
                } else if (moduleType === 'LED') {
                  const forwardVoltage = toCell.moduleDefinition.grid[toCell.cellIndex || 0]?.voltage || 
                                       toCell.moduleDefinition.properties?.forwardVoltage || 2.0
                  voltageDrop = forwardVoltage
                }
                
                newVoltage = Math.max(newVoltage, otherState.voltage - voltageDrop)
                newCurrent = Math.max(newCurrent, otherState.current)
                console.log(`🔌 Wire ${wire.id} voltage updated from ${currentState.voltage}V to ${newVoltage}V via ${moduleType}`)
              }
            }
          }
        }
      }
      
      if (newVoltage !== currentState.voltage || newCurrent !== currentState.current) {
        wireStates.set(wire.id, { voltage: newVoltage, current: newCurrent, isPowered: newVoltage > 0, isGrounded: currentState.isGrounded })
        changed = true
      }
    })
  }
  
  return wires.map(wire => {
    const state = wireStates.get(wire.id)!
    let wireVoltage = state.voltage
    let wireCurrent = state.current
    let isPowered = state.isPowered
    let isGrounded = state.isGrounded
    
    // Calculate current based on connected components
    if (isPowered && isGrounded) {
      // Find all components connected to this wire
      let totalResistance = 0
      let hasLoad = false
      
      for (const segment of wire.segments) {
        const fromCell = gridData[segment.from.y]?.[segment.from.x]
        const toCell = gridData[segment.to.y]?.[segment.to.x]
        
        // Check components connected to this wire
        if (fromCell?.occupied && fromCell.moduleDefinition) {
          const moduleType = fromCell.moduleDefinition.module
          const moduleCell = fromCell.moduleDefinition.grid[fromCell.cellIndex || 0]
          
          if (moduleType === 'Resistor') {
            const resistance = moduleCell?.resistance || fromCell.moduleDefinition.properties?.resistance || 1000 // Default 1kΩ
            totalResistance += resistance
            hasLoad = true
            console.log(`🔌 Wire ${wire.id} connected to resistor: ${resistance}Ω`)
          } else if (moduleType === 'LED') {
            // LED has forward voltage drop - calculate equivalent resistance
            const forwardVoltage = moduleCell?.voltage || fromCell.moduleDefinition.properties?.forwardVoltage || 2.0
            const maxCurrent = moduleCell?.current || fromCell.moduleDefinition.properties?.maxCurrent || 0.02
            const ledResistance = forwardVoltage / maxCurrent // R = V / I
            totalResistance += ledResistance
            hasLoad = true
            console.log(`🔌 Wire ${wire.id} connected to LED: ${ledResistance}Ω (${forwardVoltage}V, ${maxCurrent}A)`)
          }
        }
        
        if (toCell?.occupied && toCell.moduleDefinition) {
          const moduleType = toCell.moduleDefinition.module
          const moduleCell = toCell.moduleDefinition.grid[toCell.cellIndex || 0]
          
          if (moduleType === 'Resistor') {
            const resistance = moduleCell?.resistance || toCell.moduleDefinition.properties?.resistance || 1000 // Default 1kΩ
            totalResistance += resistance
            hasLoad = true
            console.log(`🔌 Wire ${wire.id} connected to resistor: ${resistance}Ω`)
          } else if (moduleType === 'LED') {
            // LED has forward voltage drop - calculate equivalent resistance
            const forwardVoltage = moduleCell?.voltage || toCell.moduleDefinition.properties?.forwardVoltage || 2.0
            const maxCurrent = moduleCell?.current || toCell.moduleDefinition.properties?.maxCurrent || 0.02
            const ledResistance = forwardVoltage / maxCurrent // R = V / I
            totalResistance += ledResistance
            hasLoad = true
            console.log(`🔌 Wire ${wire.id} connected to LED: ${ledResistance}Ω (${forwardVoltage}V, ${maxCurrent}A)`)
          }
        }
      }
      
      // Calculate current using Ohm's Law: I = V / R
      if (hasLoad && totalResistance > 0) {
        wireCurrent = wireVoltage / totalResistance
        console.log(`🔌 Wire ${wire.id} current calculation: ${wireVoltage}V / ${totalResistance}Ω = ${wireCurrent}A`)
      } else if (isPowered && isGrounded) {
        // Complete circuit but no load - this would be a short circuit
        // In real circuits this would be dangerous, but for simulation we'll show high current
        wireCurrent = 0.1 // 100mA default current
        console.log(`🔌 Wire ${wire.id} complete circuit with no load: ${wireCurrent}A`)
      }
    }
    
    console.log(`🔌 Wire ${wire.id} final state: ${wireVoltage}V, ${wireCurrent}A, powered: ${isPowered}, grounded: ${isGrounded}`)
    
    return {
      ...wire,
      voltage: wireVoltage,
      current: wireCurrent,
      power: wireVoltage * wireCurrent, // Calculate power: P = V * I
      isPowered,
      isGrounded,
      isPowerable: isPowered,
      isGroundable: isGrounded,
      segments: wire.segments.map(segment => ({
        ...segment,
        isPowered,
        isGrounded,
        voltage: wireVoltage,
        current: wireCurrent
      }))
    }
  })
}

/**
 * Update component states based on wire connections and GPIO states
 */
export function updateComponentStatesFromWires(
  gridData: GridCell[][],
  wires: WireConnection[],
  gpioStates?: Map<number, any>
): Map<string, ComponentState> {
  console.log('🔧 Updating component states from wire connections...')
  const componentStates = new Map<string, ComponentState>()
  
  // Find all components in the grid
  gridData.forEach((row, y) => {
    if (!row || !Array.isArray(row)) return
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
        const componentId = cell.componentId
        const moduleType = cell.moduleDefinition.module
        
        // Initialize component state
        let componentState: ComponentState = {
          componentId,
          componentType: moduleType,
          position: { x, y },
          outputVoltage: 0,
          outputCurrent: 0,
          power: 0,
          status: 'unpowered',
          isPowered: false,
          isGrounded: false
        }
        
        // Check if any wires connect to this component
        let hasPowerConnection = false
        let hasGroundConnection = false
        let maxVoltage = 0
        
        wires.forEach(wire => {
          wire.segments.forEach(segment => {
            // Check if wire connects to this component
            const fromCell = gridData[segment.from.y]?.[segment.from.x]
            const toCell = gridData[segment.to.y]?.[segment.to.x]
            
            if ((fromCell?.componentId === componentId) || (toCell?.componentId === componentId)) {
              // Wire connects to this component
              if (wire.isPowered) {
                hasPowerConnection = true
                maxVoltage = Math.max(maxVoltage, wire.voltage)
                console.log(`🔧 Component ${componentId} connected to power wire: ${wire.voltage}V`)
              }
              if (wire.isGrounded) {
                hasGroundConnection = true
                console.log(`🔧 Component ${componentId} connected to ground wire`)
              }
            }
          })
        })
        
        // Check if this is a microcontroller with GPIO pins set to HIGH
        if (moduleType === 'Arduino Uno R3' && gpioStates) {
          // Check if any GPIO pins are set to HIGH and connected to wires
          const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
          if (moduleCell && (moduleCell.type === 'GPIO' || moduleCell.type === 'ANALOG')) {
            let pinNumber = parseInt(moduleCell.pin?.replace('D', '').replace('A', '') || '0')
            
            // Handle analog pins (A0-A5) by using pin numbers 100-105
            if (moduleCell.type === 'ANALOG') {
              pinNumber = pinNumber + 100
            }
            
            const gpioState = gpioStates.get(pinNumber)
            
            if (gpioState && gpioState.state === 'HIGH') {
              // GPIO pin is HIGH - it can provide power
              hasPowerConnection = true
              maxVoltage = Math.max(maxVoltage, 5.0) // GPIO pins provide 5V when HIGH
              const pinName = moduleCell.type === 'ANALOG' ? `A${pinNumber - 100}` : `D${pinNumber}`
              console.log(`🔧 GPIO pin ${pinName} is HIGH - providing power to ${componentId}`)
            }
          }
        }
        
        // Update component state based on connections
        if (hasPowerConnection && hasGroundConnection) {
          // Component has both power and ground - it's fully powered
          componentState.isPowered = true
          componentState.isGrounded = true
          componentState.outputVoltage = maxVoltage
          componentState.status = 'powered'
          componentState.power = maxVoltage * 0.1 // Assume 100mA current
          console.log(`🔧 Component ${componentId} is fully powered: ${maxVoltage}V`)
        } else if (hasPowerConnection) {
          componentState.isPowered = true
          componentState.outputVoltage = maxVoltage
          componentState.status = 'powered_no_ground'
          console.log(`🔧 Component ${componentId} has power but no ground: ${maxVoltage}V`)
        } else if (hasGroundConnection) {
          componentState.isGrounded = true
          componentState.status = 'grounded_no_power'
          console.log(`🔧 Component ${componentId} has ground but no power`)
        }
        
        componentStates.set(componentId, componentState)
      }
    })
  })
  
  console.log(`🔧 Updated ${componentStates.size} component states`)
  return componentStates
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
          isPowered: state.isPowered
        }
        console.log(`🔧 Updated grid cell (${position.x}, ${position.y}) with voltage ${state.outputVoltage}V`)
      }
    }
  })
  
  return hasChanges ? newGrid : gridData
}

/**
 * Main electrical calculation function
 * This is the entry point for the entire electrical system
 * Now uses EMPhysics.ts CalculateCircuit as the primary physics engine
 */
export function calculateElectricalFlow(
  gridData: GridCell[][],
  wires: WireConnection[],
  gpioStates?: Map<number, any>
): {
  componentStates: Map<string, ComponentState>
  updatedWires: WireConnection[]
  updatedGridData: GridCell[][]
  circuitInfo?: {
    totalVoltage: number
    totalCurrent: number
    totalResistance: number
    totalPower: number
    errors: string[]
    pathways: any[]
  }
} {
  logger.electrical('Starting electrical flow calculation with EMPhysics engine...')
  logger.electricalDebug(`Grid data: ${gridData.length} rows`)
  logger.electricalDebug(`Wires: ${wires.length}`)
  logger.electricalDebug(`GPIO states: ${gpioStates?.size || 0}`)
  
  // Debug: Check if we have any components at all
  let totalComponents = 0
  let resistorComponents = 0
  gridData.forEach((row, y) => {
    if (!row || !Array.isArray(row)) return
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.componentId) {
        totalComponents++
        const moduleType = cell.moduleDefinition?.module
        logger.componentsDebug(`Found component: ${cell.componentId} (${moduleType}) at (${x}, ${y})`)
        
        if (moduleType === 'Resistor') {
          resistorComponents++
          logger.componentsDebug(`RESISTOR FOUND: ${cell.componentId} at (${x}, ${y})`)
        }
      }
    })
  })
  logger.components(`Total components found: ${totalComponents}`)
  logger.components(`Resistor components found: ${resistorComponents}`)
  
  // Debug: Check grid data content
  let occupiedCells = 0;
  gridData.forEach((row, y) => {
    if (!row) return;
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
        occupiedCells++;
        console.log(`🔍 Grid cell (${x}, ${y}): ${cell.moduleDefinition.module} - ${cell.componentId}`);
      }
    });
  });
  console.log(`🔍 Total occupied cells in grid: ${occupiedCells}`);
  
  // Step 1: Extract occupied components and find circuit pathways
  const occupiedComponents = extractOccupiedComponents(gridData)
  const circuitAnalysis = findCircuitPathways(occupiedComponents, wires)
  const pathways = circuitAnalysis.pathways
  console.log('🔍 Found circuit pathways:', pathways.length)
  
  // Step 2: Convert grid components to circuit nodes for EMPhysics
  const circuitNodes = convertGridToNodes(gridData, wires)
  console.log('🔧 Converted to circuit nodes:', circuitNodes.length)
  
  // Step 3: Check continuity before calculating circuit
  const hasContinuity = checkContinuity(circuitNodes, wires)
  console.log('🔍 Continuity check result:', hasContinuity)
  
  // TEMPORARY: Disable continuity check to debug the node creation issue
  console.log('🔧 TEMPORARY: Bypassing continuity check to debug node creation')
  const hasContinuityOverride = circuitNodes.length > 0 // Allow if we have any nodes
  
  // Step 4: Use EMPhysics CalculateCircuit as primary physics engine
  const physicsResult = CalculateCircuit(circuitNodes, wires, hasContinuityOverride)
  console.log('⚡ EMPhysics calculation result:', {
    works: physicsResult.works,
    batteryVoltage: physicsResult.batteryVoltage,
    current: physicsResult.current,
    totalResistance: physicsResult.totalResistance,
    errors: physicsResult.errors
  })
  
  if (physicsResult.works) {
    // Step 4: Use systematic voltage calculation approach
    console.log('🔌 Using systematic voltage calculation approach...')
    const systematicResult = calculateSystematicVoltageFlow(gridData, wires, gpioStates)

    const componentStates = systematicResult.componentStates
    console.log('[COMPONENT STATES] Full Map:', Array.from(componentStates.entries()))
    console.log('[COMPONENT STATES] Size:', componentStates.size)
    componentStates.forEach((state, id) => {
      console.log(`[COMPONENT STATES] ${id}:`, state)
    })
    
    // Step 5: Use systematic wire updates
    const updatedWires = systematicResult.updatedWires
    
    // Step 6: Update grid data with component states
    const updatedGridData = updateGridData(gridData, componentStates)
    
    // Debug: Check if grid data is being preserved
    let occupiedCellsAfter = 0;
    updatedGridData.forEach((row) => {
      if (!row) return;
      row.forEach((cell) => {
        if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
          occupiedCellsAfter++;
        }
      });
    });
    console.log(`🔍 Grid data after update: ${occupiedCellsAfter} occupied cells (was ${occupiedCells})`);
    
    console.log(`⚡ Electrical calculation completed: ${componentStates.size} component states, ${updatedWires.length} wires`)
    
    // Debug: Log wire states for troubleshooting
    console.log('🔍 Wire Analysis:')
    updatedWires.forEach(wire => {
      if (wire.voltage > 0 || wire.current > 0) {
        console.log(`  Wire ${wire.id}: ${wire.voltage}V, ${wire.current}A, ${wire.power}W (Powered: ${wire.isPowered}, Grounded: ${wire.isGrounded})`)
      }
    })
    
    // Create circuit info for device manager
    const circuitInfo = {
      totalVoltage: physicsResult.batteryVoltage,
      totalCurrent: physicsResult.current,
      totalResistance: physicsResult.totalResistance,
      totalPower: physicsResult.powerBattery || 0,
      errors: physicsResult.errors || [],
      pathways: pathways
    }
    
    return {
      componentStates,
      updatedWires,
      updatedGridData,
      circuitInfo
    }
  } else {
    console.warn('⚠️ Circuit calculation failed:', physicsResult.reason)
    console.warn('⚠️ Errors:', physicsResult.errors)
    
    // Create empty component states for failed circuits
    const componentStates = new Map<string, ComponentState>()
    
    // Still try to update wires with basic information
    const updatedWires = updateWiresFromEMPhysics(wires, componentStates, physicsResult, gridData)
    const updatedGridData = updateGridData(gridData, componentStates)
    
    // Debug: Check if grid data is being preserved in failed case
    let occupiedCellsAfterFailed = 0;
    updatedGridData.forEach((row) => {
      if (!row) return;
      row.forEach((cell) => {
        if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
          occupiedCellsAfterFailed++;
        }
      });
    });
    console.log(`🔍 Grid data after failed update: ${occupiedCellsAfterFailed} occupied cells (was ${occupiedCells})`);
    
    return {
      componentStates,
      updatedWires,
      updatedGridData,
      circuitInfo: {
        totalVoltage: 0,
        totalCurrent: 0,
        totalResistance: 0,
        totalPower: 0,
        errors: physicsResult.errors || [physicsResult.reason || 'Unknown error'],
        pathways: pathways
      }
    }
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

  logger.circuit(`Branch analysis: ${effectiveVoltage}V effective, ${branchCurrent}A current, ${totalResistance}Ω resistance`)
  
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
        position: comp.position,
        isPowered: result.outputVoltage > 0,
        isGrounded: false // Will be updated by wire connections
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
          position: comp.position,
          isPowered: result.outputVoltage > 0,
          isGrounded: false // Will be updated by wire connections
        })
        
        logger.components(`${comp.type} ${comp.id}: ${branch.voltage}V input, ${result.status}`)
      }
    })
  })
  
  return states
}
  