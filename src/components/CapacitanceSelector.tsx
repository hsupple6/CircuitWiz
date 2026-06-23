import { useState } from 'react'

interface CapacitanceSelectorProps {
  currentCapacitance: number
  onCapacitanceChange: (capacitance: number) => void
  onClose: () => void
}

const commonCapacitances = [
  { value: 10e-12, label: '10pF' },
  { value: 22e-12, label: '22pF' },
  { value: 47e-12, label: '47pF' },
  { value: 100e-12, label: '100pF' },
  { value: 220e-12, label: '220pF' },
  { value: 470e-12, label: '470pF' },
  { value: 1e-9, label: '1nF' },
  { value: 2.2e-9, label: '2.2nF' },
  { value: 4.7e-9, label: '4.7nF' },
  { value: 10e-9, label: '10nF' },
  { value: 22e-9, label: '22nF' },
  { value: 47e-9, label: '47nF' },
  { value: 100e-9, label: '100nF' },
  { value: 220e-9, label: '220nF' },
  { value: 470e-9, label: '470nF' },
  { value: 1e-6, label: '1µF' },
  { value: 2.2e-6, label: '2.2µF' },
  { value: 4.7e-6, label: '4.7µF' },
  { value: 10e-6, label: '10µF' },
  { value: 22e-6, label: '22µF' },
  { value: 47e-6, label: '47µF' },
  { value: 100e-6, label: '100µF' },
  { value: 220e-6, label: '220µF' },
  { value: 470e-6, label: '470µF' },
  { value: 1e-3, label: '1mF' },
]

export function formatCapacitance(farads: number): string {
  if (farads >= 1e-3) return `${(farads * 1e3).toFixed(farads >= 0.01 ? 1 : 2)}mF`
  if (farads >= 1e-6) return `${(farads * 1e6).toFixed(farads >= 1e-5 ? 1 : 2)}µF`
  if (farads >= 1e-9) return `${(farads * 1e9).toFixed(farads >= 1e-8 ? 1 : 2)}nF`
  return `${(farads * 1e12).toFixed(0)}pF`
}

export function CapacitanceSelector({
  currentCapacitance,
  onCapacitanceChange,
  onClose,
}: CapacitanceSelectorProps) {
  const [customValue, setCustomValue] = useState('')
  const [customUnit, setCustomUnit] = useState<'pF' | 'nF' | 'µF' | 'mF'>('µF')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const handleCapacitanceSelect = (capacitance: number) => {
    onCapacitanceChange(capacitance)
    onClose()
  }

  const unitToFarads = (value: number, unit: string) => {
    switch (unit) {
      case 'pF': return value * 1e-12
      case 'nF': return value * 1e-9
      case 'µF': return value * 1e-6
      case 'mF': return value * 1e-3
      default: return value
    }
  }

  const handleCustomSubmit = () => {
    const value = parseFloat(customValue)
    if (!isNaN(value) && value > 0) {
      onCapacitanceChange(unitToFarads(value, customUnit))
      onClose()
    }
  }

  const isSelected = (value: number) => Math.abs(currentCapacitance - value) < value * 0.01

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {commonCapacitances.map((capacitance) => (
          <button
            key={capacitance.label}
            onClick={() => handleCapacitanceSelect(capacitance.value)}
            className={`px-3 py-2 text-sm rounded border transition-colors ${
              isSelected(capacitance.value)
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {capacitance.label}
          </button>
        ))}
      </div>

      <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
        <button
          onClick={() => setShowCustomInput(!showCustomInput)}
          className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {showCustomInput ? 'Hide Custom Input' : 'Custom Value'}
        </button>

        {showCustomInput && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Value"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                min="0.001"
                step="any"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="pF">pF</option>
                <option value="nF">nF</option>
                <option value="µF">µF</option>
                <option value="mF">mF</option>
              </select>
            </div>
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
          Current: {formatCapacitance(currentCapacitance)}
        </p>
      </div>
    </div>
  )
}
