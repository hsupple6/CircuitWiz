import React, { useState, useEffect } from 'react'
import { Bug, X, Zap, CircuitBoard, Activity, Copy, Check, Code, Eye, Play } from 'lucide-react'
import { ComponentState } from '../systems/ElectricalSystem'
import { extractOccupiedComponents } from '../utils/gridUtils'
import { findCircuitPathways } from '../services/EMPhysics'

interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
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
  const [activeTab, setActiveTab] = useState<'pathways' | 'logs' | 'components' | 'debug' | 'json' | 'analysis'>('pathways')
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>(logs)
  const [copied, setCopied] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<{
    pathways: any[];
    errors: string[];
    warnings: string[];
  }>({ pathways: [], errors: [], warnings: [] })
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    setFilteredLogs(logs)
  }, [logs])

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
                      <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-lg">{getLogLevelIcon(log.level)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${getLogLevelColor(log.level)}`}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-dark-text-muted">
                              {log.timestamp.toLocaleTimeString()}
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
        </div>
      </div>
    </div>
  )
}
