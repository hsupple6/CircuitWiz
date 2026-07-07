const path = require('path')
const { parse, findProperty, findAll, atom, listHead } = require('./sexpr')
const {
  loadSymbolSource,
  symbolPathForName,
  libraryDirFromSymbolPath,
  symbolNameFromPath,
} = require('./symbolLoader')

function findSymbolNode(tree, symbolName) {
  for (const node of findAll(tree, 'symbol')) {
    if (atom(node[1]) === symbolName) return node
  }
  return null
}

function parsePinNode(pinNode) {
  const pinType = atom(pinNode[1]) ?? 'passive'
  const atNode = pinNode.find((n) => Array.isArray(n) && listHead(n) === 'at')
  const lengthNode = pinNode.find((n) => Array.isArray(n) && listHead(n) === 'length')
  const nameNode = pinNode.find((n) => Array.isArray(n) && listHead(n) === 'name')
  const numberNode = pinNode.find((n) => Array.isArray(n) && listHead(n) === 'number')
  if (!atNode) return null
  return {
    type: pinType,
    x: Number(atom(atNode[1]) ?? 0),
    y: Number(atom(atNode[2]) ?? 0),
    rotation: Number(atom(atNode[3]) ?? 0),
    length: Number(atom(lengthNode?.[1]) ?? 2.54),
    name: atom(nameNode?.[1]) ?? '',
    number: atom(numberNode?.[1]) ?? '',
  }
}

function parsePinsFromSymbolNode(symbolNode) {
  const pins = []
  for (const pinNode of findAll(symbolNode, 'pin')) {
    const pin = parsePinNode(pinNode)
    if (pin) pins.push(pin)
  }
  return pins
}

function parsePropertiesFromSymbolNode(symbolNode) {
  return {
    reference: findProperty(symbolNode, 'Reference'),
    value: findProperty(symbolNode, 'Value'),
    footprint: findProperty(symbolNode, 'Footprint'),
    datasheet: findProperty(symbolNode, 'Datasheet'),
    description: findProperty(symbolNode, 'Description'),
    keywords: findProperty(symbolNode, 'ki_keywords'),
    fpFilters: findProperty(symbolNode, 'ki_fp_filters'),
  }
}

function parseSymbolSource(source, symbolPath) {
  const tree = parse(source)
  const symbolName = symbolNameFromPath(symbolPath)
  const symbolNode = findSymbolNode(tree, symbolName)
  if (!symbolNode) {
    throw new Error(`Symbol "${symbolName}" not found in ${symbolPath}`)
  }

  const extendsName = symbolNode.find((n) => Array.isArray(n) && listHead(n) === 'extends')
  const properties = parsePropertiesFromSymbolNode(symbolNode)
  const pins = parsePinsFromSymbolNode(symbolNode)

  return {
    symbolName,
    symbolPath,
    extends: extendsName ? atom(extendsName[1]) ?? '' : '',
    properties,
    pins,
    tree,
    symbolNode,
  }
}

async function resolveSymbol(symbolPath, visited = new Set()) {
  const source = await loadSymbolSource(symbolPath)
  const parsed = parseSymbolSource(source, symbolPath)

  if (!parsed.extends) {
    return {
      ...parsed,
      graphicsPath: symbolPath,
      graphicsSymbolName: parsed.symbolName,
    }
  }

  if (visited.has(symbolPath)) {
    throw new Error(`Circular symbol extends: ${symbolPath}`)
  }
  visited.add(symbolPath)

  const libraryDir = libraryDirFromSymbolPath(symbolPath)
  const parentPath = symbolPathForName(libraryDir, parsed.extends)
  const parent = await resolveSymbol(parentPath, visited)

  return {
    ...parent,
    symbolName: parsed.symbolName,
    symbolPath: parsed.symbolPath,
    extends: parsed.extends,
    properties: { ...parent.properties, ...parsed.properties },
    pins: parsed.pins.length > 0 ? parsed.pins : parent.pins,
    graphicsPath: parent.graphicsPath,
    graphicsSymbolName: parent.graphicsSymbolName,
  }
}

async function loadSymbol(symbolPath) {
  const resolved = await resolveSymbol(symbolPath)
  return {
    symbolName: resolved.symbolName,
    properties: resolved.properties,
    pins: resolved.pins,
    graphicsPath: resolved.graphicsPath,
    graphicsSymbolName: resolved.graphicsSymbolName,
    extends: resolved.extends,
  }
}

module.exports = { parseSymbolSource, loadSymbol, resolveSymbol, parsePinNode }
