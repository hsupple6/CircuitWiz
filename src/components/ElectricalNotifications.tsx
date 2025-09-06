import React from 'react'

interface ElectricalValidation {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  componentId: string
  componentType: string
  message: string
  timestamp: number
}

interface ElectricalNotificationsProps {
  validations: ElectricalValidation[]
  onDismiss: (id: string) => void
}

export function ElectricalNotifications({ validations, onDismiss }: ElectricalNotificationsProps) {
  if (validations.length === 0) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      case 'success':
        return '✅'
      default:
        return 'ℹ️'
    }
  }

  const getColorClass = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-900/20 dark:border-gray-800 dark:text-gray-200'
    }
  }

  return (
    <div className="absolute top-20 left-4 right-4 z-50 space-y-2 max-h-96 overflow-y-auto">
      {validations.map((validation) => (
        <div
          key={validation.id}
          className={`p-3 rounded-lg border-l-4 shadow-lg ${getColorClass(validation.type)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <span className="text-lg">{getIcon(validation.type)}</span>
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {validation.componentType} ({validation.componentId.slice(-4)})
                </div>
                <div className="text-sm mt-1">
                  {validation.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => onDismiss(validation.id)}
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
