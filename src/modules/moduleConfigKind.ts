import type { ModuleDefinition } from './types'
import { resolveLogicModule } from './core/logicModule'

export type ModuleConfigKind =
  | 'liIonPack'
  | 'chargerProtection'
  | 'escDriver'
  | 'powerDriver'
  | 'boostDriver'
  | 'chargerDriver'
  | 'wirelessCharger'
  | 'usbPdDecoy'
  | 'levelIndicator'
  | 'fixedRegulator'

export interface LiIonPackConfig {
  seriesCells: number
  parallelCount: number
  /** Capacity of one cell (mAh); pack total = cell × parallel */
  cellCapacityMah: number
}

export const LI_ION_CELL_NOMINAL_V = 3.7

export function formatLiIonPackTopology(seriesCells: number, parallelCount: number): string {
  const s = Math.max(1, Math.round(seriesCells))
  const p = Math.max(1, Math.round(parallelCount))
  return p > 1 ? `${s}S${p}P` : `${s}S`
}

export function liIonPackNominalVoltage(seriesCells: number, perCell = LI_ION_CELL_NOMINAL_V): number {
  return Math.max(1, Math.round(seriesCells)) * perCell
}

export function liIonPackTotalCapacityMah(cellCapacityMah: number, parallelCount: number): number {
  return Math.max(1, Math.round(cellCapacityMah)) * Math.max(1, Math.round(parallelCount))
}

export function formatLiIonCapacityMah(mah: number): string {
  if (mah >= 1000) {
    const ah = mah / 1000
    return Number.isInteger(ah) ? `${ah} Ah` : `${ah.toFixed(1)} Ah`
  }
  return `${mah} mAh`
}

export interface ChargerProtectionConfig {
  cellCount: number
}

export interface EscDriverConfig {
  maxCurrent: number
  maxCells: number
}

export interface PowerDriverConfig {
  outputVoltage: number
  maxPowerW: number
}

export interface BoostDriverConfig {
  outputVoltage: number
  maxCurrent: number
}

export interface ChargerDriverConfig {
  maxPowerW: number
  outputVoltage: number
}

export interface WirelessChargerConfig {
  maxPowerW: number
}

export interface UsbPdDecoyConfig {
  pdProfile: number
  maxPowerW: number
}

export interface LevelIndicatorConfig {
  cellCount: number
}

export interface FixedRegulatorConfig {
  outputVoltage: number
}

export type ModuleConfigSettings =
  | LiIonPackConfig
  | ChargerProtectionConfig
  | EscDriverConfig
  | PowerDriverConfig
  | BoostDriverConfig
  | ChargerDriverConfig
  | WirelessChargerConfig
  | UsbPdDecoyConfig
  | LevelIndicatorConfig
  | FixedRegulatorConfig

export function getModuleConfigKind(
  definition: Pick<ModuleDefinition, 'module' | 'logicModule'> | null | undefined
): ModuleConfigKind | null {
  if (!definition) return null
  switch (resolveLogicModule(definition)) {
    case 'LiIonPack':
      return 'liIonPack'
    case 'ChargerProtection':
      return 'chargerProtection'
    case 'EscDriver':
      return 'escDriver'
    case 'PowerDriver':
      return 'powerDriver'
    case 'BoostDriver':
      return 'boostDriver'
    case 'ChargerDriver':
      return 'chargerDriver'
    case 'WirelessCharger':
      return 'wirelessCharger'
    case 'UsbPdDecoy':
      return 'usbPdDecoy'
    case 'LevelIndicator':
      return 'levelIndicator'
    case 'FixedRegulator':
      return 'fixedRegulator'
    default:
      return null
  }
}

function numProp(props: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const raw = props?.[key]
  if (raw && typeof raw === 'object' && 'default' in raw) {
    return Number((raw as { default: number }).default) || fallback
  }
  if (typeof raw === 'number') return raw
  return fallback
}

