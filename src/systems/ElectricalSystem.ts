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
import { resolveLogicModule } from '../modules/logicModule'
import { logger } from '../services/Logger'
import { findCircuitPathways, CalculateCircuit, convertGridToNodes } from '../services/EMPhysics'
import { checkContinuity } from '../systems/chain/graph'
import { isActivePowerSourceTerminal } from '../utils/powerSupplies'
import { solveCircuit } from '../services/CircuitSolver'
import { extractOccupiedComponents } from '../utils/gridUtils'
import { LEDVoltageFlow } from '../modules/output/voltageFlow/LED'
import { ResistorVoltageFlow } from '../modules/passives/voltageFlow/Resistor'
import { MicrocontrollerVoltageFlow } from '../modules/microcontrollers/voltageFlow/Microcontroller'
import { calculateMotorElectricalProperties } from '../modules/output/voltageFlow/Motor'
import { dynamicGPIO, DynamicGPIOState, multiMCUGPIO } from '../services/DynamicGPIO'

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
  pwm?: number // PWM throttle percentage (0-100)
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
    const isOn = inputVoltage > 0.01 && inputVoltage >= forwardVoltage && inputCurrent > 1e-6
    
    // LED power is forward voltage × current (this is the power the LED consumes)
    const ledPower = forwardVoltage * inputCurrent
    

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
  
        
        // Only treat actual power source components as power sources, not microcontroller pins
        const isActualPowerSource = cell.moduleDefinition.module === 'PowerSupply' || 
                                   cell.moduleDefinition.module === 'Battery'
        
        if (isActualPowerSource && isActivePowerSourceTerminal(cell.moduleDefinition.module, moduleCell) &&
            (moduleCell.type === 'VCC' || moduleCell.type === 'POSITIVE')) {
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
 * Enhanced parallel resistor detection - find resistors that share the same power and ground wire segments
 * This implements the approach: FIRSTLY, find all resistors that share the same wire segments for POWER and GROUND
 * We then combine those as ONE resistor using the parallel resistance law
 */
export function findParallelResistors(
  gridData: GridCell[][],
  _connections: Map<string, Set<string>>,
  wires: WireConnection[]
): ParallelBranch[] {
  const parallelBranches: ParallelBranch[] = []
  const processedResistors = new Set<string>()
  
  // Find all resistors in the grid
  const resistors: Array<{id: string, position: {x: number, y: number}, resistance: number, terminals: Array<{x: number, y: number}>}> = []
  
  gridData.forEach((row, y) => {
    if (!row || !Array.isArray(row)) return
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.componentId && cell.moduleDefinition && resolveLogicModule(cell.moduleDefinition) === 'Resistor') {
        // Find all terminal positions for this resistor
        const terminals = findResistorTerminals(cell, gridData)
        resistors.push({
          id: cell.componentId,
          position: { x, y },
          resistance: cell.resistance || 1000,
          terminals
        })
      }
    })
  })
  
  console.log(`🔍 [PARALLEL_DEBUG] Found ${resistors.length} resistors:`, resistors.map(r => ({ id: r.id, position: r.position, terminals: r.terminals })))
  
  // Group resistors that share the same power and ground wire segments
  for (let i = 0; i < resistors.length; i++) {
    if (processedResistors.has(resistors[i].id)) continue
    
    const resistor1 = resistors[i]
    const resistor1WireSegments = findResistorWireSegments(resistor1, wires)
    
    // Find other resistors that share the same power and ground wire segments
    const parallelGroup = [resistor1]
    processedResistors.add(resistor1.id)
    
    for (let j = i + 1; j < resistors.length; j++) {
      if (processedResistors.has(resistors[j].id)) continue
      
      const resistor2 = resistors[j]
      const resistor2WireSegments = findResistorWireSegments(resistor2, wires)
      
      // Check if these resistors share the same power and ground wire segments
      console.log(`🔍 [PARALLEL_DEBUG] Checking ${resistor1.id} vs ${resistor2.id}`)
      console.log(`🔍 [PARALLEL_DEBUG] Resistor1 wire segments:`, resistor1WireSegments)
      console.log(`🔍 [PARALLEL_DEBUG] Resistor2 wire segments:`, resistor2WireSegments)
      
      if (sharePowerAndGroundSegments(resistor1WireSegments, resistor2WireSegments)) {
        // These resistors are connected in parallel
        parallelGroup.push(resistor2)
        processedResistors.add(resistor2.id)
        console.log(`✅ [PARALLEL_DEBUG] FOUND PARALLEL: ${resistor1.id} and ${resistor2.id}`)
      } else {
        console.log(`❌ [PARALLEL_DEBUG] NOT PARALLEL: ${resistor1.id} and ${resistor2.id}`)
      }
    }
    
    // If we found multiple resistors in parallel, create a parallel branch
    if (parallelGroup.length > 1) {
      const combinedResistance = calculateParallelResistance(parallelGroup.map(r => r.resistance))
      
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
        totalResistance: combinedResistance,
        current: 0,
        voltage: 0
      }
      
      parallelBranches.push(branch)
      console.log(`✅ [PARALLEL_DEBUG] Created parallel branch with ${parallelGroup.length} resistors, combined resistance: ${combinedResistance}Ω`)
    }
  }
  
  return parallelBranches
}

/**
 * Find the terminal positions of a resistor component
 */
function findResistorTerminals(resistorCell: GridCell, _gridData: GridCell[][]): Array<{x: number, y: number}> {
  const terminals: Array<{x: number, y: number}> = []
  
  if (!resistorCell.moduleDefinition) return terminals
  
  // Find all LEAD type cells in the resistor's grid definition
  resistorCell.moduleDefinition.grid.forEach((cell: any, _index: number) => {
    if (cell.type === 'LEAD' && cell.isConnectable) {
      const terminalX = resistorCell.x! + cell.x
      const terminalY = resistorCell.y! + cell.y
      terminals.push({ x: terminalX, y: terminalY })
    }
  })
  
  return terminals
}

/**
 * Find wire segments connected to a resistor's terminals
 */
function findResistorWireSegments(
  resistor: {id: string, position: {x: number, y: number}, resistance: number, terminals: Array<{x: number, y: number}>},
  wires: WireConnection[]
): Array<{wireId: string, segment: any, terminal: {x: number, y: number}}> {
  const wireSegments: Array<{wireId: string, segment: any, terminal: {x: number, y: number}}> = []
  
  wires.forEach(wire => {
    wire.segments.forEach(segment => {
      // Check if this segment connects to any of the resistor's terminals
      resistor.terminals.forEach(terminal => {
        if ((segment.from.x === terminal.x && segment.from.y === terminal.y) ||
            (segment.to.x === terminal.x && segment.to.y === terminal.y)) {
          wireSegments.push({
            wireId: wire.id,
            segment,
            terminal
          })
        }
      })
    })
  })
  
  return wireSegments
}

/**
 * Check if two resistors share the same power and ground wire segments
 * This is the core logic for detecting parallel resistors
 */
