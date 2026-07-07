import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Code, Play, Save, Check, AlertCircle, Cpu, Zap, FolderOpen, FileText, X, Plus, Download, Upload, Settings, Bug, ExternalLink } from 'lucide-react'
import { WireConnection } from '../modules/types'
import { GridCell } from '../systems/ElectricalSystem'
import { ArduinoCompilerReal, CompilationResult, CompilationError, ArduinoProject, ArduinoFile, SystemStatus } from '../services/ArduinoCompilerReal'
import { FileManagerBrowser, FileNode, ProjectTemplate } from '../services/FileManagerBrowser'
import { ESP32Flasher, FlashProgress, FlashResult, ESP32Device } from '../services/ESP32Flasher'
import { QEMUEmulatorReal, EmulationResult, GPIOState } from '../services/QEMUEmulatorReal'
import { 
  startDynamicGPIO, 
  getDynamicGPIOStates,
  startMultiMicrocontrollerGPIO,
  stopAllCircuitSimulation,
  getAllMultiMicrocontrollerGPIOStates,
  getRunningMicrocontrollers,
  isMicrocontrollerRunning
} from '../systems/ElectricalSystem'
import { crdtService } from '../services/CRDTService'
import { formatCurrent, formatPower, formatVoltage } from '../utils/electricalFormatting'
import { useTheme } from '../contexts/ThemeContext'
import {
  WIRE_COLORS,
  getWireColorHex,
  resolveWireStrokeColor,
  wireColorPatch,
  type WireColorId,
} from '../theme/colors'
import type { Program, ProgramFlashAssignment } from '../types/workspace'
import { gpioPinNumber } from '../systems/chain/components/registry'
import { McuProgramModal } from './McuProgramModal'

type GpioDisplayState = GPIOState & { state?: GPIOState['state'] | 'PULSING' }

function formatPinStateLabel(state?: GpioDisplayState): string {
  if (!state) return 'LOW'
  if (state.state === 'PULSING') {
    return `PWM ${Math.round((state.value ?? 0) * 100)}%`
  }
  if (state.state === 'HIGH') return 'HIGH'
  return 'LOW'
}

function pinStateTone(state?: GpioDisplayState): 'high' | 'pwm' | 'low' {
  if (state?.state === 'PULSING') return 'pwm'
  if (state?.state === 'HIGH') return 'high'
  return 'low'
}

interface Microcontroller {
  id: string
  name: string
  position: { x: number; y: number }
  definition: any
  isHighlighted: boolean
}

interface CompiledCode {
  microcontrollerId: string
  code: string
  compilationResult: CompilationResult
  compiledAt: Date
}

interface SimulationState {
  isRunning: boolean
  currentMicrocontroller: Microcontroller | null
  runningMicrocontrollers: Set<string>
  gpioStates: Map<number, GPIOState>
  wireStates: Map<string, 'active' | 'inactive'>
  startTime: Date | null
}

