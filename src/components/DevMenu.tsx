import React, { useState, useEffect } from 'react'
import { Bug, X, Zap, CircuitBoard, Activity } from 'lucide-react'
import { ComponentState } from '../systems/ElectricalSystem'

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
}

export function DevMenu({ isOpen, onClose, componentStates, circuitPathways = [], logs }: DevMenuProps) {
  const [activeTab, setActiveTab] = useState<'pathways' | 'logs' | 'components'>('pathways')
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>(logs)

  useEffect(() => {
    setFilteredLogs(logs)
  }, [logs])

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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'pathways' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  Detected circuit pathways and their electrical properties
                </div>
                
                {circuitPathways.length === 0 ? (
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
                          <div className="font-mono text-sm">{pathway.voltage.toFixed(2)}V</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Current</div>
                          <div className="font-mono text-sm">{(pathway.current * 1000).toFixed(1)}mA</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Resistance</div>
                          <div className="font-mono text-sm">{pathway.resistance.toFixed(0)}Ω</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-dark-text-muted">Components</div>
                          <div className="font-mono text-sm">{pathway.components.length}</div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-500 dark:text-dark-text-muted mb-1">Components:</div>
                        <div className="flex flex-wrap gap-1">
                          {pathway.components.map((componentId, idx) => (
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
        </div>
      </div>
    </div>
  )
}
