const fs = require('fs-extra')
const { parse, findAll, atom, listHead } = require('./sexpr')
const {
  footprintCachePath,
  footprintRemoteUrl,
  ensureDirs,
} = require('./paths')

async function loadFootprintSource(library, name) {
  await ensureDirs()
  const cachePath = footprintCachePath(library, name)
  if (await fs.pathExists(cachePath)) {
    return fs.readFile(cachePath, 'utf8')
  }

  const url = footprintRemoteUrl(library, name)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Footprint not found: ${library}:${name} (${response.status})`)
  }
  const source = await response.text()
  await fs.ensureDir(require('path').dirname(cachePath))
  await fs.writeFile(cachePath, source, 'utf8')
  return source
}

function parseFootprint(source) {
  const tree = parse(source)
  const moduleNode =
    Array.isArray(tree) && (listHead(tree) === 'module' || listHead(tree) === 'footprint')
      ? tree
      : tree.find((n) => Array.isArray(n) && (listHead(n) === 'module' || listHead(n) === 'footprint'))
  if (!moduleNode) {
    throw new Error('Invalid footprint file')
  }

  const name = atom(moduleNode[1]) ?? 'Footprint'
  const descrNode = moduleNode.find((n) => Array.isArray(n) && listHead(n) === 'descr')
  const description = descrNode ? atom(descrNode[1]) ?? '' : ''

  const lines = []
  const circles = []
  const pads = []

  for (const node of findAll(moduleNode, 'fp_line')) {
    const start = node.find((n) => Array.isArray(n) && listHead(n) === 'start')
    const end = node.find((n) => Array.isArray(n) && listHead(n) === 'end')
    const layer = node.find((n) => Array.isArray(n) && listHead(n) === 'layer')
    const width = node.find((n) => Array.isArray(n) && listHead(n) === 'width')
    if (!start || !end) continue
    lines.push({
      x1: Number(atom(start[1])),
      y1: Number(atom(start[2])),
      x2: Number(atom(end[1])),
      y2: Number(atom(end[2])),
      layer: atom(layer?.[1]) ?? 'F.SilkS',
      width: Number(atom(width?.[1]) ?? 0.12),
    })
  }

  for (const node of findAll(moduleNode, 'fp_circle')) {
    const center = node.find((n) => Array.isArray(n) && listHead(n) === 'center')
    const end = node.find((n) => Array.isArray(n) && listHead(n) === 'end')
    const layer = node.find((n) => Array.isArray(n) && listHead(n) === 'layer')
    const width = node.find((n) => Array.isArray(n) && listHead(n) === 'width')
    if (!center || !end) continue
    const cx = Number(atom(center[1]))
    const cy = Number(atom(center[2]))
    const ex = Number(atom(end[1]))
    const ey = Number(atom(end[2]))
    const radius = Math.hypot(ex - cx, ey - cy)
    circles.push({
      cx,
      cy,
      radius,
      layer: atom(layer?.[1]) ?? 'F.SilkS',
      width: Number(atom(width?.[1]) ?? 0.12),
    })
  }

  for (const node of findAll(moduleNode, 'pad')) {
    const padNumber = atom(node[1]) ?? '?'
    const padType = atom(node[2]) ?? 'smd'
    const padShape = atom(node[3]) ?? 'rect'
    const at = node.find((n) => Array.isArray(n) && listHead(n) === 'at')
    const size = node.find((n) => Array.isArray(n) && listHead(n) === 'size')
    const layers = node.find((n) => Array.isArray(n) && listHead(n) === 'layers')
    const drill = node.find((n) => Array.isArray(n) && listHead(n) === 'drill')
    if (!at || !size) continue
    pads.push({
      number: padNumber,
      type: padType,
      shape: padShape,
      x: Number(atom(at[1])),
      y: Number(atom(at[2])),
      rotation: Number(atom(at[3]) ?? 0),
      width: Number(atom(size[1])),
      height: Number(atom(size[2])),
      layers: layers ? layers.slice(1).map((l) => atom(l)).filter(Boolean) : [],
      drill: drill ? Number(atom(drill[1]) ?? 0) : 0,
    })
  }

  return { name, description, lines, circles, pads }
}

async function loadFootprint(library, name) {
  const source = await loadFootprintSource(library, name)
  return parseFootprint(source)
}

module.exports = { loadFootprint, parseFootprint, loadFootprintSource }
