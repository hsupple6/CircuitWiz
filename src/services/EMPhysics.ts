export function OhmLawCurrent(voltage: number, resistance: number) {
  return voltage / resistance
}

export function OhmLawResistance(current: number, voltage: number) {
  return voltage / current
}

export function OhmLawVoltage(current: number, resistance: number) {
  return current * resistance
}

export function PowerLaw(voltage: number, current: number) {
  return voltage * current
}

export function PowerLawResistor(current: number, resistance: number) {
  return current * current * resistance
}

export function PowerLawLED(current: number, forwardVoltage: number) {
  return current * forwardVoltage
}

export function PowerLawBattery(current: number, voltage: number) {
  return current * voltage
}

export function ParallelResistance(resistances: number[]) {
    if (resistances.includes(0)) {
        return 0; // short circuit
        }
  return 1 / resistances.reduce((acc, resistance) => acc + 1 / resistance, 0)
}

export function SeriesResistance(resistances: number[]) {
  return resistances.reduce((acc, resistance) => acc + resistance, 0)
}
// Node interface for CalculateCircuit function
export interface CircuitNode {
  type: 'VoltageSource' | 'GroundingSource' | 'Resistor' | 'LED' | 'PowerSupply' | 'Arduino' | 'Switch' | 'Motor' | 'Sensor';
  voltage?: number;
  resistance?: number;
  forwardVoltage?: number;
  maxCurrent?: number;
  current?: number;
  power?: number;
  maxPower?: number; // Maximum power rating for components
  id: string; // Make id required
  position: { x: number; y: number }; // Make position required
  isPowered?: boolean;
  isGrounded?: boolean;
  status?: string;
  componentId?: string; // Add componentId for tracking
  cellIndex?: number; // Add cellIndex for terminal tracking
}