function sharePowerAndGroundSegments(
  segments1: Array<{wireId: string, segment: any, terminal: {x: number, y: number}}>,
  segments2: Array<{wireId: string, segment: any, terminal: {x: number, y: number}}>
): boolean {
  // Group segments by wire ID to identify power and ground connections
  const wireGroups1 = groupSegmentsByWire(segments1)
  const wireGroups2 = groupSegmentsByWire(segments2)
  
  // Check if both resistors are connected to the same power wire and the same ground wire
  const powerWires1 = new Set(wireGroups1.keys())
  const powerWires2 = new Set(wireGroups2.keys())
  
  // Find intersection of wire IDs (resistors connected to same wires)
  const sharedWires = new Set([...powerWires1].filter(wireId => powerWires2.has(wireId)))
  
  // For parallel connection, resistors should share at least 2 wires (power and ground)
  // or be connected to the same wire at different points
  if (sharedWires.size >= 2) {
    return true
  }
  
  // Alternative: Check if resistors are connected to the same wire but at different terminals
  // This handles cases where multiple resistors are connected in parallel to the same wire
  for (const wireId of sharedWires) {
    const segments1ForWire = wireGroups1.get(wireId) || []
    const segments2ForWire = wireGroups2.get(wireId) || []
    
    // If both resistors have multiple connections to the same wire, they're likely in parallel
    if (segments1ForWire.length >= 1 && segments2ForWire.length >= 1) {
      return true
    }
  }
  
  return false
}

/**
 * Group wire segments by wire ID
 */
