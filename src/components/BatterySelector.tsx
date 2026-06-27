import { useState } from 'react'
import { formatBatteryCapacity, formatBatteryVoltage } from '../utils/batteryVisual'

interface BatterySelectorProps {
  currentVoltage: number
  currentCapacity: number
  onApply: (voltage: number, capacityMah: number) => void
  onClose: () => void
}

const commonVoltages = [
  { value: 1.5, label: '1.5V' },
  { value: 3.7, label: '3.7V' },
  { value: 7.4, label: '7.4V' },
  { value: 9, label: '9V' },
  { value: 11.1, label: '11.1V' },
  { value: 12, label: '12V' },
  { value: 14.8, label: '14.8V' },
  { value: 24, label: '24V' },
]

const commonCapacities = [
  { value: 500, label: '500mAh' },
  { value: 1000, label: '1000mAh' },
  { value: 1500, label: '1500mAh' },
  { value: 2000, label: '2000mAh' },
  { value: 2200, label: '2200mAh' },
  { value: 3000, label: '3000mAh' },
  { value: 5000, label: '5000mAh' },
  { value: 10000, label: '10000mAh' },
  { value: 20000, label: '20000mAh' },
]

export function BatterySelector({
  currentVoltage,
  currentCapacity,
  onApply,
  onClose,
}: BatterySelectorProps) {
  const [voltage, setVoltage] = useState(currentVoltage)
  const [capacity, setCapacity] = useState(currentCapacity)
  const [customVoltage, setCustomVoltage] = useState('')
  const [customCapacity, setCustomCapacity] = useState('')
  const [showCustomVoltage, setShowCustomVoltage] = useState(false)
  const [showCustomCapacity, setShowCustomCapacity] = useState(false)

  const voltageMatches = (a: number, b: number) => Math.abs(a - b) < 0.05
  const capacityMatches = (a: number, b: number) => Math.abs(a - b) < 1

  const handleApply = () => {
    onApply(voltage, capacity)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Nominal voltage
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {commonVoltages.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setVoltage(item.value)}
              className={`px-3 py-2 text-sm rounded border transition-colors ${
                voltageMatches(voltage, item.value)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowCustomVoltage(!showCustomVoltage)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {showCustomVoltage ? 'Hide custom voltage' : 'Custom voltage'}
          </button>
          {showCustomVoltage && (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                placeholder="Volts"
                value={customVoltage}
                onChange={(e) => setCustomVoltage(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                min="0.1"
                step="0.1"
              />
              <button
                type="button"
                onClick={() => {
                  const v = parseFloat(customVoltage)
                  if (!Number.isNaN(v) && v > 0) setVoltage(v)
                }}
                className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Set
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-300 dark:border-gray-600 pt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Capacity
        </h4>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {commonCapacities.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCapacity(item.value)}
              className={`px-3 py-2 text-sm rounded border transition-colors ${
                capacityMatches(capacity, item.value)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowCustomCapacity(!showCustomCapacity)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {showCustomCapacity ? 'Hide custom capacity' : 'Custom capacity (mAh)'}
          </button>
          {showCustomCapacity && (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                placeholder="mAh"
                value={customCapacity}
                onChange={(e) => setCustomCapacity(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                min="1"
                step="1"
              />
              <button
                type="button"
                onClick={() => {
                  const c = parseFloat(customCapacity)
                  if (!Number.isNaN(c) && c > 0) setCapacity(c)
                }}
                className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Set
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-300 dark:border-gray-600 pt-3 space-y-3">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Selected: {formatBatteryVoltage(voltage)} · {formatBatteryCapacity(capacity)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
