/**
 * Simple and Robust CRDT (Conflict-free Replicated Data Type) Service
 * 
 * This CRDT system uses a Last-Write-Wins (LWW) approach with timestamps
 * and unique IDs to handle concurrent operations on components and wires.
 */

export interface CRDTOperation {
  id: string
  type: 'ADD_COMPONENT' | 'REMOVE_COMPONENT' | 'ADD_WIRE' | 'REMOVE_WIRE' | 'UPDATE_COMPONENT'
  timestamp: number
  data: any
  position?: { x: number; y: number }
  componentId?: string
  wireId?: string
}

export interface CRDTState {
  operations: Map<string, CRDTOperation>
  components: Map<string, any>
  wires: Map<string, any>
  lastSyncTimestamp: number
}

export class CRDTService {
  private state: CRDTState
  private clientId: string

  constructor(clientId: string = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`) {
    this.clientId = clientId
    this.state = {
      operations: new Map(),
      components: new Map(),
      wires: new Map(),
      lastSyncTimestamp: Date.now()
    }
  }

  /**
   * Generate a unique operation ID
   */
  private generateOperationId(): string {
    return `${this.clientId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add a component operation to the CRDT
   */
  addComponent(componentData: any, position: { x: number; y: number }): CRDTOperation {
    const operation: CRDTOperation = {
      id: this.generateOperationId(),
      type: 'ADD_COMPONENT',
      timestamp: Date.now(),
      data: componentData,
      position,
      componentId: componentData.id || this.generateOperationId()
    }

    this.applyOperation(operation)
    return operation
  }

  /**
   * Remove a component operation from the CRDT
   */
  removeComponent(componentId: string): CRDTOperation {
    const operation: CRDTOperation = {
      id: this.generateOperationId(),
      type: 'REMOVE_COMPONENT',
      timestamp: Date.now(),
      data: null,
      componentId
    }

    this.applyOperation(operation)
    return operation
  }

  /**
   * Add a wire operation to the CRDT
   */
  addWire(wireData: any): CRDTOperation {
    const operation: CRDTOperation = {
      id: this.generateOperationId(),
      type: 'ADD_WIRE',
      timestamp: Date.now(),
      data: wireData,
      wireId: wireData.id || this.generateOperationId()
    }

    this.applyOperation(operation)
    return operation
  }

  /**
   * Remove a wire operation from the CRDT
   */
  removeWire(wireId: string): CRDTOperation {
    const operation: CRDTOperation = {
      id: this.generateOperationId(),
      type: 'REMOVE_WIRE',
      timestamp: Date.now(),
      data: null,
      wireId
    }

    this.applyOperation(operation)
    return operation
  }

  /**
   * Apply an operation to the CRDT state
   */
  private applyOperation(operation: CRDTOperation): void {
    // Store the operation
    this.state.operations.set(operation.id, operation)

    // Apply the operation to the state
    switch (operation.type) {
      case 'ADD_COMPONENT':
        if (operation.componentId && operation.data) {
          this.state.components.set(operation.componentId, {
            ...operation.data,
            _crdt_timestamp: operation.timestamp,
            _crdt_operation_id: operation.id
          })
        }
        break

      case 'REMOVE_COMPONENT':
        if (operation.componentId) {
          this.state.components.delete(operation.componentId)
        }
        break

      case 'ADD_WIRE':
        if (operation.wireId && operation.data) {
          this.state.wires.set(operation.wireId, {
            ...operation.data,
            _crdt_timestamp: operation.timestamp,
            _crdt_operation_id: operation.id
          })
        }
        break

      case 'REMOVE_WIRE':
        if (operation.wireId) {
          this.state.wires.delete(operation.wireId)
        }
        break

      case 'UPDATE_COMPONENT':
        if (operation.componentId && operation.data) {
          const existing = this.state.components.get(operation.componentId)
          if (existing && operation.timestamp > (existing._crdt_timestamp || 0)) {
            this.state.components.set(operation.componentId, {
              ...existing,
              ...operation.data,
              _crdt_timestamp: operation.timestamp,
              _crdt_operation_id: operation.id
            })
          }
        }
        break
    }

    // Update last sync timestamp
    this.state.lastSyncTimestamp = Math.max(this.state.lastSyncTimestamp, operation.timestamp)
  }

  /**
   * Merge operations from another CRDT instance
   */
  mergeOperations(operations: CRDTOperation[]): void {
    for (const operation of operations) {
      // Only apply operations we haven't seen before
      if (!this.state.operations.has(operation.id)) {
        this.applyOperation(operation)
      }
    }
  }

  /**
   * Get all operations since a given timestamp
   */
  getOperationsSince(timestamp: number): CRDTOperation[] {
    return Array.from(this.state.operations.values())
      .filter(op => op.timestamp > timestamp)
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Get the current state as a serializable object
   */
  getState(): {
    components: any[]
    wires: any[]
    operations: CRDTOperation[]
    lastSyncTimestamp: number
  } {
    return {
      components: Array.from(this.state.components.values()),
      wires: Array.from(this.state.wires.values()),
      operations: Array.from(this.state.operations.values()),
      lastSyncTimestamp: this.state.lastSyncTimestamp
    }
  }

  /**
   * Restore state from a serialized object
   */
  restoreState(state: {
    components: any[]
    wires: any[]
    operations: CRDTOperation[]
    lastSyncTimestamp: number
  }): void {
    this.state.components.clear()
    this.state.wires.clear()
    this.state.operations.clear()

    // Restore operations first
    for (const operation of state.operations) {
      this.state.operations.set(operation.id, operation)
    }

    // Restore components and wires
    for (const component of state.components) {
      if (component._crdt_operation_id) {
        this.state.components.set(component._crdt_operation_id, component)
      }
    }

    for (const wire of state.wires) {
      if (wire._crdt_operation_id) {
        this.state.wires.set(wire._crdt_operation_id, wire)
      }
    }

    this.state.lastSyncTimestamp = state.lastSyncTimestamp
  }

  /**
   * Convert CRDT state to grid format for the UI
   */
  toGridFormat(gridSize: { width: number; height: number }): {
    gridData: any[][]
    wires: any[]
    componentStates: Record<string, any>
  } {
    // Initialize empty grid
    const gridData: any[][] = []
    for (let y = 0; y < gridSize.height; y++) {
      const row: any[] = []
      for (let x = 0; x < gridSize.width; x++) {
        row.push({
          x,
          y,
          occupied: false,
          componentId: undefined,
          componentType: undefined,
          moduleDefinition: undefined,
          isPowered: false,
          cellIndex: undefined,
          isClickable: false
        })
      }
      gridData.push(row)
    }

    // Place components on the grid
    const componentStates: Record<string, any> = {}
    for (const component of this.state.components.values()) {
      if (component.position && component.size) {
        const { x, y } = component.position
        const { width, height } = component.size

        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const cellX = x + dx
            const cellY = y + dy

            if (cellX >= 0 && cellX < gridSize.width && cellY >= 0 && cellY < gridSize.height) {
              gridData[cellY][cellX] = {
                ...gridData[cellY][cellX],
                occupied: true,
                componentId: component.id,
                componentType: component.type,
                moduleDefinition: component.moduleDefinition,
                isPowered: component.isPowered || false,
                cellIndex: dy * width + dx,
                isClickable: component.isClickable || false
              }
            }
          }
        }

        // Store component state
        componentStates[component.id] = {
          ...component,
          position: component.position,
          size: component.size
        }
      }
    }

    return {
      gridData,
      wires: Array.from(this.state.wires.values()),
      componentStates
    }
  }

  /**
   * Get the last sync timestamp
   */
  getLastSyncTimestamp(): number {
    return this.state.lastSyncTimestamp
  }

  /**
   * Clear all data (useful for testing or reset)
   */
  clear(): void {
    this.state.operations.clear()
    this.state.components.clear()
    this.state.wires.clear()
    this.state.lastSyncTimestamp = Date.now()
  }
}

// Export a singleton instance
export const crdtService = new CRDTService()