export function CalculateCircuit(nodes: CircuitNode[], wires: any[] = [], hasContinuity: boolean = false) {
    let batteryVoltage = 0;
    let totalResistance = 0;
    let totalLEDVoltage = 0;
    let totalCurrent = 0;
    let componentStates = new Map<string, any>();
    let hasVoltageSource = false;
    let hasGroundingSource = false;
    let errors: string[] = [];
  
    // Pass 1: classify nodes and calculate totals
    
    for (const node of nodes) {
      if (node.type === 'VoltageSource' || node.type === 'PowerSupply') {
        batteryVoltage += node.voltage || 0;
        hasVoltageSource = true;
      }
      if (node.type === 'GroundingSource') {
        hasGroundingSource = true;
      }
      if (node.type === 'Resistor') {
        totalResistance += node.resistance || 0;
      }
      if (node.type === 'LED') {
        totalLEDVoltage += node.forwardVoltage || 2.0;
      }
    }
    
  
    // Step 2: Check if we have both voltage source and grounding source
    if (!hasVoltageSource) {
      return {
        works: false,
        reason: "No voltage source found in circuit",
        batteryVoltage: 0,
        totalLEDVoltage: 0,
        totalResistance: 0,
        current: 0,
        componentStates: new Map(),
        errors: ["No voltage source found"]
      };
    }
    
    if (!hasGroundingSource) {
      return {
        works: false,
        reason: "No grounding source found in circuit",
        batteryVoltage,
        totalLEDVoltage: 0,
        totalResistance: 0,
        current: 0,
        componentStates: new Map(),
        errors: ["No grounding source found"]
      };
    }
    
    if (!hasContinuity) {
      return {
        works: false,
        reason: "No continuity - circuit is not complete",
        batteryVoltage,
        totalLEDVoltage: 0,
        totalResistance: 0,
        current: 0,
        componentStates: new Map(),
        errors: ["No continuity - circuit path is incomplete"]
      };
    }
  
    // Step 3: check if battery can power the LEDs
    if (batteryVoltage < totalLEDVoltage) {
      return {
        works: false,
        reason: "Battery voltage too low to power LEDs",
        batteryVoltage,
        totalLEDVoltage,
        totalResistance,
        current: 0,
        componentStates: new Map(),
        errors: [`Battery voltage (${batteryVoltage}V) too low to power LEDs (${totalLEDVoltage}V)`]
      };
    }
  
    // Step 3: voltage left for resistors
    const voltageAcrossResistors = batteryVoltage - totalLEDVoltage;
  
    // Step 4: current (I = V / R)
    const current = totalResistance > 0
      ? OhmLawCurrent(voltageAcrossResistors, totalResistance)
      : 0; // no resistor = no current flow
  
    totalCurrent = current;
      
    // Step 5: calculate individual component states and check power limits
    // For series circuits, we need to calculate cumulative voltage drops
    let cumulativeVoltageDrop = 0;
    
    for (const node of nodes) {
      let componentState: any = {
        id: node.id,
        type: node.type,
        position: node.position,
        isPowered: false,
        isGrounded: false,
        status: 'unpowered'
      };

      if (node.type === 'VoltageSource' || node.type === 'PowerSupply') {
        const power = PowerLaw(node.voltage || 0, current);
        componentState = {
          ...componentState,
          outputVoltage: node.voltage,
          outputCurrent: current,
          power,
          status: 'active',
          isPowered: true
        };
        
        // Check power limits for voltage source
        if (node.maxPower && power > node.maxPower) {
          errors.push(`Voltage source ${node.id} exceeded power limit: ${power.toFixed(3)}W > ${node.maxPower}W`);
        }
      } else if (node.type === 'GroundingSource') {
        componentState = {
          ...componentState,
          outputVoltage: 0,
          outputCurrent: current,
          power: 0,
          status: 'grounded',
          isGrounded: true
        };
      } else if (node.type === 'Resistor') {
        const voltageDrop = OhmLawVoltage(current, node.resistance || 0);
        const power = PowerLawResistor(current, node.resistance || 0);
        const outputVoltage = Math.max(0, batteryVoltage - cumulativeVoltageDrop - voltageDrop);
        
        componentState = {
          ...componentState,
          outputVoltage,
          outputCurrent: current,
          power,
          voltageDrop,
          status: 'active',
          isPowered: true
        };
        
        // Add this resistor's voltage drop to cumulative
        cumulativeVoltageDrop += voltageDrop;
        
        // Check power limits for resistor
        if (node.maxPower && power > node.maxPower) {
          errors.push(`Resistor ${node.id} exceeded power limit: ${power.toFixed(3)}W > ${node.maxPower}W`);
        }
      } else if (node.type === 'LED') {
        const forwardVoltage = node.forwardVoltage || 2.0;
        const outputVoltage = Math.max(0, batteryVoltage - cumulativeVoltageDrop - forwardVoltage);
        const isOn = batteryVoltage >= (cumulativeVoltageDrop + forwardVoltage) && current > 0;
        const power = PowerLawLED(current, forwardVoltage);
        
        componentState = {
          ...componentState,
          outputVoltage,
          outputCurrent: current,
          power,
          forwardVoltage,
          isOn,
          status: isOn ? 'on' : 'off',
          isPowered: isOn,
          isGrounded: true
        };
        
        // Add this LED's forward voltage to cumulative
        cumulativeVoltageDrop += forwardVoltage;
        
        // Check power limits for LED
        if (node.maxPower && power > node.maxPower) {
          errors.push(`LED ${node.id} exceeded power limit: ${power.toFixed(3)}W > ${node.maxPower}W`);
        }
      }

      if (node.id) {
        componentStates.set(node.id, componentState);
      }
    }
  
    // Step 6: power distribution
    const powerResistors = PowerLawResistor(current, totalResistance);
    const powerLEDs = current * totalLEDVoltage;
    const powerBattery = PowerLaw(batteryVoltage, current);
  
    return {
      works: errors.length === 0,
      batteryVoltage,
      current: totalCurrent,
      powerBattery,
      powerResistors,
      powerLEDs,
      totalLEDVoltage,
      totalResistance,
      componentStates,
      voltageAcrossResistors,
      errors: errors.length > 0 ? errors : undefined
    };
  }

/**
 * Convert grid components to circuit nodes for CalculateCircuit
 */
