/**
 * Utility functions for converting between full grid data and compact component storage
 */

export interface OccupiedComponent {
  x: number
  y: number
  componentId: string
  componentType: string
  moduleDefinition: any
  cellIndex?: number
  isPowered?: boolean
  voltage?: number
  current?: number
  resistance?: number
  isOn?: boolean
  isClickable?: boolean
}

export interface GridSize {
  width: number
  height: number
}

/**
 * Extract only occupied components from gridData
 */
export function extractOccupiedComponents(gridData: any[][]): OccupiedComponent[] {
  const components: OccupiedComponent[] = []
  
  if (!gridData || gridData.length === 0) return components
  
  gridData.forEach((row, y) => {
    if (!row) return
    row.forEach((cell, x) => {
      if (cell?.occupied && cell.componentId) {
        components.push({
          x,
          y,
          componentId: cell.componentId,
          componentType: cell.componentType || 'unknown',
          moduleDefinition: cell.moduleDefinition,
          cellIndex: cell.cellIndex,
          isPowered: cell.isPowered,
          voltage: cell.voltage,
          current: cell.current,
          resistance: cell.resistance,
          isOn: cell.isOn,
          isClickable: cell.isClickable
        })
      }
    })
  })
  
  return components
}

/**
 * Reconstruct gridData from occupied components and grid size
 */
export function reconstructGridData(
  components: OccupiedComponent[], 
  gridSize: GridSize = { width: 50, height: 50 }
): any[][] {
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
  components.forEach(component => {
    const { x, y } = component
    if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
      gridData[y][x] = {
        ...gridData[y][x],
        occupied: true,
        componentId: component.componentId,
        componentType: component.componentType,
        moduleDefinition: component.moduleDefinition,
        cellIndex: component.cellIndex,
        isPowered: component.isPowered || false,
        voltage: component.voltage,
        current: component.current,
        resistance: component.resistance,
        isOn: component.isOn,
        isClickable: component.isClickable || false
      }
    }
  })
  
  return gridData
}

/**
 * Get grid size from existing gridData
 */
export function getGridSize(gridData: any[][]): GridSize {
  if (!gridData || gridData.length === 0) {
    return { width: 50, height: 50 } // Default size
  }
  
  return {
    width: gridData[0]?.length || 50,
    height: gridData.length
  }
}
