import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ModuleDefinition, WireConnection, WireSegment, WiringState } from '../modules/types'
import { useTheme } from '../contexts/ThemeContext'

interface Project {
  id: number
  name: string
  lastModified: string
  preview: string
  gridSize: { width: number; height: number }
}

interface ProjectGridProps {
  project: Project
  selectedModule: ModuleDefinition | null
  onModuleSelect: (module: ModuleDefinition | null) => void
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
}


export function ProjectGrid({ project: _project, selectedModule, onModuleSelect }: ProjectGridProps) {
  const { isDark } = useTheme()
  const gridRef = useRef<HTMLDivElement>(null)
  const dragComponentRef = useRef<any>(null)
  const [gridSize, setGridSize] = useState({ width: 50, height: 50 }) // Much smaller initial grid
  const [zoom, setZoom] = useState(1)
  const [gridData, setGridData] = useState<GridCell[][]>(() => {
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
  const [wires, setWires] = useState<WireConnection[]>([])
  const [wiringState, setWiringState] = useState<WiringState>({
    isWiring: false,
    currentConnection: null
  })
  const [wirePreview, setWirePreview] = useState<Array<{ x: number; y: number }> | null>(null)
  const [editingWireColor, setEditingWireColor] = useState<string | null>(null)
  const [editingWireGauge, setEditingWireGauge] = useState<string | null>(null)
  const [selectedWire, setSelectedWire] = useState<string | null>(null)
  const [snapToGrid, setSnapToGrid] = useState(true)
  
  // Wire gauge specifications (AWG - American Wire Gauge)
  const wireGauges = [
    { gauge: 0, maxCurrent: 150, maxPower: 18000, thickness: 12, description: "0 AWG - Extra heavy duty" },
    { gauge: 1, maxCurrent: 130, maxPower: 15600, thickness: 11, description: "1 AWG - Heavy duty" },
    { gauge: 2, maxCurrent: 115, maxPower: 13800, thickness: 10, description: "2 AWG - Heavy duty" },
    { gauge: 3, maxCurrent: 100, maxPower: 12000, thickness: 9, description: "3 AWG - Heavy duty" },
    { gauge: 4, maxCurrent: 85, maxPower: 10200, thickness: 8, description: "4 AWG - Heavy duty" },
    { gauge: 6, maxCurrent: 65, maxPower: 7800, thickness: 7, description: "6 AWG - Heavy duty" },
    { gauge: 8, maxCurrent: 50, maxPower: 6000, thickness: 6, description: "8 AWG - Heavy duty" },
    { gauge: 10, maxCurrent: 30, maxPower: 3600, thickness: 5, description: "10 AWG - Heavy duty" },
    { gauge: 12, maxCurrent: 20, maxPower: 2400, thickness: 4, description: "12 AWG - Standard" },
    { gauge: 14, maxCurrent: 15, maxPower: 1800, thickness: 3, description: "14 AWG - Standard" },
    { gauge: 16, maxCurrent: 10, maxPower: 1200, thickness: 3, description: "16 AWG - Light duty" },
    { gauge: 18, maxCurrent: 7, maxPower: 840, thickness: 3, description: "18 AWG - Signal" },
    { gauge: 20, maxCurrent: 5, maxPower: 600, thickness: 3, description: "20 AWG - Low power" },
    { gauge: 22, maxCurrent: 3, maxPower: 360, thickness: 3, description: "22 AWG - Data" },
    { gauge: 24, maxCurrent: 2, maxPower: 240, thickness: 3, description: "24 AWG - Micro" }
  ]
  
  // Calculate cell size in pixels
  const cellSizePx = (window.innerWidth * 2.5 * zoom) / 100
  
  // Virtualization: Calculate visible grid bounds
  const visibleBounds = useMemo(() => {
    if (!gridRef.current) return { startX: 0, endX: 50, startY: 0, endY: 50 }
    
    const rect = gridRef.current.getBoundingClientRect()
    const cellSizeVw = 2.5 * zoom
    const cellSizePx = (window.innerWidth * cellSizeVw) / 100
    
    // Calculate visible area with buffer
    const buffer = 5 // Extra cells to render for smooth scrolling
    const startX = Math.max(0, Math.floor(-gridOffset.x / cellSizePx) - buffer)
    const endX = Math.min(gridSize.width, Math.ceil((rect.width - gridOffset.x) / cellSizePx) + buffer)
    const startY = Math.max(0, Math.floor(-gridOffset.y / cellSizePx) - buffer)
    const endY = Math.min(gridSize.height, Math.ceil((rect.height - gridOffset.y) / cellSizePx) + buffer)
    
    return { startX, endX, startY, endY }
  }, [gridOffset, zoom, gridSize.width, gridSize.height])
  
  // Helper function to snap coordinates to grid
  const snapToGridCoords = useCallback((x: number, y: number) => {
    if (!snapToGrid) return { x, y }
    return {
      x: Math.round(x),
      y: Math.round(y)
    }
  }, [snapToGrid])

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
    let resizeTimeout: number
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

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    // Check if mouse is over the grid
    if (gridRef.current && gridRef.current.contains(e.target as Node)) {
      const delta = e.deltaY
      const zoomStep = 0.1
      
      if (delta < 0) {
        // Zoom in
        const newZoom = Math.min(zoom + zoomStep, 3)
        setZoom(newZoom)
        expandGrid(newZoom)
      } else {
        // Zoom out
        const newZoom = Math.max(zoom - zoomStep, 0.25)
        setZoom(newZoom)
        expandGrid(newZoom)
      }
    }
  }, [zoom, expandGrid])

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
      gridElement.addEventListener('wheel', handleWheel, { passive: false })
      gridElement.addEventListener('touchstart', handleTouchStart, { passive: true })
      gridElement.addEventListener('touchmove', handleTouchMove, { passive: false })
      
      return () => {
        gridElement.removeEventListener('wheel', handleWheel)
        gridElement.removeEventListener('touchstart', handleTouchStart)
        gridElement.removeEventListener('touchmove', handleTouchMove)
      }
    }
  }, [handleWheel, handleTouchStart, handleTouchMove])

  // Handle mouse pan
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Pan with left mouse button when no module is selected and not wiring
    if (e.button === 0 && !selectedModule && !wiringState.isWiring) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [selectedModule, wiringState.isWiring])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      e.preventDefault()
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y
      
      setGridOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Handle touch pan
  const handleTouchMovePan = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1 && !isPanning) {
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
  }, [isPanning, panStart])

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
    const cellSizeVw = 2.5 * zoom
    const cellSizePx = (window.innerWidth * cellSizeVw) / 100
    
    // Fine-tuned offset for precise alignment
    const offsetX = -cellSizePx / 2 // Center the cursor in the cell
    const offsetY = -cellSizePx / 2
    const rawX = (e.clientX - rect.left - gridOffset.x + offsetX) / cellSizePx
    const rawY = (e.clientY - rect.top - gridOffset.y + offsetY) / cellSizePx
    
    // Snap to grid if enabled
    const { x, y } = snapToGridCoords(rawX, rawY)
    
    // Handle module placement preview
    if (selectedModule && !wiringState.isWiring) {
      console.log('Hover move with selected module:', selectedModule.module)
      // Place the module with its top-left corner at the target cell
      const centeredX = x
      const centeredY = y
      
      setHoverState({ x: centeredX, y: centeredY })
    }
    
    // Handle wire preview
    if (wiringState.isWiring && wiringState.currentConnection) {
      const currentSegments = [...wiringState.currentConnection.segments, { x, y }]
      setWirePreview(currentSegments)
    }
  }, [selectedModule, zoom, gridOffset, wiringState, snapToGridCoords])

  // Handle clicking on placed components
  const handleComponentClick = useCallback((e: React.MouseEvent, componentId: string, cellIndex: number) => {
    e.stopPropagation() // Prevent grid click from firing
    
    const cell = gridData.find(row => row.find(c => c.componentId === componentId))
    if (!cell) return
    
    const targetCell = cell.find(c => c.componentId === componentId && c.cellIndex === cellIndex)
    if (!targetCell || !targetCell.moduleDefinition) return
    
    const module = targetCell.moduleDefinition
    if (module.behavior?.onClick) {
      console.log('Executing component behavior for:', module.module)
      executeComponentBehavior(module.behavior.onClick, componentId, cellIndex)
    }
  }, [gridData])

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
          console.log('Propagating power from', fromX, fromY, 'to', isPowered)
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

  // Wire system functions
  const startWiring = useCallback((x: number, y: number) => {
    console.log('Starting wiring at:', x, y)
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
    if (!wiringState.currentConnection) return
    
    const newSegments = [...wiringState.currentConnection.segments, { x, y }]
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

  // Update wire color
  const updateWireColor = useCallback((wireId: string, newColor: string) => {
    setWires(prev => prev.map(wire => 
      wire.id === wireId 
        ? { ...wire, color: newColor, segments: wire.segments.map(segment => ({ ...segment, color: newColor })) }
        : wire
    ))
    setEditingWireColor(null)
  }, [])

  // Update wire gauge
  const updateWireGauge = useCallback((wireId: string, newGauge: number) => {
    const gaugeSpec = wireGauges.find(g => g.gauge === newGauge)
    if (!gaugeSpec) return
    
    setWires(prev => prev.map(wire => 
      wire.id === wireId 
        ? { 
            ...wire, 
            gauge: gaugeSpec.gauge,
            thickness: gaugeSpec.thickness,
            maxCurrent: gaugeSpec.maxCurrent,
            maxPower: gaugeSpec.maxPower,
            segments: wire.segments.map(segment => ({ 
              ...segment, 
              gauge: gaugeSpec.gauge,
              thickness: gaugeSpec.thickness,
              maxCurrent: gaugeSpec.maxCurrent,
              maxPower: gaugeSpec.maxPower
            }))
          }
        : wire
    ))
    setEditingWireGauge(null)
  }, [wireGauges])

  // Merge connected wires into networks
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
      
      // Create merged networks
      return networks.map((network, index) => {
        if (network.length === 1) return network[0]
        
        // Merge all segments from the network
        const allSegments = network.flatMap(wire => wire.segments)
        const networkId = `network-${index}`
        
        return {
          id: networkId,
          segments: allSegments,
          isPowered: network.some(wire => wire.isPowered),
          isGrounded: network.some(wire => wire.isGrounded),
          isPowerable: network.some(wire => wire.isPowerable),
          isGroundable: network.some(wire => wire.isGroundable),
          voltage: Math.max(...network.map(wire => wire.voltage)),
          current: Math.max(...network.map(wire => wire.current)),
          power: network.reduce((sum, wire) => sum + wire.power, 0),
          color: network[0].color, // Use first wire's color
          thickness: network[0].thickness,
          gauge: network[0].gauge,
          maxCurrent: network[0].maxCurrent,
          maxPower: network[0].maxPower
        }
      })
    })
  }, [])

  // Get component properties at a position
  const getComponentProperties = useCallback((x: number, y: number) => {
    console.log('Getting component properties at:', x, y)
    const cell = gridData[y]?.[x]
    console.log('Cell found:', cell)
    
    if (!cell?.moduleDefinition) {
      console.log('No module definition found')
      return null
    }
    
    const moduleCell = cell.moduleDefinition.grid[cell.cellIndex || 0]
    console.log('Module cell:', moduleCell)
    
    const props = {
      isPowerable: moduleCell?.isPowerable || false,
      isGroundable: moduleCell?.isGroundable || false,
      voltage: moduleCell?.voltage || 0,
      current: moduleCell?.current || 0,
      isPowered: moduleCell?.isPowered || false
    }
    
    console.log('Component properties:', props)
    return props
  }, [gridData])

  // Update finishWiring to include cancelWiring in dependencies
  const finishWiringWithValidation = useCallback((x: number, y: number) => {
    if (!wiringState.currentConnection) return

    console.log('🔌 FINISHING WIRING - Start validation process')
    console.log('Finishing wiring at:', x, y)
    console.log('Starting from:', wiringState.currentConnection.startX, wiringState.currentConnection.startY)
    const segments = [...wiringState.currentConnection.segments, { x, y }]
    console.log('Wire segments:', segments)

    // Get properties from start and end points
    const startProps = getComponentProperties(wiringState.currentConnection.startX, wiringState.currentConnection.startY)
    const endProps = getComponentProperties(x, y)
    const endWire = getWirePassingThrough(x, y)
    const startWire = getWirePassingThrough(wiringState.currentConnection.startX, wiringState.currentConnection.startY)

    console.log('Start properties:', startProps)
    console.log('End properties:', endProps)
    console.log('End wire:', endWire)

    // Check for power/ground conflicts
    console.log('🔍 VALIDATION CHECK - startProps:', startProps, 'endProps:', endProps)
    if (startProps && endProps) {
      console.log('✅ Both components found - Validating component-to-component connection:')
      console.log('Start isPowerable:', startProps.isPowerable, 'isGroundable:', startProps.isGroundable)
      console.log('End isPowerable:', endProps.isPowerable, 'isGroundable:', endProps.isGroundable)
      
      // Check if trying to connect powerable to groundable
      if (startProps.isPowerable && endProps.isGroundable) {
        console.log('❌ BLOCKED: Cannot connect powerable to groundable!')
        alert('❌ Cannot connect powerable terminal to groundable terminal!')
        cancelWiring()
        return
      }
      if (startProps.isGroundable && endProps.isPowerable) {
        console.log('❌ BLOCKED: Cannot connect groundable to powerable!')
        alert('❌ Cannot connect groundable terminal to powerable terminal!')
        cancelWiring()
        return
      }
      console.log('✅ Component-to-component connection allowed')
    } else {
      console.log('⚠️ Missing component properties - startProps:', startProps, 'endProps:', endProps)
    }

    // Check for wire-to-wire conflicts
    if (endWire) {
      console.log('🔍 WIRE-TO-WIRE VALIDATION - startWire:', startWire, 'endWire:', endWire)
      
      if (startWire) {
        // Wire to wire connection - check for conflicts
        console.log('Wire-to-wire connection detected')
        if (startWire.isPowerable && endWire.isGroundable) {
          console.log('❌ BLOCKED: Cannot connect powerable wire to groundable wire!')
          alert('❌ Cannot connect powerable wire to groundable wire!')
          cancelWiring()
          return
        }
        if (startWire.isGroundable && endWire.isPowerable) {
          console.log('❌ BLOCKED: Cannot connect groundable wire to powerable wire!')
          alert('❌ Cannot connect groundable wire to powerable wire!')
          cancelWiring()
          return
        }
      } else if (startProps) {
        // Component to wire connection - check for conflicts
        console.log('Component-to-wire connection detected')
        if (startProps.isPowerable && endWire.isGroundable) {
          console.log('❌ BLOCKED: Cannot connect powerable component to groundable wire!')
          alert('❌ Cannot connect powerable component to groundable wire!')
          cancelWiring()
          return
        }
        if (startProps.isGroundable && endWire.isPowerable) {
          console.log('❌ BLOCKED: Cannot connect groundable component to powerable wire!')
          alert('❌ Cannot connect groundable component to powerable wire!')
          cancelWiring()
          return
        }
      }
    }

    // Check for wire-to-component conflicts (when starting from a wire)
    if (startWire && endProps) {
      console.log('🔍 WIRE-TO-COMPONENT VALIDATION - startWire:', startWire, 'endProps:', endProps)
      console.log('Wire-to-component connection detected')
      if (startWire.isPowerable && endProps.isGroundable) {
        console.log('❌ BLOCKED: Cannot connect powerable wire to groundable component!')
        alert('❌ Cannot connect powerable wire to groundable component!')
        cancelWiring()
        return
      }
      if (startWire.isGroundable && endProps.isPowerable) {
        console.log('❌ BLOCKED: Cannot connect groundable wire to powerable component!')
        alert('❌ Cannot connect groundable wire to powerable component!')
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
    const wireCurrent = Math.max(
      startProps?.current || 0, 
      endProps?.current || 0,
      startWire?.current || 0,
      endWire?.current || 0
    )
    const wireIsPowered = (startProps?.isPowered || false) || (endProps?.isPowered || false) ||
                         (startWire?.isPowered || false) || (endWire?.isPowered || false)
    const wireIsGrounded = !wireIsPowered && wireIsGroundable

    console.log('Wire properties:', {
      isPowerable: wireIsPowerable,
      isGroundable: wireIsGroundable,
      voltage: wireVoltage,
      current: wireCurrent,
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
      console.log('Inheriting from start wire:', { color: wireColor, gauge: wireGauge, thickness: wireThickness })
    } else if (endWire) {
      wireColor = endWire.color
      wireGauge = endWire.gauge
      wireThickness = endWire.thickness
      console.log('Inheriting from end wire:', { color: wireColor, gauge: wireGauge, thickness: wireThickness })
    } else {
      // Use power/ground colors for component connections
      wireColor = wireIsPowered ? '#00ff00' : wireIsGrounded ? '#ff0000' : '#666666'
      const defaultGauge = wireGauges.find(g => g.gauge === 14) || wireGauges[1]
      wireGauge = defaultGauge.gauge
      wireThickness = defaultGauge.thickness
      console.log('Using default properties:', { color: wireColor, gauge: wireGauge, thickness: wireThickness })
    }
    
    // Create wire segments
    const wireSegments: WireSegment[] = []
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
        maxCurrent: wireGauges.find(g => g.gauge === wireGauge)?.maxCurrent || 15,
        maxPower: wireGauges.find(g => g.gauge === wireGauge)?.maxPower || 1800
      }
      wireSegments.push(segment)
      console.log('Created segment:', segment)
    }
    
    // Create wire connection
    const wireConnection: WireConnection = {
      id: `wire-${Date.now()}`,
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
      maxCurrent: wireGauges.find(g => g.gauge === wireGauge)?.maxCurrent || 15,
      maxPower: wireGauges.find(g => g.gauge === wireGauge)?.maxPower || 1800
    }
    
    console.log('Created wire connection:', wireConnection)
    setWires(prev => {
      const newWires = [...prev, wireConnection]
      console.log('Updated wires array:', newWires)
      return newWires
    })
    
    // Merge connected wires after a short delay to allow state update
    setTimeout(() => {
      mergeConnectedWires()
    }, 100)
    
    setWiringState({ isWiring: false, currentConnection: null })
    setWirePreview(null)
  }, [wiringState.currentConnection, gridData, cancelWiring, mergeConnectedWires])

  // Handle click to place module or wire
  const handleGridClick = useCallback((e: React.MouseEvent) => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const cellSizeVw = 2.5 * zoom
    const cellSizePx = (window.innerWidth * cellSizeVw) / 100
    
    // Fine-tuned offset for precise alignment
    const offsetX = -cellSizePx / 2 // Center the cursor in the cell
    const offsetY = -cellSizePx / 2
    const rawX = (e.clientX - rect.left - gridOffset.x + offsetX) / cellSizePx
    const rawY = (e.clientY - rect.top - gridOffset.y + offsetY) / cellSizePx
    
    // Snap to grid if enabled
    const { x, y } = snapToGridCoords(rawX, rawY)
    
    // Check if clicking on a connection point or wire
    const isConnection = isConnectionPoint(x, y)
    const wireAtPosition = getWirePassingThrough(x, y)
    
    // Handle wiring mode
    if (wiringState.isWiring) {
      if (wiringState.currentConnection) {
        // Add segment or finish wiring
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd + click to add segment
          addWireSegment(x, y)
        } else {
          // Regular click to finish wiring
          finishWiringWithValidation(x, y)
        }
      } else {
        // Start new wire
        startWiring(x, y)
      }
      return
    }
    
    // If clicking on a connection point or wire, start wiring
    if ((isConnection || wireAtPosition) && !wiringState.isWiring) {
      console.log('Starting wire from:', isConnection ? 'connection point' : 'wire', 'at', x, y)
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
      console.log('Grid clicked, selectedModule:', selectedModule)
      
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
        console.log('Placing module:', selectedModule.module, 'at', centeredX, centeredY)
        
        // Check if we need to expand the grid for this placement
        checkAndExpandForPlacement(centeredX, centeredY, selectedModule.gridX, selectedModule.gridY)
        
        setGridData(prev => {
          // More memory-efficient update - only update cells that change
          const newGrid = [...prev] // Shallow copy of rows
          const componentId = `${selectedModule.module}-${Date.now()}`
          
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
                    isClickable: moduleCell?.isClickable || false
                  }
                }
              }
            }
          }
          
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
        if (editingWireColor) {
          setEditingWireColor(null)
        }
        if (editingWireGauge) {
          setEditingWireGauge(null)
        }
      }
    }
    
    const handleClickOutside = (e: Event) => {
      console.log('Click outside detected, editingWireColor:', editingWireColor)
      if (editingWireColor) {
        // Check if click is inside the color picker
        const colorPicker = document.querySelector('[data-color-picker]')
        if (colorPicker && colorPicker.contains(e.target as Node)) {
          console.log('Click inside color picker, not closing')
          return
        }
        console.log('Closing color picker')
        setEditingWireColor(null)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleClickOutside)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [wiringState.isWiring, cancelWiring, editingWireColor])

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

  // Memoized collision check
  const isCollisionPreview = useMemo(() => {
    if (!hoverState || !selectedModule) return false
    return wouldCollide(hoverState.x, hoverState.y, selectedModule.gridX, selectedModule.gridY) ||
           wouldCollideWithWire(hoverState.x, hoverState.y, selectedModule.gridX, selectedModule.gridY)
  }, [hoverState, selectedModule, gridData, wires])



  // Check if a wire passes through a specific position
  const getWirePassingThrough = (x: number, y: number) => {
    return wires.find(wire => 
      wire.segments.some(segment => segmentPassesThroughCell(segment, x, y))
    )
  }

  // Render wire segment
  const renderWireSegment = (segment: WireSegment, wireId: string) => {
    // Use base cell size (without zoom) since SVG transform handles zoom scaling
    const baseCellSize = (window.innerWidth * 2.5) / 100
    
    // Center wires in cells with fine-tuned positioning
    const startX = segment.from.x * baseCellSize + baseCellSize / 2
    const startY = segment.from.y * baseCellSize + baseCellSize / 2
    const endX = segment.to.x * baseCellSize + baseCellSize / 2
    const endY = segment.to.y * baseCellSize + baseCellSize / 2
    
    const isSelected = selectedWire === wireId
    
    console.log('Rendering line from', startX, startY, 'to', endX, endY, 'selected:', isSelected)
    
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
        {/* Main wire */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={segment.color || '#666666'}
          strokeWidth={segment.thickness || 3}
          strokeLinecap="round"
          className="cursor-pointer"
          style={{
            filter: segment.isPowered ? 'drop-shadow(0 0 4px #00ff00)' : 'none',
            pointerEvents: 'stroke'
          }}
          onClick={(e) => {
            e.stopPropagation()
            console.log('Wire segment clicked:', segment.id)
            // Start new wire from this segment
            startWiring(segment.to.x, segment.to.y)
          }}
        />
      </g>
    )
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



  // Get the module definition at a specific position
  const getModuleAtPosition = (x: number, y: number) => {
    const cell = gridData[y]?.[x]
    if (cell?.occupied && cell.moduleDefinition) {
      return {
        definition: cell.moduleDefinition,
        id: cell.componentId,
        type: cell.componentType
      }
    }
    return null
  }

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
              console.log(`Found module origin for ${moduleId} at (${checkX}, ${checkY})`)
              return { x: checkX, y: checkY }
            }
          }
        }
      }
    }
    console.log(`No module origin found for ${moduleId} at (${x}, ${y})`)
    return null
  }

  // Helper functions to get cell properties from module definition
  const getCellFromDefinition = (definition: any, x: number, y: number, totalCells: number) => {
    // If the grid array doesn't have enough cells, return empty cell
    if (!definition.grid || definition.grid.length !== totalCells) {
      return {
        background: definition.background || '#6B7280',
        css: definition.css || '',
        pin: '',
        type: 'EMPTY'
      }
    }
    
    // Find the cell at this position
    const cell = definition.grid.find((c: any) => c.x === x && c.y === y)
    return cell || {
      background: definition.background || '#6B7280',
      css: definition.css || '',
      pin: '',
      type: 'EMPTY'
    }
  }

  const getCellBackground = (definition: any, x: number, y: number, totalCells: number) => {
    const cell = getCellFromDefinition(definition, x, y, totalCells)
    return cell.background || definition.background || '#6B7280'
  }

  const getCellCSS = (definition: any, x: number, y: number, totalCells: number) => {
    const cell = getCellFromDefinition(definition, x, y, totalCells)
    return parseInlineCSS(cell.css || '')
  }

  const getCellPin = (definition: any, x: number, y: number, totalCells: number) => {
    const cell = getCellFromDefinition(definition, x, y, totalCells)
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
  getModuleAtPosition,
  findModuleOrigin,
  getCellBackground,
  getCellCSS,
  getCellPin,
  getResistorColorBands,
  zoom
}: {
  x: number
  y: number
  cell: GridCell
  isHighlighted: boolean
  hasCollision: boolean
  isCellOccupied: (x: number, y: number) => boolean
  onComponentClick: (e: React.MouseEvent, componentId: string, cellIndex: number) => void
  getModuleAtPosition: (x: number, y: number) => any
  findModuleOrigin: (x: number, y: number, moduleId: string) => any
  getCellBackground: (definition: any, x: number, y: number, totalCells: number) => string
  getCellCSS: (definition: any, x: number, y: number, totalCells: number) => React.CSSProperties
  getCellPin: (definition: any, x: number, y: number, totalCells: number) => string
  getResistorColorBands: (resistance: number) => string[]
  zoom: number
}) => {
  const occupied = isCellOccupied(x, y)
  
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
        cursor: occupied && cell.isClickable ? 'pointer' : 'default'
      }}
      onClick={(e) => {
        if (occupied) {
          if (cell.componentId && cell.cellIndex !== null && cell.cellIndex !== undefined && cell.isClickable) {
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
        const totalCells = cell.moduleDefinition.gridX * cell.moduleDefinition.gridY
        const isPowered = cell?.isPowered || false
        
        return (
          <div
            className="absolute inset-0"
            style={{
              background: getCellBackground(cell.moduleDefinition, relativeX, relativeY, totalCells),
              ...getCellCSS(cell.moduleDefinition, relativeX, relativeY, totalCells),
              // Add power state visualization
              boxShadow: isPowered ? '0 0 8px #00ff00' : 'none'
            }}
          >
            {/* Power indicator */}
            {isPowered && (
              <div className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
            
            {/* Show pin label if this cell has one */}
            {getCellPin(cell.moduleDefinition, relativeX, relativeY, totalCells) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-xs leading-none">
                  {getCellPin(cell.moduleDefinition, relativeX, relativeY, totalCells)}
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
              const resistance = cell.moduleDefinition.properties?.resistance?.default || 1000
              const displayValue = resistance >= 1000 ? `${resistance / 1000}kΩ` : `${resistance}Ω`
              
              return (
                <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                  <span className="text-white text-xs font-bold bg-black bg-opacity-50 px-1 rounded">
                    {displayValue}
                  </span>
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
        wiringState.isWiring ? 'cursor-crosshair' :
        selectedModule ? 'cursor-crosshair' : 'cursor-grab'
      }`}
      onMouseMove={handleHoverMove}
      onClick={handleGridClick}
      onMouseLeave={handleMouseLeave}
    >
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
          transform: `scale(${zoom}) translate(${gridOffset.x / zoom}px, ${gridOffset.y / zoom}px)`,
          transformOrigin: 'top left',
          width: `${gridSize.width * 2.5}vw`,
          height: `${gridSize.height * 2.5}vw`,
          backgroundImage: `
            linear-gradient(to right, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px),
            linear-gradient(to bottom, ${isDark ? '#d1d5db' : '#9ca3af'} 1px, transparent 1px)
          `,
          backgroundSize: `${(window.innerWidth * 2.5 * zoom) / 100}px ${(window.innerWidth * 2.5 * zoom) / 100}px`
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
                    getModuleAtPosition={getModuleAtPosition}
                    findModuleOrigin={findModuleOrigin}
                    getCellBackground={getCellBackground}
                    getCellCSS={getCellCSS}
                    getCellPin={getCellPin}
                    getResistorColorBands={getResistorColorBands}
                    zoom={zoom}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Wire Dashboard */}
      <div 
        className={`absolute top-4 left-4 bg-white dark:bg-dark-surface rounded-lg shadow-lg p-3 border border-gray-200 dark:border-dark-border z-50 max-h-96 overflow-y-auto transition-all duration-200 ${
          editingWireColor ? 'max-w-md' : 'max-w-xs'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
          Wire Monitor
        </div>
        <div className="space-y-2 text-xs text-gray-600 dark:text-dark-text-secondary">
          {wires.length === 0 ? (
            <div className="text-gray-400">No wires placed</div>
          ) : (
            wires.map(wire => {
              const isOverCurrent = wire.current > wire.maxCurrent
              const isOverPower = wire.power > wire.maxPower
              const isSelected = selectedWire === wire.id
              
              return (
                <div 
                  key={wire.id} 
                  className={`p-2 rounded border-2 cursor-pointer transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-dark-border hover:border-gray-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedWire(selectedWire === wire.id ? null : wire.id)
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-4 h-4 rounded cursor-pointer hover:scale-125 transition-transform border-2 ${
                          editingWireColor === wire.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: wire.color }}
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          console.log('Color dot clicked for wire:', wire.id)
                          console.log('Current editingWireColor:', editingWireColor)
                          setEditingWireColor(editingWireColor === wire.id ? null : wire.id)
                        }}
                      />
                      <div>
                        <div className="font-medium">Wire {wire.id.slice(-4)}</div>
                        <div className="text-xs text-gray-500">{wire.gauge} AWG</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={isOverCurrent ? 'text-red-600 font-bold' : ''}>{wire.current}A / {wire.maxCurrent}A</div>
                      <div className={isOverPower ? 'text-red-600 font-bold' : ''}>{wire.power}W / {wire.maxPower}W</div>
                      <div>{wire.voltage}V</div>
                    </div>
                  </div>
                  
                  {/* Gauge selector */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs">Gauge:</span>
                    <button
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingWireGauge(editingWireGauge === wire.id ? null : wire.id)
                      }}
                    >
                      {wire.gauge} AWG
                    </button>
                  </div>
                  
                  {/* Gauge picker menu */}
                  {editingWireGauge === wire.id && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-dark-border rounded">
                      <div className="text-xs font-medium mb-2">Select Wire Gauge:</div>
                      <div className="grid grid-cols-2 gap-1">
                        {wireGauges.map(gauge => (
                          <button
                            key={gauge.gauge}
                            className={`px-2 py-1 text-xs rounded border ${
                              wire.gauge === gauge.gauge 
                                ? 'bg-blue-500 text-white border-blue-500' 
                                : 'bg-white dark:bg-dark-surface border-gray-300 hover:bg-gray-100'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              updateWireGauge(wire.id, gauge.gauge)
                            }}
                            title={gauge.description}
                          >
                            {gauge.gauge} AWG
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Max: {wireGauges.find(g => g.gauge === wire.gauge)?.maxCurrent}A, {wireGauges.find(g => g.gauge === wire.gauge)?.maxPower}W
                      </div>
                    </div>
                  )}
                  
                  {/* Color picker menu */}
                  {editingWireColor === wire.id && (
                    <div className="absolute top-8 left-0 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded shadow-lg p-3 z-50 min-w-[200px]" data-color-picker>
                      <div className="text-xs font-medium mb-2">Choose Wire Color:</div>
                      
                      {/* Predefined colors */}
                      <div className="grid grid-cols-5 gap-1 mb-3">
                        {[
                          { name: 'White', color: '#ffffff' },
                          { name: 'Brown', color: '#8B4513' },
                          { name: 'Black', color: '#000000' },
                          { name: 'Red', color: '#ff0000' },
                          { name: 'Orange', color: '#ff8800' },
                          { name: 'Yellow', color: '#ffff00' },
                          { name: 'Green', color: '#00ff00' },
                          { name: 'Blue', color: '#0000ff' },
                          { name: 'Purple', color: '#8800ff' },
                          { name: 'Pink', color: '#ff00ff' }
                        ].map(({ name, color }) => (
                          <div
                            key={color}
                            className="w-6 h-6 rounded cursor-pointer border-2 border-gray-300 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={name}
                            onClick={(e) => {
                              e.stopPropagation()
                              updateWireColor(wire.id, color)
                            }}
                          />
                        ))}
                      </div>
                      
                      {/* Hex code input */}
                      <div className="border-t border-gray-200 dark:border-dark-border pt-2">
                        <div className="text-xs mb-1">Custom Hex:</div>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="#000000"
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-gray-900 dark:text-white"
                            maxLength={7}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const hexValue = (e.target as HTMLInputElement).value
                                if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
                                  updateWireColor(wire.id, hexValue)
                                }
                              }
                            }}
                          />
                          <button
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement
                              const hexValue = input.value
                              if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
                                updateWireColor(wire.id, hexValue)
                              }
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }))
          }
          
        </div>
      </div>

      {/* Grid Info Overlay */}
      <div 
        className="absolute top-4 right-4 bg-white dark:bg-dark-surface rounded-lg shadow-lg p-3 border border-gray-200 dark:border-dark-border z-50"
        onClick={(e) => e.stopPropagation()}
      >
          <div className="text-sm text-gray-600 dark:text-dark-text-secondary space-y-1">
            <div>Grid: {gridSize.width} × {gridSize.height}</div>
            <div>Zoom: {Math.round(zoom * 100)}%</div>
            <div className="text-xs opacity-75">Scroll to zoom • Drag to pan</div>
            <div className="text-xs text-green-600 dark:text-green-400">
              Memory: {Math.round((gridSize.width * gridSize.height) / 1000)}K cells
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => {
                  setZoom(1)
                  setGridOffset({ x: -200, y: -200 })
                  expandGrid(1)
                }}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Reset view
              </button>
              <button
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`text-xs px-2 py-1 rounded ${
                  snapToGrid 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Snap: {snapToGrid ? 'ON' : 'OFF'}
              </button>
            </div>
            {selectedModule && (
              <div className="text-primary-600 dark:text-primary-400">
                Selected: {selectedModule.module} ({selectedModule.gridX}×{selectedModule.gridY})
              </div>
            )}
            {hoverState && selectedModule && (
              <div className={isCollisionPreview ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                {isCollisionPreview ? "❌ Collision - Cannot place (module or wire)" : "✅ Valid placement"} at ({hoverState.x}, {hoverState.y})
              </div>
            )}
            {wiringState.isWiring && (
              <div className="text-blue-600 dark:text-blue-400">
                🔌 Wiring Mode - {wiringState.currentConnection ? 
                  `Click to finish wire (from ${wiringState.currentConnection.startX},${wiringState.currentConnection.startY})` : 
                  'Click connection points to start wire'}
              </div>
            )}
            {wires.length > 0 && (
              <div className="text-green-600 dark:text-green-400">
                ✅ {wires.length} wire(s) placed
              </div>
            )}
          </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => {
            const newZoom = Math.min(zoom + 0.25, 3)
            setZoom(newZoom)
            expandGrid(newZoom)
          }}
          className="p-2 bg-white dark:bg-dark-surface rounded-lg shadow-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-card transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={() => {
            const newZoom = Math.max(zoom - 0.25, 0.25)
            setZoom(newZoom)
            expandGrid(newZoom)
          }}
          className="p-2 bg-white dark:bg-dark-surface rounded-lg shadow-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-card transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