export function convertGridToNodes(gridData: any[][], _wires: any[]): CircuitNode[] {
  const nodes: CircuitNode[] = [];
  const processedComponents = new Set<string>();
  
  let occupiedCells = 0;
  let totalCells = 0;
  
  gridData.forEach((row, y) => {
    if (!row || !Array.isArray(row)) return;
    row.forEach((cell, x) => {
      totalCells++;
      if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
        occupiedCells++;
        const moduleType = cell.moduleDefinition.module;
        const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0];
                
        if (!moduleCell) return;
        
        // Only create nodes for connectable cells (terminals)
        if (!moduleCell.isConnectable) {
          return;
        }
        
        // For power supplies, allow both positive and negative terminals
        // For other components, only process once per component
        if (moduleType !== 'Battery' && moduleType !== 'PowerSupply') {
          if (processedComponents.has(cell.componentId)) return;
          processedComponents.add(cell.componentId);
        }
        
        let node: CircuitNode = {
          type: moduleType as any,
          id: `${cell.componentId}-${cell.cellIndex || 0}`, // Use componentId-cellIndex for unique IDs
          position: { x, y }
        };
        
        // Extract properties based on component type and cell type
        if (moduleType === 'Battery' || moduleType === 'PowerSupply') {
          // Check if this is the positive or negative terminal
          if (moduleCell.type === 'POSITIVE' || moduleCell.type === 'VCC' || moduleCell.pin === '+' || moduleCell.pin === '5V') {
            node.type = 'VoltageSource';
            node.id = `${cell.componentId}_positive`; // Unique ID for positive terminal
            node.voltage = moduleCell.voltage || cell.moduleDefinition.properties?.voltage?.default || 5.0;
            node.current = moduleCell.current || cell.moduleDefinition.properties?.current?.default || 1.0;
            node.maxPower = moduleCell.maxPower || cell.moduleDefinition.properties?.maxPower?.default;
          } else if (moduleCell.type === 'NEGATIVE' || moduleCell.type === 'GND' || moduleCell.pin === '-' || moduleCell.pin === 'GND') {
            node.type = 'GroundingSource';
            node.id = `${cell.componentId}_negative`; // Unique ID for negative terminal
            node.voltage = 0;
            node.current = moduleCell.current || cell.moduleDefinition.properties?.current?.default || 1.0;
          } 
        } else if (moduleType === 'Resistor') {
          // Get resistance from the component's current value, not the default
          node.resistance = cell.resistance || moduleCell.resistance || cell.moduleDefinition.properties?.resistance?.default || 1000;
          node.maxPower = moduleCell.maxPower || cell.moduleDefinition.properties?.powerRating?.default || 0.25; // Default 0.25W
        } else if (moduleType === 'LED') {
          node.forwardVoltage = moduleCell.voltage || cell.moduleDefinition.properties?.forwardVoltage?.default || 2.0;
          node.maxCurrent = moduleCell.current || cell.moduleDefinition.properties?.maxCurrent?.default || 0.02;
          node.maxPower = moduleCell.maxPower || cell.moduleDefinition.properties?.maxPower?.default || 0.1; // Default 0.1W
        } else if (moduleType === 'Arduino Uno R3') {
          if (moduleCell.type === 'GPIO' && moduleCell.isPowerable) {
            node.type = 'VoltageSource';
            node.voltage = 5.0; // Arduino provides 5V
            node.current = 0.5; // Typical Arduino current
          } else if (moduleCell.type === 'GND') {
            node.type = 'GroundingSource';
            node.voltage = 0;
          }
        }
        
        nodes.push(node);
      }
    });
  });
  
  return nodes;
}

/**
 * Check if there's continuity between voltage source and grounding source
 */