function groupSegmentsByWire(segments: Array<{wireId: string, segment: any, terminal: {x: number, y: number}}>): Map<string, Array<{wireId: string, segment: any, terminal: {x: number, y: number}}>> {
  const groups = new Map<string, Array<{wireId: string, segment: any, terminal: {x: number, y: number}}>>()
  
  segments.forEach(segment => {
    if (!groups.has(segment.wireId)) {
      groups.set(segment.wireId, [])
    }
    groups.get(segment.wireId)!.push(segment)
  })
  
  return groups
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
  
  
  // Calculate parallel branch currents
  const updatedParallelBranches = calculateParallelBranchCurrents(parallelBranches, effectiveVoltage)
  

  
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
          if (isActivePowerSourceTerminal(cell.moduleDefinition.module, moduleCell)) {
            powerSources.push({ x, y, voltage: moduleCell.voltage, type: cell.moduleDefinition.module })
          }
          // Check for GPIO pin HIGH state
          else if (moduleCell.type === 'GPIO' || moduleCell.type === 'ANALOG') {
            let pinNumber = 0
            
            // Extract pin number based on pin naming scheme
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
            
            const gpioState = gpioStates?.get(pinNumber)
            // Only treat as power source if pin is explicitly HIGH
            if (gpioState && gpioState.state === 'HIGH') {
              // Use appropriate voltage based on microcontroller type
              const voltage = cell.moduleDefinition.module.includes('ESP32') ? 3.3 : 5.0
              powerSources.push({ x, y, voltage, type: 'GPIO' })
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
  
  // For each power source, trace the circuit path
  powerSources.forEach(powerSource => {
    
    // Find wires connected to this power source
    const connectedWires = wires.filter(wire => 
      wire.segments.some(segment => 
        (segment.from.x === powerSource.x && segment.from.y === powerSource.y) ||
        (segment.to.x === powerSource.x && segment.to.y === powerSource.y)
      )
    )
    
    
    // Trace each connected wire
    connectedWires.forEach(wire => {
      
      // Find the path from this wire to ground
      const circuitPath = findCircuitPath(wire, wires, gridData, groundConnections)

      
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
            } else if (moduleType === 'LED') {
              const forwardVoltage = component.moduleDefinition.grid[component.cellIndex || 0]?.voltage || 
                                   component.moduleDefinition.properties?.forwardVoltage || 2.0
              const maxCurrent = component.moduleDefinition.grid[component.cellIndex || 0]?.current || 
                                component.moduleDefinition.properties?.maxCurrent || 0.02
              const ledResistance = forwardVoltage / maxCurrent
              totalResistance += ledResistance
            }
          }
        })
        
        // Calculate circuit current using the original source voltage
        const circuitCurrent = totalResistance > 0 ? powerSource.voltage / totalResistance : 0
        
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
            } else if (moduleType === 'LED') {
              const forwardVoltage = component.moduleDefinition.grid[component.cellIndex || 0]?.voltage || 
                                   component.moduleDefinition.properties?.forwardVoltage || 2.0
              voltageAtPoint -= forwardVoltage
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
/**
 * Start dynamic GPIO simulation based on Arduino code
 */
export function startDynamicGPIO(code: string): void {
  console.log('[DYNAMIC_GPIO] Starting dynamic GPIO simulation...')
  
  // Analyze code for GPIO patterns
  const animations = dynamicGPIO.analyzeCode(code)
  console.log('[DYNAMIC_GPIO] Detected patterns:', animations)
  
  // Start simulation
  dynamicGPIO.startSimulation(animations)
}

/**
 * Stop dynamic GPIO simulation
 */
export function stopDynamicGPIO(): void {
  console.log('[DYNAMIC_GPIO] Stopping dynamic GPIO simulation...')
  dynamicGPIO.stopSimulation()
}

/**
 * Get current dynamic GPIO states
 */
export function getDynamicGPIOStates(): Map<number, DynamicGPIOState> {
  return dynamicGPIO.getCurrentStates()
}

/**
 * Start multi-microcontroller GPIO simulation
 */
export function startMultiMicrocontrollerGPIO(microcontrollerId: string, code: string): void {
  console.log(`[MULTI_MCU_GPIO] Starting simulation for ${microcontrollerId}`)
  multiMCUGPIO.startMicrocontrollerSimulation(microcontrollerId, code)
}

/**
 * Stop multi-microcontroller GPIO simulation for specific microcontroller
 */
export function stopMultiMicrocontrollerGPIO(microcontrollerId: string): void {
  console.log(`[MULTI_MCU_GPIO] Stopping simulation for ${microcontrollerId}`)
  multiMCUGPIO.stopMicrocontrollerSimulation(microcontrollerId)
}

/**
 * Stop all multi-microcontroller GPIO simulations
 */
export function stopAllMultiMicrocontrollerGPIO(): void {
  console.log('[MULTI_MCU_GPIO] Stopping all simulations')
  multiMCUGPIO.stopAllSimulations()
}

/**
 * Get GPIO states for specific microcontroller
 */
export function getMicrocontrollerGPIOStates(microcontrollerId: string): Map<number, DynamicGPIOState> {
  return multiMCUGPIO.getMicrocontrollerStates(microcontrollerId)
}

/**
 * Get all GPIO states from all microcontrollers
 */
export function getAllMultiMicrocontrollerGPIOStates(): Map<number, DynamicGPIOState> {
  return multiMCUGPIO.getAllGPIOStates()
}

/**
 * Get list of running microcontrollers
 */
export function getRunningMicrocontrollers(): string[] {
  return multiMCUGPIO.getRunningMicrocontrollers()
}

/**
 * Check if microcontroller is running
 */
export function isMicrocontrollerRunning(microcontrollerId: string): boolean {
  return multiMCUGPIO.isMicrocontrollerRunning(microcontrollerId)
}

export function calculateSystematicVoltageFlow(
  gridData: GridCell[][],
  wires: WireConnection[],
  gpioStates?: Map<number, any>,
  parallelBranches: ParallelBranch[] = []
): {
  componentStates: Map<string, ComponentState>
  updatedWires: WireConnection[]
} {

  // Check for multi-microcontroller GPIO states first, then single dynamic, then static
  const multiMCUStates = getAllMultiMicrocontrollerGPIOStates()
  const singleDynamicStates = getDynamicGPIOStates()
  const effectiveGPIOStates = multiMCUStates.size > 0 ? multiMCUStates : 
                              singleDynamicStates.size > 0 ? singleDynamicStates : 
                              gpioStates
  
  // Debug: Log GPIO states
  console.log(`[GPIO] ElectricalSystem: GPIO states received:`, effectiveGPIOStates ? Array.from(effectiveGPIOStates.entries()) : 'undefined')
  console.log(`[GPIO] Using ${multiMCUStates.size > 0 ? 'multi-MCU' : singleDynamicStates.size > 0 ? 'single dynamic' : 'static'} GPIO states`)
  
  // Debug: Check if pin 13 is HIGH
  if (effectiveGPIOStates && effectiveGPIOStates.has(13)) {
    console.log(`[GPIO] Pin 13 GPIO state:`, effectiveGPIOStates.get(13))
  } else {
    console.log(`[GPIO] Pin 13 not found in GPIO states!`)
  }
  
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
        
        // Set initial voltage for power sources (but not for GPIO pins)
        if (moduleType === 'PowerSupply' || moduleType === 'Battery') {
          const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
          if (isActivePowerSourceTerminal(moduleType, moduleCell)) {
            componentState.outputVoltage = moduleCell.voltage
            componentState.isPowered = true
            componentState.status = 'active'
          }
        }
        // For microcontrollers, only set initial state for non-GPIO pins (VCC, GND, etc.)
        else if (moduleType === 'Arduino Uno R3' || moduleType === 'ESP32' || moduleType === 'ArduinoUno' || moduleType === 'ESP32DevKit') {
          const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
          // Only set as powered if it's a power pin (VCC, GND) and not a GPIO/ANALOG pin
          if (moduleCell?.isPowerable && moduleCell.voltage > 0 && 
              moduleCell.type !== 'GPIO' && moduleCell.type !== 'ANALOG') {
            componentState.outputVoltage = moduleCell.voltage
            componentState.isPowered = true
            componentState.status = 'active'
          }
        }
        
        componentStates.set(cellComponentId, componentState)
      }
    })
  })
  
  // Step 2: Calculate circuit current using EMPhysics
  const occupiedComponents = extractOccupiedComponents(gridData)
  let resistorCount = 0
  occupiedComponents.forEach(comp => {
    if (comp.moduleDefinition && resolveLogicModule(comp.moduleDefinition) === 'Resistor') {
      resistorCount++
    }
  })
  
  // Log parallel resistor information
  if (parallelBranches.length > 0) {
    parallelBranches.forEach((branch, index) => {
    })
  }
  
  
  const nodes = convertGridToNodes(gridData, wires)
  const hasContinuity = checkContinuity(gridData, wires)
  const physicsResult = CalculateCircuit(nodes, wires, hasContinuity)
  
  if (!physicsResult.works) {
    console.warn('⚠️ Circuit calculation failed:', physicsResult.reason)
    return { componentStates, updatedWires: wires }
  }
  
  const circuitCurrent = physicsResult.current || 0
  
  // Step 2.5: Process parallel resistor groups to calculate their individual currents
  console.log(`🔍 [PARALLEL_DEBUG] About to calculate parallel branch currents for ${parallelBranches.length} branches`)
  console.log(`🔍 [PARALLEL_DEBUG] Battery voltage: ${physicsResult.batteryVoltage || 5}V`)
  
  const updatedParallelBranches = calculateParallelBranchCurrents(parallelBranches, physicsResult.batteryVoltage || 5)
  
  // Log parallel branch current distribution
  if (updatedParallelBranches.length > 0) {
    console.log(`⚡ [PARALLEL_DEBUG] Parallel branch current distribution:`)
    updatedParallelBranches.forEach((branch, index) => {
      const componentCount = branch.components?.length || 0
      const currentPerResistor = componentCount > 0 ? branch.current / componentCount : 0
      console.log(`⚡ [PARALLEL_DEBUG] Branch ${index + 1}: ${branch.current.toFixed(3)}A total, ${currentPerResistor.toFixed(3)}A per resistor through ${branch.totalResistance}Ω`)
    })
  } else {
    console.log(`❌ [PARALLEL_DEBUG] No parallel branches to process for current calculation`)
  }
  
  // Step 3.5: Process parallel resistor groups with calculated currents
  if (updatedParallelBranches.length > 0) {
    console.log(`🔍 [PARALLEL_DEBUG] Processing ${updatedParallelBranches.length} parallel resistor groups...`)
    
    updatedParallelBranches.forEach((branch, branchIndex) => {
      console.log(`🔍 [PARALLEL_DEBUG] Processing parallel branch ${branchIndex + 1} with ${branch.components?.length || 0} resistors`)
      
      if (branch.components && branch.components.length > 0) {
        branch.components.forEach((resistor, resistorIndex) => {
          const currentPerResistor = branch.current / branch.components.length
          console.log(`🔍 [PARALLEL_DEBUG] Resistor ${resistorIndex + 1}: ${currentPerResistor.toFixed(3)}A through ${resistor.properties?.resistance || 1000}Ω`)
          
          const voltageDrop = currentPerResistor * (resistor.properties?.resistance || 1000)
          console.log(`🔍 [PARALLEL_DEBUG] Voltage drop: ${voltageDrop.toFixed(3)}V`)
          
          const resistorState = componentStates.get(resistor.id)
          if (resistorState) {
            resistorState.current = currentPerResistor
            resistorState.voltage = voltageDrop
            resistorState.power = currentPerResistor * voltageDrop
            componentStates.set(resistor.id, resistorState)
            
            console.log(`✅ [PARALLEL_DEBUG] Updated resistor ${resistor.id}: ${currentPerResistor.toFixed(3)}A, ${voltageDrop.toFixed(3)}V, ${(currentPerResistor * voltageDrop).toFixed(3)}W`)
          } else {
            console.log(`❌ [PARALLEL_DEBUG] No component state found for resistor ${resistor.id}`)
          }
        })
      } else {
        console.log(`❌ [PARALLEL_DEBUG] Branch ${branchIndex + 1} has no components`)
      }
    })
  } else {
    console.log(`❌ [PARALLEL_DEBUG] No parallel branches to process`)
  }
  
  // Step 3: Process all microcontroller pin cells first to set GPIO pin states
  const microcontrollerPinCells = Array.from(componentStates.values()).filter(comp => 
    comp.componentType === 'Arduino Uno R3' || comp.componentType === 'ESP32' || 
    comp.componentType === 'ArduinoUno' || comp.componentType === 'ESP32DevKit'
  )
  
  console.log(`[PIN_PROCESSING] Found ${microcontrollerPinCells.length} microcontroller pin cells to process:`, 
    microcontrollerPinCells.map(comp => ({ id: comp.componentId, type: comp.componentType, pos: comp.position })))
  
  // Debug: Check what's actually in the grid around the microcontroller
  console.log(`[PIN_PROCESSING] Debug: Checking grid around microcontroller positions...`)
  microcontrollerPinCells.slice(0, 5).forEach(comp => {
    const x = comp.position.x
    const y = comp.position.y
    console.log(`[PIN_PROCESSING] Grid at (${x}, ${y}):`, gridData[y]?.[x])
  })
  
  // Group pin cells by base component ID to find the actual base position
  const pinCellsByBase = new Map<string, any[]>()
  microcontrollerPinCells.forEach(comp => {
    // Extract base component ID by removing the last part (cell index)
    // e.g., "Arduino Uno R3-1757665166853-39" -> "Arduino Uno R3-1757665166853"
    const parts = comp.componentId.split('-')
    const baseComponentId = parts.slice(0, -1).join('-')
    console.log(`[PIN_PROCESSING] Extracting base ID: "${comp.componentId}" -> "${baseComponentId}"`)
    if (!pinCellsByBase.has(baseComponentId)) {
      pinCellsByBase.set(baseComponentId, [])
    }
    pinCellsByBase.get(baseComponentId)!.push(comp)
  })
  
  console.log(`[PIN_PROCESSING] Found ${pinCellsByBase.size} base microcontroller components`)
  console.log(`[PIN_PROCESSING] Base component IDs:`, Array.from(pinCellsByBase.keys()))
  
  // Process each base component
  pinCellsByBase.forEach((pinCells, baseComponentId) => {
    console.log(`[PIN_PROCESSING] Processing base component: ${baseComponentId} with ${pinCells.length} pins`)
    
    // Find the actual base component position in the grid
    let baseGridCell = null
    let basePosition = null
    
    // Search the grid for the base component
    for (let y = 0; y < gridData.length; y++) {
      for (let x = 0; x < gridData[y].length; x++) {
        const cell = gridData[y][x]
        if (cell?.occupied && cell.componentId === baseComponentId) {
          baseGridCell = cell
          basePosition = { x, y }
          break
        }
      }
      if (baseGridCell) break
    }
    
    if (!baseGridCell) {
      console.log(`[PIN_PROCESSING] No base grid cell found for ${baseComponentId}`)
      return
    }
    
    console.log(`[PIN_PROCESSING] Found base component at (${basePosition?.x}, ${basePosition?.y})`)
    
    // Process each pin cell for this base component
    pinCells.forEach(comp => {
      // Extract cell index from the last part of the component ID
      // e.g., "Arduino Uno R3-1757665166853-39" -> cellIndex = 39
      const parts = comp.componentId.split('-')
      const cellIndex = parseInt(parts[parts.length - 1]) || 0
      console.log(`[PIN_PROCESSING] Processing pin cell: ${comp.componentId} (cellIndex: ${cellIndex})`)
      
      // Debug: Check if this is pin 13 (D13)
      if (cellIndex === 39) {
        console.log(`[PIN_PROCESSING] *** PROCESSING PIN 13 (D13) ***`)
      }
      
      // Get the module cell definition for this specific pin
      const moduleCell = baseGridCell.moduleDefinition.grid[cellIndex]
      
      if (moduleCell) {
        console.log(`[PIN_PROCESSING] Found moduleCell for ${comp.componentId}, cellIndex: ${cellIndex}, moduleCell:`, moduleCell)
        
        // Create a component object for this specific pin cell
        const pinComponent = {
          ...baseGridCell,
          cellIndex: cellIndex,
          moduleCell: moduleCell
        }
        
        console.log(`[PIN_PROCESSING] Processing pin component:`, pinComponent)
        
        // Process this specific pin cell
        const result = traceVoltageThroughComponent(
          pinComponent,
          0, // No input voltage for initial processing
          circuitCurrent,
          new Map(),
          new Set(),
          wires,
          gridData,
          effectiveGPIOStates
        )
        
        console.log(`[PIN_PROCESSING] Result for ${comp.componentId}:`, result.componentUpdates)
        
        // Apply the component updates
        result.componentUpdates.forEach((update, componentId) => {
          const existingState = componentStates.get(componentId)
          if (existingState) {
            const newState = { ...existingState, ...update }
            componentStates.set(componentId, newState)
            console.log(`[PIN_PROCESSING] Updated component state for ${componentId}:`, update)
            
            // Debug: Log PWM state updates specifically
            if (update.status === 'pwm' && update.pwm !== undefined) {
              console.log(`🔧 [PWM_DEBUG] PIN PWM STATE UPDATED: ${componentId} - Status: ${update.status}, PWM: ${update.pwm.toFixed(1)}%, Voltage: ${update.outputVoltage}V`)
            }
          }
        })
      } else {
        console.log(`[PIN_PROCESSING] No moduleCell found for ${comp.componentId} at cellIndex ${cellIndex}`)
      }
    })
  })
  
  // Step 3.5: Process parallel resistor components with their calculated currents
  if (updatedParallelBranches.length > 0) {
    
    updatedParallelBranches.forEach((branch, branchIndex) => {
      
      branch.components.forEach((comp) => {
        // Find the component in the grid and update its state
        const baseComponentId = comp.id
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
        
        // Calculate voltage drop across this individual resistor
        const individualResistance = comp.properties.resistance
        const individualCurrent = branch.current
        const voltageDrop = individualCurrent * individualResistance
        const outputVoltage = Math.max(0, branch.voltage - voltageDrop)
        

        // Update ALL cells of this resistor with the calculated values
        allResistorCells.forEach(cell => {
          const existingState = componentStates.get(cell.id)
          if (existingState) {
            componentStates.set(cell.id, {
              ...existingState,
              outputVoltage: outputVoltage,
              outputCurrent: individualCurrent,
              power: voltageDrop * individualCurrent,
              voltageDrop: voltageDrop,
              status: 'active',
              isPowered: outputVoltage > 0,
              isGrounded: false
            })
          }
        })
      })
    })
  }
  
  // Step 4: Systematic voltage flow calculation
  // Find power sources and trace voltage through circuit paths
  const powerSources = Array.from(componentStates.values()).filter(comp => 
    (comp.componentType === 'PowerSupply' && comp.isPowered) ||
    // Also include HIGH GPIO pins as power sources
    ((comp.componentType === 'Arduino Uno R3' || comp.componentType === 'ESP32' || 
      comp.componentType === 'ArduinoUno' || comp.componentType === 'ESP32DevKit') && 
     comp.isPowered && comp.outputVoltage > 0)
  )
  
  // Process all power sources (PowerSupply and HIGH GPIO pins)
  if (powerSources.length > 0) {
    
    powerSources.forEach(powerSource => {
      
      // Find wires connected to this power source
      const connectedWires = wires.filter(wire => 
        wire.segments.some(segment => 
          (segment.from.x === powerSource.position.x && segment.from.y === powerSource.position.y) ||
          (segment.to.x === powerSource.position.x && segment.to.y === powerSource.position.y)
        )
      )
      

      
      connectedWires.forEach(wire => {

      // Set initial wire voltage from power source
      let currentVoltage = powerSource.outputVoltage
      
      // Trace through the circuit path
      const result = traceVoltageThroughCircuit(
        wire,
        currentVoltage,
        circuitCurrent,
        componentStates,
        wires,
        gridData,
        effectiveGPIOStates
      )
      
      // Update component states with calculated voltages
      result.componentUpdates.forEach((update, componentId) => {

        const existingState = componentStates.get(componentId)
        if (existingState) {
          const newState = {
            ...existingState,
            ...update
          }
          componentStates.set(componentId, newState)

        } else {
          // If no existing state, create a new one with the update
          // Ensure all required fields are present
          const newState: ComponentState = {
            componentId: componentId,
            componentType: update.componentType || 'Unknown',
            position: update.position || { x: 0, y: 0 },
            outputVoltage: update.outputVoltage || 0,
            outputCurrent: update.outputCurrent || 0,
            power: update.power || 0,
            status: update.status || 'unpowered',
            isPowered: update.isPowered || false,
            isGrounded: update.isGrounded || false,
            ...update
          }
          componentStates.set(componentId, newState)
        }
      })
      
      // Update wire voltage based on the traced voltage
      const wireIndex = wires.findIndex(w => w.id === wire.id)
      if (wireIndex !== -1) {
        wires[wireIndex] = {
          ...wires[wireIndex],
          voltage: currentVoltage
        }
      }
    })
    }) // Close powerSources.forEach loop
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
        const _baseComponentId = componentId.replace(/-\d+$/, '') // Remove cell index
        
        return fromBaseComponentId === _baseComponentId || toBaseComponentId === _baseComponentId
      })
    )

    if (connectedWires.length > 0) {
      // Find the wire with the highest voltage (input voltage)
      const maxVoltageWire = connectedWires.reduce((max, wire) => 
        (wire.voltage || 0) > (max.voltage || 0) ? wire : max
      )
      
      const inputVoltage = maxVoltageWire.voltage || 0
 
      // Only recalculate if this component isn't a power source or microcontroller
      // Microcontrollers are handled by MicrocontrollerVoltageFlow and should not be recalculated here
      if (state.componentType !== 'PowerSupply' && state.componentType !== 'Battery' &&
          state.componentType !== 'Arduino Uno R3' && state.componentType !== 'ESP32' && 
          state.componentType !== 'ArduinoUno' && state.componentType !== 'ESP32DevKit') {
        // Recalculate component voltage using the input voltage from wires
        const calculator = componentCalculators[state.componentType.toLowerCase() as keyof typeof componentCalculators]
        if (calculator) {
          // Get component properties from grid data
          const cell = gridData[state.position.y]?.[state.position.x]
          let componentProperties = {}
          
          if (state.componentType === 'Resistor') {
            componentProperties = { resistance: cell?.resistance || 1000 }
          } else if (state.componentType === 'LED') {
            componentProperties = { 
              forwardVoltage: cell?.moduleDefinition?.properties?.forwardVoltage?.default || 2.0 
            }
            
            const result = calculator(componentProperties, inputVoltage, circuitCurrent)
            
            
            // For LEDs, we need to process ALL cells of the component (like resistors)
            const _baseComponentId = componentId.replace(/-\d+$/, '')
            
            // Find all cells of this LED component
            const allLedCells: Array<{id: string, position: {x: number, y: number}, cellIndex: number}> = []
            
            // Search the grid for all cells belonging to this LED
            for (let y = 0; y < gridData.length; y++) {
              for (let x = 0; x < gridData[y].length; x++) {
                const gridCell = gridData[y][x]
                if (gridCell?.occupied && gridCell.componentId === _baseComponentId) {
                  const cellId = `${_baseComponentId}-${gridCell.cellIndex || 0}`
                  allLedCells.push({
                    id: cellId,
                    position: { x, y },
                    cellIndex: gridCell.cellIndex || 0
                  })
                }
              }
            }
            
            
            // Update ALL cells of this LED with the same calculation result
            allLedCells.forEach(ledCell => {
              updatedComponentStates.set(ledCell.id, {
                ...state,
                outputVoltage: result.outputVoltage,
                outputCurrent: result.outputCurrent,
                power: result.power,
                status: result.status,
                isPowered: (result as any).isOn ?? false,
                isOn: (result as any).isOn,
                forwardVoltage: (result as any).forwardVoltage
              })
            })
            
            return // Skip the single cell update below since we handled all cells above
          }
          
          const result = calculator(componentProperties, inputVoltage, circuitCurrent)
          
          
          // Update component state with new calculation
          updatedComponentStates.set(componentId, {
            ...state,
            outputVoltage: result.outputVoltage,
            outputCurrent: result.outputCurrent,
            power: result.power,
            status: result.status,
            isPowered: result.outputVoltage > 0
          })
          
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
      const _baseComponentId = componentId.replace(/-\d+$/, '')
      if (!resistorGroups.has(_baseComponentId)) {
        resistorGroups.set(_baseComponentId, [])
      }
      resistorGroups.get(_baseComponentId)!.push({ id: componentId, state })
    } else if (state.componentType === 'LED') {
      const _baseComponentId = componentId.replace(/-\d+$/, '')
      if (!ledGroups.has(_baseComponentId)) {
        ledGroups.set(_baseComponentId, [])
      }
      ledGroups.get(_baseComponentId)!.push({ id: componentId, state })
    }
  })
  
  // For each resistor group, ensure all cells have the same voltage as cell -0
  resistorGroups.forEach((resistorCells, _baseComponentId) => {
    const cell0 = resistorCells.find(cell => cell.id.endsWith('-0'))
    if (cell0 && cell0.state.outputVoltage > 0) {
      const targetVoltage = cell0.state.outputVoltage
      
      resistorCells.forEach(cell => {
        if (cell.state.outputVoltage !== targetVoltage) {
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
  ledGroups.forEach((ledCells, _baseComponentId) => {
    const cell0 = ledCells.find(cell => cell.id.endsWith('-0'))
    if (cell0) {
      const targetStatus = cell0.state.status
      const targetIsPowered = cell0.state.isPowered
      const targetIsOn = cell0.state.isOn
      
      ledCells.forEach(cell => {
        if (cell.state.status !== targetStatus || cell.state.isPowered !== targetIsPowered || cell.state.isOn !== targetIsOn) {
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
  const updatedWires = wires.map(wire => {
    let wireVoltage = 0
    let isPowered = false
    let isGrounded = false
    
    
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
        }
      }
      
      // Find component state for to position
      if (toCell?.occupied && toCell.componentId) {
        const cellComponentId = `${toCell.componentId}-${toCell.cellIndex || 0}`
        const toComponent = updatedComponentStates.get(cellComponentId)
        if (toComponent) {
          connectedComponents.push(toComponent)
        }
      }
    })
    
    // Wire inherits voltage and PWM from component with highest output voltage
    let wirePWM: number | undefined = undefined
    
    if (connectedComponents.length > 0) {
      // Debug: Log all connected components for this wire
      console.log(`🔧 [PWM_WIRE_DEBUG] Wire ${wire.id} connected to ${connectedComponents.length} components:`, 
        connectedComponents.map(comp => ({
          id: comp.componentId,
          type: comp.componentType,
          status: comp.status,
          pwm: comp.pwm,
          voltage: comp.outputVoltage
        }))
      )
      
      const maxVoltageComponent = connectedComponents.reduce((max, comp) => 
        (comp.outputVoltage || 0) > (max.outputVoltage || 0) ? comp : max
      )
      
      wireVoltage = maxVoltageComponent.outputVoltage || 0
      isPowered = maxVoltageComponent.isPowered || false
      isGrounded = connectedComponents.some(comp => comp.isGrounded)
      
      // Handle PWM signals - propagate PWM throttle percentage
      if (maxVoltageComponent.status === 'pwm' && maxVoltageComponent.pwm !== undefined) {
        wirePWM = maxVoltageComponent.pwm
        console.log(`🔧 [PWM_WIRE] Transmitting PWM: ${wireVoltage}V with ${wirePWM?.toFixed(1)}% throttle from ${maxVoltageComponent.componentType}`)
      }
      
      // Also check for PWM from any connected component (including microcontrollers)
      if (wirePWM === undefined) {
        const pwmComponent = connectedComponents.find(comp => 
          comp.status === 'pwm' && comp.pwm !== undefined
        )
        if (pwmComponent) {
          wirePWM = pwmComponent.pwm
          console.log(`🔧 [PWM_WIRE] Found PWM from ${pwmComponent.componentType}: ${wireVoltage}V with ${wirePWM?.toFixed(1)}% throttle`)
        }
      }
      
      // Debug: Final wire PWM state
      if (wirePWM !== undefined) {
        console.log(`🔧 [PWM_WIRE_FINAL] Wire ${wire.id} final PWM: ${wirePWM?.toFixed(1)}% throttle`)
      }
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
      pwm: wirePWM, // Include PWM throttle percentage
      segments: wire.segments.map(segment => ({
        ...segment,
        isPowered,
        isGrounded,
        voltage: wireVoltage,
        current: circuitCurrent,
        pwm: wirePWM // Include PWM throttle percentage in segments too
      }))
    }
  })
  
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
  gridData: GridCell[][],
  gpioStates?: Map<number, any>
): {
  componentUpdates: Map<string, Partial<ComponentState>>
} {
  const componentUpdates = new Map<string, Partial<ComponentState>>()
  let currentVoltage = initialVoltage
  const visitedComponents = new Set<string>()
  

  // Find the destination of the start wire (where it connects to a component)
  const wireDestination = findWireDestination(startWire, gridData)
  if (!wireDestination) {
    return { componentUpdates }
  }
  
  
  
  // Find the component at the destination
  const component = findComponentAtPosition(wireDestination, gridData)
  if (!component) {
    logger.componentsError(`No component found at destination (${wireDestination.x}, ${wireDestination.y})`)
    return { componentUpdates }
  }
  
  
  // Trace voltage through this component and continue the path
  const result = traceVoltageThroughComponent(
    component,
    currentVoltage,
    circuitCurrent,
    componentUpdates,
    visitedComponents,
    wires,
    gridData,
    gpioStates
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
  gridData: GridCell[][],
  gpioStates?: Map<number, any>
): {
  componentUpdates: Map<string, Partial<ComponentState>>
} {
  const componentId = component.componentId
  const moduleType = component.moduleDefinition.module

  // Create cell-specific ID for visited check (consistent with recursive calls)
  const cellComponentId = `${componentId}-${component.cellIndex || 0}`
  
  // Avoid infinite loops
  if (visitedComponents.has(cellComponentId)) {
    return { componentUpdates }
  }
  
  visitedComponents.add(cellComponentId)

  // Calculate component output voltage based on input voltage and circuit current
  let outputVoltage = 0
  let isPowered = false
  let status = 'unpowered'
  
  // Create cell-specific ID for visited check (consistent with recursive calls)
  switch (moduleType) {
    case 'Resistor':
    
      // Call the Resistor voltage flow function
      const resistorResult = ResistorVoltageFlow(
        component,
        inputVoltage,
        circuitCurrent,
        componentUpdates,
        wires,
        gridData,
        componentId
      )
      
      // Extract the results
      outputVoltage = resistorResult.outputVoltage
      isPowered = resistorResult.isPowered
      status = resistorResult.status
      break
    case 'LED':
    
      // Call the LED voltage flow function
      const ledResult = LEDVoltageFlow(
        component,
        inputVoltage,
        circuitCurrent,
        componentUpdates,
        wires,
        gridData,
        componentId
      )
      
      // Extract the results
      outputVoltage = ledResult.outputVoltage
      isPowered = ledResult.isPowered
      status = ledResult.status
      
      break
    case 'Arduino Uno R3':
    case 'ESP32':
    case 'ArduinoUno':
    case 'ESP32DevKit':
    
      // Call the Microcontroller voltage flow function
      const mcuResult = MicrocontrollerVoltageFlow(
        component,
        inputVoltage,
        circuitCurrent,
        componentUpdates,
        wires,
        gridData,
        componentId,
        gpioStates
      )
      
      // Extract the results
      outputVoltage = mcuResult.outputVoltage
      isPowered = mcuResult.isPowered
      status = mcuResult.status
      
      break
    case 'Battery':
    case 'PowerSupply':
      // Power sources maintain their voltage
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
      break
    case 'Motor':
    case 'Output': // Handle Output components that are actually motors
      // For Output components, check if they're actually motors
      if (component.componentType === 'Output') {
        const moduleDef = component.moduleDefinition
        if (!moduleDef || !(moduleDef.module === 'Motor' || moduleDef.module === 'motor' || 
                           moduleDef.module?.toLowerCase().includes('motor') ||
                           moduleDef.module?.toLowerCase().includes('bldc'))) {
          // Not a motor, skip processing
          break
        }
      }
      
      console.log(`[MOTOR] Processing motor component: ${component.componentId} at (${component.x}, ${component.y})`)
      console.log(`[MOTOR] Component type: ${component.componentType}, Module: ${component.moduleDefinition?.module}`)
      logger.components(`[MOTOR] Processing motor component: ${component.componentId} at (${component.x}, ${component.y})`)
      const componentPosition = { x: component.x || 0, y: component.y || 0 }
      console.log(`[MOTOR] Scanning IN1–IN3 at origin (${componentPosition.x}, ${componentPosition.y})`)
      logger.components(`[MOTOR] Total wires available: ${wires.length}`)
      
      // 3-phase brushless inputs IN1, IN2, IN3 along top row
      const phaseOffsets = [
        { dx: 0, dy: 0, name: 'IN1' },
        { dx: 1, dy: 0, name: 'IN2' },
        { dx: 2, dy: 0, name: 'IN3' },
      ]

      let motorPWM: number | undefined = undefined
      let motorVoltage = inputVoltage
      let pwmVoltage = 0
      const connectedWires: WireConnection[] = []

      for (const phase of phaseOffsets) {
        const pinPosition = {
          x: componentPosition.x + phase.dx,
          y: componentPosition.y + phase.dy,
        }

        const phaseWires = wires.filter((wire) =>
          wire.segments.some(
            (segment) =>
              (segment.from.x === pinPosition.x && segment.from.y === pinPosition.y) ||
              (segment.to.x === pinPosition.x && segment.to.y === pinPosition.y)
          )
        )

        for (const wire of phaseWires) {
          connectedWires.push(wire)
          if (wire.pwm !== undefined && (motorPWM === undefined || wire.pwm > motorPWM)) {
            motorPWM = wire.pwm
          }
          if (wire.voltage > pwmVoltage) pwmVoltage = wire.voltage
          if (wire.voltage > motorVoltage) motorVoltage = wire.voltage
          console.log(
            `[MOTOR] Phase ${phase.name} wire ${wire.id}: PWM=${wire.pwm}, V=${wire.voltage}V`
          )
        }
      }

      console.log(`[MOTOR] Connected phase wires: ${connectedWires.length}`)
      logger.components(`[MOTOR] Connected phase wires: ${connectedWires.length}`)

      const hasPWM = motorPWM !== undefined && motorPWM > 0
      console.log(`🔧 [MOTOR] Phase drive: PWM=${motorPWM ?? 0}% (${hasPWM})`)
      
      // Use PWM voltage as the voltage source
      if (pwmVoltage > 0) {
        motorVoltage = pwmVoltage
      }
      
      // Debug: Log wire information
      console.log(`🔧 [MOTOR] Wire analysis:`)
      connectedWires.forEach(wire => {
        console.log(`🔧 [MOTOR] Wire ${wire.id}: PWM=${wire.pwm}, Voltage=${wire.voltage}V`)
      })
      console.log(`🔧 [MOTOR] Final motor voltage: ${motorVoltage}V, PWM: ${motorPWM}`)
      
      // Calculate motor electrical properties
      const motorProperties = {
        inputVoltage: motorVoltage, // Use voltage from wire, not inputVoltage parameter
        kv: component.parameters?.kv || 1000, // Default kV rating
        resistance: component.parameters?.resistance || 0.1, // Default resistance
        maxRPM: component.parameters?.maxRPM || 20000, // Default max RPM
        efficiency: component.parameters?.efficiency || 85, // Default efficiency
        poles: component.parameters?.poles || 14 // Default pole count
      }
      
      console.log(`[MOTOR] Calling motor calculation with motorVoltage: ${motorVoltage}V, motorPWM: ${motorPWM}`)
      console.log(`[MOTOR] Component state key: ${cellComponentId}`)
      logger.components(`[MOTOR] Calling motor calculation with motorVoltage: ${motorVoltage}V, motorPWM: ${motorPWM}`)
      const motorResult = calculateMotorElectricalProperties(motorVoltage, motorProperties, motorPWM)
      
      // Extract the results
      outputVoltage = motorResult.outputVoltage
      // BINARY: Motor is powered if it has PWM signal
      isPowered = hasPWM
      status = isPowered ? 'active' : 'inactive'
      
      // Update component state with motor-specific properties
      componentUpdates.set(cellComponentId, {
        outputVoltage: motorResult.outputVoltage,
        outputCurrent: motorResult.outputCurrent,
        power: motorResult.power,
        status,
        isPowered,
        isGrounded: false,
        // Motor-specific properties
        motorRPM: motorResult.actualRPM,
        instantaneousRPM: motorResult.instantaneousRPM,
        motorTorque: motorResult.instantaneousTorque,
        instantaneousTorque: motorResult.instantaneousTorque,
        powerBasedTorque: motorResult.powerBasedTorque,
        currentBasedTorque: motorResult.currentBasedTorque,
        motorEfficiency: motorProperties.efficiency,
        backEMF: motorResult.backEMF,
        powerLoss: motorResult.power - motorResult.mechanicalPower,
        angularVelocity: motorResult.angularVelocity,
        mechanicalPower: motorResult.mechanicalPower,
        speedConstant: motorResult.speedConstant,
        torqueConstant: motorResult.torqueConstant
      })
      
      console.log(`[MOTOR] ${componentId}: ${motorVoltage}V → ${motorResult.actualRPM.toFixed(0)} RPM, ${motorResult.instantaneousTorque.toFixed(3)} N⋅m`)
      console.log('[MOTOR] Setting component state for:', cellComponentId, 'with RPM:', motorResult.actualRPM, 'Status:', status, 'Powered:', isPowered)
      break
    default:
      console.log(`🔍 [BRANCH] Taking default branch for ${componentId}`)
      break
  }
  
  // Find the other terminal of this component and continue tracing
  const entryCell = component.moduleDefinition.grid[component.cellIndex || 0]
  const entryPosition = entryCell
    ? { x: component.x + entryCell.x, y: component.y + entryCell.y }
    : { x: component.x, y: component.y }
  const otherTerminal = findOtherTerminal(component, entryPosition)
  if (otherTerminal) {
    
    // Find wires connected to the other terminal
    const connectedWires = wires.filter(wire => 
      wire.segments.some(segment => 
        (segment.from.x === otherTerminal.x && segment.from.y === otherTerminal.y) ||
        (segment.to.x === otherTerminal.x && segment.to.y === otherTerminal.y)
      )
    )
    
    
    // Find the wire with the highest voltage to continue tracing
    if (connectedWires.length > 0) {
      const highestVoltageWire = connectedWires.reduce((highest, current) => 
        current.voltage > highest.voltage ? current : highest
      )
      
      // Find the next component connected to this wire
      const nextDestination = findWireDestination(highestVoltageWire, gridData, otherTerminal)
      if (nextDestination) {
        const nextComponent = findComponentAtPosition(nextDestination, gridData)
        // Find the wire connected to the next component
        const _connectedWire = wires.find(wire => 
          wire.segments.some(segment => 
            (segment.from.x === nextComponent.x && segment.from.y === nextComponent.y) ||
            (segment.to.x === nextComponent.x && segment.to.y === nextComponent.y)
          )
        )
        if (nextComponent) {
          // Create cell-specific ID for visited check
          const nextComponentCellId = `${nextComponent.componentId}-${nextComponent.cellIndex || 0}`
          if (!visitedComponents.has(nextComponentCellId)) {

            const nextResult = traceVoltageThroughComponent(
              nextComponent,
              outputVoltage, // Use this component's output voltage
              circuitCurrent,
              componentUpdates,
              visitedComponents,
              wires,
              gridData,
              gpioStates
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
function findOtherTerminal(
  component: any,
  currentPosition: { x: number; y: number }
): { x: number; y: number } | null {
  const terminals = component.moduleDefinition.grid.filter((cell: any) => 
    cell.isConnectable && (
      cell.type === 'LEAD' || 
      cell.type === 'LED_POSITIVE' || 
      cell.type === 'LED_NEGATIVE' ||
      cell.type === 'VCC' ||
      cell.type === 'GND' ||
      cell.type === 'POSITIVE' ||
      cell.type === 'NEGATIVE' ||
      cell.type.includes('TERMINAL') ||
      cell.type.includes('PIN')
    )
  )
  
  const otherTerminal = terminals.find((terminal: any) => {
    const terminalX = component.x + terminal.x
    const terminalY = component.y + terminal.y
    return terminalX !== currentPosition.x || terminalY !== currentPosition.y
  })
  
  if (otherTerminal) {
    return {
      x: component.x + otherTerminal.x,
      y: component.y + otherTerminal.y
    }
  }
  
  return null
}

/**
 * Get the destination position of a wire
 */
function _getWireDestination(wire: WireConnection, startPosition: { x: number; y: number }): { x: number; y: number } {
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
  _gridData: GridCell[][]
): WireConnection[] {
  
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
      const fromCell = _gridData[segment.from.y]?.[segment.from.x]
      const toCell = _gridData[segment.to.y]?.[segment.to.x]
      
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

    // Determine wire voltage and PWM based on connected components
    let wirePWM: number | undefined = undefined
    
    if (connectedComponents.length > 0) {
      
      // Check if any component is a voltage source (power supply positive)
      const voltageSource = connectedComponents.find(comp => 
        comp.componentType === 'PowerSupply' && comp.isPowered && !comp.isGrounded
      )
      
      if (voltageSource) {
        wireVoltage = voltageSource.outputVoltage || physicsResult.batteryVoltage || 5
        isPowered = true
      } else {
        // Use the component with the highest output voltage (closest to power source)
        const maxVoltageComponent = connectedComponents.reduce((max, comp) => 
          (comp.outputVoltage || 0) > (max.outputVoltage || 0) ? comp : max
        )
        
        if (maxVoltageComponent) {
          wireVoltage = maxVoltageComponent.outputVoltage || 0
          isPowered = maxVoltageComponent.isPowered || false
          
          // Handle PWM signals - propagate PWM throttle percentage
          if (maxVoltageComponent.status === 'pwm' && maxVoltageComponent.pwm !== undefined) {
            wirePWM = maxVoltageComponent.pwm
            console.log(`🔧 [PWM_WIRE] Transmitting PWM: ${wireVoltage}V with ${wirePWM?.toFixed(1)}% throttle`)
          }
        }
      }
      
      // Also check for PWM from any connected component (including microcontrollers)
      if (wirePWM === undefined) {
        const pwmComponent = connectedComponents.find(comp => 
          comp.status === 'pwm' && comp.pwm !== undefined
        )
        if (pwmComponent) {
          wirePWM = pwmComponent.pwm
          console.log(`🔧 [PWM_WIRE] Found PWM from ${pwmComponent.componentType}: ${wireVoltage}V with ${wirePWM?.toFixed(1)}% throttle`)
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
    
    
    return {
      ...wire,
      voltage: wireVoltage,
      current: wireCurrent,
      power: wireVoltage * wireCurrent,
      isPowered,
      isGrounded,
      isPowerable: isPowered,
      isGroundable: isGrounded,
      pwm: wirePWM, // Include PWM throttle percentage
      segments: wire.segments.map(segment => ({
        ...segment,
        isPowered,
        isGrounded,
        voltage: wireVoltage,
        current: wireCurrent,
        pwm: wirePWM // Include PWM throttle percentage in segments too
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
      const currentCell = newGrid[position.y][position.x]
      const currentVoltage = currentCell.voltage || 0
      const currentIsPowered = currentCell.isPowered || false
      const currentCapVoltage = currentCell.capacitorVoltage ?? 0
      
      // Check if voltage or power state has changed
      const voltageChanged = Math.abs(currentVoltage - state.outputVoltage) > 0.01
      const powerStateChanged = currentIsPowered !== state.isPowered
      const capVoltageChanged =
        typeof (state as { capacitorVoltage?: number }).capacitorVoltage === 'number' &&
        Math.abs(currentCapVoltage - (state as { capacitorVoltage: number }).capacitorVoltage) > 0.001
      
      if (voltageChanged || powerStateChanged || capVoltageChanged) {
        if (!hasChanges) {
          newGrid[position.y] = [...newGrid[position.y]]
          hasChanges = true
        }
        const updates: Partial<GridCell> = {
          voltage: state.outputVoltage,
          current: state.outputCurrent,
          isPowered: state.isPowered,
        }
        if (typeof (state as { capacitorVoltage?: number }).capacitorVoltage === 'number') {
          updates.capacitorVoltage = (state as { capacitorVoltage: number }).capacitorVoltage
        }
        newGrid[position.y][position.x] = {
          ...newGrid[position.y][position.x],
          ...updates,
        }
      }
    }
  })
  
  return hasChanges ? newGrid : gridData
}

/**
 * Main electrical calculation function.
 * Uses the netlist MNA solver with chain-based continuity validation.
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
  const multiMCUStates = getAllMultiMicrocontrollerGPIOStates()
  const singleDynamicStates = getDynamicGPIOStates()
  const effectiveGPIOStates =
    multiMCUStates.size > 0 ? multiMCUStates :
    singleDynamicStates.size > 0 ? singleDynamicStates :
    gpioStates

  const occupiedComponents = extractOccupiedComponents(gridData)
  const circuitAnalysis = findCircuitPathways(occupiedComponents, wires)
  const pathways = circuitAnalysis.pathways

  const solverResult = solveCircuit(gridData, wires, effectiveGPIOStates)
  const componentStates = solverResult.componentStates as Map<string, ComponentState>
  const updatedWires = solverResult.updatedWires
  const updatedGridData = updateGridData(gridData, componentStates)

  return {
    componentStates,
    updatedWires,
    updatedGridData,
    circuitInfo: {
      totalVoltage: solverResult.totalVoltage,
      totalCurrent: solverResult.totalCurrent,
      totalResistance: solverResult.totalResistance,
      totalPower: solverResult.totalPower,
      errors: solverResult.works
        ? [...circuitAnalysis.errors, ...solverResult.errors]
        : [
            solverResult.reason || 'Circuit solve failed',
            ...solverResult.errors,
            ...circuitAnalysis.errors,
          ],
      pathways,
    },
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
    return states
  }

  // Compute branch voltage drop & total resistance (including parallel)
  const { totalResistance, totalVoltageDrop, ledCurrentRequirement, motorCurrentRequirement } = calculateCircuitParameters(branch, parallelBranches)
  const effectiveVoltage = Math.max(0, sourceVoltage - totalVoltageDrop)
  const resistorCurrent = totalResistance > 0 ? effectiveVoltage / totalResistance : maxCurrent

  // Current through branch = min(limit by resistor, LED/motor requirement, source)
  const branchCurrent = Math.min(ledCurrentRequirement + motorCurrentRequirement, resistorCurrent, maxCurrent)
  
  // Calculate parallel branch currents
  const updatedParallelBranches = calculateParallelBranchCurrents(parallelBranches, effectiveVoltage)
  
  // Log parallel branch information
  if (updatedParallelBranches.length > 0) {
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
      }
    })
  })
  
  return states
}
  