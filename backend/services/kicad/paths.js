const path = require('path')
const fs = require('fs-extra')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const PUBLIC_DIR = path.join(REPO_ROOT, 'public')
const SYMBOLS_DIR = path.join(PUBLIC_DIR, 'kicad-symbols')
const FOOTPRINT_CACHE_DIR = path.join(REPO_ROOT, 'backend', 'data', 'footprint-cache')
const SYMBOL_CACHE_DIR = path.join(REPO_ROOT, 'backend', 'data', 'symbol-cache')

const KICAD_SYMBOLS_RAW =
  'https://gitlab.com/kicad/libraries/kicad-symbols/-/raw/master'
const DATASHEET_INDEX_PATH = path.join(PUBLIC_DIR, 'datasheet-index.json')
const MODULE_MAP_PATH = path.join(PUBLIC_DIR, 'kicad-module-map.json')

const KICAD_FOOTPRINTS_RAW =
  'https://raw.githubusercontent.com/kicad/kicad-footprints/master'

/** Default footprints when symbol metadata has no Footprint field. */
const DEFAULT_FOOTPRINT_BY_SYMBOL = {
  'Device/LED': 'LED_SMD:LED_0805_2012Metric',
  'Device/R': 'Resistor_SMD:R_0805_2012Metric',
  'Device/R_US': 'Resistor_SMD:R_0805_2012Metric',
  'Device/C': 'Capacitor_SMD:C_0805_2012Metric',
  'Device/L': 'Inductor_SMD:L_0805_2012Metric',
  'Device/D': 'Diode_SMD:D_SOD-123',
  'Device/D_Zener': 'Diode_SMD:D_SOD-123',
  'Device/Q_NPN': 'Package_TO_SOT_SMD:SOT-23',
  'Device/Q_PNP': 'Package_TO_SOT_SMD:SOT-23',
  'Device/Q_NMOS': 'Package_TO_SOT_SMD:SOT-23',
  'Device/Q_PMOS': 'Package_TO_SOT_SMD:SOT-23',
  'Amplifier_Operational/LM358': 'Package_DIP:DIP-8_W7.62mm',
  'Switch/SW_SPST': 'Button_Switch_SMD:SW_SPST_CK_RS282G05A3',
  'Switch/SW_Push': 'Button_Switch_SMD:SW_SPST_CK_RS282G05A3',
}

const DEFAULT_FOOTPRINT_BY_MODULE = {
  LED: 'LED_SMD:LED_0805_2012Metric',
  RGBLED: 'LED_SMD:LED_0805_2012Metric',
  Resistor: 'Resistor_SMD:R_0805_2012Metric',
  Capacitor: 'Capacitor_SMD:C_0805_2012Metric',
  Inductor: 'Inductor_SMD:L_0805_2012Metric',
  Diode: 'Diode_SMD:D_SOD-123',
  ZenerDiode: 'Diode_SMD:D_SOD-123',
  NPNTransistor: 'Package_TO_SOT_SMD:SOT-23',
  PNPTransistor: 'Package_TO_SOT_SMD:SOT-23',
  MOSFET: 'Package_TO_SOT_SMD:SOT-23',
  PMOSFET: 'Package_TO_SOT_SMD:SOT-23',
  OpAmp: 'Package_DIP:DIP-8_W7.62mm',
  Switch: 'Button_Switch_SMD:SW_SPST_CK_RS282G05A3',
  'Push Button': 'Button_Switch_SMD:SW_SPST_CK_RS282G05A3',
}

function splitFootprintRef(ref) {
  if (!ref || typeof ref !== 'string') return null
  const trimmed = ref.trim()
  if (!trimmed) return null
  const colon = trimmed.indexOf(':')
  if (colon === -1) return null
  return {
    library: trimmed.slice(0, colon),
    name: trimmed.slice(colon + 1),
  }
}

function footprintCachePath(library, name) {
  return path.join(FOOTPRINT_CACHE_DIR, library, `${name}.kicad_mod`)
}

function footprintRemoteUrl(library, name) {
  return `${KICAD_FOOTPRINTS_RAW}/${library}.pretty/${name}.kicad_mod`
}

function symbolCachePath(symbolPath) {
  return path.join(SYMBOL_CACHE_DIR, symbolPath)
}

/** Device/Q_NPN.kicad_sym → GitLab symdir URL */
function symbolRemoteUrl(symbolPath) {
  const parts = symbolPath.split('/')
  const fileName = parts.pop()
  const library = parts.join('/')
  const symdir = library ? `${library}.kicad_symdir` : 'Device.kicad_symdir'
  return `${KICAD_SYMBOLS_RAW}/${symdir}/${fileName}`
}

async function ensureDirs() {
  await fs.ensureDir(FOOTPRINT_CACHE_DIR)
  await fs.ensureDir(SYMBOL_CACHE_DIR)
}

module.exports = {
  REPO_ROOT,
  PUBLIC_DIR,
  SYMBOLS_DIR,
  FOOTPRINT_CACHE_DIR,
  SYMBOL_CACHE_DIR,
  DATASHEET_INDEX_PATH,
  MODULE_MAP_PATH,
  KICAD_FOOTPRINTS_RAW,
  KICAD_SYMBOLS_RAW,
  DEFAULT_FOOTPRINT_BY_SYMBOL,
  DEFAULT_FOOTPRINT_BY_MODULE,
  splitFootprintRef,
  footprintCachePath,
  footprintRemoteUrl,
  symbolCachePath,
  symbolRemoteUrl,
  ensureDirs,
}