export function checkContinuity(nodes: CircuitNode[], wires: any[]): boolean {
  
  // Find voltage source and grounding source
  const voltageSource = nodes.find(node => node.type === 'VoltageSource');
  const groundingSource = nodes.find(node => node.type === 'GroundingSource');
  
  if (!voltageSource || !groundingSource) {
    return false;
  }
  
  
  // If no wires, check if they're adjacent (grid adjacency)
  if (wires.length === 0) {
    const distance = Math.abs((voltageSource.position?.x || 0) - (groundingSource.position?.x || 0)) + 
                    Math.abs((voltageSource.position?.y || 0) - (groundingSource.position?.y || 0));
    const isAdjacent = distance <= 2; // Allow for some adjacency
    return isAdjacent;
  }
  
  // Check if there's a path through wires from voltage source to grounding source
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [voltageSource.position!];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.x},${current.y}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    
    // Check if we've reached the grounding source
    if (current.x === groundingSource.position?.x && current.y === groundingSource.position?.y) {
      return true;
    }
    
    // Find wires connected to this position
    const connectedWires = wires.filter(wire => 
      wire.segments.some((segment: any) => 
        (segment.from.x === current.x && segment.from.y === current.y) ||
        (segment.to.x === current.x && segment.to.y === current.y)
      )
    );
    
    
    // Add connected positions to queue
    connectedWires.forEach(wire => {
      wire.segments.forEach((segment: any) => {
        // Add both from and to positions to handle bidirectional connections
        const positions = [
          { x: segment.from.x, y: segment.from.y },
          { x: segment.to.x, y: segment.to.y }
        ];
        
        positions.forEach(pos => {
          const nextKey = `${pos.x},${pos.y}`;
          if (!visited.has(nextKey)) {
            console.log(`🔍 Adding next position (${pos.x}, ${pos.y}) to queue`);
            queue.push(pos);
          }
        });
      });
    });
    
    // Also check for grid adjacency (components next to each other)
    const adjacentPositions = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 }
    ];
    
    adjacentPositions.forEach(pos => {
      const nextKey = `${pos.x},${pos.y}`;
      if (!visited.has(nextKey)) {
        // Check if there's a component at this adjacent position
        const hasComponent = nodes.some(node => 
          node.position?.x === pos.x && node.position?.y === pos.y
        );
        if (hasComponent) {
          console.log(`🔍 Adding adjacent component position (${pos.x}, ${pos.y}) to queue`);
          queue.push(pos);
        }
      }
    });
  }
  
  console.log(`🔍 No path found to grounding source - no continuity`);
  return false;
}

/**
 * Find circuit pathways from voltage sources to grounding sources
 */
export function findCircuitPathways(occupiedComponents: any[], wires: any[]): {
  pathways: CircuitNode[][];
  errors: string[];
  warnings: string[];
} {
  const pathways: CircuitNode[][] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Step 1: Find all voltage sources and ground sources with their exact coordinates
  const voltageSources = findVoltageSources(occupiedComponents);
  const groundSources = findGroundSources(occupiedComponents);
  
  // Debug: Check for duplicate voltage sources
  const voltageSourcePositions = voltageSources.map(v => `${v.position.x},${v.position.y}`);
  const uniquePositions = new Set(voltageSourcePositions);
  if (voltageSourcePositions.length !== uniquePositions.size) {
    console.log(`⚠️ Duplicate voltage source positions detected:`, voltageSourcePositions);
  }
  
  // Check for basic circuit requirements
  if (voltageSources.length === 0) {
    errors.push('❌ No voltage sources found - circuit needs at least one battery or power supply');
  }
  
  if (groundSources.length === 0) {
    errors.push('❌ No ground sources found - circuit needs at least one ground connection');
  }
  
  if (wires.length === 0 && occupiedComponents.length > 1) {
    warnings.push('⚠️ No wires found - components may not be properly connected');
  }
  
  if (occupiedComponents.length === 0) {
    warnings.push('⚠️ No components placed on the circuit board');
  }
  
  // Step 2: For each voltage source, find all wires connected to it
  voltageSources.forEach(voltageSource => {
    
    // Find all wires connected to this voltage source
    const connectedWires = findWiresAtPosition(voltageSource.position, wires);
    
    if (connectedWires.length === 0) {
      errors.push(`❌ Voltage source ${voltageSource.id} has no wires connected - circuit is open`);
    }
    
    // Step 3: For each wire, trace a separate circuit path
    connectedWires.forEach((wire, wireIndex) => {
      const result = traceCircuitFromWire(wire, voltageSource, groundSources, occupiedComponents, wires);
      
      if (result.pathway.length > 0) {
        pathways.push(result.pathway);
      } else {
        if (result.error) {
          errors.push(`❌ Open circuit from ${voltageSource.id}: ${result.error}`);
        }
      }
    });
  });
  
  // Check for isolated components
  const connectedComponents = new Set<string>();
  pathways.forEach(pathway => {
    pathway.forEach(node => {
      if (node.componentId) {
        connectedComponents.add(node.componentId);
      }
    });
  });
  
  const isolatedComponents = occupiedComponents.filter(comp => 
    !connectedComponents.has(comp.componentId)
  );
  
  if (isolatedComponents.length > 0) {
    warnings.push(`⚠️ ${isolatedComponents.length} isolated component(s) found: ${isolatedComponents.map(c => c.componentId).join(', ')}`);
  }
  
  // Check for multiple voltage sources without proper isolation
  if (voltageSources.length > 1 && pathways.length > 0) {
    warnings.push(`⚠️ Multiple voltage sources detected (${voltageSources.length}) - ensure they don't conflict`);
  }
  
  return { pathways, errors, warnings };
}

