import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ModuleDefinition, WireConnection, WireSegment, WiringState } from '../modules/types'
import { GPIOState } from '../services/QEMUEmulatorReal'
import { useTheme } from '../contexts/ThemeContext'
import { calculateElectricalFlow, ComponentState } from '../systems/ElectricalSystem'
import { ElectricalValidator } from './ElectricalValidator'
import { DevicePanel } from './DevicePanel'
import { ElectricalNotifications } from './ElectricalNotifications'
import { CircuitTutorial } from './CircuitTutorial'
import { logger } from '../services/Logger'
import { crdtService } from '../services/CRDTService'
import { getCRDTSaveService } from '../services/CRDTSaveService'
import { Eraser } from 'lucide-react'

interface Project {
  id: number
  name: string
  lastModified: string
  preview: string
  gridSize: { width: number; height: number }
}

interface SimulationState {
  isRunning: boolean
  currentMicrocontroller: any | null
  gpioStates: Map<number, GPIOState>
  wireStates: Map<string, 'active' | 'inactive'>
  startTime: Date | null
}

interface ProjectGridProps {
  project: Project
  selectedModule: ModuleDefinition | null
  onModuleSelect: (module: ModuleDefinition | null) => void
  onComponentStatesChange?: (states: Map<string, ComponentState>) => void
  // New props for project data integration
  initialGridData?: any[][]
  initialWires?: any[]
  initialComponentStates?: Record<string, any>
  projectId?: string
  getAccessToken?: () => Promise<string>
  onProjectDataChange?: (data: {
    gridData?: any[][]
    wires?: any[]
    componentStates?: Record<string, any>
    hasUnsavedChanges?: boolean
    triggerUnsavedCheck?: boolean
  }) => void
  // Debug suite callbacks
  onCircuitPathwaysChange?: (pathways: any[]) => void
  onWiresChange?: (wires: any[]) => void
  onCircuitInfoChange?: (info: any) => void
}

interface GridCell {
  x: number
  y: number
  occupied: boolean
  componentId?: string
  componentType?: string
  moduleDefinition?: any // Store the full module definition
  isPowered?: boolean // Power state for this cell
  cellIndex?: number // Index within the module (for power tracking)
  isClickable?: boolean // Whether this cell can be clicked for interaction
  voltage?: number // Voltage level for this cell
  current?: number // Current level for this cell
  resistance?: number // Resistance value for resistors
  isOn?: boolean // Switch state
}


