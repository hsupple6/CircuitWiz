import { useState, type ReactNode } from 'react'
import type {
  BoostDriverConfig,
  ChargerDriverConfig,
  ChargerProtectionConfig,
  EscDriverConfig,
  FixedRegulatorConfig,
  LevelIndicatorConfig,
  LiIonPackConfig,
  ModuleConfigKind,
  ModuleConfigSettings,
  PowerDriverConfig,
  UsbPdDecoyConfig,
  WirelessChargerConfig,
} from '../modules/moduleConfigKind'
import {
  formatLiIonCapacityMah,
  formatLiIonPackTopology,
  liIonPackNominalVoltage,
  liIonPackTotalCapacityMah,
} from '../modules/moduleConfigKind'

interface ModuleConfigSelectorProps {
  kind: ModuleConfigKind
  currentSettings: ModuleConfigSettings
  onApply: (settings: ModuleConfigSettings) => void
  onClose: () => void
}

const CELL_OPTIONS = [1, 2, 3, 4, 6].map((n) => ({ value: n, label: `${n}S` }))
const LI_ION_PACK_PRESETS: Array<{ series: number; parallel: number; label: string }> = [
  { series: 1, parallel: 1, label: '1S' },
  { series: 2, parallel: 1, label: '2S' },
  { series: 3, parallel: 1, label: '3S' },
  { series: 4, parallel: 1, label: '4S' },
  { series: 6, parallel: 1, label: '6S' },
  { series: 2, parallel: 2, label: '2S2P' },
  { series: 3, parallel: 2, label: '3S2P' },
  { series: 4, parallel: 2, label: '4S2P' },
  { series: 6, parallel: 2, label: '6S2P' },
  { series: 3, parallel: 3, label: '3S3P' },
  { series: 4, parallel: 4, label: '4S4P' },
  { series: 12, parallel: 3, label: '12S3P' },
]
const LI_ION_CELL_MAH = [1200, 1500, 2000, 2200, 2500, 3000, 3500, 5000, 10000].map((n) => ({
  value: n,
  label: `${n} mAh`,
}))
const ESC_AMPS = [20, 30, 40, 50, 60, 80, 100, 120].map((n) => ({ value: n, label: `${n}A` }))
const ESC_CELLS = [2, 3, 4, 6, 8, 12].map((n) => ({ value: n, label: `${n}S` }))
const BUCK_VOUT = [3.3, 5, 9, 12, 24].map((n) => ({ value: n, label: `${n}V` }))
const LDO_VOUT = [1.8, 2.5, 3.3, 5, 6, 9, 12, 15].map((n) => ({ value: n, label: `${n}V` }))
const POWER_W = [5, 10, 15, 20, 24].map((n) => ({ value: n, label: `${n}W` }))
const BOOST_VOUT = [5, 9, 12, 24].map((n) => ({ value: n, label: `${n}V` }))
const BOOST_AMPS = [0.5, 1, 2, 3, 5].map((n) => ({ value: n, label: `${n}A` }))
const PD_VOLTAGES = [5, 9, 12, 15, 20].map((n) => ({ value: n, label: `${n}V` }))
const PD_POWER = [18, 24, 36, 45, 65].map((n) => ({ value: n, label: `${n}W` }))

