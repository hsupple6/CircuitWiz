import React from 'react'
import { X } from 'lucide-react'
import ComponentConfigPanel from './ComponentConfigPanel'

interface ComponentConfigModalProps {
  isOpen: boolean
  onClose: () => void
  componentId: string
  component: {
    module: string
    parameters?: Record<string, any>
    position?: { x: number; y: number }
  }
  onParameterChange: (componentId: string, parameterName: string, value: any) => void
}

export const ComponentConfigModal: React.FC<ComponentConfigModalProps> = ({
  isOpen,
  onClose,
  componentId,
  component,
  onParameterChange
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl">
          <ComponentConfigPanel
            componentId={componentId}
            component={component}
            onClose={onClose}
            onParameterChange={onParameterChange}
            className="max-h-[90vh] overflow-y-auto"
          />
        </div>
      </div>
    </div>
  )
}

export default ComponentConfigModal
