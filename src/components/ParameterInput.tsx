import React from 'react'
import { ModuleParameter } from '../modules/types'

interface ParameterInputProps {
  parameter: ModuleParameter
  value: any
  onChange: (value: any) => void
  className?: string
}

export const ParameterInput: React.FC<ParameterInputProps> = ({
  parameter,
  value,
  onChange,
  className = ''
}) => {
  const handleChange = (newValue: any) => {
    // Validate against parameter constraints
    if (parameter.type === 'number') {
      const numValue = typeof newValue === 'string' ? parseFloat(newValue) : newValue
      if (parameter.min !== undefined && numValue < parameter.min) return
      if (parameter.max !== undefined && numValue > parameter.max) return
      onChange(numValue)
    } else {
      onChange(newValue)
    }
  }

  const renderInput = () => {
    switch (parameter.type) {
      case 'select':
        return (
          <select
            value={value || parameter.defaultValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {parameter.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )

      case 'number':
        return (
          <input
            type="number"
            value={value || parameter.defaultValue || ''}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step || 1}
            onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case 'range':
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={parameter.min}
              max={parameter.max}
              step={parameter.step || 1}
              value={value || parameter.defaultValue || parameter.min || 0}
              onChange={(e) => handleChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {value || parameter.defaultValue || parameter.min || 0} {parameter.unit || ''}
            </div>
          </div>
        )

      case 'boolean':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value || parameter.defaultValue || false}
              onChange={(e) => handleChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {value || parameter.defaultValue ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        )

      case 'string':
      default:
        return (
          <input
            type="text"
            value={value || parameter.defaultValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {parameter.label}
        {parameter.required && <span className="text-red-500 ml-1">*</span>}
        {parameter.unit && <span className="text-gray-500 ml-1">({parameter.unit})</span>}
      </label>
      
      {parameter.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {parameter.description}
        </p>
      )}
      
      {renderInput()}
      
      {parameter.type === 'number' && (parameter.min !== undefined || parameter.max !== undefined) && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Range: {parameter.min || '∞'} - {parameter.max || '∞'}
        </div>
      )}
    </div>
  )
}

export default ParameterInput
