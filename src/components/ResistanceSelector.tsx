import { useState } from 'react'

interface ResistanceSelectorProps {
  currentResistance: number
  onResistanceChange: (resistance: number) => void
  onClose: () => void
}

const commonResistances = [
  { value: 10, label: '10Ω' },
  { value: 22, label: '22Ω' },
  { value: 47, label: '47Ω' },
  { value: 100, label: '100Ω' },
  { value: 220, label: '220Ω' },
  { value: 470, label: '470Ω' },
  { value: 1000, label: '1kΩ' },
  { value: 2200, label: '2.2kΩ' },
  { value: 4700, label: '4.7kΩ' },
  { value: 10000, label: '10kΩ' },
  { value: 22000, label: '22kΩ' },
  { value: 47000, label: '47kΩ' },
  { value: 100000, label: '100kΩ' },
  { value: 220000, label: '220kΩ' },
  { value: 470000, label: '470kΩ' },
  { value: 1000000, label: '1MΩ' },
  { value: 2200000, label: '2.2MΩ' },
  { value: 4700000, label: '4.7MΩ' },
  { value: 10000000, label: '10MΩ' }
]

export function ResistanceSelector({ 
  currentResistance, 
  onResistanceChange, 
  onClose 
}: ResistanceSelectorProps) {
  const [customValue, setCustomValue] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const handleResistanceSelect = (resistance: number) => {
    onResistanceChange(resistance)
    onClose()
  }

  const handleCustomSubmit = () => {
    const value = parseFloat(customValue)
    if (!isNaN(value) && value > 0) {
      onResistanceChange(value)
      onClose()
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {commonResistances.map((resistance) => (
          <button
            key={resistance.value}
            onClick={() => handleResistanceSelect(resistance.value)}
            className={`px-3 py-2 text-sm rounded border transition-colors ${
              currentResistance === resistance.value
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {resistance.label}
          </button>
        ))}
      </div>
      
      {/* Custom resistance input */}
      <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
        <button
          onClick={() => setShowCustomInput(!showCustomInput)}
          className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {showCustomInput ? 'Hide Custom Input' : 'Custom Value'}
        </button>
        
        {showCustomInput && (
          <div className="mt-2 space-y-2">
            <input
              type="number"
              placeholder="Enter resistance value"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              min="0.1"
              step="0.1"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCustomSubmit}
                className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setShowCustomInput(false)}
                className="flex-1 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Current: {currentResistance >= 1000 ? `${(currentResistance / 1000).toFixed(1)}kΩ` : `${currentResistance}Ω`}
        </p>
      </div>
    </div>
  )
}
