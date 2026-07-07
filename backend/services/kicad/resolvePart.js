const {
  DEFAULT_FOOTPRINT_BY_SYMBOL,
  DEFAULT_FOOTPRINT_BY_MODULE,
  splitFootprintRef,
} = require('./paths')
const { loadSymbol } = require('./symbolParser')
const { loadFootprint } = require('./footprintLoader')
const { renderFootprintSvg } = require('./footprintSvg')
const { loadSymbolSvg } = require('./symbolSvg')
const {
  loadDatasheetIndex,
  loadModuleMap,
  entryByPath,
  searchEntries,
} = require('./libraryIndex')

function normalizeDatasheetUrl(url) {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function resolveFootprintRef(symbolPath, moduleName, properties, indexEntry) {
  const candidates = [
    properties.footprint,
    indexEntry?.footprint,
    DEFAULT_FOOTPRINT_BY_SYMBOL[symbolPath.replace('.kicad_sym', '')],
    DEFAULT_FOOTPRINT_BY_SYMBOL[symbolPath],
    DEFAULT_FOOTPRINT_BY_MODULE[moduleName],
  ]
  for (const candidate of candidates) {
    const split = splitFootprintRef(candidate)
    if (split) return { ref: `${split.library}:${split.name}`, ...split }
  }
  return null
}

async function resolvePartBySymbolPath(symbolPath, moduleName = '') {
  const index = await loadDatasheetIndex()
  const indexEntry = entryByPath(index.entries, symbolPath)
  const symbol = await loadSymbol(symbolPath)
  const footprintRef = resolveFootprintRef(symbolPath, moduleName, symbol.properties, indexEntry)

  let footprint = null
  let footprintSvg = null
  let footprintError = null
  if (footprintRef) {
    try {
      footprint = await loadFootprint(footprintRef.library, footprintRef.name)
      footprintSvg = renderFootprintSvg(footprint)
    } catch (error) {
      footprintError = error.message
    }
  }

  const symbolSvg = await loadSymbolSvg(symbolPath)

  const datasheet = normalizeDatasheetUrl(symbol.properties.datasheet || indexEntry?.datasheet || '')
  const name = moduleName || symbol.properties.value || symbol.symbolName
  const id = indexEntry?.id ?? symbolPath.replace('.kicad_sym', '')

  return {
    id,
    name,
    moduleName: moduleName || symbol.symbolName,
    symbolPath,
    symbolIdStr: `${symbolPath.replace('.kicad_sym', '').replace('/', ':')}`,
    description: symbol.properties.description || indexEntry?.description || '',
    keywords: symbol.properties.keywords || indexEntry?.keywords || '',
    datasheet,
    footprint: footprintRef?.ref ?? '',
    footprintName: footprint?.name ?? footprintRef?.name ?? '',
    footprintDescription: footprint?.description ?? '',
    footprintPadCount: footprint?.pads?.length ?? 0,
    footprintPads: footprint?.pads ?? [],
    footprintSvg,
    footprintError,
    symbolSvg,
    pins: symbol.pins,
    properties: symbol.properties,
    source: indexEntry?.source ?? 'bundled',
  }
}

async function resolvePartByModuleName(moduleName) {
  const moduleMap = await loadModuleMap()
  const symbolPath = moduleMap[moduleName]
  if (!symbolPath) {
    const index = await loadDatasheetIndex()
    const matches = searchEntries(index.entries, moduleName, 1)
    if (matches.length > 0) {
      return resolvePartBySymbolPath(matches[0].path, moduleName)
    }
    throw new Error(`No KiCad symbol mapping for module: ${moduleName}`)
  }
  return resolvePartBySymbolPath(symbolPath, moduleName)
}

async function resolvePartById(partId) {
  const index = await loadDatasheetIndex()
  const entry = index.entries.find((e) => e.id === partId)
  if (!entry) throw new Error(`Unknown part id: ${partId}`)
  return resolvePartBySymbolPath(entry.path, entry.symbol)
}

function toKicadHttpPart(part) {
  return {
    id: part.id,
    name: part.name,
    symbolIdStr: part.symbolIdStr,
    exclude_from_bom: 'False',
    exclude_from_board: 'False',
    exclude_from_sim: 'False',
    fields: {
      footprint: { value: part.footprint, visible: 'False' },
      datasheet: { value: part.datasheet, visible: 'False' },
      value: { value: part.name },
      reference: { value: part.properties.reference || 'U' },
      description: { value: part.description, visible: 'False' },
      keywords: { value: part.keywords, visible: 'False' },
    },
    circuitwiz: {
      symbolPath: part.symbolPath,
      symbolSvg: part.symbolSvg,
      footprintSvg: part.footprintSvg,
      footprintPads: part.footprintPads,
      footprintDescription: part.footprintDescription,
      footprintError: part.footprintError,
      pins: part.pins,
    },
  }
}

module.exports = {
  resolvePartByModuleName,
  resolvePartById,
  resolvePartBySymbolPath,
  toKicadHttpPart,
}