function OptionGrid({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string
  options: Array<{ value: number; label: string }>
  selected: number
  onSelect: (value: number) => void
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`rounded border px-2 py-2 text-sm transition-colors ${
              selected === opt.value
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (!Number.isFinite(next)) return
          onChange(Math.min(max, Math.max(min, next)))
        }}
        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />
    </label>
  )
}

function FixedRegulatorConfigPanel({
  settings,
  onChange,
}: {
  settings: FixedRegulatorConfig
  onChange: (next: FixedRegulatorConfig) => void
}) {
  const matchesPreset = LDO_VOUT.some((opt) => opt.value === settings.outputVoltage)
  const [customMode, setCustomMode] = useState(!matchesPreset)

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Output voltage
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {LDO_VOUT.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setCustomMode(false)
                onChange({ outputVoltage: opt.value })
              }}
              className={`rounded border px-2 py-2 text-sm transition-colors ${
                settings.outputVoltage === opt.value && !customMode
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            className={`rounded border px-2 py-2 text-sm transition-colors ${
              customMode
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
            }`}
          >
            Custom
          </button>
        </div>
      </div>
      {customMode && (
        <NumberField
          label="Custom voltage (V)"
          value={settings.outputVoltage}
          min={0.8}
          max={24}
          step={0.1}
          onChange={(outputVoltage) => onChange({ outputVoltage })}
        />
      )}
    </div>
  )
}

function LiIonPackConfigPanel({
  settings,
  onChange,
}: {
  settings: LiIonPackConfig
  onChange: (next: LiIonPackConfig) => void
}) {
  const topology = formatLiIonPackTopology(settings.seriesCells, settings.parallelCount)
  const matchesPreset = LI_ION_PACK_PRESETS.some(
    (p) => p.series === settings.seriesCells && p.parallel === settings.parallelCount
  )
  const [customMode, setCustomMode] = useState(!matchesPreset)
  const [customCapacity, setCustomCapacity] = useState(
    !LI_ION_CELL_MAH.some((o) => o.value === settings.cellCapacityMah)
  )

  const totalMah = liIonPackTotalCapacityMah(settings.cellCapacityMah, settings.parallelCount)
  const nominalV = liIonPackNominalVoltage(settings.seriesCells)

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Pack layout
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {LI_ION_PACK_PRESETS.map((preset) => {
            const selected =
              settings.seriesCells === preset.series && settings.parallelCount === preset.parallel
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setCustomMode(false)
                  onChange({
                    ...settings,
                    seriesCells: preset.series,
                    parallelCount: preset.parallel,
                  })
                }}
                className={`rounded border px-2 py-2 text-sm transition-colors ${
                  selected && !customMode
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            className={`rounded border px-2 py-2 text-sm transition-colors ${
              customMode
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {customMode && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Series (S)"
            value={settings.seriesCells}
            min={1}
            max={24}
            onChange={(seriesCells) => onChange({ ...settings, seriesCells })}
          />
          <NumberField
            label="Parallel (P)"
            value={settings.parallelCount}
            min={1}
            max={12}
            onChange={(parallelCount) => onChange({ ...settings, parallelCount })}
          />
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Cell capacity
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {LI_ION_CELL_MAH.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setCustomCapacity(false)
                onChange({ ...settings, cellCapacityMah: opt.value })
              }}
              className={`rounded border px-2 py-2 text-sm transition-colors ${
                settings.cellCapacityMah === opt.value && !customCapacity
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomCapacity(true)}
            className={`rounded border px-2 py-2 text-sm transition-colors ${
              customCapacity
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
            }`}
          >
            Custom
          </button>
        </div>
        {customCapacity && (
          <div className="mt-2">
            <NumberField
              label="Per-cell capacity (mAh)"
              value={settings.cellCapacityMah}
              min={100}
              max={100000}
              step={50}
              onChange={(cellCapacityMah) => onChange({ ...settings, cellCapacityMah })}
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200">
        <div className="font-medium">{topology}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {nominalV.toFixed(1)} V nominal · {formatLiIonCapacityMah(totalMah)} pack
        </div>
      </div>
    </div>
  )
}

export function ModuleConfigSelector({
  kind,
  currentSettings,
  onApply,
  onClose,
}: ModuleConfigSelectorProps) {
  const [settings, setSettings] = useState<ModuleConfigSettings>(currentSettings)

  const handleApply = () => {
    onApply(settings)
    onClose()
  }

  let body: ReactNode = null

  if (kind === 'liIonPack') {
    body = (
      <LiIonPackConfigPanel
        settings={settings as LiIonPackConfig}
        onChange={(next) => setSettings(next)}
      />
    )
  } else if (kind === 'chargerProtection' || kind === 'levelIndicator') {
    const s = settings as ChargerProtectionConfig | LevelIndicatorConfig
    body = (
      <OptionGrid
        label="Cell count"
        options={CELL_OPTIONS}
        selected={s.cellCount}
        onSelect={(cellCount) => setSettings({ cellCount })}
      />
    )
  } else if (kind === 'escDriver') {
    const s = settings as EscDriverConfig
    body = (
      <>
        <OptionGrid
          label="Current rating"
          options={ESC_AMPS}
          selected={s.maxCurrent}
          onSelect={(maxCurrent) => setSettings({ ...s, maxCurrent })}
        />
        <OptionGrid
          label="Battery rating"
          options={ESC_CELLS}
          selected={s.maxCells}
          onSelect={(maxCells) => setSettings({ ...s, maxCells })}
        />
      </>
    )
  } else if (kind === 'powerDriver') {
    const s = settings as PowerDriverConfig
    body = (
      <>
        <OptionGrid
          label="Output voltage"
          options={BUCK_VOUT}
          selected={s.outputVoltage}
          onSelect={(outputVoltage) => setSettings({ ...s, outputVoltage })}
        />
        <OptionGrid
          label="Power rating"
          options={POWER_W}
          selected={s.maxPowerW}
          onSelect={(maxPowerW) => setSettings({ ...s, maxPowerW })}
        />
      </>
    )
  } else if (kind === 'boostDriver') {
    const s = settings as BoostDriverConfig
    body = (
      <>
        <OptionGrid
          label="Output voltage"
          options={BOOST_VOUT}
          selected={s.outputVoltage}
          onSelect={(outputVoltage) => setSettings({ ...s, outputVoltage })}
        />
        <OptionGrid
          label="Max current"
          options={BOOST_AMPS}
          selected={s.maxCurrent}
          onSelect={(maxCurrent) => setSettings({ ...s, maxCurrent })}
        />
      </>
    )
  } else if (kind === 'chargerDriver') {
    const s = settings as ChargerDriverConfig
    body = (
      <>
        <OptionGrid
          label="Charge power"
          options={POWER_W}
          selected={s.maxPowerW}
          onSelect={(maxPowerW) => setSettings({ ...s, maxPowerW })}
        />
        <OptionGrid
          label="Aux output (buck)"
          options={BUCK_VOUT}
          selected={s.outputVoltage}
          onSelect={(outputVoltage) => setSettings({ ...s, outputVoltage })}
        />
      </>
    )
  } else if (kind === 'fixedRegulator') {
    body = (
      <FixedRegulatorConfigPanel
        settings={settings as FixedRegulatorConfig}
        onChange={(next) => setSettings(next)}
      />
    )
  } else if (kind === 'wirelessCharger') {
    const s = settings as WirelessChargerConfig
    body = (
      <OptionGrid
        label="TX power"
        options={POWER_W.filter((o) => o.value <= 15)}
        selected={s.maxPowerW}
        onSelect={(maxPowerW) => setSettings({ maxPowerW })}
      />
    )
  } else if (kind === 'usbPdDecoy') {
    const s = settings as UsbPdDecoyConfig
    body = (
      <>
        <OptionGrid
          label="Negotiated voltage"
          options={PD_VOLTAGES}
          selected={s.pdProfile}
          onSelect={(pdProfile) => setSettings({ ...s, pdProfile })}
        />
        <OptionGrid
          label="Power class"
          options={PD_POWER}
          selected={s.maxPowerW}
          onSelect={(maxPowerW) => setSettings({ ...s, maxPowerW })}
        />
      </>
    )
  }

  return (
    <div className="space-y-4">
      {body}
      <div className="flex gap-2 border-t border-gray-300 pt-4 dark:border-gray-600">
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 rounded bg-blue-500 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-600"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded bg-gray-500 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