export function ProjectGrid({ 
  project: _project, 
  selectedModule, 
  onModuleSelect, 
  onComponentStatesChange,
  initialGridData,
  initialWires,
  initialComponentStates,
  projectId,
  getAccessToken,
  onProjectDataChange,
  onCircuitPathwaysChange,
  onWiresChange,
  onCircuitInfoChange
}: ProjectGridProps) {
  const { isDark } = useTheme()
  const gridRef = useRef<HTMLDivElement>(null)
  const dragComponentRef = useRef<any>(null)
  const [gridSize, setGridSize] = useState({ width: 50, height: 50 }) // Much smaller initial grid
  const [zoom, setZoom] = useState(1)
  const [gridData, setGridData] = useState<GridCell[][]>(() => {
    // Use initial data if provided, otherwise create empty grid
    if (initialGridData && initialGridData.length > 0) {
      return initialGridData as GridCell[][]
    }
    
    // Initialize with a much smaller grid for better memory usage
    const initialGrid: GridCell[][] = []
    for (let y = 0; y < 50; y++) {
      const row: GridCell[] = []
      for (let x = 0; x < 50; x++) {
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
      initialGrid.push(row)
    }
    return initialGrid
  })
  const [hoverState, setHoverState] = useState<{
    x: number
    y: number
  } | null>(null)
  const [gridOffset, setGridOffset] = useState({ x: -200, y: -200 }) // Standard positioning
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  // Wire system state
  const [wires, setWires] = useState<WireConnection[]>(() => {
    if (initialWires && initialWires.length > 0) {
      return initialWires
    }
    return []
  })
  const [wiringState, setWiringState] = useState<WiringState>({
    isWiring: false,
    currentConnection: null
  })
  const [wirePreview, setWirePreview] = useState<Array<{ x: number; y: number }> | null>(null)
  const [snapToGrid] = useState(true) // Keep for internal logic but don't expose UI
  const [electricalValidations, setElectricalValidations] = useState<any[]>([])
  const [showTutorial, setShowTutorial] = useState(false)
  const [componentStates, setComponentStates] = useState<Map<string, ComponentState>>(() => {
    if (initialComponentStates) {
      return new Map(Object.entries(initialComponentStates))
    }
    return new Map()
  })
  const [highlightedMicrocontroller, setHighlightedMicrocontroller] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [hoveredForDeletion, setHoveredForDeletion] = useState<{ type: 'component' | 'wire', id: string } | null>(null)
  
  // Simulation state for wire visual feedback
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    currentMicrocontroller: null,
    gpioStates: new Map(),
    wireStates: new Map(),
    startTime: null
  })
  
  // Auto-save functionality - call onProjectDataChange when data changes (debounced)
  useEffect(() => {
    if (onProjectDataChange) {
      
      // First, notify that there are unsaved changes and trigger immediate check
      onProjectDataChange({
        gridData,
        wires,
        componentStates: Object.fromEntries(componentStates),
        hasUnsavedChanges: true,
        triggerUnsavedCheck: true
      })

      const timeoutId = setTimeout(() => {
        // After debounce, trigger the actual save (without hasUnsavedChanges flag)
        onProjectDataChange({
          gridData,
          wires,
          componentStates: Object.fromEntries(componentStates)
        })
      }, 500) // 500ms debounce to prevent excessive saves

      return () => clearTimeout(timeoutId)
    }
  }, [gridData, wires, componentStates])
  
  
  // Calculate cell size in pixels - moved to visibleBounds calculation
  
  // Virtualization: Calculate visible grid bounds
  const visibleBounds = useMemo(() => {
    if (!gridRef.current) return { startX: 0, endX: 50, startY: 0, endY: 50 }
    
    const rect = gridRef.current.getBoundingClientRect()
    // Use actual cell size with zoom since grid cells are sized with 2.5 * zoom vw
    // Grid cells are sized with 2.5vw, so we need to convert this to pixels
    const baseCellSize = (window.innerWidth * 2.5) / 100
    
    // Calculate visible area with buffer, accounting for the transform
    const buffer = 5 // Extra cells to render for smooth scrolling
    const translateX = gridOffset.x + 4 / zoom
    const translateY = gridOffset.y + 4 / zoom
    
    // Calculate the visible area in transformed coordinates
    const visibleLeft = -translateX / zoom
    const visibleTop = -translateY / zoom
    const visibleRight = (rect.width - translateX) / zoom
    const visibleBottom = (rect.height - translateY) / zoom
    
    // Convert to grid coordinates
    const startX = Math.max(0, Math.floor(visibleLeft / baseCellSize) - buffer)
    const endX = Math.min(gridSize.width, Math.ceil(visibleRight / baseCellSize) + buffer)
    const startY = Math.max(0, Math.floor(visibleTop / baseCellSize) - buffer)
    const endY = Math.min(gridSize.height, Math.ceil(visibleBottom / baseCellSize) + buffer)
    
    return { startX, endX, startY, endY }
  }, [gridOffset, zoom, gridSize.width, gridSize.height])
  
  // Helper function to snap coordinates to grid
  const snapToGridCoords = useCallback((x: number, y: number) => {
    if (!snapToGrid) return { x, y }
    return {
      x: Math.max(0, Math.min(gridSize.width - 1, Math.round(x))),
      y: Math.max(0, Math.min(gridSize.height - 1, Math.round(y)))
    }
  }, [snapToGrid, gridSize.width, gridSize.height])

  // Expand grid dynamically based on content and viewport - MEMORY OPTIMIZED
  const expandGrid = useCallback((newZoom: number) => {
    // Calculate viewport size in grid cells
    const cellSizePx = (window.innerWidth * 2.5 * newZoom) / 100
    const viewportWidth = Math.ceil(window.innerWidth / cellSizePx)
    const viewportHeight = Math.ceil(window.innerHeight / cellSizePx)
    
    // Much smaller buffer and max size to prevent memory issues
    const buffer = 10 // Reduced buffer
    const maxSize = 50 // Much smaller maximum grid size
    const newWidth = Math.min(maxSize, Math.max(gridSize.width, viewportWidth + buffer * 2))
    const newHeight = Math.min(maxSize, Math.max(gridSize.height, viewportHeight + buffer * 2))
    
    // Only expand if we actually need to
    if (newWidth <= gridSize.width && newHeight <= gridSize.height) {
      return // No expansion needed
    }
    
    setGridData(prev => {
      // Only create new grid if we need to expand
      if (newWidth > gridSize.width || newHeight > gridSize.height) {
        const expandedGrid: GridCell[][] = []
        
        for (let y = 0; y < newHeight; y++) {
          const row: GridCell[] = []
          for (let x = 0; x < newWidth; x++) {
            // Preserve existing data or create new cell
            const existingCell = prev[y]?.[x]
            row.push(existingCell || {
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
          expandedGrid.push(row)
        }
        
        setGridSize({ width: newWidth, height: newHeight })
        return expandedGrid
      }
      
      return prev // No changes needed
    })
  }, [gridSize.width, gridSize.height])

  // Check if component placement is near grid boundaries and expand if needed - MEMORY OPTIMIZED
  const checkAndExpandForPlacement = useCallback((x: number, y: number, width: number, height: number) => {
    const boundaryThreshold = 5 // Reduced threshold
    const expansionAmount = 10 // Reduced expansion amount
    const maxSize = 50 // Much smaller maximum size
    let needsExpansion = false
    let newWidth = gridSize.width
    let newHeight = gridSize.height

    // Check if component is near right boundary
    if (x + width >= gridSize.width - boundaryThreshold) {
      newWidth = Math.min(maxSize, gridSize.width + expansionAmount)
      needsExpansion = true
    }

    // Check if component is near bottom boundary
    if (y + height >= gridSize.height - boundaryThreshold) {
      newHeight = Math.min(maxSize, gridSize.height + expansionAmount)
      needsExpansion = true
    }

    // Check if component is near left boundary (expand left by shifting grid)
    if (x < boundaryThreshold) {
      newWidth = Math.min(maxSize, gridSize.width + expansionAmount)
      needsExpansion = true
    }

    // Check if component is near top boundary (expand top by shifting grid)
    if (y < boundaryThreshold) {
      newHeight = Math.min(maxSize, gridSize.height + expansionAmount)
      needsExpansion = true
    }

    // Don't expand if we're already at max size
    if (needsExpansion && (newWidth <= maxSize && newHeight <= maxSize)) {
      setGridData(prev => {
        const expandedGrid: GridCell[][] = []
        
        for (let y = 0; y < newHeight; y++) {
          const row: GridCell[] = []
          for (let x = 0; x < newWidth; x++) {
            // Preserve existing data or create new cell
            const existingCell = prev[y]?.[x]
            row.push(existingCell || {
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
          expandedGrid.push(row)
        }
        
        setGridSize({ width: newWidth, height: newHeight })
        return expandedGrid
      })
    }
  }, [gridSize.width, gridSize.height])

  // Initialize grid data - create a large infinite grid
  useEffect(() => {
    expandGrid(zoom)
  }, [zoom, expandGrid])
  
  // Memory cleanup effect
  useEffect(() => {
    // Force garbage collection periodically to prevent memory buildup
    const cleanupInterval = setInterval(() => {
      // @ts-ignore - gc is available in some browsers for debugging
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc()
      }
    }, 30000) // Every 30 seconds
    
    return () => clearInterval(cleanupInterval)
  }, [])
  
  // Expand grid when window resizes - with debouncing to prevent excessive calls
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        expandGrid(zoom)
      }, 100) // Debounce resize events
    }
    
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [zoom, expandGrid])

  // Listen for drag start events from component palette
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      try {
        const componentData = JSON.parse(e.dataTransfer?.getData('application/json') || '{}')
        if (componentData && componentData.width && componentData.height) {
          dragComponentRef.current = componentData
        }
      } catch (error) {
        // Ignore invalid data
      }
    }

    document.addEventListener('dragstart', handleDragStart)
    return () => document.removeEventListener('dragstart', handleDragStart)
  }, [])

  // Handle wheel zoom - DISABLED (too buggy)
  // const handleWheel = useCallback((e: WheelEvent) => {
  //   e.preventDefault()
  //   
  //   // Check if mouse is over the grid
  //   if (gridRef.current && gridRef.current.contains(e.target as Node)) {
  //     const delta = e.deltaY
  //     const zoomStep = 0.1
  //     
  //     if (delta < 0) {
  //       // Zoom in
  //       const newZoom = Math.min(zoom + zoomStep, 3)
  //       setZoom(newZoom)
  //       expandGrid(newZoom)
  //     } else {
  //       // Zoom out
  //       const newZoom = Math.max(zoom - zoomStep, 0.25)
  //       setZoom(newZoom)
  //       expandGrid(newZoom)
  //     }
  //   }
  // }, [zoom, expandGrid])

  // Handle touch/pinch zoom
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      
      // Store initial distance for pinch calculation
      if (gridRef.current) {
        gridRef.current.dataset.initialDistance = distance.toString()
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      
      const initialDistance = parseFloat(gridRef.current?.dataset.initialDistance || '0')
      
      if (initialDistance > 0) {
        const scale = currentDistance / initialDistance
        const zoomStep = (scale - 1) * 0.5
        
        if (Math.abs(zoomStep) > 0.05) { // Only zoom if significant change
          const newZoom = Math.max(0.25, Math.min(3, zoom + zoomStep))
          setZoom(newZoom)
          expandGrid(newZoom)
          
          // Update initial distance for continuous pinch
          if (gridRef.current) {
            gridRef.current.dataset.initialDistance = currentDistance.toString()
          }
        }
      }
    }
  }, [zoom, expandGrid])

  // Add wheel and touch event listeners
  useEffect(() => {
    const gridElement = gridRef.current
    if (gridElement) {
      // gridElement.addEventListener('wheel', handleWheel, { passive: false }) // DISABLED - too buggy
      gridElement.addEventListener('touchstart', handleTouchStart, { passive: true })
      gridElement.addEventListener('touchmove', handleTouchMove, { passive: false })
      
      return () => {
        // gridElement.removeEventListener('wheel', handleWheel) // DISABLED - too buggy
        gridElement.removeEventListener('touchstart', handleTouchStart)
        gridElement.removeEventListener('touchmove', handleTouchMove)
      }
    }
  }, [handleTouchStart, handleTouchMove]) // Removed handleWheel from dependencies

  // Handle mouse pan
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Pan with left mouse button when no module is selected, not wiring, and modal is not open
    if (e.button === 0 && !selectedModule && !wiringState.isWiring && !isModalOpen) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [selectedModule, wiringState.isWiring, isModalOpen])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning && !isModalOpen) {
      e.preventDefault()
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y
      
      setGridOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [isPanning, isModalOpen, panStart])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Stop panning when modal opens
  React.useEffect(() => {
    if (isModalOpen && isPanning) {
      setIsPanning(false)
    }
  }, [isModalOpen, isPanning])

  // Handle touch pan
  const handleTouchMovePan = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1 && !isModalOpen) {
      // Single finger drag for panning
      e.preventDefault()
      const touch = e.touches[0]
      
      if (!isPanning) {
        setIsPanning(true)
        setPanStart({ x: touch.clientX, y: touch.clientY })
      } else {
        const deltaX = touch.clientX - panStart.x
        const deltaY = touch.clientY - panStart.y
        
        setGridOffset(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }))
        
        setPanStart({ x: touch.clientX, y: touch.clientY })
      }
    }
  }, [isPanning, panStart, isModalOpen])

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Add pan event listeners
  useEffect(() => {
    const gridElement = gridRef.current
    if (gridElement) {
      gridElement.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      gridElement.addEventListener('touchmove', handleTouchMovePan, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      
      // Prevent context menu on right click
      gridElement.addEventListener('contextmenu', (e) => e.preventDefault())
      
      return () => {
        gridElement.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        gridElement.removeEventListener('touchmove', handleTouchMovePan)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchMovePan, handleTouchEnd])

  // Handle mouse move for hover preview
  const handleHoverMove = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current) return
    
    const rect = gridRef.current.getBoundingClientRect()
    // Use actual cell size with zoom since grid cells are sized with 2.5 * zoom vw
    // Grid cells are sized with 2.5vw, so we need to convert this to pixels
    const baseCellSize = (window.innerWidth * 2.5) / 100
    
    // Calculate coordinates relative to the grid container
    // The grid is transformed with: scale(${zoom}) translate(${gridOffset.x + 4 / zoom}px, ${gridOffset.y + 4 / zoom}px)
    // We need to account for the transform by using the inverse calculation
    const translateX = gridOffset.x + 4 / zoom
    const translateY = gridOffset.y + 4 / zoom
    
    // Calculate the mouse position relative to the transformed grid
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Apply inverse transform: first subtract translation, then divide by scale
    const transformedX = (mouseX - translateX) / zoom
    const transformedY = (mouseY - translateY) / zoom
    
    // Convert to grid coordinates
    // Add half cell size offset to match component placement
    const rawX = (transformedX - baseCellSize / 2) / baseCellSize
    const rawY = (transformedY - baseCellSize / 2) / baseCellSize
    
    // Snap to grid if enabled
    const { x, y } = snapToGridCoords(rawX, rawY)
    
    // Handle delete mode hover
    if (deleteMode) {
      const cell = gridData[y]?.[x]
      if (cell?.occupied && cell.componentId) {
        setHoveredForDeletion({ type: 'component', id: cell.componentId })
      } else {
        setHoveredForDeletion(null)
      }
      return
    }
    
    // Handle module placement preview
    if (selectedModule && !wiringState.isWiring) {
      // Place the module with its top-left corner at the target cell
      const centeredX = x
      const centeredY = y
      
      setHoverState({ x: centeredX, y: centeredY })
    }
    
    // Handle wire preview
    if (wiringState.isWiring && wiringState.currentConnection) {
      // For wire preview, use offset coordinates to match wire placement
      const wireX = (transformedX - baseCellSize / 2) / baseCellSize
      const wireY = (transformedY - baseCellSize / 2) / baseCellSize
      const { x: wireGridX, y: wireGridY } = snapToGridCoords(wireX, wireY)
      
      const currentSegments = [...wiringState.currentConnection.segments, { x: wireGridX, y: wireGridY }]
      setWirePreview(currentSegments)
    }
  }, [selectedModule, zoom, gridOffset, wiringState, snapToGridCoords, deleteMode, gridData])

  // Handle clicking on placed components
  const handleComponentClick = useCallback((e: React.MouseEvent, componentId: string, cellIndex: number) => {
    e.stopPropagation() // Prevent grid click from firing
    
    const cell = gridData.find(row => row.find(c => c.componentId === componentId))
    if (!cell) return
    
    const targetCell = cell.find(c => c.componentId === componentId && c.cellIndex === cellIndex)
    if (!targetCell || !targetCell.moduleDefinition) return
    
    const module = targetCell.moduleDefinition
    
    // Special handling for resistor - no longer needed (handled in App component)
    // if (module.module === 'Resistor' && targetCell.isClickable) {
    //   // Resistance selection is now handled when resistor is selected from palette
    //   return
    // }
    
    // Execute other component behaviors
    if (module.behavior?.onClick) {
      executeComponentBehavior(module.behavior.onClick, componentId, cellIndex)
    }
  }, [gridData])

  // Handle clicking on connectable cells for wiring - removed (handled by grid click handler)

  // Execute JavaScript behavior for components
  const executeComponentBehavior = useCallback((jsCode: string, componentId: string, cellIndex: number) => {
    try {
      // Find the component's origin position
      const componentOrigin = findModuleOrigin(-1, -1, componentId)
      if (!componentOrigin) return
      
      // Create a context for the JavaScript execution
      const context = {
        componentId,
        cellIndex,
        gridData,
        setGridData,
        // Helper functions
        getCellByPosition: (relativeX: number, relativeY: number) => {
          const absoluteX = componentOrigin.x + relativeX
          const absoluteY = componentOrigin.y + relativeY
          return gridData[absoluteY]?.[absoluteX]
        },
        updateCellPower: (relativeX: number, relativeY: number, isPowered: boolean) => {
          const absoluteX = componentOrigin.x + relativeX
          const absoluteY = componentOrigin.y + relativeY
          setGridData(prev => {
            // More memory-efficient update - only update the specific cell
            if (prev[absoluteY]?.[absoluteX] && prev[absoluteY][absoluteX].isPowered !== isPowered) {
              const newGrid = [...prev]
              newGrid[absoluteY] = [...newGrid[absoluteY]]
              newGrid[absoluteY][absoluteX] = {
                ...newGrid[absoluteY][absoluteX],
                isPowered: isPowered
              }
              return newGrid
            }
            return prev // No changes needed
          })
        },
        propagatePower: (fromX: number, fromY: number, isPowered: boolean) => {
          // TODO: Implement power propagation through connections
        }
      }
      
      // Execute the JavaScript code in a controlled context
      const func = new Function('context', `with(context) { ${jsCode} }`)
      func(context)
    } catch (error) {
      console.error('Error executing component behavior:', error)
    }
  }, [gridData, setGridData])


  // Check if a cell is a connection point
  const isConnectionPoint = useCallback((x: number, y: number) => {
    const cell = gridData[y]?.[x]
    if (!cell?.occupied || !cell.moduleDefinition) return false
    
    const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
    return moduleCell?.isConnectable || false
  }, [gridData])

  // Calculate electrical flow using the new system
  const performElectricalCalculation = useCallback(() => {
    // Prevent multiple simultaneous calculations
    if (isCalculating) {
      return
    }
    setIsCalculating(true)

    try {
      console.log(`[ELECTRICAL] Performing electrical calculation with ${simulationState.gpioStates.size} GPIO states`)
      // Use the new electrical system
      const result = calculateElectricalFlow(gridData, wires, simulationState.gpioStates)

      
      // Update states with results
      setComponentStates(result.componentStates)
      setWires(result.updatedWires as any)
      setGridData(result.updatedGridData as any)
      
      // Display circuit information in console for now (will be moved to device manager)
      if (result.circuitInfo) {
        
        // Update debug suite data
        if (onCircuitPathwaysChange) {
          onCircuitPathwaysChange(result.circuitInfo.pathways || [])
        }
        if (onCircuitInfoChange) {
          onCircuitInfoChange(result.circuitInfo)
        }
      }
      
      // Update wires for debug suite
      if (onWiresChange) {
        onWiresChange(result.updatedWires)
      }
      
      // Notify parent of component state changes
      if (onComponentStatesChange) {
        onComponentStatesChange(result.componentStates)
      }
      
    } catch (error) {
      console.error('Error in electrical calculation:', error)
    } finally {
      setIsCalculating(false)
    }
  }, [gridData, wires, isCalculating])

  // Calculate electrical flow whenever grid or wires change (with debouncing)
  useEffect(() => {
    // For GPIO state changes, use requestAnimationFrame for immediate response
    // For grid/wire changes, use debounce to prevent excessive calculations
    if (simulationState.gpioStates.size > 0) {
      // Immediate update for GPIO changes using requestAnimationFrame
      const frameId = requestAnimationFrame(() => {
        // Only calculate if we have components and wires
        const hasComponents = gridData.some(row => row.some(cell => cell.occupied))
        const hasWires = wires.length > 0
        
        if (hasComponents || hasWires) {
          performElectricalCalculation()
        }
      })
      
      return () => cancelAnimationFrame(frameId)
    } else {
      // Debounced update for grid/wire changes
      const timeoutId = setTimeout(() => {
        // Only calculate if we have components and wires
        const hasComponents = gridData.some(row => row.some(cell => cell.occupied))
        const hasWires = wires.length > 0
        
        if (hasComponents || hasWires) {
          performElectricalCalculation()
        } 
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [gridData, wires, simulationState.gpioStates, performElectricalCalculation])

  // Wire system functions
  const startWiring = useCallback((x: number, y: number) => {
    logger.debug(`Starting wiring at: (${x}, ${y})`)
    setWiringState({
      isWiring: true,
      currentConnection: {
        startX: x,
        startY: y,
        segments: [{ x, y }]
      }
    })
  }, [])

  const addWireSegment = useCallback((x: number, y: number) => {
    console.log('🔍 addWireSegment called with:', x, y)
    if (!wiringState.currentConnection) return
    
    const newSegments = [...wiringState.currentConnection.segments, { x, y }]
    console.log('🔍 Adding segment, new segments:', newSegments)
    setWiringState(prev => ({
      ...prev,
      currentConnection: prev.currentConnection ? {
        ...prev.currentConnection,
        segments: newSegments
      } : null
    }))
  }, [wiringState.currentConnection])


  const cancelWiring = useCallback(() => {
    setWiringState({ isWiring: false, currentConnection: null })
    setWirePreview(null)
  }, [])

  // Delete mode functions
  const toggleDeleteMode = useCallback(() => {
    setDeleteMode(prev => !prev)
    setHoveredForDeletion(null)
    // Exit wiring mode when entering delete mode
    if (wiringState.isWiring) {
      cancelWiring()
    }
    // Deselect module when entering delete mode
    if (selectedModule) {
      onModuleSelect(null)
    }
  }, [wiringState.isWiring, cancelWiring, selectedModule, onModuleSelect])

  const deleteComponent = useCallback((componentId: string) => {
    setGridData(prev => {
      const newGrid = [...prev]
      let hasChanges = false
      
      // Remove all cells belonging to this component
      for (let y = 0; y < newGrid.length; y++) {
        if (newGrid[y]) {
          for (let x = 0; x < newGrid[y].length; x++) {
            if (newGrid[y][x]?.componentId === componentId) {
              if (!hasChanges) {
                newGrid[y] = [...newGrid[y]]
                hasChanges = true
              }
              newGrid[y][x] = {
                ...newGrid[y][x],
                occupied: false,
                componentId: undefined,
                componentType: undefined,
                moduleDefinition: undefined,
                isPowered: false,
                cellIndex: undefined,
                isClickable: false
              }
            }
          }
        }
      }
      
      return hasChanges ? newGrid : prev
    })
    
    // Remove component from component states
    setComponentStates(prev => {
      const newStates = new Map(prev)
      newStates.delete(componentId)
      return newStates
    })
    
    // Delete connected wires
    deleteWiresConnectedToComponent(componentId)
  }, [])

  const deleteWiresConnectedToComponent = useCallback((componentId: string) => {
    setWires(prev => {
      const newWires = prev.filter(wire => {
        // Check if any segment of this wire connects to the component
        return !wire.segments.some(segment => {
          const cell = gridData[segment.from.y]?.[segment.from.x] || gridData[segment.to.y]?.[segment.to.x]
          return cell?.componentId === componentId
        })
      })
      return newWires
    })
  }, [gridData])

  const deleteWire = useCallback((wireId: string) => {
    setWires(prev => prev.filter(wire => wire.id !== wireId))
  }, [])


  // Merge connected wires into networks while preserving parent-child relationships
  const mergeConnectedWires = useCallback(() => {
    setWires(prev => {
      const networks: WireConnection[][] = []
      const processed = new Set<string>()
      
      // Find all connected wire networks
      prev.forEach(wire => {
        if (processed.has(wire.id)) return
        
        const network = [wire]
        processed.add(wire.id)
        
        // Find all wires connected to this one
        let foundNew = true
        while (foundNew) {
          foundNew = false
          prev.forEach(otherWire => {
            if (processed.has(otherWire.id)) return
            
            // Check if this wire connects to any wire in the current network
            const isConnected = network.some(networkWire => 
              networkWire.segments.some(segment =>
                otherWire.segments.some(otherSegment =>
                  (segment.from.x === otherSegment.from.x && segment.from.y === otherSegment.from.y) ||
                  (segment.from.x === otherSegment.to.x && segment.from.y === otherSegment.to.y) ||
                  (segment.to.x === otherSegment.from.x && segment.to.y === otherSegment.from.y) ||
                  (segment.to.x === otherSegment.to.x && segment.to.y === otherSegment.to.y)
                )
              )
            )
            
            if (isConnected) {
              network.push(otherWire)
              processed.add(otherWire.id)
              foundNew = true
            }
          })
        }
        
        networks.push(network)
      })
      
      // Create merged networks while preserving parent-child relationships
      return networks.map((network) => {
        if (network.length === 1) return network[0]
        
        // Find the parent wire (the one with the earliest timestamp or no parentId)
        const parentWire = network.reduce((parent, wire) => {
          if (!parent) return wire
          if (!wire.parentId && parent.parentId) return wire
          if (wire.parentId === wire.id && parent.parentId !== parent.id) return wire
          return parent
        })
        
        // Merge all segments from the network
        const allSegments = network.flatMap(wire => wire.segments)
        const childIds = network.filter(wire => wire.id !== parentWire.id).map(wire => wire.id)
        
        return {
          id: parentWire.id, // Preserve the parent wire's ID
          segments: allSegments,
          isPowered: network.some(wire => wire.isPowered),
          isGrounded: network.some(wire => wire.isGrounded),
          isPowerable: network.some(wire => wire.isPowerable),
          isGroundable: network.some(wire => wire.isGroundable),
          voltage: Math.max(...network.map(wire => wire.voltage)),
          current: Math.max(...network.map(wire => wire.current)),
          power: network.reduce((sum, wire) => sum + wire.power, 0),
          color: parentWire.color, // Use parent wire's color
          thickness: parentWire.thickness,
          gauge: parentWire.gauge,
          maxCurrent: parentWire.maxCurrent,
          maxPower: parentWire.maxPower,
          parentId: parentWire.parentId || parentWire.id, // Preserve parent hierarchy
          childIds: childIds
        }
      })
    })
  }, [])

  // Get component properties at a position
  const getComponentProperties = useCallback((x: number, y: number) => {
    const cell = gridData[y]?.[x]
    
    if (!cell?.moduleDefinition) {
      return null
    }
    
    const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
    
    const props = {
      isPowerable: moduleCell?.isPowerable || false,
      isGroundable: moduleCell?.isGroundable || false,
      voltage: moduleCell?.voltage || 0,
      current: moduleCell?.current || 0,
      isPowered: moduleCell?.isPowered || false,
      componentType: cell.componentType
    }
    
    return props
  }, [gridData])

  // Update finishWiring to include cancelWiring in dependencies
  const finishWiringWithValidation = useCallback((x: number, y: number) => {
    console.log('🚨 FINISH WIRING CALLED!', x, y)
    console.log('🔍 finishWiringWithValidation called with:', x, y)
    if (!wiringState.currentConnection) return


    // Get properties from start and end points
    const startProps = getComponentProperties(wiringState.currentConnection.startX, wiringState.currentConnection.startY)
    const endProps = getComponentProperties(x, y)
    const endWire = getWirePassingThrough(x, y)
    const startWire = getWirePassingThrough(wiringState.currentConnection.startX, wiringState.currentConnection.startY)
    if (startProps && endProps) {
      
      // Check if trying to connect powerable to groundable
      // Exception: Resistors can connect to both powerable and groundable components
      const startIsResistor = startProps.componentType === 'Resistor'
      const endIsResistor = endProps.componentType === 'Resistor'
      
      if (startProps.isPowerable && endProps.isGroundable && !startIsResistor && !endIsResistor) {
        alert('❌ Cannot connect powerable terminal to groundable terminal!')
        cancelWiring()
        return
      }
      if (startProps.isGroundable && endProps.isPowerable && !startIsResistor && !endIsResistor) {
        alert('❌ Cannot connect groundable terminal to powerable terminal!')
        cancelWiring()
        return
      }
    } 

    // Check for wire-to-wire conflicts
    if (endWire) {
      
      if (startWire) {
        // Wire to wire connection - check for conflicts
        if (startWire.isPowerable && endWire.isGroundable) {
          alert('❌ Cannot connect powerable wire to groundable wire!')
          cancelWiring()
          return
        }
        if (startWire.isGroundable && endWire.isPowerable) {
          alert('❌ Cannot connect groundable wire to powerable wire!')
          cancelWiring()
          return
        }
      } else if (startProps) {
        
        // Exception: Resistors can connect to both powerable and groundable wires
        const startIsResistor = startProps.componentType === 'Resistor'
        
        if (startProps.isPowerable && endWire.isGroundable && !startIsResistor) {
          alert('❌ Cannot connect powerable component to groundable wire!')
          cancelWiring()
          return
        }
        if (startProps.isGroundable && endWire.isPowerable && !startIsResistor) {
          alert('❌ Cannot connect groundable component to powerable wire!')
          cancelWiring()
          return
        }
      }
    }

    // Check for wire-to-component conflicts (when starting from a wire)
    if (startWire && endProps) {
      // Exception: Resistors can connect to both powerable and groundable wires
      const endIsResistor = endProps.componentType === 'Resistor'
      
      if (startWire.isPowerable && endProps.isGroundable && !endIsResistor) {
        alert('❌ Cannot connect powerable wire to groundable component!')
        cancelWiring()
        return
      }
    }
    
    // Determine wire properties from connected components and existing wires
    
    const wireIsPowerable = (startProps?.isPowerable || false) || (endProps?.isPowerable || false) || 
                          (startWire?.isPowerable || false) || (endWire?.isPowerable || false)
    const wireIsGroundable = (startProps?.isGroundable || false) || (endProps?.isGroundable || false) || 
                            (startWire?.isGroundable || false) || (endWire?.isGroundable || false)
    const wireVoltage = Math.max(
      startProps?.voltage || 0, 
      endProps?.voltage || 0,
      startWire?.voltage || 0,
      endWire?.voltage || 0
    )
    // Use the circuit current from the electrical flow calculation
    let wireCurrent = 0
    
    // Find the power source that's providing voltage to this wire
    const maxVoltage = Math.max(
      startProps?.voltage || 0, 
      endProps?.voltage || 0,
      startWire?.voltage || 0,
      endWire?.voltage || 0
    )
    
    if (maxVoltage > 0) {
      // Find the power source component that matches this voltage
      const powerSourceId = (startProps as any)?.componentId || (endProps as any)?.componentId
      if (powerSourceId && componentStates.has(powerSourceId)) {
        const state = componentStates.get(powerSourceId)
        wireCurrent = state?.outputCurrent || 0
      } else {
        // Fallback: look for any component with similar voltage
        for (const [, state] of componentStates) {
          if (state.outputVoltage > 0) {
            wireCurrent = state.outputCurrent
            break // Use the first component current found
          }
        }
      }
    } else {
      // Fallback to component current if no voltage
      wireCurrent = Math.max(
        startProps?.current || 0, 
        endProps?.current || 0,
        startWire?.current || 0,
        endWire?.current || 0
      )
    }
    const wireIsPowered = (startProps?.isPowered || false) || (endProps?.isPowered || false) ||
                         (startWire?.isPowered || false) || (endWire?.isPowered || false)
    const wireIsGrounded = !wireIsPowered && wireIsGroundable

    console.log('Wire properties:', {
      isPowerable: wireIsPowerable,
      isGroundable: wireIsGroundable,
      voltage: wireVoltage,
      current: wireCurrent,
      maxVoltage,
      powerSourceId: (startProps as any)?.componentId || (endProps as any)?.componentId,
      componentStates: Array.from(componentStates.entries()),
      hasResistor: startProps?.componentType === 'Resistor' || endProps?.componentType === 'Resistor',
      totalResistance: startProps?.componentType === 'Resistor' ? (startProps as any).resistance : 
                      endProps?.componentType === 'Resistor' ? (endProps as any).resistance : 0,
      isPowered: wireIsPowered,
      isGrounded: wireIsGrounded
    })

    // Determine wire color and gauge from existing wires or use defaults
    let wireColor = '#666666' // Default gray
    let wireGauge = 14 // Default 14 AWG
    let wireThickness = 3 // Default thickness
    
    // Inherit properties from existing wires if connecting to them
    if (startWire) {
      wireColor = startWire.color
      wireGauge = startWire.gauge
      wireThickness = startWire.thickness
    } else if (endWire) {
      wireColor = endWire.color
      wireGauge = endWire.gauge
      wireThickness = endWire.thickness
    } else {
      // Use power/ground colors for component connections
      wireColor = wireIsPowered ? '#00ff00' : wireIsGrounded ? '#ff0000' : '#666666'
      // Default to 14 AWG wire
      wireGauge = 14
      wireThickness = 3
    }
    
    // Create wire segments
    const wireSegments: WireSegment[] = []
    // Add the end point to the segments array if it's not already there
    const segments = [...wiringState.currentConnection.segments]
    if (segments.length === 0 || segments[segments.length - 1].x !== x || segments[segments.length - 1].y !== y) {
      segments.push({ x, y })
    }
    console.log('🔍 Creating wire segments from:', segments)
    console.log('🔍 Segments length:', segments.length)
    console.log('🔍 Current connection:', wiringState.currentConnection)
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = {
        id: `segment-${Date.now()}-${i}`,
        from: segments[i],
        to: segments[i + 1],
        isPowered: wireIsPowered,
        isGrounded: wireIsGrounded,
        isPowerable: wireIsPowerable,
        isGroundable: wireIsGroundable,
        voltage: wireVoltage,
        current: wireCurrent,
        power: wireVoltage * wireCurrent,
        color: wireColor,
        thickness: wireThickness,
        gauge: wireGauge,
        maxCurrent: 15, // Default for 14 AWG
        maxPower: 1800  // Default for 14 AWG
      }
      wireSegments.push(segment)
      console.log('Created segment:', segment)
    }
    console.log('🔍 Total wire segments created:', wireSegments.length)
    
    // Check if we're extending an existing wire
    const existingWire = startWire || endWire
    let wireId: string
    let parentId: string | undefined
    let childIds: string[] = []
    
    if (existingWire) {
      // If we're extending an existing wire, use its ID and preserve parent-child relationships
      wireId = existingWire.id
      parentId = existingWire.parentId || existingWire.id
      childIds = existingWire.childIds || []
      
    } else {
      // Create a new wire with a new ID
      wireId = `wire-${Date.now()}`
      parentId = undefined
      childIds = []
      
    }
    
    // Create wire connection
    const wireConnection: WireConnection = {
      id: wireId,
      segments: wireSegments,
      isPowered: wireIsPowered,
      isGrounded: wireIsGrounded,
      isPowerable: wireIsPowerable,
      isGroundable: wireIsGroundable,
      voltage: wireVoltage,
      current: wireCurrent,
      power: wireVoltage * wireCurrent,
      color: wireColor,
      thickness: wireThickness,
      gauge: wireGauge,
      maxCurrent: 15, // Default for 14 AWG
      maxPower: 1800, // Default for 14 AWG
      parentId: parentId,
      childIds: childIds
    }
    
    console.log('Created wire connection:', wireConnection)
    
    // Add CRDT operation for wire creation
    if (projectId && getAccessToken) {
      const wireData = {
        id: wireId,
        segments: wireSegments,
        isPowered: wireIsPowered,
        isGrounded: wireIsGrounded,
        isPowerable: wireIsPowerable,
        isGroundable: wireIsGroundable,
        voltage: wireVoltage,
        current: wireCurrent,
        power: wireVoltage * wireCurrent,
        color: wireColor,
        thickness: wireThickness,
        gauge: wireGauge,
        maxCurrent: 15, // Default for 14 AWG
        maxPower: 1800, // Default for 14 AWG
        parentId: parentId,
        childIds: childIds
      }
      
      const operation = crdtService.addWire(wireData)
      const saveService = getCRDTSaveService(getAccessToken)
      saveService.queueOperation(operation, projectId).then(result => {
        console.log('🔧 ProjectGrid: CRDT wire save result:', result)
      }).catch(error => {
        console.error('❌ ProjectGrid: CRDT wire save failed:', error)
      })
    }
    
    setWires(prev => {
      console.log('🔍 Setting wires, previous count:', prev.length)
      if (existingWire) {
        // Update existing wire instead of adding a new one
        const updatedWires = prev.map(wire => 
          wire.id === existingWire.id 
            ? { ...wireConnection, segments: [...existingWire.segments, ...wireSegments] }
            : wire
        )
        console.log('🔍 Updated existing wire, new count:', updatedWires.length)
        return updatedWires
      } else {
        // Add new wire
        const newWires = [...prev, wireConnection]
        console.log('🔍 Added new wire, new count:', newWires.length, 'wire:', wireConnection)
        return newWires
      }
    })
    
    // No need to merge connected wires since we're preserving the same wire ID
    
    setWiringState({ isWiring: false, currentConnection: null })
    setWirePreview(null)
  }, [wiringState.currentConnection, gridData, cancelWiring, mergeConnectedWires])

  // Handle click to place module or wire
  const handleGridClick = useCallback((e: React.MouseEvent) => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // Use actual cell size with zoom since grid cells are sized with 2.5 * zoom vw
    // Grid cells are sized with 2.5vw, so we need to convert this to pixels
    const baseCellSize = (window.innerWidth * 2.5) / 100
    
    // Calculate coordinates relative to the grid container
    // The grid is transformed with: scale(${zoom}) translate(${gridOffset.x + 4 / zoom}px, ${gridOffset.y + 4 / zoom}px)
    // We need to account for the transform by using the inverse calculation
    const translateX = gridOffset.x + 4 / zoom
    const translateY = gridOffset.y + 4 / zoom
    
    // Calculate the mouse position relative to the transformed grid
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Apply inverse transform: first subtract translation, then divide by scale
    const transformedX = (mouseX - translateX) / zoom
    const transformedY = (mouseY - translateY) / zoom
    
    // Convert to grid coordinates
    // Add half cell size offset to account for cell positioning
    const rawX = (transformedX - baseCellSize / 2) / baseCellSize
    const rawY = (transformedY - baseCellSize / 2) / baseCellSize
    
    // Snap to grid if enabled
    const { x, y } = snapToGridCoords(rawX, rawY)
    
    // Handle delete mode
    if (deleteMode) {
      const cell = gridData[y]?.[x]
      if (cell?.occupied && cell.componentId) {
        deleteComponent(cell.componentId)
      }
      return
    }
    
    // Check if clicking on a connection point or wire
    const isConnection = isConnectionPoint(x, y)
    const wireAtPosition = getWirePassingThrough(x, y)
    
    // Handle wiring mode
    if (wiringState.isWiring) {
      // For wires, use offset coordinates to account for cell positioning
      const wireX = (transformedX - baseCellSize / 2) / baseCellSize
      const wireY = (transformedY - baseCellSize / 2) / baseCellSize
      const { x: wireGridX, y: wireGridY } = snapToGridCoords(wireX, wireY)
      
      if (wiringState.currentConnection) {
        // Add segment or finish wiring
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd + click to add segment
          addWireSegment(wireGridX, wireGridY)
        } else {
          // Regular click to finish wiring - add end point to segments first
          addWireSegment(wireGridX, wireGridY)
          finishWiringWithValidation(wireGridX, wireGridY)
        }
      } else {
        // Start new wire
        startWiring(wireGridX, wireGridY)
      }
      return
    }
    
    // If clicking on a connection point or wire, start wiring
    if ((isConnection || wireAtPosition) && !wiringState.isWiring) {
      startWiring(x, y)
      return
    }
    
    // If clicking on empty space while wiring, cancel wiring
    if (wiringState.isWiring && !isConnection && !wireAtPosition && !selectedModule) {
      cancelWiring()
      return
    }
    
    // Handle module placement
    if (selectedModule) {
      
      // Place the module with its top-left corner at the target cell
      const centeredX = x
      const centeredY = y
      
      // Check if placement is valid (within bounds and no conflicts)
      const isValid = centeredX >= 0 && centeredY >= 0 && 
                     centeredX + selectedModule.gridX <= gridSize.width && 
                     centeredY + selectedModule.gridY <= gridSize.height &&
                     !wouldCollide(centeredX, centeredY, selectedModule.gridX, selectedModule.gridY) &&
                     !wouldCollideWithWire(centeredX, centeredY, selectedModule.gridX, selectedModule.gridY)
      
      if (isValid) {
        
        // Check if we need to expand the grid for this placement
        checkAndExpandForPlacement(centeredX, centeredY, selectedModule.gridX, selectedModule.gridY)
        
        setGridData(prev => {
          console.log('🔧 ProjectGrid: Placing component, updating gridData', {
            componentType: selectedModule.module,
            position: { x: centeredX, y: centeredY },
            size: { width: selectedModule.gridX, height: selectedModule.gridY },
            currentOccupiedCells: prev.flat().filter(cell => cell.occupied).length
          })
          
          // More memory-efficient update - only update cells that change
          const newGrid = [...prev] // Shallow copy of rows
          const componentId = `${selectedModule.module}-${Date.now()}`
          
          // Create CRDT operation for component placement
          const componentData = {
            id: componentId,
            type: selectedModule.module,
            position: { x: centeredX, y: centeredY },
            size: { width: selectedModule.gridX, height: selectedModule.gridY },
            moduleDefinition: selectedModule,
            isPowered: false,
            isClickable: false
          }
          
          // Add to CRDT and save
          if (projectId && getAccessToken) {
            const operation = crdtService.addComponent(componentData, { x: centeredX, y: centeredY })
            const saveService = getCRDTSaveService(getAccessToken)
            saveService.queueOperation(operation, projectId).then(result => {
              console.log('🔧 ProjectGrid: CRDT save result:', result)
            }).catch(error => {
              console.error('❌ ProjectGrid: CRDT save failed:', error)
            })
          }
          
          for (let dy = 0; dy < selectedModule.gridY; dy++) {
            for (let dx = 0; dx < selectedModule.gridX; dx++) {
              const cellX = centeredX + dx
              const cellY = centeredY + dy
              
              // Ensure bounds checking and array existence
              if (cellX >= 0 && cellX < gridSize.width && 
                  cellY >= 0 && cellY < gridSize.height &&
                  newGrid[cellY] && newGrid[cellY][cellX]) {
                
                const cellIndex = dy * selectedModule.gridX + dx
                const moduleCell = selectedModule.grid[cellIndex]
                
                // Only update if the cell is actually changing
                if (!newGrid[cellY][cellX].occupied) {
                  newGrid[cellY] = [...newGrid[cellY]] // Shallow copy of row
                  newGrid[cellY][cellX] = {
                    ...newGrid[cellY][cellX],
                    occupied: true,
                    componentId: componentId,
                    componentType: selectedModule.module,
                    moduleDefinition: selectedModule,
                    isPowered: moduleCell?.isPowered || false,
                    cellIndex: cellIndex,
                    isClickable: moduleCell?.isClickable || false,
                    // Add resistance for resistors to all cells
                    ...(selectedModule.module === 'Resistor' && (selectedModule as any).properties?.resistance ? {
                      resistance: (selectedModule as any).properties.resistance
                    } : {})
                  }
                }
              }
            }
          }
          
          console.log('🔧 ProjectGrid: GridData updated, new occupied cells:', newGrid.flat().filter(cell => cell.occupied).length)
          return newGrid
        })
        
        // Deselect the module after placing
        onModuleSelect(null)
      }
    }
  }, [selectedModule, zoom, gridOffset, gridSize.width, gridSize.height, onModuleSelect, wiringState, addWireSegment, finishWiringWithValidation, startWiring, isConnectionPoint, snapToGridCoords, checkAndExpandForPlacement])

  // Handle mouse leave to clear hover state
  const handleMouseLeave = useCallback(() => {
    setHoverState(null)
    setWirePreview(null)
  }, [])

  // Handle ESC key to cancel wiring and close color picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (wiringState.isWiring) {
          cancelWiring()
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [wiringState.isWiring, cancelWiring])

  // Disable delete mode when a component is selected for placement
  useEffect(() => {
    if (selectedModule && deleteMode) {
      setDeleteMode(false)
      setHoveredForDeletion(null)
    }
  }, [selectedModule, deleteMode])

  // Check if cell is occupied
  const isCellOccupied = (x: number, y: number) => {
    return gridData[y]?.[x]?.occupied || false
  }

  // Check if placement would collide with existing modules
  const wouldCollide = (startX: number, startY: number, width: number, height: number) => {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
          if (isCellOccupied(x, y)) {
            return true
          }
        }
      }
    }
    return false
  }

  // Check if a wire segment passes through a specific cell
  const segmentPassesThroughCell = (segment: WireSegment, cellX: number, cellY: number) => {
    const fromX = segment.from.x
    const fromY = segment.from.y
    const toX = segment.to.x
    const toY = segment.to.y
    
    // If segment is a single point
    if (fromX === toX && fromY === toY) {
      return fromX === cellX && fromY === cellY
    }
    
    // If segment is horizontal
    if (fromY === toY) {
      const minX = Math.min(fromX, toX)
      const maxX = Math.max(fromX, toX)
      return fromY === cellY && cellX >= minX && cellX <= maxX
    }
    
    // If segment is vertical
    if (fromX === toX) {
      const minY = Math.min(fromY, toY)
      const maxY = Math.max(fromY, toY)
      return fromX === cellX && cellY >= minY && cellY <= maxY
    }
    
    // For diagonal segments, check if the cell is on the line
    // Using line equation: y = mx + b
    const dx = toX - fromX
    const dy = toY - fromY
    const slope = dy / dx
    const intercept = fromY - slope * fromX
    
    // Check if the cell's center is close to the line
    const expectedY = slope * cellX + intercept
    const tolerance = 0.5 // Allow some tolerance for diagonal lines
    
    return Math.abs(expectedY - cellY) <= tolerance && 
           cellX >= Math.min(fromX, toX) && 
           cellX <= Math.max(fromX, toX)
  }

  // Check if placement would collide with existing wires
  const wouldCollideWithWire = (startX: number, startY: number, width: number, height: number) => {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const cellX = startX + dx
        const cellY = startY + dy
        
        // Check if any wire passes through this cell
        for (const wire of wires) {
          for (const segment of wire.segments) {
            // Check if segment passes through this cell
            if (segmentPassesThroughCell(segment, cellX, cellY)) {
              return true
            }
          }
        }
      }
    }
    return false
  }

  // Memoized expensive calculations
  const isCellHighlighted = useCallback((x: number, y: number) => {
    if (!hoverState || !selectedModule) return false
    
    const { x: hoverX, y: hoverY } = hoverState
    return x >= hoverX && x < hoverX + selectedModule.gridX && 
           y >= hoverY && y < hoverY + selectedModule.gridY
  }, [hoverState, selectedModule])

  // Check if a wire passes through a specific position
  const getWirePassingThrough = (x: number, y: number) => {
    return wires.find(wire => 
      wire.segments.some(segment => segmentPassesThroughCell(segment, x, y))
    )
  }

  // Memoized collision check
  const isCollisionPreview = useMemo(() => {
    if (!hoverState || !selectedModule) return false
    return wouldCollide(hoverState.x, hoverState.y, selectedModule.gridX, selectedModule.gridY) ||
           wouldCollideWithWire(hoverState.x, hoverState.y, selectedModule.gridX, selectedModule.gridY)
  }, [hoverState, selectedModule, gridData, wires])

  // Render wire segment
  const renderWireSegment = (segment: WireSegment, wireId: string) => {
    // Use base cell size (without zoom) since SVG transform handles zoom scaling
    const baseCellSize = (window.innerWidth * 2.5) / 100
    
    // Center wires in cells with fine-tuned positioning
    const startX = segment.from.x * baseCellSize + baseCellSize / 2
    const startY = segment.from.y * baseCellSize + baseCellSize / 2
    const endX = segment.to.x * baseCellSize + baseCellSize / 2
    const endY = segment.to.y * baseCellSize + baseCellSize / 2
    
    const isSelected = false // Wire selection moved to DevicePanel
    
    // Check if wire is active in simulation
    const isWireActive = simulationState.isRunning && simulationState.wireStates.get(wireId) === 'active'
    const isWireInactive = simulationState.isRunning && simulationState.wireStates.get(wireId) === 'inactive'
    
    // Rendering wire segment
    
    return (
      <g key={segment.id}>
        {/* White border for selected wire */}
        {isSelected && (
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="white"
            strokeWidth={(segment.thickness || 3) + 4}
            strokeLinecap="round"
            className="pointer-events-none"
          />
        )}
        {/* Animated pulse for active wires */}
        {isWireActive && (
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="#00ff00"
            strokeWidth={(segment.thickness || 3) + 2}
            strokeLinecap="round"
            className="pointer-events-none"
            style={{
              filter: 'drop-shadow(0 0 12px #00ff00)',
              opacity: 0.6,
              animation: 'wirePulse 1s ease-in-out infinite alternate'
            }}
          />
        )}
        
        {/* Main wire */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={
            isWireActive ? '#00ff00' : // Bright green when active
            isWireInactive ? '#666666' : // Gray when inactive
            segment.color || '#666666' // Default color
          }
          strokeWidth={segment.thickness || 3}
          strokeLinecap="round"
          className="cursor-pointer"
          style={{
            filter: isWireActive ? 'drop-shadow(0 0 8px #00ff00) drop-shadow(0 0 16px #00ff00)' : 
                   segment.isPowered ? 'drop-shadow(0 0 6px #00ff00)' : 'none',
            pointerEvents: 'stroke',
            opacity: isWireInactive ? 0.3 : 1
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (deleteMode) {
              // Delete the wire in delete mode
              deleteWire(wireId)
            } else {
              console.log('Wire segment clicked:', segment.id)
              // Start new wire from this segment
              startWiring(segment.to.x, segment.to.y)
            }
          }}
        />
        
        {/* Electrical flow animation for powered wires */}
        {segment.isPowered && (
          <defs>
            <linearGradient id={`flow-${segment.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ff00" stopOpacity="0">
                <animate attributeName="stop-opacity" values="0;1;0" dur="1s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#00ff00" stopOpacity="1">
                <animate attributeName="stop-opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#00ff00" stopOpacity="0">
                <animate attributeName="stop-opacity" values="0;1;0" dur="1s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>
        )}
        
        {/* Flow indicator line */}
        {segment.isPowered && (
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={`url(#flow-${segment.id})`}
            strokeWidth={Math.max(1, (segment.thickness || 3) - 1)}
            strokeLinecap="round"
            className="pointer-events-none"
          />
        )}
      </g>
    )
  }




  // Get the module definition at a specific position - removed (unused)

  // Find the origin position of a module by its ID
  const findModuleOrigin = (x: number, y: number, moduleId: string) => {
    // Search for the top-left corner of this module
    for (let dy = 0; dy < 25; dy++) { // Search up to 25 cells up (increased for ESP32)
      for (let dx = 0; dx < 10; dx++) { // Search up to 10 cells left
        const checkX = x - dx
        const checkY = y - dy
        
        if (checkX >= 0 && checkY >= 0) {
          const cell = gridData[checkY]?.[checkX]
          if (cell?.occupied && cell.componentId === moduleId) {
            // Check if this is the origin (no occupied cell to the left or above)
            const leftCell = checkX > 0 ? gridData[checkY]?.[checkX - 1] : null
            const topCell = checkY > 0 ? gridData[checkY - 1]?.[checkX] : null
            
            const isLeftEdge = !leftCell?.occupied || leftCell.componentId !== moduleId
            const isTopEdge = !topCell?.occupied || topCell.componentId !== moduleId
            
            if (isLeftEdge && isTopEdge) {
              return { x: checkX, y: checkY }
            }
          }
        }
      }
    }
    return null
  }

  // Helper functions to get cell properties from module definition
  const getCellFromDefinition = (definition: any, x: number, y: number) => {
    // If no grid array, return empty cell with module background
    if (!definition.grid || definition.grid.length === 0) {
      return {
        background: definition.background || '#6B7280',
        css: definition.css || '',
        pin: '',
        type: 'EMPTY'
      }
    }
    
    // Find the cell at this position
    const cell = definition.grid.find((c: any) => c.x === x && c.y === y)
    
    // If cell found, return it
    if (cell) {
      return cell
    }
    
    // If no cell found, return empty cell with module background
    // This handles cases where the grid array is incomplete
    return {
      background: definition.background || '#6B7280',
      css: definition.css || '',
      pin: '',
      type: 'EMPTY'
    }
  }

  const getCellBackground = (definition: any, x: number, y: number) => {
    const cell = getCellFromDefinition(definition, x, y)
    return cell.background || definition.background || '#6B7280'
  }

  const getCellCSS = (definition: any, x: number, y: number) => {
    const cell = getCellFromDefinition(definition, x, y)
    return parseInlineCSS(cell.css || '')
  }

  const getCellPin = (definition: any, x: number, y: number) => {
    const cell = getCellFromDefinition(definition, x, y)
    return cell.pin || ''
  }

  // Calculate resistor color bands based on resistance value
  const getResistorColorBands = (resistance: number) => {
    if (!resistance || resistance <= 0) return []
    
    // Convert resistance to string to extract digits
    const resistanceStr = resistance.toString()
    const digits = resistanceStr.split('').map(Number)
    
    // Color code mapping
    const colorMap: Record<number, string> = {
      0: '#000000', // Black
      1: '#8B4513', // Brown
      2: '#FF0000', // Red
      3: '#FF8C00', // Orange
      4: '#FFFF00', // Yellow
      5: '#00FF00', // Green
      6: '#0000FF', // Blue
      7: '#800080', // Violet
      8: '#808080', // Gray
      9: '#FFFFFF'  // White
    }
    
    // For resistances like 1000, 2200, etc., we need to handle them differently
    if (resistance >= 1000) {
      const value = resistance / 1000
      const valueStr = value.toString()
      const valueDigits = valueStr.split('').map(Number)
      
      // First two significant digits
      const band1 = valueDigits[0] || 0
      const band2 = valueDigits[1] || 0
      
      // Multiplier (how many zeros)
      const multiplier = Math.log10(resistance / (band1 * 10 + band2))
      const multiplierBand = Math.round(multiplier)
      
      return [
        colorMap[band1],
        colorMap[band2],
        colorMap[multiplierBand],
        '#C0C0C0' // Silver tolerance (5%)
      ]
    } else {
      // For values under 1000
      const band1 = digits[0] || 0
      const band2 = digits[1] || 0
      const multiplier = digits.length - 2
      
      return [
        colorMap[band1],
        colorMap[band2],
        colorMap[multiplier],
        '#C0C0C0' // Silver tolerance (5%)
      ]
    }
  }

  // Parse inline CSS (same as in DynamicModule)
  const parseInlineCSS = (cssString: string): React.CSSProperties => {
    const styles: React.CSSProperties = {}
    
    const declarations = cssString.split(';').filter(decl => decl.trim())
    
    declarations.forEach(decl => {
      const [property, value] = decl.split(':').map(s => s.trim())
      if (property && value) {
        const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        
        switch (camelProperty) {
          case 'borderRadius':
            styles.borderRadius = value
            break
          case 'background':
            if (value.includes('gradient')) {
              const colorMatch = value.match(/#[0-9A-Fa-f]{6}/)
              if (colorMatch) {
                styles.background = colorMatch[0]
              }
            } else {
              styles.background = value
            }
            break
          case 'color':
            styles.color = value
            break
          case 'fontWeight':
            styles.fontWeight = value as any
            break
          case 'textAlign':
            styles.textAlign = value as any
            break
          case 'display':
            styles.display = value as any
            break
          case 'alignItems':
            styles.alignItems = value as any
            break
          case 'justifyContent':
            styles.justifyContent = value as any
            break
          case 'boxShadow':
            styles.boxShadow = value
            break
          case 'borderTopLeftRadius':
            styles.borderTopLeftRadius = value
            break
          case 'borderTopRightRadius':
            styles.borderTopRightRadius = value
            break
          case 'borderBottomLeftRadius':
            styles.borderBottomLeftRadius = value
            break
          case 'borderBottomRightRadius':
            styles.borderBottomRightRadius = value
            break
          default:
            try {
              (styles as any)[camelProperty] = value
            } catch (e) {
              // Ignore invalid properties
            }
        }
      }
    })
    
  return styles
}

// Memoized Grid Cell Component for performance
const GridCell = React.memo(({ 
  x, 
  y, 
  cell, 
  isHighlighted, 
  hasCollision, 
  isCellOccupied, 
  onComponentClick,
  findModuleOrigin,
  getCellBackground,
  getCellCSS,
  getCellPin,
  getResistorColorBands,
  componentStates,
  zoom,
  highlightedMicrocontroller,
  deleteMode,
  hoveredForDeletion
}: {
  x: number
  y: number
  cell: GridCell
  isHighlighted: boolean
  hasCollision: boolean
  isCellOccupied: (x: number, y: number) => boolean
  onComponentClick: (e: React.MouseEvent, componentId: string, cellIndex: number) => void
  findModuleOrigin: (x: number, y: number, moduleId: string) => any
  getCellBackground: (definition: any, x: number, y: number) => string
  getCellCSS: (definition: any, x: number, y: number) => React.CSSProperties
  getCellPin: (definition: any, x: number, y: number) => string
  getResistorColorBands: (resistance: number) => string[]
  componentStates: Map<string, ComponentState>
  zoom: number
  highlightedMicrocontroller: string | null
  deleteMode: boolean
  hoveredForDeletion: { type: 'component' | 'wire', id: string } | null
}) => {
  const occupied = isCellOccupied(x, y)
  const isHoveredForDeletion = deleteMode && hoveredForDeletion?.type === 'component' && hoveredForDeletion.id === cell.componentId
  
  return (
    <div
      key={`${x}-${y}`}
      className={`
        relative
        ${occupied 
          ? 'bg-transparent' 
          : isHighlighted
          ? hasCollision
            ? 'bg-red-200 dark:bg-red-800/50'
            : 'bg-green-200 dark:bg-green-800/50'
          : 'bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
        }
        transition-colors duration-150
      `}
      style={{
        width: `${2.5 * zoom}vw`,
        height: `${2.5 * zoom}vw`,
        minWidth: '10px',
        minHeight: '10px',
        cursor: occupied && (cell.isClickable || (cell.moduleDefinition?.grid[cell.cellIndex || 0]?.isConnectable)) ? 'pointer' : 'default'
      }}
      onClick={(e) => {
        if (occupied) {
          // Check if this is a connectable cell (for wiring)
          const moduleCell = cell.moduleDefinition?.grid[cell.cellIndex || 0]
          const isConnectable = moduleCell?.isConnectable || false
          
          if (cell.componentId && cell.cellIndex !== null && cell.cellIndex !== undefined && cell.isClickable) {
            // Handle component-specific click behavior
            console.log('🔍 Component click:', cell.componentType, cell.cellIndex)
            onComponentClick(e, cell.componentId, cell.cellIndex)
          } 
        }
      }}
    >
      {/* Show individual cell background if occupied */}
      {occupied && (() => {
        if (!cell.componentId || !cell.moduleDefinition) return null
        
        // Calculate relative position within the module
        const moduleOrigin = findModuleOrigin(x, y, cell.componentId)
        if (!moduleOrigin) {
          console.log(`No module origin found for cell (${x}, ${y}) with componentId: ${cell.componentId}`)
          return null
        }
        
        const relativeX = x - moduleOrigin.x
        const relativeY = y - moduleOrigin.y
        const isPowered = cell?.isPowered || false
        
        // Check if this cell is part of a highlighted microcontroller
        const isMicrocontrollerHighlighted = cell.componentId === highlightedMicrocontroller
        
        return (
          <div
            className="absolute inset-0"
            style={{
              background: getCellBackground(cell.moduleDefinition, relativeX, relativeY),
              ...getCellCSS(cell.moduleDefinition, relativeX, relativeY),
              // Add power state visualization
              boxShadow: isPowered ? '0 0 8px #00ff00' : 'none',
              // Add microcontroller highlighting
              ...(isMicrocontrollerHighlighted && {
                boxShadow: '0 0 12px #3b82f6',
                border: '2px solid #3b82f6'
              }),
              // Add delete mode highlighting
              ...(isHoveredForDeletion && {
                boxShadow: '0 0 12px #ef4444',
                border: '2px solid #ef4444',
                filter: 'brightness(0.8)'
              })
            }}
          >
            {/* Power indicator */}
            {isPowered && (
              <div className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
            
            {/* Show pin label if this cell has one */}
            {getCellPin(cell.moduleDefinition, relativeX, relativeY) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-xs leading-none">
                  {getCellPin(cell.moduleDefinition, relativeX, relativeY)}
                </span>
              </div>
            )}
            
            {/* Show resistor color bands for resistor components */}
            {cell.moduleDefinition.module === 'Resistor' && relativeX === 1 && relativeY === 0 && (() => {
              const resistance = cell.moduleDefinition.properties?.resistance?.default || 1000
              const colorBands = getResistorColorBands(resistance)
              
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex gap-0.5">
                    {colorBands.map((color, index) => (
                      <div
                        key={index}
                        className="w-1 h-3 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
            
            {/* Show resistance value for resistor components */}
            {cell.moduleDefinition.module === 'Resistor' && relativeX === 1 && relativeY === 0 && (() => {
              const resistance = cell?.resistance || cell.moduleDefinition.properties?.resistance?.default || 1000
              const displayValue = resistance >= 1000 ? `${resistance / 1000}kΩ` : `${resistance}Ω`
              
              return (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {/* Color bands */}
                  <div className="flex space-x-0.5 mb-1">
                    {getResistorColorBands(resistance).map((color, index) => (
                      <div
                        key={index}
                        className="w-1 h-3 border border-gray-600"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  {/* Resistance value */}
                  <span className="text-white text-xs font-bold bg-black bg-opacity-70 px-1 rounded">
                    {displayValue}
                  </span>
                </div>
              )
            })()}
            
            {/* Show LED state indicator */}
            {cell.moduleDefinition.module === 'LED' && relativeX === 1 && relativeY === 0 && (() => {
              // Get LED state from component states using the correct cell-specific key
              const cellComponentId = `${cell.componentId}-${cell.cellIndex || 0}`
              const ledState = componentStates.get(cellComponentId)
              const isOn = ledState?.isOn || false
              const forwardVoltage = ledState?.forwardVoltage || cell.moduleDefinition.properties?.forwardVoltage?.default || 2.0
              const ledColor = cell.moduleDefinition.properties?.color?.default || 'Red'
              
              // Calculate LED brightness based on LED state
              const getLEDColor = (color: string, isOn: boolean) => {
                if (!isOn) return 'bg-gray-600 border-gray-400'
                
                const colorMap: {[key: string]: string} = {
                  'Red': 'bg-red-400 border-red-500',
                  'Green': 'bg-green-400 border-green-500', 
                  'Blue': 'bg-blue-400 border-blue-500',
                  'Yellow': 'bg-yellow-300 border-yellow-400',
                  'White': 'bg-white border-gray-200',
                  'Orange': 'bg-orange-400 border-orange-500'
                }
                
                return colorMap[color] || 'bg-yellow-300 border-yellow-400'
              }
              
              const getLEDBrightness = (isOn: boolean) => {
                if (!isOn) return 'opacity-30'
                return 'opacity-100'
              }
              
              const ledClass = getLEDColor(ledColor, isOn)
              const brightnessClass = getLEDBrightness(isOn)
              const shouldGlow = isOn
              
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  
                  {/* Main LED */}
                  <div className={`w-6 h-6 rounded-full border-3 ${ledClass} ${brightnessClass} ${
                    shouldGlow ? 'animate-pulse shadow-lg' : ''
                  }`} 
                    style={{
                      boxShadow: shouldGlow ? `0 0 15px ${ledColor.toLowerCase()}, 0 0 30px ${ledColor.toLowerCase()}, 0 0 45px ${ledColor.toLowerCase()}` : 'none',
                      borderWidth: '3px'
                    }}
                  />
                  
                  {/* Voltage and Current indicators */}
                  {isOn && (
                    <>
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-green-600 font-mono bg-green-100 dark:bg-green-900 px-1 rounded">
                        {forwardVoltage.toFixed(1)}V
                      </div>
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">
                        {ledState?.outputCurrent ? `${(ledState.outputCurrent * 1000).toFixed(0)}mA` : '0mA'}
                      </div>
                    </>
                  )}
                  
                  {/* Brightness indicator rings */}
                  {isOn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-8 h-8 rounded-full border-2 ${ledClass} opacity-30 animate-ping`} />
                      <div className={`w-10 h-10 rounded-full border ${ledClass} opacity-20 animate-ping`} style={{ animationDelay: '0.5s' }} />
                    </div>
                  )}
                </div>
              )
            })()}
            
            {/* Show switch state indicator */}
            {cell.moduleDefinition.module === 'Switch' && relativeX === 1 && relativeY === 0 && (() => {
              const isOn = cell?.isOn || false
              const isPowered = cell?.isPowered || false
              
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-4 h-2 rounded-full border-2 transition-colors ${
                    isOn 
                      ? 'bg-green-500 border-green-600' 
                      : 'bg-gray-500 border-gray-600'
                  } ${isPowered && isOn ? 'shadow-lg shadow-green-500/50' : ''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full border transition-transform ${
                      isOn 
                        ? 'bg-white border-gray-300 translate-x-1' 
                        : 'bg-gray-300 border-gray-400 translate-x-0'
                    }`} />
                  </div>
                  {/* Power indicator */}
                  {isPowered && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-xs text-green-600">
                      ⚡
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )
      })()}
    </div>
  )
})

  return (
    <div 
      ref={gridRef}
      className={`relative w-full h-full overflow-hidden bg-gray-100 dark:bg-dark-bg ${
        isPanning ? 'cursor-grabbing' : 
        deleteMode ? 'cursor-pointer' :
        wiringState.isWiring ? 'cursor-crosshair' :
        selectedModule ? 'cursor-crosshair' : 'cursor-grab'
      }`}
      onMouseMove={handleHoverMove}
      onClick={handleGridClick}
      onMouseLeave={handleMouseLeave}
    >
      {/* Electrical Validator */}
      <ElectricalValidator
        gridData={gridData}
        wires={wires}
        onValidationUpdate={setElectricalValidations}
      />
      
      {/* Electrical Notifications */}
      <ElectricalNotifications
        validations={electricalValidations}
        onDismiss={(id) => setElectricalValidations(prev => prev.filter(v => v.id !== id))}
      />
      
      {/* Tutorial Modal */}
      {showTutorial && (
        <CircuitTutorial onClose={() => setShowTutorial(false)} />
      )}
      
      {/* Wire Layer */}
      <svg 
        className="absolute inset-0 z-10"
        style={{
          transform: `scale(${zoom}) translate(${gridOffset.x + 4 / zoom}px, ${gridOffset.y + 4 / zoom}px)`,
          transformOrigin: 'top left',
          width: `${gridSize.width * 2.5}vw`,
          height: `${gridSize.height * 2.5}vw`,
          pointerEvents: 'auto'
        }}
      >
        
        {/* Render existing wires */}
        {(() => {
          return null
        })()}
        {wires.map(wire => {
          return wire.segments.map(segment => {
            return renderWireSegment(segment, wire.id)
          })
        })}
        
        {/* Render wire preview */}
        {wirePreview && wirePreview.length > 1 && (
          <>
            {wirePreview.slice(0, -1).map((point, i) => {
              const nextPoint = wirePreview[i + 1]
              const baseCellSize = (window.innerWidth * 2.5) / 100
              
              // Center preview wires in cells without offset to match actual wires
              const startX = point.x * baseCellSize + baseCellSize / 2
              const startY = point.y * baseCellSize + baseCellSize / 2
              const endX = nextPoint.x * baseCellSize + baseCellSize / 2
              const endY = nextPoint.y * baseCellSize + baseCellSize / 2
              
              return (
                <line
                  key={`preview-${i}`}
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#666666"
                  strokeWidth={2}
                  strokeDasharray="5,5"
                  strokeLinecap="round"
                />
              )
            })}
          </>
        )}
        
        {/* Render connection point indicators */}
        {Array.from({ length: gridSize.height }, (_, y) =>
          Array.from({ length: gridSize.width }, (_, x) => {
            if (isConnectionPoint(x, y)) {
              const baseCellSize = (window.innerWidth * 2.5) / 100
              const isStartPoint = wiringState.currentConnection &&
                wiringState.currentConnection.startX === x && 
                wiringState.currentConnection.startY === y
              
              return (
                <g key={`connection-${x}-${y}`}>
                  {/* Large gray border for active connection point */}
                  {isStartPoint && (
                    <rect
                      x={x * baseCellSize}
                      y={y * baseCellSize}
                      width={baseCellSize}
                      height={baseCellSize}
                      fill="none"
                      stroke="#666666"
                      strokeWidth={3}
                      className="pointer-events-none"
                    />
                  )}
                </g>
              )
            }
            return null
          })
        )}
      </svg>

      {/* Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          transform: `scale(${zoom}) translate(${gridOffset.x + 4 / zoom}px, ${gridOffset.y + 4 / zoom}px)`,
          transformOrigin: 'top left',
          width: `${gridSize.width * 2.5}vw`,
          height: `${gridSize.height * 2.5}vw`,
          backgroundImage: `
            linear-gradient(to right, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px),
            linear-gradient(to bottom, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px)
          `,
          backgroundSize: `${(window.innerWidth * 2.5) / 100}px ${(window.innerWidth * 2.5) / 100}px`
        }}
      />

      {/* Virtualized Grid - Only render visible cells */}
      <div 
        className="absolute inset-0"
        style={{
          transform: `scale(${zoom}) translate(${gridOffset.x + 4 / zoom}px, ${gridOffset.y + 4 / zoom}px)`,
          transformOrigin: 'top left',
          width: `${gridSize.width * 2.5}vw`,
          height: `${gridSize.height * 2.5}vw`
        }}
      >
        {Array.from({ length: visibleBounds.endY - visibleBounds.startY }, (_, rowIndex) => {
          const y = visibleBounds.startY + rowIndex
          return (
            <div key={y} className="flex">
              {Array.from({ length: visibleBounds.endX - visibleBounds.startX }, (_, colIndex) => {
                const x = visibleBounds.startX + colIndex
                const cell = gridData[y]?.[x]
                const isHighlighted = isCellHighlighted(x, y)
                const hasCollision = isCollisionPreview
                
                return (
                  <GridCell
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    cell={cell}
                    isHighlighted={isHighlighted}
                    hasCollision={hasCollision}
                    isCellOccupied={isCellOccupied}
                    onComponentClick={handleComponentClick}
                    findModuleOrigin={findModuleOrigin}
                    getCellBackground={getCellBackground}
                    getCellCSS={getCellCSS}
                    getCellPin={getCellPin}
                    getResistorColorBands={getResistorColorBands}
                    componentStates={componentStates}
                    zoom={zoom}
                    highlightedMicrocontroller={highlightedMicrocontroller}
                    deleteMode={deleteMode}
                    hoveredForDeletion={hoveredForDeletion}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Device Panel */}
      <DevicePanel
        gridData={gridData}
        wires={wires}
        componentStates={componentStates}
        onMicrocontrollerHighlight={setHighlightedMicrocontroller}
        onMicrocontrollerClick={(microcontroller) => {
          console.log('Microcontroller clicked:', microcontroller)
        }}
        onModalStateChange={setIsModalOpen}
        onSimulationStateChange={setSimulationState}
        onWiresChange={setWires}
      />


      {/* Control Buttons */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        {/* Delete Mode Button */}
        <button
          onClick={toggleDeleteMode}
          className={`px-3 py-2 rounded-lg shadow-lg transition-colors text-sm flex items-center gap-2 ${
            deleteMode 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-gray-500 text-white hover:bg-gray-600'
          }`}
          title={deleteMode ? 'Exit delete mode' : 'Enter delete mode'}
        >
          <Eraser className="h-4 w-4" />
          {deleteMode ? 'Exit Delete' : 'Delete'}
        </button>
        
        {/* Tutorial Button */}
        <button
          onClick={() => setShowTutorial(true)}
          className="px-3 py-2 bg-green-500 text-white rounded-lg shadow-lg hover:bg-green-600 transition-colors text-sm"
        >
          📚 Tutorial
        </button>
      </div>

    </div>
  )
}