/**
 * Find all voltage sources with their exact coordinates
 */
function findVoltageSources(occupiedComponents: any[]): CircuitNode[] {
  const voltageSources: CircuitNode[] = [];
  
  occupiedComponents.forEach(component => {
    const moduleType = component.moduleDefinition.module;
        
        if (moduleType === 'Battery' || moduleType === 'PowerSupply') {
      // Find the positive terminal (only create one voltage source per component)
      const positiveTerminal = component.moduleDefinition.grid.find((cell: any) => 
        cell.isConnectable && (cell.type === 'POSITIVE' || cell.type === 'VCC' || cell.pin === '+')
      );
      
      if (positiveTerminal) {
        const cellIndex = component.moduleDefinition.grid.indexOf(positiveTerminal);
            voltageSources.push({
              type: 'VoltageSource',
          id: `${component.componentId}_positive`,
          voltage: positiveTerminal.voltage || 5.0,
          position: { 
            x: component.x + positiveTerminal.x, 
            y: component.y + positiveTerminal.y 
          },
          componentId: component.componentId,
          cellIndex: cellIndex
        });
        }
      }
    });
  
  return voltageSources;
}

/**
 * Find all ground sources with their exact coordinates
 */
function findGroundSources(occupiedComponents: any[]): CircuitNode[] {
  const groundSources: CircuitNode[] = [];
  
  occupiedComponents.forEach(component => {
    const moduleType = component.moduleDefinition.module;
    
    if (moduleType === 'Battery' || moduleType === 'PowerSupply') {
      // Check all terminals of this component
      component.moduleDefinition.grid.forEach((cell: any, cellIndex: number) => {
        if (cell.type === 'NEGATIVE' || cell.type === 'GND' || cell.pin === '-') {
          groundSources.push({
            type: 'GroundingSource',
            id: `${component.componentId}_negative`,
            voltage: 0,
            position: { 
              x: component.x + cell.x, 
              y: component.y + cell.y 
            },
            componentId: component.componentId,
            cellIndex: cellIndex
          });
        }
      });
    }
  });
  
  return groundSources;
}

/**
 * Find all wires connected to a specific position
 */
function findWiresAtPosition(position: { x: number; y: number }, wires: any[]): any[] {
  return wires.filter(wire => 
    wire.segments.some((segment: any) => 
      (segment.from.x === position.x && segment.from.y === position.y) ||
      (segment.to.x === position.x && segment.to.y === position.y)
    )
  );
}

/**
 * Trace a complete circuit starting from a wire
 */
