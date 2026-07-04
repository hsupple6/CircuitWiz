import { useState } from 'react'
import type { ConnectorGender } from '../modules/connectors/buildConnectorDefinition'

interface ConnectorPlacementSelectorProps {
  initialPins?: number
  initialGender?: ConnectorGender
  onApply: (pins: number, gender: ConnectorGender) => void
  onClose: () => void
}

const PIN_PRESETS = [2, 3, 4, 5, 6, 8, 10, 12, 16]

export function ConnectorPlacementSelector({
  initialPins = 2,
  initialGender = 'plug',
  onApply,
  onClose,
}: ConnectorPlacementSelectorProps) {
  const [pins, setPins] = useState(initialPins)
  const [gender, setGender] = useState<ConnectorGender>(initialGender)
  const [customPins, setCustomPins] = useState('')

  const apply = () => {
    const count = customPins.trim() ? parseInt(customPins, 10) : pins
    if (!Number.isFinite(count) || count < 2 || count > 16) return
    onApply(count, gender)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-dark-text-primary">Pin count</p>
        <div className="grid grid-cols-3 gap-2">
          {PIN_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPins(n)
                setCustomPins('')
              }}
              className={`rounded border px-3 py-2 text-sm transition-colors ${
                pins === n && !customPins
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-primary dark:hover:bg-dark-card'
              }`}
            >
              {n} pins
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            min={2}
            max={16}
            value={customPins}
            onChange={(e) => setCustomPins(e.target.value)}
            placeholder="Custom (2–16)"
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-primary"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-dark-text-primary">Connector type</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setGender('plug')}
            className={`rounded border px-3 py-3 text-sm transition-colors ${
              gender === 'plug'
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-primary dark:hover:bg-dark-card'
            }`}
          >
            <span className="block font-semibold">Plug</span>
            <span className="block text-[11px] opacity-80">Male header / pins</span>
          </button>
          <button
            type="button"
            onClick={() => setGender('socket')}
            className={`rounded border px-3 py-3 text-sm transition-colors ${
              gender === 'socket'
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-primary dark:hover:bg-dark-card'
            }`}
          >
            <span className="block font-semibold">Socket</span>
            <span className="block text-[11px] opacity-80">Female receptacle</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-dark-border">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-dark-text-muted dark:hover:bg-dark-bg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          className="rounded bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          Place on grid
        </button>
      </div>
    </div>
  )
}
