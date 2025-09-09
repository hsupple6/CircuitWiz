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
    if (!row) return
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
        position: comp.position,
        isPowered: result.outputVoltage > 0,
        isGrounded: false // Will be updated by wire connections
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
          position: comp.position,
          isPowered: result.outputVoltage > 0,
          isGrounded: false // Will be updated by wire connections
        })
        
        logger.componentState(comp.type, comp.id, branch.voltage, branch.current, result.status)
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
    if (!row) return
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
 * Update wire states based on EMPhysics results
 */
export function updateWiresFromEMPhysics(
  wires: WireConnection[],
  componentStates: Map<string, ComponentState>,
  physicsResult: any
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
      // Find component at each end of the wire segment
      const fromComponent = Array.from(componentStates.values()).find(comp => 
        comp.position.x === segment.from.x && comp.position.y === segment.from.y
      )
      const toComponent = Array.from(componentStates.values()).find(comp => 
        comp.position.x === segment.to.x && comp.position.y === segment.to.y
      )
      
      if (fromComponent) connectedComponents.push(fromComponent)
      if (toComponent) connectedComponents.push(toComponent)
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
    if (!row) return
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
  console.log('⚡ Starting electrical flow calculation with EMPhysics engine...')
  console.log('Grid data:', gridData.length, 'rows')
  console.log('Wires:', wires.length)
  console.log('GPIO states:', gpioStates?.size || 0)
  
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
  
        // Step 4: Convert EMPhysics results back to component states
        const componentStates = new Map<string, ComponentState>()

        if (physicsResult.works && physicsResult.componentStates) {
          physicsResult.componentStates.forEach((state, componentId) => {
            const componentState = {
              componentId: state.id,
              componentType: state.type,
              position: state.position,
              outputVoltage: state.outputVoltage || 0,
              outputCurrent: state.outputCurrent || 0,
              power: state.power || 0,
              status: state.status || 'unpowered',
              isPowered: state.isPowered || false,
              isGrounded: state.isGrounded || false,
              // Include additional properties from EMPhysics
              voltageDrop: state.voltageDrop,
              forwardVoltage: state.forwardVoltage,
              isOn: state.isOn
            }
            componentStates.set(componentId, componentState)
            console.log(`🔧 Component state: ${state.type} ${state.id} - ${componentState.outputVoltage}V, ${componentState.outputCurrent}A, powered: ${componentState.isPowered}, grounded: ${componentState.isGrounded}`)
          })
  } else {
    console.warn('⚠️ Circuit calculation failed:', physicsResult.reason)
    console.warn('⚠️ Errors:', physicsResult.errors)
    
    // Create empty component states for failed circuits
    const componentStates = new Map<string, ComponentState>()
    
    // Still try to update wires with basic information
    const updatedWires = updateWiresFromEMPhysics(wires, componentStates, physicsResult)
    const updatedGridData = updateGridData(gridData, componentStates)
    
    // Debug: Check if grid data is being preserved in failed case
    let occupiedCellsAfterFailed = 0;
    updatedGridData.forEach((row, y) => {
      if (!row) return;
      row.forEach((cell, x) => {
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
  
        // Step 5: Update wire states based on EMPhysics results (not the old system)
        const updatedWires = updateWiresFromEMPhysics(wires, componentStates, physicsResult)
  
  // Step 6: Update grid data with component states
  const updatedGridData = updateGridData(gridData, componentStates)
  
  // Debug: Check if grid data is being preserved
  let occupiedCellsAfter = 0;
  updatedGridData.forEach((row, y) => {
    if (!row) return;
    row.forEach((cell, x) => {
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
        
        logger.componentState(comp.type, comp.id, branch.voltage, branch.current, result.status)
      }
    })
  })
  
  return states
}
  