function traceCircuitFromWire(
  startWire: any,
  voltageSource: CircuitNode,
  groundSources: CircuitNode[],
  occupiedComponents: any[],
  wires: any[]
): { pathway: CircuitNode[]; error?: string } {
  const circuitPath: CircuitNode[] = [voltageSource];
  const visitedWires = new Set<string>();
  const visitedComponents = new Set<string>();
  
  
  // Follow the wire to its destination
  const wireDestination = getWireDestination(startWire, voltageSource.position);
  
  // Check if destination is a ground source
  const isGround = groundSources.some(ground => 
    ground.position.x === wireDestination.x && ground.position.y === wireDestination.y
  );
  
  if (isGround) {
    console.log(`✅ Direct connection to ground found!`);
    const groundSource = groundSources.find(ground => 
      ground.position.x === wireDestination.x && ground.position.y === wireDestination.y
    );
    if (groundSource) {
      circuitPath.push(groundSource);
    }
    return { pathway: circuitPath };
  }
  
  // Find component at destination
  const component = findComponentAtPosition(wireDestination, occupiedComponents);
  if (!component) {
    return { 
      pathway: [], 
      error: `Wire leads to empty space at (${wireDestination.x}, ${wireDestination.y}) - no component found` 
    };
  }

  
  // Check if this is a PowerSupply/Battery component
  if (component.moduleDefinition.module === 'PowerSupply' || component.moduleDefinition.module === 'Battery') {
    // Find the specific cell we're connecting to
    const targetCell = component.moduleDefinition.grid.find((cell: any) => 
      (component.x + cell.x) === wireDestination.x && (component.y + cell.y) === wireDestination.y
    );
    
    
    // Allow connections to PowerSupply terminals (VCC, GND, POSITIVE, NEGATIVE)
    if (targetCell && (
      targetCell.type === 'VCC' || 
      targetCell.type === 'GND' || 
      targetCell.type === 'POSITIVE' || 
      targetCell.type === 'NEGATIVE' ||
      targetCell.pin === '+' ||
      targetCell.pin === '-' ||
      targetCell.pin === '5V' ||
      targetCell.pin === 'GND'
    )) {
      console.log(`✅ Connection to PowerSupply terminal ${targetCell.type || targetCell.pin} is allowed`);
      // This is a valid terminal connection - continue with normal processing
    } else {
      console.log(`⚠️ Skipping ${component.moduleDefinition.module} component - not a terminal connection`);
      return { 
        pathway: [], 
        error: `Wire leads to ${component.moduleDefinition.module} component body - circuit should only use terminals` 
      };
    }
  }
  
  // Add component to path
  const componentNode = convertComponentToNode(component);
  if (componentNode) {
    circuitPath.push(componentNode);
    visitedComponents.add(component.componentId);
  }
  
  // Find the other terminal of this component
  const otherTerminal = findOtherTerminal(component, wireDestination);
  if (!otherTerminal) {
    return { 
      pathway: [], 
      error: `Component ${component.componentId} has only one terminal - cannot continue circuit` 
    };
  }
  
  
  // Recursively trace from the other terminal
  const result = traceFromTerminal(
    otherTerminal,
    groundSources,
    occupiedComponents,
    wires,
    circuitPath,
    visitedWires,
    visitedComponents
  );
  
  return result;
}

/**
 * Get the destination position of a wire (opposite end from start position)
 */
function getWireDestination(wire: any, startPosition: { x: number; y: number }): { x: number; y: number } {
  const segment = wire.segments.find((seg: any) => 
    seg.from.x === startPosition.x && seg.from.y === startPosition.y
  );
  
  if (segment) {
    return { x: segment.to.x, y: segment.to.y };
  }
  
  // If not found, try the reverse
  const reverseSegment = wire.segments.find((seg: any) => 
    seg.to.x === startPosition.x && seg.to.y === startPosition.y
  );
  
  if (reverseSegment) {
    return { x: reverseSegment.from.x, y: reverseSegment.from.y };
  }
  
  // Fallback - return the last segment's destination
  const lastSegment = wire.segments[wire.segments.length - 1];
  return { x: lastSegment.to.x, y: lastSegment.to.y };
}

/**
 * Find component at a specific position
 */
function findComponentAtPosition(position: { x: number; y: number }, occupiedComponents: any[]): any | null {
  return occupiedComponents.find(component => {
    // Check if position is within this component's grid
    return component.moduleDefinition.grid.some((cell: any) => 
      (component.x + cell.x) === position.x && 
      (component.y + cell.y) === position.y
    );
  });
}

/**
 * Find the other terminal of a component (the one not at the given position)
 */
function findOtherTerminal(component: any, currentPosition: { x: number; y: number }): { x: number; y: number } | null {
  
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
  );
  
  // Find terminal that's not at current position
  const otherTerminal = terminals.find((terminal: any) => 
    (component.x + terminal.x) !== currentPosition.x || 
    (component.y + terminal.y) !== currentPosition.y
  );
  
  if (otherTerminal) {
    const result = {
      x: component.x + otherTerminal.x,
      y: component.y + otherTerminal.y
    };
    return result;
  }
  
  return null;
}

/**
 * Recursively trace circuit from a terminal position
 */
