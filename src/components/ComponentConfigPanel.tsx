import React, { useState, useEffect } from 'react'
import { X, Settings, Info, AlertTriangle } from 'lucide-react'
import { getModuleWithType } from '../modules/registry'
import { ModuleParameter } from '../modules/types'
import ParameterInput from './ParameterInput'

interface ComponentConfigPanelProps {
  componentId: string
  component: {
    module: string
    parameters?: Record<string, any>
    position?: { x: number; y: number }
  }
  onClose: () => void
  onParameterChange: (componentId: string, parameterName: string, value: any) => void
  className?: string
}

export const ComponentConfigPanel: React.FC<ComponentConfigPanelProps> = ({
  componentId,
  component,
  onClose,
  onParameterChange,
  className = ''
}) => {
  const [parameters, setParameters] = useState<Record<string, any>>(component.parameters || {})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const moduleData = getModuleWithType(component.module)
  const typeDef = moduleData?.type

  // Initialize parameters with default values
  useEffect(() => {
    if (typeDef) {
      const defaultParams: Record<string, any> = {}
      typeDef.parameters.forEach(param => {
        if (param.defaultValue !== undefined && !(param.name in parameters)) {
          defaultParams[param.name] = param.defaultValue
        }
      })
      
      if (Object.keys(defaultParams).length > 0) {
        setParameters(prev => ({ ...prev, ...defaultParams }))
        // Update parent component with default values
        Object.entries(defaultParams).forEach(([name, value]) => {
          onParameterChange(componentId, name, value)
        })
      }
    }
  }, [typeDef, componentId, onParameterChange, parameters])

  const handleParameterChange = (parameterName: string, value: any) => {
    // Validate parameter
    const param = typeDef?.parameters.find(p => p.name === parameterName)
    if (param) {
      const error = validateParameter(value, param)
      setValidationErrors(prev => ({
        ...prev,
        [parameterName]: error
      }))
    }

    // Update local state
    setParameters(prev => ({
      ...prev,
      [parameterName]: value
    }))

    // Notify parent
    onParameterChange(componentId, parameterName, value)
  }

  const validateParameter = (value: any, parameter: ModuleParameter): string => {
    if (parameter.required && (value === undefined || value === null || value === '')) {
      return `${parameter.label} is required`
    }

    if (parameter.type === 'number') {
      const numValue = typeof value === 'string' ? parseFloat(value) : value
      if (isNaN(numValue)) return 'Must be a valid number'
      if (parameter.min !== undefined && numValue < parameter.min) {
        return `Must be at least ${parameter.min}`
      }
      if (parameter.max !== undefined && numValue > parameter.max) {
        return `Must be at most ${parameter.max}`
      }
    }

    return ''
  }

  if (!typeDef) {
    return (
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Component Configuration
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <Info className="w-5 h-5" />
          <p>No configuration available for {component.module}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Settings className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Configure {component.module}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {typeDef.description}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Component Info */}
      <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <div><strong>Component ID:</strong> {componentId}</div>
          {component.position && (
            <div><strong>Position:</strong> ({component.position.x}, {component.position.y})</div>
          )}
        </div>
      </div>

      {/* Parameters */}
      <div className="space-y-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
          Parameters
        </h4>
        
        <div className="space-y-4">
          {typeDef.parameters.map(parameter => (
            <div key={parameter.name}>
              <ParameterInput
                parameter={parameter}
                value={parameters[parameter.name]}
                onChange={(value) => handleParameterChange(parameter.name, value)}
              />
              
              {validationErrors[parameter.name] && (
                <div className="flex items-center space-x-1 mt-1 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">{validationErrors[parameter.name]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Connection Rules */}
      {typeDef.connectionRules && typeDef.connectionRules.length > 0 && (
        <div className="mt-8 space-y-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
            Connection Rules
          </h4>
          
          <div className="space-y-2">
            {typeDef.connectionRules.map((rule, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  rule.allowed
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${
                  rule.allowed ? 'bg-green-500' : 'bg-red-500'
                }`} />
                
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {rule.fromType} → {rule.toType}
                  </div>
                  {rule.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {rule.description}
                    </div>
                  )}
                </div>
                
                <div className={`text-sm font-medium ${
                  rule.allowed
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {rule.allowed ? '✅ Allowed' : '❌ Forbidden'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Electrical Properties */}
      {typeDef.electricalProperties && (
        <div className="mt-8 space-y-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
            Electrical Properties
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(typeDef.electricalProperties).map(([property, spec]) => (
              <div key={property} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {property}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {spec.min} - {spec.max} {spec.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ComponentConfigPanel