interface DevicePanelProps {
  gridData: GridCell[][]
  wires: WireConnection[]
  componentStates: Map<string, any>
  projectPrograms?: Program[]
  programFlashes?: Record<string, ProgramFlashAssignment>
  onMicrocontrollerHighlight: (id: string | null) => void
  onMicrocontrollerClick: (microcontroller: Microcontroller) => void
  onModalStateChange?: (isOpen: boolean) => void
  onSimulationStateChange?: (state: SimulationState) => void
  onWiresChange?: (wires: WireConnection[]) => void
  embedded?: boolean
  floating?: boolean
  stacked?: boolean
  expanded?: boolean
  hideHeader?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export function DevicePanel({ gridData, wires, componentStates, projectPrograms, programFlashes, onMicrocontrollerHighlight, onMicrocontrollerClick, onModalStateChange, onSimulationStateChange, onWiresChange, embedded = false, floating = false, stacked = false, expanded: expandedProp, hideHeader = false, onExpandedChange }: DevicePanelProps) {
  const { wireColorMode } = useTheme()
  const [internalExpanded, setInternalExpanded] = useState(() => stacked || !(embedded || floating))
  const isExpanded = hideHeader ? true : (expandedProp ?? internalExpanded)
  const [activeTab, setActiveTab] = useState<'microcontrollers' | 'wires' | 'simulation'>('microcontrollers')
  const [expandedMicrocontroller, setExpandedMicrocontroller] = useState<string | null>(null)
  const [showCodingModal, setShowCodingModal] = useState(false)
  const [selectedMicrocontroller, setSelectedMicrocontroller] = useState<Microcontroller | null>(null)
  const [microcontrollerCode, setMicrocontrollerCode] = useState<Map<string, string>>(new Map())
  const [code, setCode] = useState('// Your code here\nvoid setup() {\n  // Initialize pins\n}\n\nvoid loop() {\n  // Main program loop\n}')
  const [isCompiled, setIsCompiled] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  // New state for enhanced functionality
  const [compiler] = useState(() => new ArduinoCompilerReal())
  const [fileManager] = useState(() => new FileManagerBrowser())
  const [flasher] = useState(() => new ESP32Flasher())
  const [qemuEmulator] = useState(() => new QEMUEmulatorReal())
  const [currentProject, setCurrentProject] = useState<ArduinoProject | null>(null)
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null)
  const [showFileManager, setShowFileManager] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compilationErrors, setCompilationErrors] = useState<CompilationError[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [isFlashing, setIsFlashing] = useState(false)
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null)
  const [connectedDevice, setConnectedDevice] = useState<ESP32Device | null>(null)
  const [showErrorPanel, setShowErrorPanel] = useState(false)
  const [errorPanelHeight, setErrorPanelHeight] = useState(400) // Default height in pixels
  const [emulationResult, setEmulationResult] = useState<EmulationResult | null>(null)
  const [isEmulating, setIsEmulating] = useState(false)
  const [showEmulationPanel, setShowEmulationPanel] = useState(false)
  
  // New state for code linking and simulation
  const [compiledCodes, setCompiledCodes] = useState<Map<string, CompiledCode>>(new Map())
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    currentMicrocontroller: null,
    runningMicrocontrollers: new Set(),
    gpioStates: new Map(),
    wireStates: new Map(),
    startTime: null
  })
  const [showSimulationPanel, setShowSimulationPanel] = useState(false)
  const [linkedPrograms, setLinkedPrograms] = useState<Map<string, string>>(new Map())

  const linkableProjectPrograms = projectPrograms ?? []

  const getMicrocontrollerSketch = useCallback(
    (microcontrollerId: string): string | undefined => {
      const saved = microcontrollerCode.get(microcontrollerId)?.trim()
      if (saved) return saved
      const compiled = compiledCodes.get(microcontrollerId)?.code?.trim()
      if (compiled) return compiled
      return undefined
    },
    [microcontrollerCode, compiledCodes]
  )

  React.useEffect(() => {
    if (!programFlashes || !projectPrograms?.length) return

    const nextLinked = new Map<string, string>()
    const nextCodes = new Map<string, string>()
    const nextCompiled = new Map<string, CompiledCode>()
    const runningIds = new Set<string>()

    for (const [componentId, assignment] of Object.entries(programFlashes)) {
      const program = projectPrograms.find((p) => p.id === assignment.programId)
      if (!program?.code?.trim()) continue

      nextLinked.set(componentId, program.id)
      nextCodes.set(componentId, program.code)
      if (program.compilation?.success) {
        nextCompiled.set(componentId, {
          microcontrollerId: componentId,
          code: program.code,
          compilationResult: {
            success: true,
            output: program.compilation.output,
            firmware: program.compilation.firmware,
            filename: program.compilation.filename,
            size: program.compilation.size,
            binPath: program.compilation.binPath,
          },
          compiledAt: new Date(program.compilation.compiledAt),
        })
      }
      runningIds.add(componentId)
    }

    setLinkedPrograms(nextLinked)
    setMicrocontrollerCode(nextCodes)
    setCompiledCodes(nextCompiled)
    if (runningIds.size > 0) {
      setSimulationState((prev) => ({
        ...prev,
        isRunning: true,
        runningMicrocontrollers: runningIds,
      }))
      setShowSimulationPanel(true)
    }
  }, [programFlashes, projectPrograms])
  
  // Wire editing state
  const [selectedWire, setSelectedWire] = useState<string | null>(null)
  const [editingWireColor, setEditingWireColor] = useState<string | null>(null)
  const [editingWireGauge, setEditingWireGauge] = useState<string | null>(null)
  
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

  // Wire update functions
  const updateWireColor = useCallback((wireId: string, colorId: WireColorId) => {
    const patch = wireColorPatch(colorId, wireColorMode)
    const updatedWires = wires.map(wire => {
      if (wire.id === wireId || wire.parentId === wireId || (wire.childIds && wire.childIds.includes(wireId))) {
        return {
          ...wire,
          colorId: patch.colorId,
          color: patch.color,
          segments: wire.segments.map(segment => ({
            ...segment,
            colorId: patch.colorId,
            color: patch.color,
          })),
        }
      }
      return wire
    })
    onWiresChange?.(updatedWires)
    setEditingWireColor(null)
  }, [wires, onWiresChange, wireColorMode])

  const updateWireColorHex = useCallback((wireId: string, hex: string) => {
    const updatedWires = wires.map(wire => {
      if (wire.id === wireId || wire.parentId === wireId || (wire.childIds && wire.childIds.includes(wireId))) {
        return {
          ...wire,
          colorId: undefined,
          color: hex,
          segments: wire.segments.map(segment => ({
            ...segment,
            colorId: undefined,
            color: hex,
          })),
        }
      }
      return wire
    })
    onWiresChange?.(updatedWires)
    setEditingWireColor(null)
  }, [wires, onWiresChange])

  const updateWireGauge = useCallback((wireId: string, newGauge: number) => {
    const gaugeSpec = wireGauges.find(g => g.gauge === newGauge)
    if (!gaugeSpec) return

    const updatedWires = wires.map(wire => {
      // Update the wire and all its children
      if (wire.id === wireId || wire.parentId === wireId || (wire.childIds && wire.childIds.includes(wireId))) {
        return { 
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
      }
      return wire
    })
    onWiresChange?.(updatedWires)
    setEditingWireGauge(null)
  }, [wires, wireGauges, onWiresChange])

  // Handle click outside to close color picker
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (editingWireColor) {
        // Check if click is inside the color picker
        const colorPicker = document.querySelector('[data-color-picker]')
        if (colorPicker && colorPicker.contains(e.target as Node)) {
          return // Don't close if clicking inside color picker
        }
        setEditingWireColor(null)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [editingWireColor])

  // Notify parent component when simulation state changes
  useEffect(() => {
    if (onSimulationStateChange) {
      onSimulationStateChange(simulationState)
    }
  }, [simulationState, onSimulationStateChange])

  // Find all microcontrollers in the grid
  const findMicrocontrollers = useCallback((): Microcontroller[] => {
    const microcontrollers: Microcontroller[] = []
    
    gridData.forEach((row, y) => {
      if (!row || !Array.isArray(row)) return
      row.forEach((cell, x) => {
        if (cell?.occupied && cell.componentId && cell.moduleDefinition) {
          const module = cell.moduleDefinition
          if (module.category === 'microcontrollers') {
            // Check if we already have this microcontroller
            const existing = microcontrollers.find(mc => mc.id === cell.componentId)
            if (!existing) {
              microcontrollers.push({
                id: cell.componentId,
                name: module.module,
                position: { x, y },
                definition: module,
                isHighlighted: false
              })
            }
          }
        }
      })
    })
    
    return microcontrollers
  }, [gridData])

  const microcontrollers = findMicrocontrollers()

  // Initialize templates and check system status
  useEffect(() => {
    const initializeServices = async () => {
      try {
        const availableTemplates = await fileManager.getTemplates()
        setTemplates(availableTemplates)
        
        const status = await compiler.checkSystemStatus()
        setSystemStatus(status)
        
        if (!status.arduinoCliAvailable) {
          console.warn('Arduino CLI not available:', status.error)
        }
        
        // Load microcontroller code from CRDT
        loadMicrocontrollerCodeFromCRDT()
      } catch (error) {
        console.error('Failed to initialize services:', error)
      }
    }
    
    initializeServices()
  }, [compiler, fileManager])

  // Load microcontroller code from CRDT
  const loadMicrocontrollerCodeFromCRDT = () => {
    try {
      const allMicrocontrollerCode = crdtService.getAllMicrocontrollerCode()
      const codeMap = new Map<string, string>()
      
      allMicrocontrollerCode.forEach((codeData, microcontrollerId) => {
        if (codeData.code) {
          codeMap.set(microcontrollerId, codeData.code)
        }
      })
      
      setMicrocontrollerCode(codeMap)
      console.log('✅ Loaded microcontroller code from CRDT:', {
        count: codeMap.size,
        microcontrollers: Array.from(codeMap.keys())
      })
    } catch (error) {
      console.error('❌ Failed to load microcontroller code from CRDT:', error)
    }
  }

  // Auto-save functionality
  useEffect(() => {
    if (showCodingModal && code && currentProject && selectedMicrocontroller) {
      const interval = setInterval(async () => {
        setSaveStatus('saving')
        try {
          await saveCurrentProject()
          
          // Save code to microcontroller-specific storage
          setMicrocontrollerCode(prev => new Map(prev.set(selectedMicrocontroller.id, code)))
          
          setSaveStatus('saved')
          setLastSaved(new Date())
        } catch (error) {
          setSaveStatus('unsaved')
          console.error('Auto-save failed:', error)
        }
      }, 10000) // Auto-save every 10 seconds

      return () => clearInterval(interval)
    }
  }, [showCodingModal, code, currentProject, selectedMicrocontroller])

  // Notify parent component when modal state changes
  React.useEffect(() => {
    onModalStateChange?.(showCodingModal)
  }, [showCodingModal, onModalStateChange])

  // Load code and compile state for selected microcontroller
  React.useEffect(() => {
    if (!selectedMicrocontroller) return

    const savedCode = microcontrollerCode.get(selectedMicrocontroller.id)
    setCode(
      savedCode ??
        '// Your code here\nvoid setup() {\n  // Initialize pins\n}\n\nvoid loop() {\n  // Main program loop\n}'
    )

    const compiled = compiledCodes.get(selectedMicrocontroller.id)
    if (compiled) {
      setCompilationResult(compiled.compilationResult)
      setIsCompiled(true)
      setCompilationErrors([])
    } else {
      setCompilationResult(null)
      setIsCompiled(false)
      setCompilationErrors([])
    }
  }, [selectedMicrocontroller, microcontrollerCode, compiledCodes])

  // Enhanced handler functions
  const saveCurrentProject = async () => {
    if (!currentProject || !selectedMicrocontroller) return
    
    const updatedProject: ArduinoProject = {
      ...currentProject,
      files: currentProject.files.map(file => 
        file.isMain ? { ...file, content: code } : file
      ),
      modifiedAt: new Date()
    }
    
    await compiler.saveProject(updatedProject)
    setCurrentProject(updatedProject)
    
    // Save code to microcontroller-specific storage
    setMicrocontrollerCode(prev => new Map(prev.set(selectedMicrocontroller.id, code)))
    
    // Save to CRDT
    saveMicrocontrollerCodeToCRDT(selectedMicrocontroller.id, code, updatedProject, compilationResult)
  }

  // Save microcontroller code to CRDT
  const saveMicrocontrollerCodeToCRDT = (microcontrollerId: string, code: string, project?: any, compilationResult?: any) => {
    try {
      const operation = crdtService.updateMicrocontrollerCode(microcontrollerId, {
        code,
        project,
        compilationResult,
        compiledAt: compilationResult ? new Date() : undefined
      })
      
      console.log('✅ Microcontroller code saved to CRDT:', {
        microcontrollerId,
        operationId: operation.id,
        codeLength: code.length
      })
    } catch (error) {
      console.error('❌ Failed to save microcontroller code to CRDT:', error)
    }
  }

  const handleLinkProjectProgram = (microcontrollerId: string, program: Program) => {
    setLinkedPrograms((prev) => new Map(prev.set(microcontrollerId, program.id)))
    setMicrocontrollerCode((prev) => new Map(prev.set(microcontrollerId, program.code)))

    if (program.compilation?.success) {
      const compilationResult: CompilationResult = {
        success: true,
        output: program.compilation.output,
        firmware: program.compilation.firmware,
        filename: program.compilation.filename,
        size: program.compilation.size,
        binPath: program.compilation.binPath,
      }

      setCompiledCodes((prev) =>
        new Map(
          prev.set(microcontrollerId, {
            microcontrollerId,
            code: program.code,
            compilationResult,
            compiledAt: new Date(program.compilation.compiledAt),
          })
        )
      )
    } else {
      setCompiledCodes((prev) => {
        const next = new Map(prev)
        next.delete(microcontrollerId)
        return next
      })
      if (selectedMicrocontroller?.id === microcontrollerId) {
        setCompilationResult(null)
        setIsCompiled(false)
      }
    }
  }

  const handleCompile = async () => {
    if (!selectedMicrocontroller) return
    
    setIsCompiling(true)
    setCompilationErrors([])
    
    try {
      // Determine board type based on microcontroller
      const board = getBoardForMicrocontroller(selectedMicrocontroller.name)
      
      // Create project if it doesn't exist
      if (!currentProject) {
        const newProject: ArduinoProject = {
          name: `${selectedMicrocontroller.name}_${Date.now()}`,
          files: [{
            name: `${selectedMicrocontroller.name}.ino`,
            content: code,
            type: 'ino',
            isMain: true
          }],
          board,
          libraries: [],
          createdAt: new Date(),
          modifiedAt: new Date()
        }
        setCurrentProject(newProject)
      }
      
      // Compile the code
      const result = await compiler.compileSketch(code, board)
      setCompilationResult(result)
      
      if (result.success) {
        setIsCompiled(true)
        setCompilationErrors([])
        setShowErrorPanel(false)
        
        // Link the compiled code to the selected microcontroller
        if (selectedMicrocontroller) {
          const compiledCode: CompiledCode = {
            microcontrollerId: selectedMicrocontroller.id,
            code: code,
            compilationResult: result,
            compiledAt: new Date()
          }
          setCompiledCodes(prev => new Map(prev.set(selectedMicrocontroller.id, compiledCode)))
          
          // Save code to microcontroller-specific storage
          setMicrocontrollerCode(prev => new Map(prev.set(selectedMicrocontroller.id, code)))
          
          // Save to CRDT
          saveMicrocontrollerCodeToCRDT(selectedMicrocontroller.id, code, currentProject, result)
          
          console.log('Code linked to microcontroller:', selectedMicrocontroller.name, compiledCode)
        }
        
        console.log('Compilation successful!', result)
      } else {
        setIsCompiled(false)
        setCompilationErrors(result.errors || [])
        setShowErrorPanel(true) // Show error panel when compilation fails
        console.error('Compilation failed:', result.errors)
      }
    } catch (error) {
      setIsCompiled(false)
      setCompilationErrors([{
        file: 'compiler',
        line: 0,
        column: 0,
        message: `Compilation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      }])
      console.error('Compilation error:', error)
    } finally {
      setIsCompiling(false)
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await saveCurrentProject()
      
      // Save code to microcontroller-specific storage
      if (selectedMicrocontroller) {
        setMicrocontrollerCode(prev => new Map(prev.set(selectedMicrocontroller.id, code)))
      }
      
      setSaveStatus('saved')
      setLastSaved(new Date())
    } catch (error) {
      setSaveStatus('unsaved')
      console.error('Save failed:', error)
    }
  }

  const handleRun = async () => {
    if (!selectedMicrocontroller) {
      alert('Please select a microcontroller first')
      return
    }

    if (!compilationResult?.firmware) {
      alert('Please compile code for this microcontroller first')
      return
    }

    try {
      await startSimulation(selectedMicrocontroller, compilationResult)
    } catch (error) {
      console.error('Run failed:', error)
      alert('Failed to start simulation: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const startSimulation = async (microcontroller: Microcontroller, compilationResult: CompilationResult) => {
    setSimulationState(prev => ({
      ...prev,
      isRunning: true,
      currentMicrocontroller: microcontroller,
      runningMicrocontrollers: new Set([...prev.runningMicrocontrollers, microcontroller.id]),
      startTime: new Date()
    }))
    setShowSimulationPanel(true)

    try {
      // Start multi-microcontroller GPIO simulation for this specific microcontroller
      console.log(`[MULTI_MCU_GPIO] Starting simulation for ${microcontroller.id} with code:`, code)
      startMultiMicrocontrollerGPIO(microcontroller.id, code)

      // Also start emulation with the compiled firmware for additional data
      const result = await qemuEmulator.startEmulation(
        compilationResult.firmware!,
        getBoardForMicrocontroller(microcontroller.name),
        'bin',
        compilationResult.binPath,
        code // Use the current code from the editor
      )

      if (result.success) {
        // Get multi-microcontroller GPIO states
        const multiMCUStates = getAllMultiMicrocontrollerGPIOStates()
        const singleDynamicStates = getDynamicGPIOStates()
        const dynamicStates = multiMCUStates.size > 0 ? multiMCUStates : singleDynamicStates
        
        // Update GPIO states from dynamic simulation (preferred) or emulation result
        const gpioStates = new Map<number, GPIOState>()
        if (dynamicStates.size > 0) {
        // Use dynamic states
        dynamicStates.forEach((state, pin) => {
          gpioStates.set(pin, {
            pin,
            state: state.state,
            value: state.value,
            timestamp: state.timestamp
          })
        })
        } else {
          // Fall back to emulation result
          result.gpioStates.forEach(state => {
            gpioStates.set(state.pin, state)
          })
        }

        // Update wire states based on GPIO states
        const wireStates = new Map<string, 'active' | 'inactive'>()
        gpioStates.forEach((gpioState, pin) => {
          // Find wires connected to this pin
          const connectedWires = findWiresConnectedToPin(microcontroller, pin)
          connectedWires.forEach(wireId => {
            wireStates.set(wireId, (gpioState.state === 'HIGH' || gpioState.state === 'PULSING') ? 'active' : 'inactive')
          })
        })

        setSimulationState(prev => ({
          ...prev,
          gpioStates,
          wireStates
        }))

        setEmulationResult(result)
        console.log('Simulation started successfully:', result)
      } else {
        throw new Error(result.error || 'Simulation failed')
      }
    } catch (error) {
      console.error('Simulation error:', error)
      setSimulationState(prev => ({
        ...prev,
        isRunning: false,
        currentMicrocontroller: null,
        startTime: null
      }))
      throw error
    }
  }

  const findWiresConnectedToPin = (microcontroller: Microcontroller, pin: number): string[] => {
    const connectedWires: string[] = []

    wires.forEach((wire) => {
      const touchesPin = wire.segments.some((segment) => {
        for (const pt of [segment.from, segment.to]) {
          const cell = gridData[pt.y]?.[pt.x]
          if (!cell?.occupied || cell.componentId !== microcontroller.id) continue
          const moduleCell = cell.moduleDefinition?.grid?.[cell.cellIndex ?? 0]
          if (!moduleCell) continue
          if (gpioPinNumber(moduleCell) === pin) return true
        }
        return false
      })
      if (touchesPin) connectedWires.push(wire.id)
    })

    return connectedWires
  }

  /** Rebuild panel/grid GPIO + wire highlight state from live engine (empty when nothing is running). */
  const syncLiveGpioAndWireStates = useCallback(
    (runningIds: Set<string>): Pick<SimulationState, 'gpioStates' | 'wireStates'> => {
      const gpioStates = new Map<number, GPIOState>()
      const wireStates = new Map<string, 'active' | 'inactive'>()

      if (runningIds.size === 0) {
        return { gpioStates, wireStates }
      }

      const multiMCUStates = getAllMultiMicrocontrollerGPIOStates()
      const singleDynamicStates = getDynamicGPIOStates()
      const dynamicStates = multiMCUStates.size > 0 ? multiMCUStates : singleDynamicStates

      dynamicStates.forEach((state, pin) => {
        gpioStates.set(pin, {
          pin,
          state: state.state,
          value: state.value,
          timestamp: state.timestamp,
        })
      })

      microcontrollers
        .filter((mcu) => runningIds.has(mcu.id))
        .forEach((mcu) => {
          gpioStates.forEach((gpioState, pin) => {
            findWiresConnectedToPin(mcu, pin).forEach((wireId) => {
              wireStates.set(
                wireId,
                gpioState.state === 'HIGH' || gpioState.state === 'PULSING' ? 'active' : 'inactive'
              )
            })
          })
        })

      return { gpioStates, wireStates }
    },
    [microcontrollers, gridData, wires]
  )

  /** Stop every simulation and clear GPIO/PWM/wire highlights. */
  const haltAllSimulations = useCallback(() => {
    stopAllCircuitSimulation()
    const cleared = syncLiveGpioAndWireStates(new Set())
    setSimulationState({
      isRunning: false,
      currentMicrocontroller: null,
      runningMicrocontrollers: new Set(),
      gpioStates: cleared.gpioStates,
      wireStates: cleared.wireStates,
      startTime: null,
    })
  }, [syncLiveGpioAndWireStates])

  const stopSimulation = () => {
    haltAllSimulations()
    setShowSimulationPanel(false)
  }

  // Real-time GPIO state updates during simulation
  useEffect(() => {
    if (!simulationState.isRunning) return

    const updateGPIOStates = () => {
      const multiMCUStates = getAllMultiMicrocontrollerGPIOStates()
      const singleDynamicStates = getDynamicGPIOStates()
      const dynamicStates = multiMCUStates.size > 0 ? multiMCUStates : singleDynamicStates

      if (dynamicStates.size > 0) {
        const gpioStates = new Map<number, GPIOState>()
        let hasChanges = false

        dynamicStates.forEach((state, pin) => {
          const newState = state.state
          const current = simulationState.gpioStates.get(pin)

          if (
            current?.state !== newState ||
            (newState === 'PULSING' &&
              Math.abs((current?.value ?? 0) - state.value) > 0.005)
          ) {
            hasChanges = true
          }

          gpioStates.set(pin, {
            pin,
            state: newState,
            value: state.value,
            timestamp: state.timestamp,
          })
        })

        if (hasChanges) {
          const wireStates = new Map<string, 'active' | 'inactive'>()
          const mcusForWires =
            simulationState.runningMicrocontrollers.size > 0
              ? microcontrollers.filter((mcu) =>
                  simulationState.runningMicrocontrollers.has(mcu.id)
                )
              : simulationState.currentMicrocontroller
                ? [simulationState.currentMicrocontroller]
                : []

          mcusForWires.forEach((mcu) => {
            gpioStates.forEach((gpioState, pin) => {
              findWiresConnectedToPin(mcu, pin).forEach((wireId) => {
                wireStates.set(
                  wireId,
                  gpioState.state === 'HIGH' || gpioState.state === 'PULSING'
                    ? 'active'
                    : 'inactive'
                )
              })
            })
          })

          setSimulationState((prev) => ({
            ...prev,
            gpioStates,
            wireStates,
          }))
        }
      }
    }

    const interval = setInterval(updateGPIOStates, 0)
    return () => clearInterval(interval)
  }, [
    simulationState.isRunning,
    simulationState.currentMicrocontroller,
    simulationState.runningMicrocontrollers,
    simulationState.gpioStates,
    microcontrollers,
    gridData,
    wires,
  ])

  const handleFlashFirmware = async () => {
    if (!compilationResult?.firmware) {
      console.error('No firmware to flash')
      return
    }

    try {
      setIsFlashing(true)
      setFlashProgress(null)

      // Check if Web Serial is supported
      if (!flasher.isWebSerialSupported()) {
        throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.')
      }

      // Request device access
      const device = await flasher.requestDevice()
      setConnectedDevice(device)

      // Connect to device
      await flasher.connect(device)

      // Flash firmware
      const result = await flasher.flashFirmware(
        compilationResult.firmware,
        (progress) => {
          setFlashProgress(progress)
        }
      )

      if (result.success) {
        console.log('Firmware flashed successfully!')
        // Optionally reset the device
        await flasher.reset()
      } else {
        throw new Error(result.error || 'Flash failed')
      }

    } catch (error) {
      console.error('Flash error:', error)
      alert(`Failed to flash firmware: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsFlashing(false)
      setFlashProgress(null)
      if (connectedDevice) {
        await flasher.disconnect()
        setConnectedDevice(null)
      }
    }
  }

  const handleDownloadFirmware = () => {
    if (compilationResult?.firmware && compilationResult?.filename) {
      try {
        compiler.downloadFirmware(compilationResult.firmware, compilationResult.filename)
      } catch (error) {
        console.error('Failed to download firmware:', error)
        alert('Failed to download firmware file')
      }
    }
  }

  const handleErrorPanelResize = (e: React.MouseEvent) => {
    const startY = e.clientY
    const startHeight = errorPanelHeight

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY // Inverted because we want to resize from bottom
      const newHeight = Math.max(200, Math.min(600, startHeight + deltaY)) // Min 200px, max 600px
      setErrorPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleEmulate = async () => {
    if (!compilationResult?.firmware) {
      console.error('No firmware to emulate')
      return
    }

    try {
      setIsEmulating(true)
      setEmulationResult(null)

      const board = getBoardForMicrocontroller(selectedMicrocontroller?.name || 'ESP32')
      const result = await qemuEmulator.startEmulation(
        compilationResult.firmware,
        board,
        'bin',
        compilationResult.binPath,
        code // Pass the source code for accurate emulation
      )

      setEmulationResult(result)
      setShowEmulationPanel(true)
      console.log('Emulation completed:', result)
    } catch (error) {
      console.error('Emulation failed:', error)
      setEmulationResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        gpioStates: [],
        executionTime: 0
      })
      setShowEmulationPanel(true)
    } finally {
      setIsEmulating(false)
    }
  }

  const getBoardLabel = (microcontrollerName: string): string => {
    const board = getBoardForMicrocontroller(microcontrollerName)
    if (board.includes('esp32s3')) return 'ESP32-S3'
    if (board.includes('esp32')) return 'ESP32'
    if (board.includes('nano')) return 'Arduino Nano'
    return 'Arduino Uno'
  }

  const runSchematicSimulation = () => {
    if (!selectedMicrocontroller) return
    const sketch = code.trim() || getMicrocontrollerSketch(selectedMicrocontroller.id)
    if (!sketch) return

    startMultiMicrocontrollerGPIO(selectedMicrocontroller.id, sketch)
    const dynamicStates = getAllMultiMicrocontrollerGPIOStates()
    const initialGpioStates = new Map<number, GPIOState>()
    const initialWireStates = new Map<string, 'active' | 'inactive'>()
    dynamicStates.forEach((state, pin) => {
      initialGpioStates.set(pin, {
        pin,
        state: state.state,
        value: state.value,
        timestamp: state.timestamp,
      })
      findWiresConnectedToPin(selectedMicrocontroller, pin).forEach((wireId) => {
        initialWireStates.set(
          wireId,
          state.state === 'HIGH' || state.state === 'PULSING' ? 'active' : 'inactive'
        )
      })
    })
    setSimulationState((prev) => ({
      ...prev,
      isRunning: true,
      currentMicrocontroller: selectedMicrocontroller,
      runningMicrocontrollers: new Set([...prev.runningMicrocontrollers, selectedMicrocontroller.id]),
      gpioStates: initialGpioStates.size > 0 ? initialGpioStates : prev.gpioStates,
      wireStates: initialWireStates.size > 0 ? initialWireStates : prev.wireStates,
      startTime: new Date(),
    }))
    setShowSimulationPanel(true)
  }

  const getBoardForMicrocontroller = (microcontrollerName: string): string => {
    switch (microcontrollerName.toLowerCase()) {
      case 'arduino uno':
      case 'arduino uno r3':
        return 'arduino:avr:uno'
      case 'esp32':
      case 'esp32-wroom-32 (38-pin)':
        return 'esp32:esp32:esp32'
      default:
        return 'arduino:avr:uno' // Default to Arduino Uno for better compatibility
    }
  }

  const getWokwiBoardConfig = (microcontrollerName: string) => {
    switch (microcontrollerName.toLowerCase()) {
      case 'arduino uno':
        return {
          type: 'wokwi-arduino-uno',
          name: 'Arduino Uno',
          pins: 14,
          analogPins: 6,
          pwmPins: [3, 5, 6, 9, 10, 11],
          voltage: '5V'
        }
      case 'esp32':
        return {
          type: 'wokwi-esp32-devkit-v1',
          name: 'ESP32 DevKit',
          pins: 30,
          analogPins: 18,
          pwmPins: [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33],
          voltage: '3.3V'
        }
      default:
        return {
          type: 'wokwi-esp32-devkit-v1',
          name: 'ESP32 DevKit',
          pins: 30,
          analogPins: 18,
          pwmPins: [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33],
          voltage: '3.3V'
        }
    }
  }

  const createNewProject = async (template?: ProjectTemplate) => {
    if (!selectedMicrocontroller) return
    
    const projectName = `${selectedMicrocontroller.name}_${Date.now()}`
    
    if (template) {
      await fileManager.createProjectFromTemplate(template.name, projectName)
    }
    
    const newProject = compiler.createNewProject(projectName, template)
    
    setCurrentProject(newProject)
    if (newProject.files.length > 0) {
      const mainFile = newProject.files.find(f => f.isMain)
      if (mainFile) {
        setCode(mainFile.content)
      }
    }
  }

  const loadProject = async (projectName: string) => {
    try {
      const project = await compiler.loadProject(projectName)
      if (project) {
        setCurrentProject(project)
        const mainFile = project.files.find(f => f.isMain)
        if (mainFile) {
          setCode(mainFile.content)
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saved':
        return <Check className="w-4 h-4 text-green-500" />
      case 'saving':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'unsaved':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
    }
  }

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saved':
        return lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Saved'
      case 'saving':
        return 'Saving...'
      case 'unsaved':
        return 'Unsaved changes'
    }
  }

  const toggleExpanded = () => {
    const next = !isExpanded
    if (expandedProp === undefined) setInternalExpanded(next)
    onExpandedChange?.(next)
  }

  return (
    <>
      {/* Main Panel */}
      <div
        className={
          floating
            ? `flex min-h-0 w-full flex-col overflow-hidden ${stacked ? 'h-full flex-1' : ''} ${
                hideHeader ? 'bg-transparent text-zinc-100' : ''
              }`
            : embedded
              ? `flex w-full flex-col overflow-hidden ${
                  hideHeader ? 'h-full min-h-0 flex-1 bg-transparent text-zinc-100' : 'bg-white dark:bg-carbon-card/80 dark:bg-dark-surface'
                }`
              : 'absolute top-4 left-4 bg-white dark:bg-dark-surface rounded-lg shadow-lg border border-gray-200 dark:border-dark-border z-50 min-w-[300px] max-w-[400px]'
        }
      >
        {/* Header */}
        {!hideHeader && (
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-card transition-colors shrink-0"
          onClick={toggleExpanded}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-sm text-gray-900 dark:text-dark-text-primary">Device Panel</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
          )}
        </div>
        )}

        {isExpanded && (
          <div
            className={`${hideHeader ? '' : 'border-t border-gray-200 dark:border-dark-border'} ${
              stacked
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                : embedded
                  ? 'max-h-[min(40vh,320px)] overflow-y-auto'
                  : 'overflow-y-auto'
            }`}
          >
            {/* Global MCU Stats and Run All Button */}
            {(() => {
              const mcusWithCode = microcontrollers.filter((mcu) => compiledCodes.has(mcu.id))
              const runningCount = simulationState.runningMicrocontrollers.size
              const canRunAll = mcusWithCode.length > 1
              const allRunning =
                mcusWithCode.length > 0 &&
                mcusWithCode.every((mcu) => simulationState.runningMicrocontrollers.has(mcu.id))
              const showRunAll = mcusWithCode.length > 1
              const showSelected = !hideHeader && selectedMicrocontroller != null

              if (!showRunAll && !showSelected) return null

              return (
                <div
                  className={
                    hideHeader
                      ? 'border-b border-white/10 px-4 py-2.5'
                      : 'p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-dark-border'
                  }
                >
                  {showRunAll && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Multiple MCUs ({mcusWithCode.length} with code)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-blue-600 dark:text-blue-300">
                            {runningCount} running
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (allRunning) {
                            console.log('Stop All button clicked - stopping all microcontrollers')
                            haltAllSimulations()
                          } else {
                            console.log('Run All button clicked - starting all microcontrollers')
                            mcusWithCode.forEach((mcu) => {
                              const compiledCode = compiledCodes.get(mcu.id)
                              if (compiledCode) {
                                startMultiMicrocontrollerGPIO(mcu.id, compiledCode.code)
                              }
                            })
                            setSimulationState((prev) => ({
                              ...prev,
                              isRunning: true,
                              runningMicrocontrollers: new Set(mcusWithCode.map((mcu) => mcu.id)),
                            }))
                          }
                        }}
                        disabled={!canRunAll && !allRunning}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors ${
                          allRunning
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                            : canRunAll
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                        title={
                          allRunning
                            ? 'Stop all running microcontrollers'
                            : 'Run all microcontrollers with compiled code'
                        }
                      >
                        {allRunning ? (
                          <>
                            <X className="w-4 h-4" />
                            Stop All ({runningCount})
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Run All ({mcusWithCode.length})
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {showSelected && selectedMicrocontroller && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Active MCU</span>
                        </div>
                        <button
                          onClick={() => setSelectedMicrocontroller(null)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                          title="Clear selection"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <div className="font-medium">{selectedMicrocontroller.name}</div>
                        <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                          Board: {getBoardForMicrocontroller(selectedMicrocontroller.name)}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-300">
                          Position: ({selectedMicrocontroller.position.x}, {selectedMicrocontroller.position.y})
                        </div>
                        {(() => {
                          const wokwiConfig = getWokwiBoardConfig(selectedMicrocontroller.name)
                          return (
                            <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                              <div className="text-xs text-blue-600 dark:text-blue-300">
                                <div>Wokwi Type: {wokwiConfig.type}</div>
                                <div>Voltage: {wokwiConfig.voltage}</div>
                                <div>Digital Pins: {wokwiConfig.pins}</div>
                                <div>Analog Pins: {wokwiConfig.analogPins}</div>
                                <div>
                                  PWM Pins: {wokwiConfig.pwmPins.slice(0, 5).join(', ')}
                                  {wokwiConfig.pwmPins.length > 5 ? '...' : ''}
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {!hideHeader && (
            <div className="flex shrink-0 border-b border-gray-200 dark:border-dark-border">
              <button
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'microcontrollers'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text-secondary'
                }`}
                onClick={() => setActiveTab('microcontrollers')}
              >
                Microcontrollers ({microcontrollers.length})
              </button>
              <button
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'wires'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text-secondary'
                }`}
                onClick={() => setActiveTab('wires')}
              >
                <div className="flex items-center justify-center gap-1">
                  <Zap className="w-4 h-4" />
                  Wires ({wires.length})
                </div>
              </button>
              <button
                className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'simulation'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text-secondary'
                }`}
                onClick={() => setActiveTab('simulation')}
              >
                <div className="flex items-center justify-center gap-1">
                  <Cpu className="w-4 h-4" />
                  Simulation
                </div>
              </button>
            </div>
            )}

            {/* Content */}
            <div
              className={
                stacked
                  ? `min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${hideHeader ? 'px-4 py-3' : ''}`
                  : 'max-h-96 overflow-y-auto'
              }
            >
              {(hideHeader || activeTab === 'microcontrollers') ? (
                <div className={hideHeader ? 'space-y-2' : 'p-3 space-y-2'}>
                  {microcontrollers.length === 0 ? (
                    <div
                      className={
                        hideHeader
                          ? 'py-10 text-center text-zinc-500'
                          : 'text-center py-8 text-gray-500 dark:text-dark-text-muted'
                      }
                    >
                      <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No microcontrollers placed</p>
                      <p className="text-xs">Add microcontrollers from the component palette</p>
                    </div>
                  ) : (
                    microcontrollers.map((microcontroller) => {
                      // Check if this specific microcontroller has power using electrical system results
                      const isMicrocontrollerPowered = (() => {
                        const prefix = `${microcontroller.id}-`
                        for (const [key, state] of componentStates) {
                          if (!key.startsWith(prefix)) continue
                          if (state.isPowered && state.outputVoltage > 0.1) return true
                        }
                        return false
                      })()
                      
                      return (
                        <div
                          key={microcontroller.id}
                          className={
                            hideHeader
                              ? 'rounded-lg border border-white/10 bg-zinc-800/40 p-3 transition-colors hover:border-white/20'
                              : 'p-3 border border-gray-200 dark:border-dark-border rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer'
                          }
                          onMouseEnter={() => onMicrocontrollerHighlight(microcontroller.id)}
                          onMouseLeave={() => onMicrocontrollerHighlight(null)}
                        >
                          <div className={`flex items-center justify-between ${hideHeader ? 'mb-2.5' : 'mb-2'}`}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4
                                  className={
                                    hideHeader
                                      ? 'truncate text-sm font-medium text-zinc-100'
                                      : 'font-medium text-gray-900 dark:text-dark-text-primary'
                                  }
                                >
                                  {microcontroller.name}
                                </h4>
                                <div
                                  className={`h-2 w-2 shrink-0 rounded-full ${
                                    isMicrocontrollerPowered ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                  title={isMicrocontrollerPowered ? 'Powered' : 'No power'}
                                />
                                {microcontrollerCode.has(microcontroller.id) && (
                                  <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Has code" />
                                )}
                                {simulationState.runningMicrocontrollers.has(microcontroller.id) && (
                                  <div
                                    className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500"
                                    title="Running"
                                  />
                                )}
                              </div>
                              {!hideHeader && (
                                <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                                  Position: ({microcontroller.position.x}, {microcontroller.position.y})
                                </p>
                              )}
                            </div>
                          </div>

                        {!hideHeader && linkableProjectPrograms.length > 0 && (
                          <div className="mb-2">
                            <label className="block text-[10px] font-medium text-gray-500 dark:text-dark-text-muted mb-1">
                              Project program
                            </label>
                            <select
                              value={linkedPrograms.get(microcontroller.id) ?? ''}
                              onChange={(e) => {
                                const program = linkableProjectPrograms.find((p) => p.id === e.target.value)
                                if (program) handleLinkProjectProgram(microcontroller.id, program)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-2 py-1 text-xs text-gray-700 dark:text-dark-text-primary outline-none focus:border-primary-500"
                            >
                              <option value="">Select program…</option>
                              {linkableProjectPrograms.map((program) => (
                                <option key={program.id} value={program.id}>
                                  {program.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            className={
                              hideHeader
                                ? 'flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary-600 px-2 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-500'
                                : 'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-primary-600/90 text-white rounded-md hover:bg-primary-500 transition-colors shadow-sm'
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedMicrocontroller(microcontroller)
                              setShowCodingModal(true)
                            }}
                          >
                            <Code className="w-3.5 h-3.5" />
                            {compiledCodes.has(microcontroller.id) ? 'Edit' : 'Program'}
                          </button>
                          {!hideHeader && (
                          <>
                          <button
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                            onClick={() => {
                              setExpandedMicrocontroller(
                                expandedMicrocontroller === microcontroller.id ? null : microcontroller.id
                              )
                            }}
                          >
                            <Cpu className="w-3 h-3" />
                            Pins
                          </button>
                          <button
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                              simulationState.runningMicrocontrollers.has(microcontroller.id)
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                                : getMicrocontrollerSketch(microcontroller.id)
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => {
                              if (simulationState.runningMicrocontrollers.has(microcontroller.id)) {
                                console.log(`Stop button clicked - halting all simulations`)
                                haltAllSimulations()
                              } else {
                                console.log(`Run button clicked for ${microcontroller.id} - Debug info:`, {
                                  hasSketch: Boolean(getMicrocontrollerSketch(microcontroller.id)),
                                  isRunning: simulationState.runningMicrocontrollers.has(microcontroller.id),
                                  selectedMicrocontroller: selectedMicrocontroller?.name
                                })
                                
                                const sketch = getMicrocontrollerSketch(microcontroller.id)
                                if (sketch) {
                                  const originalSelected = selectedMicrocontroller
                                  setSelectedMicrocontroller(microcontroller)
                                  setCode(sketch)
                                  const compiledCode = compiledCodes.get(microcontroller.id)
                                  if (compiledCode) {
                                    setCompilationResult(compiledCode.compilationResult)
                                  }
                                  
                                  startMultiMicrocontrollerGPIO(microcontroller.id, sketch)
                                  const dynamicStates = getAllMultiMicrocontrollerGPIOStates()
                                  const initialGpioStates = new Map<number, GPIOState>()
                                  const initialWireStates = new Map<string, 'active' | 'inactive'>()
                                  dynamicStates.forEach((state, pin) => {
                                    initialGpioStates.set(pin, {
                                      pin,
                                      state: state.state,
                                      value: state.value,
                                      timestamp: state.timestamp,
                                    })
                                    findWiresConnectedToPin(microcontroller, pin).forEach((wireId) => {
                                      initialWireStates.set(
                                        wireId,
                                        state.state === 'HIGH' || state.state === 'PULSING'
                                          ? 'active'
                                          : 'inactive'
                                      )
                                    })
                                  })
                                  setSimulationState(prev => ({
                                    ...prev,
                                    isRunning: true,
                                    runningMicrocontrollers: new Set([...prev.runningMicrocontrollers, microcontroller.id]),
                                    gpioStates: initialGpioStates.size > 0 ? initialGpioStates : prev.gpioStates,
                                    wireStates: initialWireStates.size > 0 ? initialWireStates : prev.wireStates,
                                  }))
                                  
                                  // Restore original selection
                                  setTimeout(() => {
                                    setSelectedMicrocontroller(originalSelected)
                                    if (originalSelected) {
                                      const originalCode = microcontrollerCode.get(originalSelected.id)
                                      if (originalCode) {
                                        setCode(originalCode)
                                      }
                                    }
                                  }, 100)
                                } else {
                                  alert('Load or write a program for this microcontroller first')
                                }
                              }
                            }}
                            disabled={!simulationState.runningMicrocontrollers.has(microcontroller.id) && !getMicrocontrollerSketch(microcontroller.id)}
                            title={
                              simulationState.runningMicrocontrollers.has(microcontroller.id) ? 'Stop this microcontroller' :
                              !getMicrocontrollerSketch(microcontroller.id) ? 'Load or write a program first' :
                              'Run program'
                            }
                          >
                            {simulationState.runningMicrocontrollers.has(microcontroller.id) ? (
                              <>
                                <X className="w-3 h-3" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                Run
                              </>
                            )}
                          </button>
                          </>
                          )}
                        </div>
                        
                        {/* Expanded Pins View */}
                        {!hideHeader && expandedMicrocontroller === microcontroller.id && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">
                                Pin Status
                              </h5>
                              <button
                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                onClick={() => setExpandedMicrocontroller(null)}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {microcontroller.definition.grid
                                .filter((pin: any) => pin.pin && (pin.type === 'GPIO' || pin.type === 'ANALOG' || pin.type === 'VCC' || pin.type === 'GND'))
                                .map((pin: any, index: number) => {
                                  // Get the actual cell index from the original grid
                                  const cellIndex = microcontroller.definition.grid.findIndex((gridPin: any) => gridPin === pin)
                                  // Get component state for this pin using the correct ID format
                                  const pinComponentId = `${microcontroller.id}-${cellIndex}`
                                  const pinState = componentStates.get(pinComponentId)
                                  
                                  // Debug: Log pin state for D13 specifically
                                  if (pin.pin === 'D13/SCK') {
                                    console.log(`🔧 DevicePanel: D13 pin state debug:`, {
                                      pinComponentId,
                                      pinState,
                                      cellIndex,
                                      allComponentStates: Array.from(componentStates.keys()).filter(id => id.includes(microcontroller.id))
                                    })
                                  }
                                  
                                  // Determine pin mode and status
                                  let pinMode = 'INPUT'
                                  let pinStatus = 'LOW'
                                  let pinVoltage = 0
                                  let pinCurrent = 0
                                  let pinPower = 0
                                  let gpioState: GpioDisplayState | undefined
                                  
                                  if (pinState) {
                                    pinVoltage = pinState.outputVoltage || 0
                                    pinCurrent = pinState.outputCurrent || 0
                                    pinPower = pinState.power || 0
                                    
                                    if (pin.type === 'VCC' || pin.type === 'GND') {
                                      pinMode = 'POWER'
                                      pinStatus = pinVoltage > 0 ? 'HIGH' : 'LOW'
                                    } else if (pin.type === 'GPIO' || pin.type === 'ANALOG') {
                                      const pinNumber = pin.pin?.startsWith('D') ? 
                                        parseInt(pin.pin.replace('D', '')) :
                                        pin.pin?.startsWith('A') ? 
                                        parseInt(pin.pin.replace('A', '')) + 100 :
                                        parseInt(pin.pin || '0')
                                      
                                      gpioState = simulationState.gpioStates.get(pinNumber) as GpioDisplayState | undefined
                                      if (gpioState) {
                                        if (gpioState.state === 'INPUT' || gpioState.state === 'OUTPUT') {
                                          pinMode = gpioState.state
                                          pinStatus = pinVoltage > 0 ? 'HIGH' : 'LOW'
                                        } else if (gpioState.state === 'PULSING') {
                                          pinMode = 'OUTPUT'
                                          pinStatus = formatPinStateLabel(gpioState)
                                        } else {
                                          pinMode = 'OUTPUT'
                                          pinStatus = gpioState.state
                                        }
                                      } else if (pinVoltage > 0) {
                                        pinMode = 'OUTPUT'
                                        pinStatus = 'HIGH'
                                      }
                                    }
                                  }
                                  
                                  const tone = pinStateTone(gpioState)
                                  
                                  return (
                                    <div
                                      key={index}
                                      className={`flex items-center justify-between p-2 rounded text-xs ${
                                        tone === 'high'
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                          : tone === 'pwm'
                                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                          tone === 'high'
                                            ? 'bg-green-500'
                                            : tone === 'pwm'
                                            ? 'bg-amber-500'
                                            : 'bg-gray-400'
                                        } ${tone !== 'low' && pinMode === 'OUTPUT' ? 'animate-pulse' : ''}`} />
                                        <span className="font-mono font-medium">{pin.pin}</span>
                                        <span className="text-gray-500 dark:text-gray-400">({pin.type})</span>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-mono">
                                          {formatVoltage(pinVoltage)} {formatCurrent(pinCurrent)} {formatPower(pinPower)}
                                        </div>
                                        <div className="text-gray-500 dark:text-gray-400">
                                          {pinMode} {pinStatus}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                      )
                    })
                  )}
                </div>
              ) : !hideHeader && activeTab === 'wires' ? (
                <div className="p-3 space-y-2">
                  {wires.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                      <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No wires placed</p>
                      <p className="text-xs">Connect components with wires</p>
                    </div>
                  ) : (
                    wires.map((wire) => {
                      const isOverCurrent = wire.current > wire.maxCurrent
                      const isOverPower = wire.power > wire.maxPower
                      const isSelected = selectedWire === wire.id
                      
                      return (
                        <div
                          key={wire.id}
                          className={`p-2 border-2 rounded cursor-pointer transition-all relative ${
                            isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-dark-border hover:border-gray-300'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedWire(selectedWire === wire.id ? null : wire.id)
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-4 h-4 rounded cursor-pointer hover:scale-125 transition-transform border-2 ${
                                  editingWireColor === wire.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: resolveWireStrokeColor(wire, wireColorMode) }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  setEditingWireColor(editingWireColor === wire.id ? null : wire.id)
                                }}
                              />
                              <div>
                                <div className="text-sm font-medium">Wire {wire.id.slice(-4)}</div>
                                <div className="text-xs text-gray-500">{wire.gauge} AWG</div>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <div className={isOverCurrent ? 'text-red-600 font-bold' : ''}>
                                {formatCurrent(wire.current)} / {formatCurrent(wire.maxCurrent)}
                              </div>
                              <div className={isOverPower ? 'text-red-600 font-bold' : ''}>
                                {formatPower(wire.power)} / {formatPower(wire.maxPower)}
                              </div>
                              <div>{formatVoltage(wire.voltage)}</div>
                              {wire.pwm !== undefined && (
                                <div className="text-purple-600 font-medium">
                                  PWM: {wire.pwm.toFixed(1)}%
                                </div>
                              )}
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
                              <div className="grid grid-cols-4 gap-1 mb-3">
                                {WIRE_COLORS.map((def) => (
                                  <div
                                    key={def.id}
                                    className="w-6 h-6 rounded cursor-pointer border-2 border-gray-300 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: getWireColorHex(def.id, wireColorMode) }}
                                    title={def.name}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      updateWireColor(wire.id, def.id)
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
                                          updateWireColorHex(wire.id, hexValue)
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
                                        updateWireColorHex(wire.id, hexValue)
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
                    })
                  )}
                </div>
              ) : !hideHeader && activeTab === 'simulation' ? (
                <div className="p-3 space-y-2">
                  {!simulationState.isRunning ? (
                    <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                      <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No simulation running</p>
                      <p className="text-xs">Start a simulation to see outputs</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-dark-text-primary">
                          Simulation Status
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-600 dark:text-green-400">Running</span>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                          GPIO Pin States
                        </h5>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {/* Digital Pins D0-D13 */}
                          {Array.from({length: 14}, (_, i) => i).map(pin => {
                            const state = simulationState.gpioStates.get(pin) as GpioDisplayState | undefined
                            const tone = pinStateTone(state)
                            return (
                              <div
                                key={`D${pin}`}
                                className={`flex items-center justify-between p-1 rounded ${
                                  tone === 'high'
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : tone === 'pwm'
                                    ? 'bg-amber-100 dark:bg-amber-900/30'
                                    : 'bg-gray-50 dark:bg-gray-800'
                                }`}
                              >
                                <span className="text-gray-600 dark:text-dark-text-muted">D{pin}:</span>
                                <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                  tone === 'high'
                                    ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                                    : tone === 'pwm'
                                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                  {formatPinStateLabel(state)}
                                </span>
                              </div>
                            )
                          })}
                          
                          {/* Analog Pins A0-A5 */}
                          {Array.from({length: 6}, (_, i) => i).map(pin => {
                            const state = simulationState.gpioStates.get(pin + 100) as GpioDisplayState | undefined
                            const tone = pinStateTone(state)
                            return (
                              <div
                                key={`A${pin}`}
                                className={`flex items-center justify-between p-1 rounded ${
                                  tone === 'high'
                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                    : tone === 'pwm'
                                    ? 'bg-amber-100 dark:bg-amber-900/30'
                                    : 'bg-gray-50 dark:bg-gray-800'
                                }`}
                              >
                                <span className="text-gray-600 dark:text-dark-text-muted">A{pin}:</span>
                                <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                  tone === 'high'
                                    ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                    : tone === 'pwm'
                                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                  {formatPinStateLabel(state)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        
                        {/* Legend */}
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-dark-border">
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-dark-text-muted">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-200 rounded"></div>
                              <span>Digital HIGH</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-blue-200 rounded"></div>
                              <span>Analog HIGH</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-amber-300 rounded"></div>
                              <span>PWM</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-gray-200 rounded"></div>
                              <span>LOW</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {simulationState.wireStates && simulationState.wireStates.size > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                            Wire States
                          </h5>
                          <div className="space-y-1">
                            {Array.from(simulationState.wireStates.entries()).map(([wireId, state]) => (
                              <div
                                key={wireId}
                                className="flex items-center justify-between p-2 rounded text-sm bg-gray-50 dark:bg-gray-800"
                              >
                                <span className="text-gray-600 dark:text-dark-text-muted">Wire {wireId}:</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  state === 'active' 
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {state}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-2 border-t border-gray-200 dark:border-dark-border">
                        <button
                          onClick={stopSimulation}
                          className="w-full px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          Stop Simulation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {showCodingModal && selectedMicrocontroller && (
        <McuProgramModal
          microcontrollerName={selectedMicrocontroller.name}
          position={selectedMicrocontroller.position}
          boardLabel={getBoardLabel(selectedMicrocontroller.name)}
          code={code}
          onCodeChange={(next) => {
            setCode(next)
            setSaveStatus('unsaved')
            setMicrocontrollerCode((prev) =>
              new Map(prev.set(selectedMicrocontroller.id, next))
            )
          }}
          onClose={() => setShowCodingModal(false)}
          isCompiling={isCompiling}
          isCompiled={isCompiled}
          compileErrors={compilationErrors}
          firmwareSize={compilationResult?.size}
          onCompile={handleCompile}
          onRunSimulation={runSchematicSimulation}
          onStopSimulation={haltAllSimulations}
          isSimulationRunning={simulationState.runningMicrocontrollers.has(
            selectedMicrocontroller.id
          )}
          canCompile={systemStatus?.arduinoCliAvailable ?? false}
          saveStatusText={getSaveStatusText()}
          projectPrograms={projectPrograms}
          linkedProgramId={linkedPrograms.get(selectedMicrocontroller.id)}
          onLinkProgram={(program) => {
            handleLinkProjectProgram(selectedMicrocontroller.id, program)
            setCode(program.code)
          }}
          onSave={handleSave}
        />
      )}


    </>
  )
}