export function readModuleConfig(
  kind: ModuleConfigKind,
  definition: { properties?: ModuleDefinition['properties'] }
): ModuleConfigSettings {
  const props = definition.properties as Record<string, unknown> | undefined
  switch (kind) {
    case 'liIonPack': {
      const seriesCells = numProp(props, 'seriesCells', numProp(props, 'cellCount', 1))
      const parallelCount = Math.max(1, numProp(props, 'parallelCount', 1))
      const totalAh = numProp(props, 'capacityAh', 2.2)
      const cellCapacityMah = Math.max(
        100,
        Math.round(
          numProp(props, 'cellCapacityMah', 0) ||
            (totalAh * 1000) / parallelCount
        )
      )
      return { seriesCells, parallelCount, cellCapacityMah }
    }
    case 'chargerProtection':
      return { cellCount: numProp(props, 'cellCount', 1) }
    case 'escDriver':
      return {
        maxCurrent: numProp(props, 'maxCurrent', 30),
        maxCells: numProp(props, 'maxCells', 3),
      }
    case 'powerDriver':
      return {
        outputVoltage: numProp(props, 'outputVoltage', 5),
        maxPowerW: numProp(props, 'maxPowerW', 10),
      }
    case 'boostDriver':
      return {
        outputVoltage: numProp(props, 'outputVoltage', 12),
        maxCurrent: numProp(props, 'maxCurrent', 1),
      }
    case 'chargerDriver':
      return {
        maxPowerW: numProp(props, 'maxPowerW', 10),
        outputVoltage: numProp(props, 'outputVoltage', 5),
      }
    case 'wirelessCharger':
      return { maxPowerW: numProp(props, 'maxPowerW', 10) }
    case 'usbPdDecoy':
      return {
        pdProfile: numProp(props, 'pdProfile', 9),
        maxPowerW: numProp(props, 'maxPowerW', 18),
      }
    case 'levelIndicator':
      return { cellCount: numProp(props, 'cellCount', 1) }
    case 'fixedRegulator':
      return { outputVoltage: numProp(props, 'outputVoltage', 3.3) }
  }
}

export function applyModuleConfig(
  module: ModuleDefinition,
  kind: ModuleConfigKind,
  settings: ModuleConfigSettings
): ModuleDefinition {
  const props = { ...(module.properties ?? {}) } as Record<string, { default?: number | string }>

  switch (kind) {
    case 'liIonPack': {
      const s = settings as LiIonPackConfig
      const series = Math.max(1, Math.round(s.seriesCells))
      const parallel = Math.max(1, Math.round(s.parallelCount))
      const cellMah = Math.max(100, Math.round(s.cellCapacityMah))
      const totalAh = (cellMah * parallel) / 1000
      if (props.seriesCells) props.seriesCells.default = series
      if (props.parallelCount) props.parallelCount.default = parallel
      if (props.cellCount) props.cellCount.default = series
      if (props.cellCapacityMah) props.cellCapacityMah.default = cellMah
      if (props.capacityAh) props.capacityAh.default = totalAh
      break
    }
    case 'chargerProtection': {
      const s = settings as ChargerProtectionConfig
      if (props.cellCount) props.cellCount.default = s.cellCount
      break
    }
    case 'escDriver': {
      const s = settings as EscDriverConfig
      if (props.maxCurrent) props.maxCurrent.default = s.maxCurrent
      if (props.maxCells) props.maxCells.default = s.maxCells
      if (props.maxVoltage) props.maxVoltage.default = Math.round(s.maxCells * 4.2 * 10) / 10
      break
    }
    case 'powerDriver': {
      const s = settings as PowerDriverConfig
      if (props.outputVoltage) props.outputVoltage.default = s.outputVoltage
      if (props.maxPowerW) props.maxPowerW.default = s.maxPowerW
      break
    }
    case 'boostDriver': {
      const s = settings as BoostDriverConfig
      if (props.outputVoltage) props.outputVoltage.default = s.outputVoltage
      if (props.maxCurrent) props.maxCurrent.default = s.maxCurrent
      break
    }
    case 'chargerDriver': {
      const s = settings as ChargerDriverConfig
      if (props.maxPowerW) props.maxPowerW.default = s.maxPowerW
      if (props.outputVoltage) props.outputVoltage.default = s.outputVoltage
      break
    }
    case 'wirelessCharger': {
      const s = settings as WirelessChargerConfig
      if (props.maxPowerW) props.maxPowerW.default = s.maxPowerW
      break
    }
    case 'usbPdDecoy': {
      const s = settings as UsbPdDecoyConfig
      if (props.pdProfile) props.pdProfile.default = s.pdProfile
      if (props.maxPowerW) props.maxPowerW.default = s.maxPowerW
      break
    }
    case 'levelIndicator': {
      const s = settings as LevelIndicatorConfig
      if (props.cellCount) props.cellCount.default = s.cellCount
      break
    }
    case 'fixedRegulator': {
      const s = settings as FixedRegulatorConfig
      if (props.outputVoltage) props.outputVoltage.default = s.outputVoltage
      break
    }
  }

  return { ...module, properties: props } as ModuleDefinition
}

export function moduleConfigSelectorTitle(
  kind: ModuleConfigKind,
  displayName?: string
): string {
  const name = displayName ?? 'module'
  switch (kind) {
    case 'liIonPack':
      return `Configure ${name}`
    case 'chargerProtection':
      return `Configure ${name}`
    case 'escDriver':
      return `Configure ${name}`
    case 'powerDriver':
      return `Configure ${name}`
    case 'boostDriver':
      return `Configure ${name}`
    case 'chargerDriver':
      return `Configure ${name}`
    case 'wirelessCharger':
      return `Configure ${name}`
    case 'usbPdDecoy':
      return `Configure ${name}`
    case 'levelIndicator':
      return `Configure ${name}`
    case 'fixedRegulator':
      return `Configure ${name}`
  }
}