function traceFromTerminal(
  position: { x: number; y: number },
  groundSources: CircuitNode[],
  occupiedComponents: any[],
  wires: any[],
  circuitPath: CircuitNode[],
  visitedWires: Set<string>,
  visitedComponents: Set<string>
): { pathway: CircuitNode[]; error?: string } {  
  // Check if we've reached a ground source
  const groundSource = groundSources.find(ground => 
    ground.position.x === position.x && ground.position.y === position.y
  );
  
  if (groundSource) {
    circuitPath.push(groundSource);
    return { pathway: circuitPath };
  }
  
  // Find wires connected to this position
  const connectedWires = findWiresAtPosition(position, wires).filter(wire => 
    !visitedWires.has(wire.id)
  );
  
  if (connectedWires.length === 0) {
    return { 
      pathway: [], 
      error: `Circuit ends at (${position.x}, ${position.y}) - no wires connected to continue path` 
    };
  }
  
  // Follow the first unvisited wire
  const nextWire = connectedWires[0];
  visitedWires.add(nextWire.id);
  
  
  // Get destination of this wire
  const destination = getWireDestination(nextWire, position);
  
  // Check if destination is a ground
  const isGround = groundSources.some(ground => 
    ground.position.x === destination.x && ground.position.y === destination.y
  );
  
  if (isGround) {
    const groundSource = groundSources.find(ground => 
      ground.position.x === destination.x && ground.position.y === destination.y
    );
    if (groundSource) {
      circuitPath.push(groundSource);
    }
    return { pathway: circuitPath };
  }
  
  // Find component at destination
  const component = findComponentAtPosition(destination, occupiedComponents);
  if (!component) {
    return { 
      pathway: [], 
      error: `Wire leads to empty space at (${destination.x}, ${destination.y}) - no component found` 
    };
  }
  
  // Check if this is a PowerSupply/Battery component
  if (component.moduleDefinition.module === 'PowerSupply' || component.moduleDefinition.module === 'Battery') {
    // Find the specific cell we're connecting to
    const targetCell = component.moduleDefinition.grid.find((cell: any) => 
      (component.x + cell.x) === destination.x && (component.y + cell.y) === destination.y
    );
    
    
    // Allow connections to PowerSupply terminals (VCC, GND, POSITIVE, NEGATIVE)
    if (targetCell && (
      targetCell.type === 'VCC' || 
      targetCell.type === 'GND' || 
      targetCell.type === 'POSITIVE' || 
      targetCell.type === 'NEGATIVE' ||
      targetCell.pin === '+' ||
      targetCell.pin === '-' ||
      targetCell.pin === '5V' ||
      targetCell.pin === 'GND'
    )) {
      // This is a valid terminal connection - continue with normal processing
    } else {
      return { 
        pathway: [], 
        error: `Wire leads to ${component.moduleDefinition.module} component body - circuit should only use terminals` 
      };
    }
  }
  
  if (visitedComponents.has(component.componentId)) {
    return { 
      pathway: [], 
      error: `Circuit loop detected - component ${component.componentId} already in path` 
    };
  }
  
  
  // Add component to path
  const componentNode = convertComponentToNode(component);
  if (componentNode) {
    circuitPath.push(componentNode);
    visitedComponents.add(component.componentId);
  }
  
  // Find other terminal and continue tracing
  const otherTerminal = findOtherTerminal(component, destination);
  if (!otherTerminal) {
    return { 
      pathway: [], 
      error: `Component ${component.componentId} has only one terminal - cannot continue circuit` 
    };
  }
  
  // Recursively continue tracing
  return traceFromTerminal(
    otherTerminal,
    groundSources,
    occupiedComponents,
    wires,
    circuitPath,
    visitedWires,
    visitedComponents
  );
}



/**
 * Convert a single occupied component to a circuit node
 */
function convertComponentToNode(component: any): CircuitNode | null {
  const moduleType = component.moduleDefinition.module;
  const moduleCell = component.moduleDefinition.grid[component.cellIndex || 0];
  
  if (!moduleCell) return null;
  
  let node: CircuitNode = {
    type: moduleType as any,
    id: component.componentId,
    position: { x: component.x, y: component.y }
  };
  
  // Add component-specific properties
  if (moduleType === 'Resistor') {
    node.resistance = component.resistance || moduleCell.resistance || 1000;
  } else if (moduleType === 'LED') {
    node.forwardVoltage = component.moduleDefinition?.properties?.forwardVoltage?.default ||
                         moduleCell.properties?.forward_voltage ||
                         moduleCell.voltage || 2.0;
  } else if (moduleType === 'PowerSupply' || moduleType === 'Battery') {
      node.voltage = moduleCell.voltage || 5.0;
  }
  
  return node;
  }

  