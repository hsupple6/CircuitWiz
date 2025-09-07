import React, { useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight, Code, Play, Save, Check, AlertCircle, Cpu, Zap, FolderOpen, FileText, X, Plus, Download, Upload, Settings, Bug, ExternalLink } from 'lucide-react'
import { GridCell, WireConnection } from '../modules/types'
import { ArduinoCompilerReal, CompilationResult, CompilationError, ArduinoProject, ArduinoFile, SystemStatus } from '../services/ArduinoCompilerReal'
import { FileManagerBrowser, FileNode, ProjectTemplate } from '../services/FileManagerBrowser'
import { ESP32Flasher, FlashProgress, FlashResult, ESP32Device } from '../services/ESP32Flasher'
import { QEMUEmulatorReal, EmulationResult, GPIOState } from '../services/QEMUEmulatorReal'

interface Microcontroller {
  id: string
  name: string
  position: { x: number; y: number }
  definition: any
  isHighlighted: boolean
}

interface DevicePanelProps {
  gridData: GridCell[][]
  wires: WireConnection[]
  onMicrocontrollerHighlight: (id: string | null) => void
  onMicrocontrollerClick: (microcontroller: Microcontroller) => void
  onModalStateChange?: (isOpen: boolean) => void
}

export function DevicePanel({ gridData, wires, onMicrocontrollerHighlight, onMicrocontrollerClick, onModalStateChange }: DevicePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'microcontrollers' | 'wires'>('microcontrollers')
  const [showCodingModal, setShowCodingModal] = useState(false)
  const [selectedMicrocontroller, setSelectedMicrocontroller] = useState<Microcontroller | null>(null)
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

  // Find all microcontrollers in the grid
  const findMicrocontrollers = useCallback((): Microcontroller[] => {
    const microcontrollers: Microcontroller[] = []
    
    gridData.forEach((row, y) => {
      if (!row) return
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
      } catch (error) {
        console.error('Failed to initialize services:', error)
      }
    }
    
    initializeServices()
  }, [compiler, fileManager])

  // Auto-save functionality
  useEffect(() => {
    if (showCodingModal && code && currentProject) {
      const interval = setInterval(async () => {
        setSaveStatus('saving')
        try {
          await saveCurrentProject()
          setSaveStatus('saved')
          setLastSaved(new Date())
        } catch (error) {
          setSaveStatus('unsaved')
          console.error('Auto-save failed:', error)
        }
      }, 10000) // Auto-save every 10 seconds

      return () => clearInterval(interval)
    }
  }, [showCodingModal, code, currentProject])

  // Notify parent component when modal state changes
  React.useEffect(() => {
    onModalStateChange?.(showCodingModal)
  }, [showCodingModal, onModalStateChange])

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
      setSaveStatus('saved')
      setLastSaved(new Date())
    } catch (error) {
      setSaveStatus('unsaved')
      console.error('Save failed:', error)
    }
  }

  const handleRun = async () => {
    if (isCompiled && compilationResult?.firmware) {
      try {
        await handleFlashFirmware()
      } catch (error) {
        console.error('Failed to flash firmware:', error)
      }
    }
  }

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

  const getBoardForMicrocontroller = (microcontrollerName: string): string => {
    switch (microcontrollerName.toLowerCase()) {
      case 'arduino uno':
        return 'arduino:avr:uno'
      case 'esp32':
        return 'esp32:esp32:esp32'
      default:
        return 'esp32:esp32:esp32' // Default to ESP32 for better ARM64 compatibility
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

  return (
    <>
      {/* Main Panel */}
      <div className="absolute top-4 left-4 bg-white dark:bg-dark-surface rounded-lg shadow-lg border border-gray-200 dark:border-dark-border z-50 min-w-[300px] max-w-[400px]">
        {/* Header */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-card transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-gray-900 dark:text-dark-text-primary">Device Panel</span>
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-dark-border">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-dark-border">
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'microcontrollers'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text-secondary'
                }`}
                onClick={() => setActiveTab('microcontrollers')}
              >
                Microcontrollers ({microcontrollers.length})
              </button>
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
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
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'microcontrollers' ? (
                <div className="p-3 space-y-2">
                  {microcontrollers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                      <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No microcontrollers placed</p>
                      <p className="text-xs">Add microcontrollers from the component palette</p>
                    </div>
                  ) : (
                    microcontrollers.map((microcontroller) => (
                      <div
                        key={microcontroller.id}
                        className="p-3 border border-gray-200 dark:border-dark-border rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                        onMouseEnter={() => onMicrocontrollerHighlight(microcontroller.id)}
                        onMouseLeave={() => onMicrocontrollerHighlight(null)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-dark-text-primary">
                              {microcontroller.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                              Position: ({microcontroller.position.x}, {microcontroller.position.y})
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            onClick={() => {
                              setSelectedMicrocontroller(microcontroller)
                              setShowCodingModal(true)
                            }}
                          >
                            <Code className="w-3 h-3" />
                            Program
                          </button>
                          <button
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                              isCompiled
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={handleRun}
                            disabled={!isCompiled}
                          >
                            <Play className="w-3 h-3" />
                            Run
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
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
                      
                      return (
                        <div
                          key={wire.id}
                          className="p-2 border border-gray-200 dark:border-dark-border rounded"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: wire.color }}
                              />
                              <div>
                                <div className="text-sm font-medium">Wire {wire.id.slice(-4)}</div>
                                <div className="text-xs text-gray-500">{wire.gauge} AWG</div>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <div className={isOverCurrent ? 'text-red-600 font-bold' : ''}>
                                {wire.current.toFixed(3)}A / {wire.maxCurrent}A
                              </div>
                              <div className={isOverPower ? 'text-red-600 font-bold' : ''}>
                                {wire.power.toFixed(3)}W / {wire.maxPower}W
                              </div>
                              <div>{wire.voltage.toFixed(3)}V</div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Coding Modal */}
      {showCodingModal && selectedMicrocontroller && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"
          onMouseDown={(e) => {
            e.stopPropagation()
            // Close modal if clicking on backdrop
            if (e.target === e.currentTarget) {
              setShowCodingModal(false)
            }
          }}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => {
            e.stopPropagation()
            // Close modal if touching backdrop
            if (e.target === e.currentTarget) {
              setShowCodingModal(false)
            }
          }}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-7xl h-[80vh] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
                    Program {selectedMicrocontroller.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-muted">
                    Position: ({selectedMicrocontroller.position.x}, {selectedMicrocontroller.position.y})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCodingModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-card">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCompile}
                  disabled={isCompiling || !systemStatus?.arduinoCliAvailable}
                  className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
                    isCompiling || !systemStatus?.arduinoCliAvailable
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  {isCompiling ? 'Compiling...' : 'Compile'}
                </button>
                <button
                  onClick={handleRun}
                  disabled={!isCompiled || isFlashing}
                  className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
                    isCompiled && !isFlashing
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {isFlashing ? 'Flashing...' : 'Flash'}
                </button>
                {isCompiled && compilationResult?.firmware && (
                  <button
                    onClick={handleDownloadFirmware}
                    className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
                {isCompiled && compilationResult?.firmware && (
                  <button
                    onClick={handleEmulate}
                    disabled={isEmulating}
                    className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
                      isEmulating
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    {isEmulating ? 'Emulating...' : 'Emulate'}
                  </button>
                )}
                <button
                  onClick={() => setShowFileManager(!showFileManager)}
                  className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  Files
                </button>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-2 px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-muted">
                  {getSaveStatusIcon()}
                  <span>{getSaveStatusText()}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                    systemStatus?.arduinoCliAvailable ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-500">
                    {systemStatus?.arduinoCliAvailable ? 'Arduino CLI' : 'No CLI'}
                  </span>
                </div>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>

            {/* File Manager Panel */}
            {showFileManager && (
              <div className="border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-card">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">Project Files</h4>
                  <div className="space-y-1">
                    {currentProject?.files.map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedFile === file.name
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          setSelectedFile(file.name)
                          if (file.isMain) {
                            setCode(file.content)
                          }
                        }}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">{file.name}</span>
                        {file.isMain && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1 rounded">
                            Main
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Templates Panel */}
            {showTemplates && (
              <div className="border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-card">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">Project Templates</h4>
                  <div className="space-y-1">
                    {templates.map((template, index) => (
                      <div
                        key={index}
                        className="p-2 border border-gray-200 dark:border-dark-border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => {
                          createNewProject(template)
                          setShowTemplates(false)
                        }}
                      >
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs text-gray-500 dark:text-dark-text-muted">{template.description}</div>
                      </div>
                    ))}
                    <div
                      className="p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        createNewProject()
                        setShowTemplates(false)
                      }}
                    >
                      <div className="font-medium text-sm">Empty Project</div>
                      <div className="text-xs text-gray-500 dark:text-dark-text-muted">Start with a blank sketch</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compilation Errors */}
            {compilationErrors.length > 0 && (
              <div className="border-b border-gray-200 dark:border-dark-border bg-red-50 dark:bg-red-900/20">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Compilation Errors</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {compilationErrors.map((error, index) => (
                      <div key={index} className="text-xs text-red-700 dark:text-red-300">
                        <span className="font-medium">{error.file}:{error.line}:{error.column}</span>
                        <span className="ml-2">{error.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Compilation Success */}
            {isCompiled && compilationResult && (
              <div className="border-b border-gray-200 dark:border-dark-border bg-green-50 dark:bg-green-900/20">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Compilation Successful</h4>
                  {compilationResult.size && (
                    <div className="text-xs text-green-700 dark:text-green-300">
                      Firmware size: {compilationResult.size} bytes
                    </div>
                  )}
                  {compilationResult.filename && (
                    <div className="text-xs text-green-700 dark:text-green-300">
                      File: {compilationResult.filename}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Flash Progress */}
            {isFlashing && flashProgress && (
              <div className="border-b border-gray-200 dark:border-dark-border bg-blue-50 dark:bg-blue-900/20">
                <div className="p-3">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                    Flashing Firmware
                  </h4>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                    {flashProgress.message}
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${flashProgress.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {flashProgress.progress}%
                  </div>
                </div>
              </div>
            )}

          {/* Main Content Area */}
          <div className="flex-1 flex">
            {/* Code Editor */}
            <div 
              className={`${
                showErrorPanel || showEmulationPanel ? 'w-1/2' : 'w-full'
              } p-4 transition-all duration-300`}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
                <textarea
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setSaveStatus('unsaved')
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseMove={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="w-full h-full p-4 bg-gray-50 dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="// Your Arduino code here..."
                  spellCheck={false}
                />
              </div>

              {/* Error Panel */}
              {showErrorPanel && (
                <div className="w-1/2 border-l border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-card relative">
                  {/* Resize Handle */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-600 cursor-ns-resize hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                    onMouseDown={handleErrorPanelResize}
                  />
                  <div className="h-full flex flex-col" style={{ height: `${errorPanelHeight}px` }}>
                    {/* Error Panel Header */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-dark-border bg-red-50 dark:bg-red-900/20 mt-1">
                      <div className="flex items-center gap-2">
                        <Bug className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h3 className="font-semibold text-red-800 dark:text-red-300">
                          Compilation Errors
                        </h3>
                        <span className="bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-full text-xs font-medium">
                          {compilationErrors.length} error{compilationErrors.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowErrorPanel(false)}
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Error List */}
                    <div className="flex-1 overflow-y-auto p-3">
                      {compilationErrors.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                          <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                          <p>No compilation errors</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {compilationErrors.map((error, index) => (
                            <div
                              key={index}
                              className="bg-white dark:bg-dark-surface border border-red-200 dark:border-red-800 rounded-lg p-3 shadow-sm"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                  error.severity === 'error' ? 'bg-red-500' : 
                                  error.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-dark-text-primary">
                                      {error.file}
                                    </span>
                                    {error.line > 0 && (
                                      <>
                                        <span className="text-gray-400">:</span>
                                        <span className="font-mono text-sm text-gray-600 dark:text-dark-text-secondary">
                                          {error.line}
                                        </span>
                                        {error.column > 0 && (
                                          <>
                                            <span className="text-gray-400">:</span>
                                            <span className="font-mono text-sm text-gray-600 dark:text-dark-text-secondary">
                                              {error.column}
                                            </span>
                                          </>
                                        )}
                                      </>
                                    )}
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      error.severity === 'error' 
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                        : error.severity === 'warning'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                    }`}>
                                      {error.severity}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 dark:text-dark-text-secondary leading-relaxed">
                                    {error.message}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Error Panel Footer */}
                    <div className="border-t border-gray-200 dark:border-dark-border p-3 bg-gray-50 dark:bg-dark-card">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                          Click on error to jump to line
                        </div>
                        <button
                          onClick={() => setShowErrorPanel(false)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                        >
                          Hide Panel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Emulation Panel */}
              {showEmulationPanel && (
                <div className="w-1/2 border-l border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-card relative">
                  {/* Resize Handle */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-600 cursor-ns-resize hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                    onMouseDown={handleErrorPanelResize}
                  />
                  <div className="h-full flex flex-col" style={{ height: `${errorPanelHeight}px` }}>
                    {/* Emulation Panel Header */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-dark-border bg-green-50 dark:bg-green-900/20 mt-1">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <h3 className="font-semibold text-green-800 dark:text-green-300">
                          Emulation Results
                        </h3>
                        {emulationResult?.isSimulation && (
                          <span className="bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full text-xs font-medium">
                            Simulation
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowEmulationPanel(false)}
                        className="text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Emulation Content */}
                    <div className="flex-1 overflow-y-auto p-3">
                      {!emulationResult ? (
                        <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                          <Cpu className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>No emulation results</p>
                        </div>
                      ) : !emulationResult.success ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            <h4 className="font-semibold text-red-800 dark:text-red-300">Emulation Failed</h4>
                          </div>
                          <p className="text-red-700 dark:text-red-300 text-sm">
                            {emulationResult.error}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Summary */}
                          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-3">
                            <h4 className="font-semibold text-gray-900 dark:text-dark-text-primary mb-2">Summary</h4>
                            <div className="text-sm text-gray-600 dark:text-dark-text-muted space-y-1">
                              <div>Execution time: {(emulationResult.executionTime / 1000).toFixed(2)}s</div>
                              <div>GPIO changes: {emulationResult.gpioStates.length}</div>
                              {emulationResult.isSimulation && (
                                <div className="text-yellow-600 dark:text-yellow-400">
                                  ⚠️ This was a simulation
                                </div>
                              )}
                            </div>
                          </div>

                          {/* GPIO States */}
                          {emulationResult.gpioStates.length > 0 && (
                            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-3">
                              <h4 className="font-semibold text-gray-900 dark:text-dark-text-primary mb-2">GPIO Activity</h4>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {emulationResult.gpioStates.map((state, index) => (
                                  <div
                                    key={index}
                                    className={`flex items-center justify-between p-2 rounded text-sm ${
                                      state.state === 'HIGH'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                    }`}
                                  >
                                    <div className="flex flex-col">
                                      <span>Pin {state.pin}</span>
                                      {state.register && (
                                        <span className="text-xs opacity-75">{state.register}</span>
                                      )}
                                    </div>
                                    <span className="font-mono">{state.state}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Registers */}
                          {emulationResult.registers && Object.keys(emulationResult.registers).length > 0 && (
                            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-3">
                              <h4 className="font-semibold text-gray-900 dark:text-dark-text-primary mb-2">Registers</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                                {Object.entries(emulationResult.registers).map(([reg, value]) => (
                                  <div key={reg} className="flex justify-between">
                                    <span className="text-gray-600 dark:text-dark-text-muted">{reg}:</span>
                                    <span className="text-gray-900 dark:text-dark-text-primary">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Output */}
                          {emulationResult.output && (
                            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-3">
                              <h4 className="font-semibold text-gray-900 dark:text-dark-text-primary mb-2">Output</h4>
                              <pre className="text-xs text-gray-600 dark:text-dark-text-muted whitespace-pre-wrap">
                                {emulationResult.output}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Emulation Panel Footer */}
                    <div className="border-t border-gray-200 dark:border-dark-border p-3 bg-gray-50 dark:bg-dark-card">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                          {emulationResult?.isSimulation ? 'Simulated emulation' : 'QEMU emulation'}
                        </div>
                        <button
                          onClick={() => setShowEmulationPanel(false)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                        >
                          Hide Panel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
