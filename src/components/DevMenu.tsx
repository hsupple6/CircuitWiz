import React, { useState, useEffect } from 'react'
import { Bug, X, Zap, CircuitBoard, Activity, Copy, Check, Code, Eye, Play, Network, Settings, Clock } from 'lucide-react'
import { ComponentState } from '../systems/ElectricalSystem'
import { extractOccupiedComponents } from '../utils/gridUtils'
import { findCircuitPathways } from '../services/EMPhysics'
import { logger, LoggingConfig } from '../services/Logger'

interface LogEntry {
  id?: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  category: string
  message: string
  data?: any
}

interface CircuitPathway {
  id: string
  components: string[]
  voltage: number
  current: number
  resistance: number
}

interface DevMenuProps {
  isOpen: boolean
  onClose: () => void
  componentStates: Map<string, ComponentState>
  circuitPathways?: CircuitPathway[]
  logs: LogEntry[]
  wires?: any[]
  circuitInfo?: any
  gridData?: any[][]
}

export function DevMenu({ isOpen, onClose, componentStates, circuitPathways = [], logs, wires = [], circuitInfo, gridData }: DevMenuProps) {
  const [activeTab, setActiveTab] = useState<'pathways' | 'logs' | 'components' | 'debug' | 'json' | 'analysis' | 'griddata' | 'circuitanalysis' | 'circuitoverview' | 'logging'>('pathways')
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>(logs)
  const [copied, setCopied] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<{
    pathways: any[];
    errors: string[];
    warnings: string[];
  }>({ pathways: [], errors: [], warnings: [] })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentRow, setCurrentRow] = useState(0)
  const [columnsToShow, setColumnsToShow] = useState(50)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [loggingConfig, setLoggingConfig] = useState<LoggingConfig>(logger.getConfig())
  const [isCapturingSnippet, setIsCapturingSnippet] = useState(false)
  const [snippetLogs, setSnippetLogs] = useState<any[]>([])
  const [circuitAnalysisData, setCircuitAnalysisData] = useState<{
    nodes: Array<{
      id: string
      type: string
      position: { x: number; y: number }
      inputVoltage: number
      outputVoltage: number
      current: number
      calculation: string
      properties: any
    }>
    pathways: any[]
  }>({ nodes: [], pathways: [] })

  useEffect(() => {
    setFilteredLogs(logs)
  }, [logs])

  // Logging control functions
  const updateLoggingConfig = (updates: Partial<LoggingConfig>) => {
    const newConfig = { ...loggingConfig, ...updates }
    setLoggingConfig(newConfig)
    logger.updateConfig(newConfig)
  }

  const toggleAllLogs = (enabled: boolean) => {
    const newConfig = {
      ...loggingConfig,
      enabled, // This is just for UI convenience
      categories: {
        electrical: enabled,
        components: enabled,
        wires: enabled,
        physics: enabled,
        circuit: enabled,
        grid: enabled,
        debug: enabled,
        performance: enabled
      }
    }
    setLoggingConfig(newConfig)
    logger.updateConfig(newConfig)
  }

  const startSnippetCapture = () => {
    setIsCapturingSnippet(true)
    setSnippetLogs([])
    logger.updateConfig({ captureSnippet: true })
    
    // Stop capture after duration
    setTimeout(() => {
      const capturedLogs = logger.stopSnippetCapture()
      setSnippetLogs(capturedLogs)
      setIsCapturingSnippet(false)
      logger.updateConfig({ captureSnippet: false })
    }, loggingConfig.snippetDuration)
  }

  const clearLogs = () => {
    logger.clearLogs()
    setSnippetLogs([])
  }

  // Generate circuit analysis data
  const generateCircuitAnalysis = () => {
    const nodes: any[] = []
    const pathways = circuitPathways || []
    
    // Group component states by base component ID (without cell index)
    const componentGroups = new Map<string, ComponentState[]>()
    
    componentStates.forEach((state, componentId) => {
      // Extract base component ID (e.g., "Resistor-444312" from "Resistor-444312-0")
      const baseId = componentId.replace(/-\d+$/, '')
      if (!componentGroups.has(baseId)) {
        componentGroups.set(baseId, [])
      }
      componentGroups.get(baseId)!.push(state)
    })
    
    // Process each component group
    componentGroups.forEach((states, baseId) => {
      // Sort states by cell index to get proper order
      const sortedStates = states.sort((a, b) => {
        const aIndex = parseInt(a.componentId.split('-').pop() || '0')
        const bIndex = parseInt(b.componentId.split('-').pop() || '0')
        return aIndex - bIndex
      })
      
      const firstState = sortedStates[0]
      const lastState = sortedStates[sortedStates.length - 1]
      
      // Create packaged component node
      const node = {
        id: baseId,
        type: firstState.componentType,
        position: firstState.position,
        inputVoltage: 0,
        outputVoltage: 0,
        current: firstState.outputCurrent,
        calculation: '',
        properties: {},
        cellCount: sortedStates.length,
        cells: sortedStates.map(state => ({
          id: state.componentId,
          position: state.position,
          voltage: state.outputVoltage,
          cellIndex: parseInt(state.componentId.split('-').pop() || '0')
        }))
      }
      
      // Calculate input voltage from first cell, output voltage from last cell
      node.inputVoltage = firstState.outputVoltage
      node.outputVoltage = lastState.outputVoltage
      
      // Generate calculation string based on component type
      if (firstState.componentType === 'PowerSupply') {
        // For PowerSupply, show voltage from VCC to GND
        const vccCell = sortedStates.find(s => s.componentId.includes('-0'))
        const gndCell = sortedStates.find(s => s.componentId.includes('-1'))
        if (vccCell && gndCell) {
          node.calculation = `VCC: ${vccCell.outputVoltage}V → GND: ${gndCell.outputVoltage}V (Power Source)`
          node.inputVoltage = vccCell.outputVoltage
          node.outputVoltage = gndCell.outputVoltage
        } else {
          node.calculation = `OV = ${node.outputVoltage}V (Power Source)`
        }
      } else if (firstState.componentType === 'Resistor') {
        // For Resistor, show voltage drop calculation
        const cell = gridData?.[firstState.position.y]?.[firstState.position.x]
        const resistance = cell?.resistance || 1000
        const voltageDrop = node.inputVoltage - node.outputVoltage
        node.calculation = `OV = ${node.inputVoltage.toFixed(2)}V - (${node.current.toFixed(4)}A × ${resistance}Ω) = ${node.outputVoltage.toFixed(2)}V`
        node.properties = { resistance, voltageDrop }
      } else if (firstState.componentType === 'LED') {
        // For LED, show forward voltage drop
        const cell = gridData?.[firstState.position.y]?.[firstState.position.x]
        const forwardVoltage = cell?.moduleDefinition?.properties?.forwardVoltage?.default || 2.0
        const voltageDrop = node.inputVoltage - node.outputVoltage
        node.calculation = `OV = ${node.inputVoltage.toFixed(2)}V - ${forwardVoltage}V (Forward Voltage) = ${node.outputVoltage.toFixed(2)}V`
        node.properties = { forwardVoltage, voltageDrop }
      } else {
        node.calculation = `OV = ${node.outputVoltage.toFixed(2)}V (Unknown Component)`
      }
      
      nodes.push(node)
    })
    
    setCircuitAnalysisData({ nodes, pathways })
  }

  useEffect(() => {
    if (activeTab === 'circuitanalysis') {
      generateCircuitAnalysis()
    }
  }, [activeTab, componentStates, circuitPathways, gridData])

  const runCircuitAnalysis = async () => {
    if (!gridData || gridData.length === 0) {
      console.log('❌ No grid data available for analysis')
      setAnalysisResults({ 
        pathways: [], 
        errors: ['No grid data available - please ensure a project is loaded'], 
        warnings: [] 
      })
      return
    }

    if (!wires || wires.length === 0) {
      console.log('⚠️ No wires found - analyzing components only')
    }

    setIsAnalyzing(true)
    console.log('🔍 Running circuit pathway analysis...')
    console.log(`📊 Grid data: ${gridData.length} rows, ${gridData[0]?.length || 0} columns`)
    console.log(`📊 Wires: ${wires?.length || 0}`)
    
    try {
      // Extract occupied components
      const occupiedComponents = extractOccupiedComponents(gridData)
      console.log(`📊 Analyzing ${occupiedComponents.length} components and ${wires?.length || 0} wires`)
      
      // Run the circuit pathway analysis
      const result = findCircuitPathways(occupiedComponents, wires)
      
      console.log(`✅ Analysis complete: Found ${result.pathways.length} circuit pathways, ${result.errors.length} errors, ${result.warnings.length} warnings`)
      setAnalysisResults(result)
      
      // Log detailed results
      result.pathways.forEach((pathway, index) => {
        console.log(`🔗 Circuit ${index + 1}:`, pathway.map(node => `${node.type}(${node.id})`).join(' → '))
      })
      
      // Log errors and warnings
      result.errors.forEach(error => console.error(error))
      result.warnings.forEach(warning => console.warn(warning))
      
    } catch (error) {
      console.error('❌ Circuit analysis failed:', error)
      setAnalysisResults({ pathways: [], errors: [`Analysis failed: ${error}`], warnings: [] })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateDebugSuite = () => {
    const timestamp = new Date().toLocaleString()
    
    let debugText = `🔍 === CIRCUIT DEBUG SUITE ===\n`
    debugText += `📅 Generated: ${timestamp}\n\n`
    
    // Add console logs to debug suite
    debugText += `📋 CONSOLE LOGS (Recent):\n`
    debugText += `   Check browser console for detailed logs:\n`
    debugText += `   - 🔍 Starting convertGridToNodes\n`
    debugText += `   - 🔍 Found occupied cell\n`
    debugText += `   - 🔍 Processing PowerSupply cell\n`
    debugText += `   - 🔋 Found VoltageSource/GroundingSource\n`
    debugText += `   - ⚡ Current calculation\n`
    debugText += `   - 🔌 Wire connected to components\n`
    debugText += `\n`
    
    // Add grid analysis section
    debugText += `🔍 GRID ANALYSIS:\n`
    debugText += `   Expected: 4 nodes (VoltageSource, Resistor, LED, GroundingSource)\n`
    debugText += `   Actual: ${componentStates.size} nodes\n`
    debugText += `   Missing: ${4 - componentStates.size} nodes\n`
    debugText += `   \n`
    debugText += `   Component Types Found:\n`
    const componentTypes = Array.from(componentStates.values()).map(state => state.componentType)
    const uniqueTypes = [...new Set(componentTypes)]
    uniqueTypes.forEach(type => {
      const count = componentTypes.filter(t => t === type).length
      debugText += `   - ${type}: ${count}\n`
    })
    debugText += `   \n`
    debugText += `   Expected Types: VoltageSource, Resistor, LED, GroundingSource\n`
    debugText += `   Missing Types: ${['VoltageSource', 'Resistor', 'LED', 'GroundingSource'].filter(type => !uniqueTypes.includes(type)).join(', ')}\n`
    debugText += `\n`
    
    // Circuit Analysis
    if (circuitInfo) {
      debugText += `⚡ CIRCUIT ANALYSIS:\n`
      debugText += `   Total Voltage: ${circuitInfo.totalVoltage || 0}V\n`
      debugText += `   Total Current: ${circuitInfo.totalCurrent || 0}A (${((circuitInfo.totalCurrent || 0) * 1000).toFixed(2)}mA)\n`
      debugText += `   Total Resistance: ${circuitInfo.totalResistance || 0}Ω\n`
      debugText += `   Total Power: ${circuitInfo.totalPower || 0}W\n`
      debugText += `   Pathways: ${Array.isArray(circuitInfo.pathways) ? circuitInfo.pathways.length : 0}\n`
      if (circuitInfo.errors && circuitInfo.errors.length > 0) {
        debugText += `   Errors: ${circuitInfo.errors.join(', ')}\n`
      }
      debugText += `\n`
    }
    
    // Node Creation Summary
    debugText += `📊 NODE CREATION SUMMARY:\n`
    debugText += `   Total Nodes: ${componentStates.size}\n`
    debugText += `   Node Details:\n`
    Array.from(componentStates.entries()).forEach(([id, state], index) => {
      debugText += `   ${index + 1}. ${state.componentType} (${id}) at (${state.position.x}, ${state.position.y})\n`
      if (state.componentType === 'PowerSupply' || state.componentType === 'Battery') {
        debugText += `      Voltage: ${state.outputVoltage}V\n`
      }
      if (state.componentType === 'Resistor') {
        debugText += `      Resistance: ${state.voltageDrop ? (state.voltageDrop / state.outputCurrent) : 'Unknown'}Ω\n`
      }
      if (state.componentType === 'LED') {
        debugText += `      Forward Voltage: ${state.forwardVoltage || 2.0}V\n`
      }
    })
    debugText += `\n`
    
    // Component States
    debugText += `🔧 COMPONENT STATE CALCULATIONS:\n`
    Array.from(componentStates.entries()).forEach(([id, state]) => {
      debugText += `   ${state.componentType} (${id}):\n`
      debugText += `      Output Voltage: ${state.outputVoltage}V\n`
      debugText += `      Output Current: ${state.outputCurrent}A\n`
      debugText += `      Power: ${state.power}W\n`
      debugText += `      Status: ${state.status}\n`
      debugText += `      Powered: ${state.isPowered}\n`
      debugText += `      Grounded: ${state.isGrounded}\n`
      if (state.voltageDrop !== undefined) debugText += `      Voltage Drop: ${state.voltageDrop}V\n`
      if (state.forwardVoltage !== undefined) debugText += `      Forward Voltage: ${state.forwardVoltage}V\n`
      if (state.isOn !== undefined) debugText += `      LED On: ${state.isOn}\n`
    })
    debugText += `\n`
    
    // Add wire analysis section
    debugText += `🔌 WIRE ANALYSIS:\n`
    debugText += `   Total Wires: ${wires?.length || 0}\n`
    debugText += `   Grid Adjacency: ${wires?.length === 0 ? 'ACTIVE (No wires placed - using grid adjacency)' : 'INACTIVE (Wires placed)'}\n`
    if (wires && wires.length > 0) {
      debugText += `   Wire Types:\n`
      wires.forEach((wire, index) => {
        debugText += `   ${index + 1}. ${wire.id}: ${wire.voltage}V, ${wire.current}A, ${wire.isPowered ? 'POWERED' : 'UNPOWERED'}, ${wire.isGrounded ? 'GROUNDED' : 'UNGROUNDED'}\n`
      })
    } else {
      debugText += `   ⚠️ No wires detected - circuit working via grid adjacency\n`
      debugText += `   This means components are connected by being placed next to each other\n`
    }
    debugText += `\n`
    
    // Wire States
    debugText += `🔌 WIRE STATE SUMMARY:\n`
    debugText += `   Total Wires: ${wires?.length || 0}\n`
    if (wires && wires.length > 0) {
      wires.forEach((wire, index) => {
        debugText += `   ${index + 1}. Wire ${wire.id || 'Unknown'}:\n`
        debugText += `      Voltage: ${wire.voltage || 0}V\n`
        debugText += `      Current: ${wire.current || 0}A\n`
        debugText += `      Power: ${wire.power || 0}W\n`
        debugText += `      Powered: ${wire.isPowered || false}\n`
        debugText += `      Grounded: ${wire.isGrounded || false}\n`
        debugText += `      Segments: ${wire.segments?.length || 0}\n`
        if (wire.segments && wire.segments.length > 0) {
          wire.segments.forEach((segment: any, segIndex: number) => {
            debugText += `         Segment ${segIndex + 1}: (${segment.from?.x || 0},${segment.from?.y || 0}) → (${segment.to?.x || 0},${segment.to?.y || 0})\n`
          })
        }
      })
    }
    debugText += `\n`
    
    // Circuit Pathways
    if (circuitPathways && Array.isArray(circuitPathways) && circuitPathways.length > 0) {
      debugText += `🛤️ CIRCUIT PATHWAYS:\n`
      circuitPathways.forEach((pathway, index) => {
        debugText += `   ${index + 1}. Pathway ${pathway.id || 'Unknown'}:\n`
        debugText += `      Voltage: ${pathway.voltage || 0}V\n`
        debugText += `      Current: ${pathway.current || 0}A (${((pathway.current || 0) * 1000).toFixed(2)}mA)\n`
        debugText += `      Resistance: ${pathway.resistance || 0}Ω\n`
        debugText += `      Components: ${(pathway.components || []).join(', ')}\n`
      })
    }
    
    // Add troubleshooting section
    debugText += `\n`
    debugText += `🔧 TROUBLESHOOTING:\n`
    debugText += `   Issues Detected:\n`
    
    // Check for missing VoltageSource
    const hasVoltageSource = Array.from(componentStates.values()).some(state => state.componentType === 'VoltageSource')
    if (!hasVoltageSource) {
      debugText += `   ❌ Missing VoltageSource - PowerSupply positive terminal not detected\n`
      debugText += `      Check console for: "🔍 Processing PowerSupply cell" logs\n`
      debugText += `      Expected: type="VCC", pin="5V" for positive terminal\n`
    } else {
      debugText += `   ✅ VoltageSource detected\n`
    }
    
    // Check for missing GroundingSource
    const hasGroundingSource = Array.from(componentStates.values()).some(state => state.componentType === 'GroundingSource')
    if (!hasGroundingSource) {
      debugText += `   ❌ Missing GroundingSource - PowerSupply negative terminal not detected\n`
    } else {
      debugText += `   ✅ GroundingSource detected\n`
    }
    
    // Check continuity
    const hasContinuity = circuitInfo?.hasContinuity !== false
    if (!hasContinuity) {
      debugText += `   ❌ No continuity - circuit path is incomplete\n`
      debugText += `      Check if components are properly connected with wires or grid adjacency\n`
    } else {
      debugText += `   ✅ Continuity confirmed\n`
    }
    
    // Check wire count
    if (wires?.length === 0) {
      debugText += `   ⚠️ No wires placed - circuit using grid adjacency\n`
      debugText += `      This is normal if components are placed next to each other\n`
    } else {
      debugText += `   ✅ Wires detected: ${wires?.length || 0}\n`
    }
    
    // Check LED state
    const ledStates = Array.from(componentStates.values()).filter(state => state.componentType === 'LED')
    if (ledStates.length > 0) {
      const ledOn = ledStates.some(led => led.isOn)
      debugText += `   ${ledOn ? '✅' : '❌'} LED State: ${ledOn ? 'ON' : 'OFF'}\n`
    }
    
    debugText += `\n`
    debugText += `📝 NEXT STEPS:\n`
    debugText += `   1. Check browser console for detailed logs\n`
    debugText += `   2. Look for "🔍 Processing PowerSupply cell" messages\n`
    debugText += `   3. Verify PowerSupply has both positive (VCC) and negative (GND) terminals\n`
    debugText += `   4. Check if components are properly placed on grid\n`
    
    return debugText
  }

  const copyDebugSuite = async () => {
    const debugText = generateDebugSuite()
    try {
      await navigator.clipboard.writeText(debugText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy debug suite:', err)
    }
  }

  const generateJSONData = () => {
    // Extract only occupied components from gridData for compact storage
    const occupiedComponents = gridData ? extractOccupiedComponents(gridData) : []

    const jsonData = {
      timestamp: new Date().toISOString(),
      occupiedComponents: occupiedComponents,
      wires: wires || [],
      componentStates: Object.fromEntries(componentStates),
      circuitPathways: circuitPathways || [],
      circuitInfo: circuitInfo || null
    }
    return JSON.stringify(jsonData, null, 2)
  }

  const copyJSONData = async () => {
    const jsonText = generateJSONData()
    try {
      await navigator.clipboard.writeText(jsonText)
      setJsonCopied(true)
      setTimeout(() => setJsonCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy JSON data:', err)
    }
  }

  if (!isOpen) return null

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500'
      case 'warn': return 'text-yellow-500'
      case 'info': return 'text-blue-500'
      case 'debug': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌'
      case 'warn': return '⚠️'
      case 'info': return 'ℹ️'
      case 'debug': return '🔍'
      default: return '📝'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-4xl h-[80vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
              Developer Menu
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-border">
          <button
            onClick={() => setActiveTab('pathways')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pathways'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <CircuitBoard className="h-4 w-4 inline mr-2" />
            Circuit Pathways
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'components'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Zap className="h-4 w-4 inline mr-2" />
            Components ({componentStates.size})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Activity className="h-4 w-4 inline mr-2" />
            Logs ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('debug')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'debug'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Bug className="h-4 w-4 inline mr-2" />
            Debug Suite
          </button>
          <button
            onClick={() => setActiveTab('logging')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logging'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Settings className="h-4 w-4 inline mr-2" />
            Logging Controls
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Play className="h-4 w-4 inline mr-2" />
            Circuit Analysis
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'json'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Code className="h-4 w-4 inline mr-2" />
            JSON Data
          </button>
          <button
            onClick={() => setActiveTab('griddata')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'griddata'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Eye className="h-4 w-4 inline mr-2" />
            Grid Data
          </button>
          <button
            onClick={() => setActiveTab('circuitanalysis')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'circuitanalysis'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <CircuitBoard className="h-4 w-4 inline mr-2" />
            Circuit Analysis
          </button>
          <button
            onClick={() => setActiveTab('circuitoverview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'circuitoverview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Network className="h-4 w-4 inline mr-2" />
            Circuit Overview
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'pathways' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Detected circuit pathways and their electrical properties
                </div>
                
                {!circuitPathways || !Array.isArray(circuitPathways) || circuitPathways.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                    No circuit pathways detected
                  </div>
                ) : (
                  circuitPathways.map((pathway, index) => (
                    <div key={pathway.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-dark-text-primary">
                          Pathway {index + 1}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                          ID: {pathway.id}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Voltage</div>
                          <div className="font-mono text-sm">{(pathway.voltage || 0).toFixed(2)}V</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Current</div>
                          <div className="font-mono text-sm">{((pathway.current || 0) * 1000).toFixed(1)}mA</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Resistance</div>
                          <div className="font-mono text-sm">{(pathway.resistance || 0).toFixed(0)}Ω</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Components</div>
                          <div className="font-mono text-sm">{pathway.components?.length || 0}</div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-500 dark:text-dark-text-muted mb-1">Components:</div>
                        <div className="flex flex-wrap gap-1">
                          {(pathway.components || []).map((componentId, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
                            >
                              {componentId}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'components' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Component states and electrical properties
                </div>
                
                {componentStates.size === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                    No components detected
                  </div>
                ) : (
                  Array.from(componentStates.entries()).map(([id, state]) => (
                    <div key={id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-dark-text-primary">
                          {state.componentType}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                          {id}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Voltage</div>
                          <div className="font-mono text-sm">{state.outputVoltage.toFixed(2)}V</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Current</div>
                          <div className="font-mono text-sm">{(state.outputCurrent * 1000).toFixed(1)}mA</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Power</div>
                          <div className="font-mono text-sm">{state.power.toFixed(3)}W</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Status</div>
                          <div className={`text-sm font-medium ${
                            state.status === 'on' ? 'text-green-600' : 
                            state.status === 'off' ? 'text-red-600' : 
                            'text-blue-600'
                          }`}>
                            {state.status}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                        Position: ({state.position.x}, {state.position.y})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  System logs and debug information
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                    No logs available
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLogs.map((log) => (
                      <div key={`${log.timestamp}-${log.message}`} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-lg">{getLogLevelIcon(log.level)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${getLogLevelColor(log.level)}`}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900 dark:text-dark-text-primary break-words">
                            {log.message}
                          </div>
                          {log.data && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-500 dark:text-dark-text-muted cursor-pointer">
                                View Data
                              </summary>
                              <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'debug' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      Complete circuit debug information for troubleshooting
                    </div>
                    <div className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">
                      Click "Copy Debug Suite" to copy all information to clipboard
                    </div>
                  </div>
                  <button
                    onClick={copyDebugSuite}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      copied
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Debug Suite
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <pre className="text-xs text-gray-900 dark:text-dark-text-primary whitespace-pre-wrap font-mono leading-relaxed">
                    {generateDebugSuite()}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logging' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      Centralized Logging Controls
                    </div>
                    <div className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">
                      Control all console logs from CircuitWiz systems
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAllLogs(true)}
                      className="px-3 py-2 text-sm font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                    >
                      Enable All
                    </button>
                    <button
                      onClick={() => toggleAllLogs(false)}
                      className="px-3 py-2 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                    >
                      Disable All
                    </button>
                    <button
                      onClick={clearLogs}
                      className="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Clear Logs
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Master Toggle */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text-primary">
                        Master Logging Control
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                        Quick toggle for all categories (individual categories can still be controlled separately)
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loggingConfig.enabled}
                        onChange={(e) => {
                          // When master toggle is turned on, turn on all categories
                          // When turned off, turn off all categories
                          const enabled = e.target.checked
                          updateLoggingConfig({
                            enabled,
                            categories: {
                              electrical: enabled,
                              components: enabled,
                              wires: enabled,
                              physics: enabled,
                              circuit: enabled,
                              grid: enabled,
                              debug: enabled,
                              performance: enabled
                            }
                          })
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Category Controls */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                    Individual Category Controls
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-4">
                    Turn on specific log categories independently. All categories are OFF by default.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(loggingConfig.categories).map(([category, enabled]) => (
                      <label key={category} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => {
                            const newCategories = {
                              ...loggingConfig.categories,
                              [category]: e.target.checked
                            }
                            // Update master toggle based on whether any categories are enabled
                            const anyEnabled = Object.values(newCategories).some(enabled => enabled)
                            updateLoggingConfig({
                              enabled: anyEnabled,
                              categories: newCategories
                            })
                          }}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary capitalize">
                          {category}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Snippet Capture */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text-primary mb-4">
                    Log Snippet Capture
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                          Capture a {loggingConfig.snippetDuration / 1000} second snippet of all logs
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                          Useful for debugging specific issues
                        </p>
                      </div>
                      <button
                        onClick={startSnippetCapture}
                        disabled={isCapturingSnippet}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          isCapturingSnippet
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 cursor-not-allowed'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                        {isCapturingSnippet ? 'Capturing...' : 'Start Capture'}
                      </button>
                    </div>
                    
                    {snippetLogs.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                          Captured Logs ({snippetLogs.length} entries)
                        </h4>
                        <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 max-h-64 overflow-y-auto">
                          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                            {snippetLogs.map((log, index) => 
                              `[${log.timestamp}] [${log.category.toUpperCase()}] ${log.message}${log.data ? ' ' + JSON.stringify(log.data) : ''}`
                            ).join('\n')}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Logs Preview */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text-primary mb-4">
                    Recent Logs Preview
                  </h3>
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                      {logger.getRecentLogs(20).map((log, index) => 
                        `[${log.timestamp}] [${log.category.toUpperCase()}] ${log.message}${log.data ? ' ' + JSON.stringify(log.data) : ''}`
                      ).join('\n')}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      Current instantaneous JSON array and visual component display
                    </div>
                    <div className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">
                      Left: JSON data • Right: Visual component grid
                    </div>
                  </div>
                  <button
                    onClick={copyJSONData}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      jsonCopied
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
                    }`}
                  >
                    {jsonCopied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy JSON
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {/* Left side - JSON Data */}
                <div className="flex-1 border-r border-gray-200 dark:border-dark-border">
                  <div className="h-full overflow-y-auto p-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                      JSON Data
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <pre className="text-xs text-gray-900 dark:text-dark-text-primary whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                        {generateJSONData()}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Right side - Visual Component Display */}
                <div className="flex-1">
                  <div className="h-full overflow-y-auto p-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                      Visual Component Grid
                    </div>
                    
                    {gridData && gridData.length > 0 ? (
                      <div className="space-y-4">
                        {/* Grid Overview */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted mb-2">
                            Grid Overview ({gridData.length} rows × {gridData[0]?.length || 0} columns)
                          </div>
                          <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                            {gridData.slice(0, 8).map((row, y) => 
                              row.slice(0, 8).map((cell, x) => (
                                <div
                                  key={`${x}-${y}`}
                                  className={`w-4 h-4 rounded-sm border ${
                                    cell?.occupied 
                                      ? 'bg-blue-500 border-blue-600' 
                                      : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                  }`}
                                  title={`(${x}, ${y}) ${cell?.occupied ? cell.componentType : 'Empty'}`}
                                />
                              ))
                            )}
                          </div>
                        </div>

                        {/* Component Details */}
                        <div className="space-y-3">
                          {gridData ? extractOccupiedComponents(gridData).map((component, index) => (
                            <div key={`${component.componentId}-${component.cellIndex}`} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${
                                    component.isPowered ? 'bg-green-500' : 'bg-gray-400'
                                  }`} />
                                  <span className="font-medium text-sm text-gray-900 dark:text-dark-text-primary">
                                    {component.componentType}
                                  </span>
                                  {component.moduleDefinition?.grid?.[component.cellIndex || 0]?.type && (
                                    <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                      ({component.moduleDefinition.grid[component.cellIndex || 0].type})
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                  {component.componentId}-{component.cellIndex}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500 dark:text-dark-text-muted">Position:</span>
                                  <span className="ml-1 font-mono">({component.x}, {component.y})</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-dark-text-muted">Voltage:</span>
                                  <span className="ml-1 font-mono">{component.voltage?.toFixed(2) || '0.00'}V</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-dark-text-muted">Current:</span>
                                  <span className="ml-1 font-mono">{((component.current || 0) * 1000).toFixed(1)}mA</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-dark-text-muted">Status:</span>
                                  <span className={`ml-1 font-medium ${
                                    component.isPowered ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {component.isPowered ? 'powered' : 'unpowered'}
                                  </span>
                                </div>
                                {component.resistance && (
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Resistance:</span>
                                    <span className="ml-1 font-mono">{component.resistance}Ω</span>
                                  </div>
                                )}
                                {component.moduleDefinition?.grid?.[component.cellIndex || 0]?.pin && (
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Pin:</span>
                                    <span className="ml-1 font-mono">{component.moduleDefinition.grid[component.cellIndex || 0].pin}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )) : (
                            <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                              No components detected
                            </div>
                          )}
                        </div>

                        {/* Wire Information */}
                        {wires && wires.length > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                              Wires ({wires.length})
                            </div>
                            <div className="space-y-2">
                              {wires.map((wire, index) => (
                                <div key={wire.id || index} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      wire.isPowered ? 'bg-yellow-500' : 'bg-gray-400'
                                    }`} />
                                    <span className="font-mono">{wire.id || `Wire ${index + 1}`}</span>
                                    <span className="text-gray-500 dark:text-dark-text-muted">
                                      {wire.voltage?.toFixed(2)}V, {(wire.current * 1000)?.toFixed(1)}mA
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                        No grid data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                    Circuit Pathway Analysis
                  </div>
                  <button
                    onClick={runCircuitAnalysis}
                    disabled={isAnalyzing || !gridData || !wires}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isAnalyzing || !gridData || !wires
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                        : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                    }`}
                  >
                    <Play className="h-4 w-4 inline mr-2" />
                    {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                  </button>
                </div>

                {!gridData || !wires ? (
                  <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                    No grid data or wires available for analysis
                  </div>
                ) : analysisResults.pathways.length === 0 && analysisResults.errors.length === 0 && analysisResults.warnings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                    {isAnalyzing ? 'Running circuit analysis...' : 'Click "Run Analysis" to analyze circuit pathways'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Errors */}
                    {analysisResults.errors.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <h3 className="font-medium text-red-800 dark:text-red-200">
                            Errors ({analysisResults.errors.length})
                          </h3>
                        </div>
                        <div className="space-y-1">
                          {analysisResults.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700 dark:text-red-300">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {analysisResults.warnings.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                            Warnings ({analysisResults.warnings.length})
                          </h3>
                        </div>
                        <div className="space-y-1">
                          {analysisResults.warnings.map((warning, index) => (
                            <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                              {warning}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Circuit Pathways */}
                    {analysisResults.pathways.length > 0 && (
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                          Found {analysisResults.pathways.length} circuit pathway{analysisResults.pathways.length !== 1 ? 's' : ''}
                        </div>
                    
                        {analysisResults.pathways.map((pathway, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-gray-900 dark:text-dark-text-primary">
                            Circuit {index + 1}
                          </h3>
                          <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                            {pathway.length} components
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {pathway.map((node, nodeIndex) => (
                            <div key={nodeIndex} className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  node.type === 'VoltageSource' ? 'bg-green-500' :
                                  node.type === 'GroundingSource' ? 'bg-red-500' :
                                  'bg-blue-500'
                                }`} />
                                <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">
                                  {node.type}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                  ({node.id})
                                </span>
                              </div>
                              
                              {nodeIndex < pathway.length - 1 && (
                                <div className="flex-1 flex items-center">
                                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                                  <div className="mx-2 text-xs text-gray-400">→</div>
                                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Component details */}
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {pathway.map((node, nodeIndex) => (
                              <div key={nodeIndex} className="space-y-1">
                                <div className="font-medium text-gray-700 dark:text-dark-text-primary">
                                  {node.type} ({node.id})
                                </div>
                                <div className="text-gray-500 dark:text-dark-text-muted">
                                  Position: ({node.position.x}, {node.position.y})
                                </div>
                                {node.voltage !== undefined && (
                                  <div className="text-gray-500 dark:text-dark-text-muted">
                                    Voltage: {node.voltage}V
                                  </div>
                                )}
                                {node.resistance !== undefined && (
                                  <div className="text-gray-500 dark:text-dark-text-muted">
                                    Resistance: {node.resistance}Ω
                                  </div>
                                )}
                                {node.forwardVoltage !== undefined && (
                                  <div className="text-gray-500 dark:text-dark-text-muted">
                                    Forward Voltage: {node.forwardVoltage}V
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'griddata' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      Row-by-row grid data inspection
                    </div>
                    <div className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">
                      Navigate through rows and columns to inspect cell data
                    </div>
                  </div>
                  {gridData && (
                    <div className="text-sm text-gray-500 dark:text-dark-text-muted">
                      {gridData.length} rows × {gridData[0]?.length || 0} columns
                    </div>
                  )}
                </div>

                {gridData && (
                  <div className="space-y-4">
                    {/* Row Navigation */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-dark-text-secondary">
                          Row:
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, gridData.length - 1)}
                          value={currentRow}
                          onChange={(e) => setCurrentRow(parseInt(e.target.value))}
                          className="w-32"
                        />
                        <span className="text-sm font-mono text-gray-900 dark:text-dark-text-primary min-w-[3rem]">
                          {currentRow}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-dark-text-secondary">
                          Columns:
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="10"
                          value={columnsToShow}
                          onChange={(e) => setColumnsToShow(parseInt(e.target.value))}
                          className="w-32"
                        />
                        <span className="text-sm font-mono text-gray-900 dark:text-dark-text-primary min-w-[3rem]">
                          {columnsToShow}
                        </span>
                      </div>
                    </div>

                    {/* Quick Navigation */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentRow(0)}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        First Row
                      </button>
                      <button
                        onClick={() => setCurrentRow(Math.max(0, currentRow - 10))}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        -10 Rows
                      </button>
                      <button
                        onClick={() => setCurrentRow(Math.max(0, currentRow - 1))}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentRow(Math.min(gridData.length - 1, currentRow + 1))}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentRow(Math.min(gridData.length - 1, currentRow + 10))}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        +10 Rows
                      </button>
                      <button
                        onClick={() => setCurrentRow(gridData.length - 1)}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Last Row
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {gridData ? (
                  <div className="h-full flex flex-col">
                    {/* Current Row Info */}
                    <div className="p-4 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-gray-800">
                      <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                        Row {currentRow} Details
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-dark-text-muted">Row Length:</span>
                          <span className="ml-2 font-mono">{gridData[currentRow]?.length || 0} cells</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-dark-text-muted">Occupied:</span>
                          <span className="ml-2 font-mono">
                            {gridData[currentRow]?.filter(cell => cell?.occupied).length || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-dark-text-muted">Empty:</span>
                          <span className="ml-2 font-mono">
                            {(gridData[currentRow]?.length || 0) - (gridData[currentRow]?.filter(cell => cell?.occupied).length || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-dark-text-muted">Showing:</span>
                          <span className="ml-2 font-mono">0-{Math.min(columnsToShow - 1, (gridData[currentRow]?.length || 0) - 1)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Row Data Display */}
                    <div className="flex-1 overflow-auto p-4">
                      <div className="space-y-4">
                        {/* Visual Row */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                            Visual Row {currentRow}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {gridData[currentRow]?.slice(0, columnsToShow).map((cell, x) => (
                              <div
                                key={x}
                                className={`w-6 h-6 rounded-sm border text-xs flex items-center justify-center ${
                                  cell?.occupied 
                                    ? 'bg-blue-500 border-blue-600 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                }`}
                                title={`(${x}, ${currentRow}) ${cell?.occupied ? `${cell.componentType} - ${cell.componentId}` : 'Empty'}`}
                              >
                                {cell?.occupied ? '●' : ''}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Detailed Row Data */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                            Row {currentRow} Data (First {columnsToShow} columns)
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 overflow-auto">
                            <pre className="text-xs text-gray-900 dark:text-dark-text-primary whitespace-pre-wrap font-mono leading-relaxed">
                              {JSON.stringify(
                                gridData[currentRow]?.slice(0, columnsToShow).map((cell, x) => ({
                                  position: `(${x}, ${currentRow})`,
                                  occupied: cell?.occupied || false,
                                  componentId: cell?.componentId || null,
                                  componentType: cell?.componentType || null,
                                  voltage: cell?.voltage || null,
                                  current: cell?.current || null,
                                  resistance: cell?.resistance || null,
                                  isPowered: cell?.isPowered || false,
                                  cellIndex: cell?.cellIndex || null,
                                  moduleDefinition: cell?.moduleDefinition ? 'Present' : null
                                })), 
                                null, 
                                2
                              )}
                            </pre>
                          </div>
                        </div>

                        {/* Occupied Cells in Current Row */}
                        {gridData[currentRow]?.filter(cell => cell?.occupied).length > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                              Occupied Cells in Row {currentRow}
                            </div>
                            <div className="space-y-2">
                              {gridData[currentRow]?.slice(0, columnsToShow).map((cell, x) => 
                                cell?.occupied ? (
                                  <div key={x} className="bg-gray-100 dark:bg-gray-900 rounded p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${
                                          cell.isPowered ? 'bg-green-500' : 'bg-gray-400'
                                        }`} />
                                        <span className="font-medium text-sm text-gray-900 dark:text-dark-text-primary">
                                          {cell.componentType}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                          ({x}, {currentRow})
                                        </span>
                                      </div>
                                      <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                        {cell.componentId}-{cell.cellIndex}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-gray-500 dark:text-dark-text-muted">Position:</span>
                                        <span className="ml-1 font-mono">({x}, {currentRow})</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 dark:text-dark-text-muted">Voltage:</span>
                                        <span className="ml-1 font-mono">{cell.voltage?.toFixed(2) || '0.00'}V</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 dark:text-dark-text-muted">Current:</span>
                                        <span className="ml-1 font-mono">{((cell.current || 0) * 1000).toFixed(1)}mA</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 dark:text-dark-text-muted">Status:</span>
                                        <span className={`ml-1 font-medium ${
                                          cell.isPowered ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {cell.isPowered ? 'powered' : 'unpowered'}
                                        </span>
                                      </div>
                                      {cell.resistance && (
                                        <div>
                                          <span className="text-gray-500 dark:text-dark-text-muted">Resistance:</span>
                                          <span className="ml-1 font-mono">{cell.resistance}Ω</span>
                                        </div>
                                      )}
                                      {cell.moduleDefinition?.grid?.[cell.cellIndex || 0]?.pin && (
                                        <div>
                                          <span className="text-gray-500 dark:text-dark-text-muted">Pin:</span>
                                          <span className="ml-1 font-mono">{cell.moduleDefinition.grid[cell.cellIndex || 0].pin}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : null
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                      No grid data available
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'circuitanalysis' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
                      Circuit Analysis
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      Detailed voltage calculations for each circuit node
                    </p>
                  </div>
                  <button
                    onClick={generateCircuitAnalysis}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    <Play className="h-4 w-4 inline mr-1" />
                    Refresh Analysis
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="h-full flex">
                  {/* Node List */}
                  <div className="w-1/2 border-r border-gray-200 dark:border-dark-border overflow-y-auto">
                    <div className="p-4">
                      <h4 className="text-md font-medium text-gray-900 dark:text-dark-text-primary mb-3">
                        Circuit Nodes ({circuitAnalysisData.nodes.length})
                      </h4>
                      <div className="space-y-2">
                        {circuitAnalysisData.nodes.map((node) => (
                          <div
                            key={node.id}
                            onClick={() => setSelectedNode(node.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedNode === node.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  node.outputVoltage > 0 ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                                <span className="font-medium text-sm text-gray-900 dark:text-dark-text-primary">
                                  {node.type}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                  ({node.position.x}, {node.position.y})
                                </span>
                                {node.cellCount > 1 && (
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded">
                                    {node.cellCount} cells
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                {node.id.split('-').pop()}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-dark-text-muted">Input:</span>
                                <span className="ml-1 font-mono">{node.inputVoltage.toFixed(2)}V</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-dark-text-muted">Output:</span>
                                <span className="ml-1 font-mono">{node.outputVoltage.toFixed(2)}V</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-dark-text-muted">Current:</span>
                                <span className="ml-1 font-mono">{((node.current || 0) * 1000).toFixed(1)}mA</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-dark-text-muted">Power:</span>
                                <span className="ml-1 font-mono">{((node.outputVoltage * node.current) * 1000).toFixed(1)}mW</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Calculation */}
                  <div className="w-1/2 overflow-y-auto">
                    <div className="p-4">
                      {selectedNode ? (
                        (() => {
                          const node = circuitAnalysisData.nodes.find(n => n.id === selectedNode)
                          if (!node) return null
                          
                          return (
                            <div>
                              <h4 className="text-md font-medium text-gray-900 dark:text-dark-text-primary mb-4">
                                {node.type} Calculation
                              </h4>
                              
                              {/* Component Details */}
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                                  Component Details
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Position:</span>
                                    <span className="ml-2 font-mono">({node.position.x}, {node.position.y})</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">ID:</span>
                                    <span className="ml-2 font-mono text-xs">{node.id}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Type:</span>
                                    <span className="ml-2">{node.type}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Cells:</span>
                                    <span className="ml-2">{node.cellCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Status:</span>
                                    <span className={`ml-2 font-medium ${
                                      node.outputVoltage > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {node.outputVoltage > 0 ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Cell-by-Cell Breakdown */}
                              {node.cells && node.cells.length > 1 && (
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                                  <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                                    Cell-by-Cell Breakdown
                                  </div>
                                  <div className="space-y-2">
                                    {node.cells.map((cell, index) => (
                                      <div key={cell.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-900 rounded p-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">
                                            Cell {cell.cellIndex}
                                          </span>
                                          <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                            ({cell.position.x}, {cell.position.y})
                                          </span>
                                        </div>
                                        <span className="text-sm font-mono">
                                          {cell.voltage.toFixed(2)}V
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Voltage Calculation */}
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                                  Voltage Calculation
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-900 rounded p-3">
                                  <code className="text-sm font-mono text-gray-900 dark:text-dark-text-primary">
                                    {node.calculation}
                                  </code>
                                </div>
                              </div>

                              {/* Component Properties */}
                              {Object.keys(node.properties).length > 0 && (
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                                  <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                                    Component Properties
                                  </div>
                                  <div className="space-y-1">
                                    {Object.entries(node.properties).map(([key, value]) => (
                                      <div key={key} className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-dark-text-muted capitalize">
                                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                                        </span>
                                        <span className="font-mono">{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Electrical Values */}
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-dark-text-primary mb-2">
                                  Electrical Values
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Input Voltage:</span>
                                    <span className="ml-2 font-mono text-lg font-bold text-blue-600">
                                      {node.inputVoltage.toFixed(2)}V
                                    </span>
                                    <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                                      (Cell {node.cells?.[0]?.cellIndex || 0})
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Output Voltage:</span>
                                    <span className="ml-2 font-mono text-lg font-bold text-green-600">
                                      {node.outputVoltage.toFixed(2)}V
                                    </span>
                                    <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                                      (Cell {node.cells?.[node.cells?.length - 1]?.cellIndex || 0})
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Voltage Drop:</span>
                                    <span className="ml-2 font-mono text-lg font-bold text-red-600">
                                      {(node.inputVoltage - node.outputVoltage).toFixed(2)}V
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Current:</span>
                                    <span className="ml-2 font-mono text-lg font-bold text-orange-600">
                                      {((node.current || 0) * 1000).toFixed(1)}mA
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-dark-text-muted">Power:</span>
                                    <span className="ml-2 font-mono text-lg font-bold text-purple-600">
                                      {((node.outputVoltage * node.current) * 1000).toFixed(1)}mW
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                            <CircuitBoard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Select a node to view detailed calculations</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'circuitoverview' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Complete circuit overview showing components, wires, and their connections
                </div>
                
                {!gridData || gridData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-dark-text-muted">
                    No circuit data available
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Circuit Summary */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-3">
                        Circuit Summary
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Components</div>
                          <div className="font-mono text-lg font-bold text-blue-600">
                            {componentStates.size}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Wires</div>
                          <div className="font-mono text-lg font-bold text-green-600">
                            {wires?.length || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Pathways</div>
                          <div className="font-mono text-lg font-bold text-purple-600">
                            {circuitPathways?.length || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Grid Size</div>
                          <div className="font-mono text-lg font-bold text-orange-600">
                            {gridData.length}×{gridData[0]?.length || 0}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Component-Wire Connections */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-3">
                        Component-Wire Connections
                      </h3>
                      
                      {componentStates.size === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-dark-text-muted">
                          No components detected
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Array.from(componentStates.entries()).map(([componentId, componentState]) => {
                            // Find wires connected to this component
                            const connectedWires = wires?.filter(wire => {
                              return wire.segments?.some(segment => {
                                const fromCell = gridData[segment.from.y]?.[segment.from.x]
                                const toCell = gridData[segment.to.y]?.[segment.to.x]
                                
                                // Check if wire connects to this component at either end
                                const componentBaseId = componentState.componentId.split('-')[0]
                                
                                // Check if the wire segment starts or ends at this component's position
                                const fromMatches = fromCell?.occupied && fromCell.componentId === componentBaseId
                                const toMatches = toCell?.occupied && toCell.componentId === componentBaseId
                                
                                // Also check if the wire segment coordinates match this component's position
                                const positionMatches = (segment.from.x === componentState.position.x && segment.from.y === componentState.position.y) ||
                                                      (segment.to.x === componentState.position.x && segment.to.y === componentState.position.y)
                                
                                return fromMatches || toMatches || positionMatches
                              })
                            }) || []

                            return (
                              <div key={componentId} className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${
                                      componentState.isPowered ? 'bg-green-500' : 'bg-gray-400'
                                    }`} />
                                    <div>
                                      <h4 className="font-medium text-gray-900 dark:text-dark-text-primary">
                                        {componentState.componentType}
                                      </h4>
                                      <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                                        {componentId} at ({componentState.position.x}, {componentState.position.y})
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-mono text-gray-900 dark:text-dark-text-primary">
                                      {componentState.outputVoltage.toFixed(2)}V
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                                      {(componentState.outputCurrent * 1000).toFixed(1)}mA
                                    </div>
                                  </div>
                                </div>

                                {/* Connected Wires */}
                                {connectedWires.length > 0 ? (
                                  <div className="space-y-2">
                                    <div className="text-xs text-gray-500 dark:text-dark-text-muted font-medium">
                                      Connected Wires ({connectedWires.length}):
                                    </div>
                                    {connectedWires.map((wire, wireIndex) => {
                                      // Find the destination component for this wire
                                      const findDestinationComponent = () => {
                                        const currentComponentBaseId = componentState.componentId.split('-')[0]
                                        
                                        for (const segment of wire.segments || []) {
                                          const fromCell = gridData[segment.from.y]?.[segment.from.x]
                                          const toCell = gridData[segment.to.y]?.[segment.to.x]
                                          
                                          // Check if this segment connects to a different component
                                          if (fromCell?.occupied && fromCell.componentId !== currentComponentBaseId) {
                                            return {
                                              componentId: fromCell.componentId,
                                              componentType: fromCell.componentType,
                                              position: { x: segment.from.x, y: segment.from.y }
                                            }
                                          }
                                          if (toCell?.occupied && toCell.componentId !== currentComponentBaseId) {
                                            return {
                                              componentId: toCell.componentId,
                                              componentType: toCell.componentType,
                                              position: { x: segment.to.x, y: segment.to.y }
                                            }
                                          }
                                          
                                          // Also check by position if grid data doesn't have the component info
                                          if (segment.from.x !== componentState.position.x || segment.from.y !== componentState.position.y) {
                                            // This segment doesn't start at our component, so the destination is at the 'from' end
                                            if (fromCell?.occupied) {
                                              return {
                                                componentId: fromCell.componentId,
                                                componentType: fromCell.componentType,
                                                position: { x: segment.from.x, y: segment.from.y }
                                              }
                                            }
                                          }
                                          if (segment.to.x !== componentState.position.x || segment.to.y !== componentState.position.y) {
                                            // This segment doesn't end at our component, so the destination is at the 'to' end
                                            if (toCell?.occupied) {
                                              return {
                                                componentId: toCell.componentId,
                                                componentType: toCell.componentType,
                                                position: { x: segment.to.x, y: segment.to.y }
                                              }
                                            }
                                          }
                                        }
                                        return null
                                      }

                                      const destination = findDestinationComponent()

                                      return (
                                        <div key={wire.id || wireIndex} className="bg-gray-100 dark:bg-gray-600 rounded p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <div className={`w-2 h-2 rounded-full ${
                                                wire.isPowered ? 'bg-yellow-500' : 'bg-gray-400'
                                              }`} />
                                              <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">
                                                Wire {wire.id || `#${wireIndex + 1}`}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                                              {wire.voltage?.toFixed(2) || '0.00'}V, {(wire.current * 1000)?.toFixed(1) || '0.0'}mA
                                            </div>
                                          </div>
                                          
                                          {/* Wire Segments */}
                                          <div className="space-y-1">
                                            <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                                              Segments ({wire.segments?.length || 0}):
                                            </div>
                                            {wire.segments?.map((segment, segIndex) => (
                                              <div key={segIndex} className="text-xs font-mono text-gray-600 dark:text-dark-text-muted ml-2">
                                                ({segment.from.x}, {segment.from.y}) → ({segment.to.x}, {segment.to.y})
                                                {segment.isPowered && (
                                                  <span className="ml-2 text-green-600">●</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>

                                          {/* Destination Component */}
                                          {destination && (
                                            <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-500">
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 dark:text-dark-text-muted">→</span>
                                                <div className="flex items-center gap-2">
                                                  <div className={`w-2 h-2 rounded-full ${
                                                    componentStates.get(`${destination.componentId}-0`)?.isPowered ? 'bg-green-500' : 'bg-gray-400'
                                                  }`} />
                                                  <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">
                                                    {destination.componentType}
                                                  </span>
                                                  <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                                                    ({destination.position.x}, {destination.position.y})
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                                    No wires connected (using grid adjacency)
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Wire Details */}
                    {wires && wires.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-3">
                          Wire Details
                        </h3>
                        <div className="space-y-3">
                          {wires.map((wire, index) => (
                            <div key={wire.id || index} className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full ${
                                    wire.isPowered ? 'bg-yellow-500' : 'bg-gray-400'
                                  }`} />
                                  <div>
                                    <h4 className="font-medium text-gray-900 dark:text-dark-text-primary">
                                      Wire {wire.id || `#${index + 1}`}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                                      {wire.segments?.length || 0} segments
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-mono text-gray-900 dark:text-dark-text-primary">
                                    {wire.voltage?.toFixed(2) || '0.00'}V
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-dark-text-muted">
                                    {(wire.current * 1000)?.toFixed(1) || '0.0'}mA
                                  </div>
                                </div>
                              </div>

                              {/* Wire Segments */}
                              <div className="space-y-2">
                                <div className="text-xs text-gray-500 dark:text-dark-text-muted font-medium">
                                  Segments:
                                </div>
                                {wire.segments?.map((segment, segIndex) => (
                                  <div key={segIndex} className="bg-gray-100 dark:bg-gray-600 rounded p-2">
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs font-mono text-gray-900 dark:text-dark-text-primary">
                                        ({segment.from.x}, {segment.from.y}) → ({segment.to.x}, {segment.to.y})
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {segment.isPowered && (
                                          <span className="text-xs text-green-600">● Powered</span>
                                        )}
                                        {segment.isGrounded && (
                                          <span className="text-xs text-red-600">● Grounded</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
