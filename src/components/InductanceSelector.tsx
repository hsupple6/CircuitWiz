import { useState } from 'react'

interface InductanceSelectorProps {
  currentInductance: number
  onInductanceChange: (inductance: number) => void
  onClose: () => void
}

const commonInductances = [
  { value: 1e-6, label: '1µH' },
  { value: 2.2e-6, label: '2.2µH' },
  { value: 4.7e-6, label: '4.7µH' },
  { value: 10e-6, label: '10µH' },
  { value: 22e-6, label: '22µH' },
  { value: 47e-6, label: '47µH' },
  { value: 100e-6, label: '100µH' },
  { value: 220e-6, label: '220µH' },
  { value: 470e-6, label: '470µH' },
  { value: 1e-3, label: '1mH' },
  { value: 2.2e-3, label: '2.2mH' },
  { value: 4.7e-3, label: '4.7mH' },
  { value: 10e-3, label: '10mH' },
  { value: 22e-3, label: '22mH' },
  { value: 47e-3, label: '47mH' },
  { value: 100e-3, label: '100mH' },
  { value: 220e-3, label: '220mH' },
  { value: 470e-3, label: '470mH' },
  { value: 1, label: '1H' },
]

export function formatInductance(henries: number): string {
  if (henries >= 1) return `${henries}H`
  if (henries >= 1e-3) return `${(henries * 1e3).toFixed(henries >= 0.01 ? 1 : 2)}mH`
  return `${(henries * 1e6).toFixed(henries >= 1e-5 ? 1 : 2)}µH`
}

export function InductanceSelector({
  currentInductance,
  onInductanceChange,
  onClose,
}: InductanceSelectorProps) {
  const [customValue, setCustomValue] = useState('')
  const [customUnit, setCustomUnit] = useState<'µH' | 'mH' | 'H'>('µH')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const handleInductanceSelect = (inductance: number) => {
    onInductanceChange(inductance)
    onClose()
  }

  const unitToHenries = (value: number, unit: string) => {
    switch (unit) {
      case 'µH': return value * 1e-6
      case 'mH': return value * 1e-3
      case 'H': return value
      default: return value
    }
  }

  const handleCustomSubmit = () => {
    const value = parseFloat(customValue)
    if (!isNaN(value) && value > 0) {
      onInductanceChange(unitToHenries(value, customUnit))
      onClose()
    }
  }

  const isSelected = (value: number) => Math.abs(currentInductance - value) < value * 0.01

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {commonInductances.map((inductance) => (
          <button
            key={inductance.label}
            onClick={() => handleInductanceSelect(inductance.value)}
            className={`px-3 py-2 text-sm rounded border transition-colors ${
              isSelected(inductance.value)
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {inductance.label}
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
                <option value="µH">µH</option>
                <option value="mH">mH</option>
                <option value="H">H</option>
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
          Current: {formatInductance(currentInductance)}
        </p>
      </div>
    </div>
  )
}
