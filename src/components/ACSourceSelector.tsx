import { useState } from 'react'
import {
  ACWaveform,
  AC_WAVEFORM_LABELS,
  ACSourceSettings,
  formatACFrequency,
  formatACVoltage,
} from '../utils/acSourceVisual'
import { ACWaveformPreview } from './ACWaveformPreview'

interface ACSourceSelectorProps {
  currentSettings: ACSourceSettings
  onApply: (settings: ACSourceSettings) => void
  onClose: () => void
}

const commonVrms = [
  { value: 5, label: '5Vrms' },
  { value: 12, label: '12Vrms' },
  { value: 24, label: '24Vrms' },
  { value: 120, label: '120Vrms' },
]

const commonFrequencies = [
  { value: 50, label: '50Hz' },
  { value: 60, label: '60Hz' },
  { value: 400, label: '400Hz' },
  { value: 1000, label: '1kHz' },
]

const waveforms: ACWaveform[] = ['sine', 'square', 'triangle', 'sawtooth']

export function ACSourceSelector({ currentSettings, onApply, onClose }: ACSourceSelectorProps) {
  const [settings, setSettings] = useState<ACSourceSettings>(currentSettings)
  const [customVrms, setCustomVrms] = useState('')
  const [customFrequency, setCustomFrequency] = useState('')
  const [showCustomVrms, setShowCustomVrms] = useState(false)
  const [showCustomFrequency, setShowCustomFrequency] = useState(false)

  const vrmsMatches = (a: number, b: number) => Math.abs(a - b) < 0.05
  const freqMatches = (a: number, b: number) => Math.abs(a - b) < 0.5

  const handleApply = () => {
    onApply(settings)
    onClose()
  }

  return (
    <div className="space-y-4">
      <ACWaveformPreview
        waveform={settings.waveform}
        vrms={settings.vrms}
        frequency={settings.frequency}
        className="h-36 w-full"
      />

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Waveform
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {waveforms.map((wf) => (
            <button
              key={wf}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, waveform: wf }))}
              className={`px-2 py-2 text-xs font-semibold rounded border transition-colors ${
                settings.waveform === wf
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {AC_WAVEFORM_LABELS[wf]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          RMS voltage
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {commonVrms.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, vrms: item.value }))}
              className={`px-3 py-2 text-sm rounded border transition-colors ${
                vrmsMatches(settings.vrms, item.value)
                  ? 'bg-emerald-500 text-white border-emerald-500'
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
            onClick={() => setShowCustomVrms(!showCustomVrms)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {showCustomVrms ? 'Hide custom voltage' : 'Custom Vrms'}
          </button>
          {showCustomVrms && (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                placeholder="Vrms"
                value={customVrms}
                onChange={(e) => setCustomVrms(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                min="0.1"
                step="0.1"
              />
              <button
                type="button"
                onClick={() => {
                  const v = parseFloat(customVrms)
                  if (!Number.isNaN(v) && v > 0) setSettings((s) => ({ ...s, vrms: v }))
                }}
                className="px-3 py-2 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Set
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-300 dark:border-gray-600 pt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Frequency
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {commonFrequencies.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, frequency: item.value }))}
              className={`px-3 py-2 text-sm rounded border transition-colors ${
                freqMatches(settings.frequency, item.value)
                  ? 'bg-emerald-500 text-white border-emerald-500'
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
            onClick={() => setShowCustomFrequency(!showCustomFrequency)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {showCustomFrequency ? 'Hide custom frequency' : 'Custom frequency (Hz)'}
          </button>
          {showCustomFrequency && (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                placeholder="Hz"
                value={customFrequency}
                onChange={(e) => setCustomFrequency(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                min="1"
                step="1"
              />
              <button
                type="button"
                onClick={() => {
                  const f = parseFloat(customFrequency)
                  if (!Number.isNaN(f) && f > 0) setSettings((s) => ({ ...s, frequency: f }))
                }}
                className="px-3 py-2 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Set
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-300 dark:border-gray-600 pt-3 space-y-3">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Selected: {AC_WAVEFORM_LABELS[settings.waveform]} · {formatACVoltage(settings.vrms)} ·{' '}
          {formatACFrequency(settings.frequency)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 px-3 py-2 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
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
