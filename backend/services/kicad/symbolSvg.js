const { KicadParser } = require('kicad-toolkit')
const fs = require('fs-extra')
const path = require('path')
const { SYMBOLS_DIR } = require('./paths')
const { loadSymbolSource } = require('./symbolLoader')
const { loadSymbol } = require('./symbolParser')

const GRAPHIC_TYPES = new Set(['schematic_line', 'schematic_rect', 'schematic_circle', 'schematic_arc'])

const PIN_OUTER_DELTA = {
  0: [-1, 0],
  90: [0, 1],
  180: [1, 0],
  270: [0, -1],
}

const PIN_LABEL_DELTA = {
  0: [0.65, 0],
  90: [0, -0.65],
  180: [-0.65, 0],
  270: [0, 0.65],
}

function pinOuterEnd(pin) {
  const [dx, dy] = PIN_OUTER_DELTA[pin.rotation] ?? [-1, 0]
  const len = pin.length ?? 2.54
  return { x: pin.x + dx * len, y: pin.y + dy * len }
}

function pinLabelPos(pin) {
  const [dx, dy] = PIN_LABEL_DELTA[pin.rotation] ?? [0.65, 0]
  return { x: pin.x + dx, y: pin.y + dy }
}

function collectGraphicElements(model) {
  const elements = []
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (GRAPHIC_TYPES.has(node.type)) elements.push(node)
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(model)
  return elements
}

function collectBounds(elements, pins = []) {
  const points = []
  for (const el of elements) {
    if (el.type === 'schematic_line') {
      points.push({ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 })
    } else if (el.type === 'schematic_rect') {
      points.push(
        { x: el.center.x - el.width / 2, y: el.center.y - el.height / 2 },
        { x: el.center.x + el.width / 2, y: el.center.y + el.height / 2 }
      )
    } else if (el.type === 'schematic_circle') {
      points.push(
        { x: el.center.x - el.radius, y: el.center.y - el.radius },
        { x: el.center.x + el.radius, y: el.center.y + el.radius }
      )
    } else if (el.type === 'schematic_arc') {
      points.push(el.start, el.mid, el.end)
    }
  }
  for (const pin of pins) {
    points.push({ x: pin.x, y: pin.y }, pinOuterEnd(pin))
  }
  if (points.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  }
}

function renderKicadSymbolSvg(model, options = {}) {
  const width = options.width ?? 280
  const height = options.height ?? 180
  const pins = options.pins ?? []
  const strokeColor = options.strokeColor ?? '#e8e8e8'
  const fillColor = options.fillColor ?? '#2a2a2a'
  const pinColor = options.pinColor ?? '#f97316'
  const labelColor = options.labelColor ?? '#d4d4d4'
  const background = options.background ?? '#141414'
  const showPinNumbers = options.showPinNumbers ?? false

  const elements = collectGraphicElements(model)
  const bounds = collectBounds(elements, pins)
  const padding = 2.5
  const spanX = Math.max(bounds.maxX - bounds.minX, 1)
  const spanY = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  const mapX = (x) => width / 2 + (x - cx) * scale
  const mapY = (y) => height / 2 - (y - cy) * scale

  const parts = []
  for (const el of elements) {
    const sw = Math.max((el.stroke_width ?? 0.15) * scale, 0.55)
    if (el.type === 'schematic_line') {
      const dash = el.is_dashed ? ' stroke-dasharray="4 2"' : ''
      parts.push(
        `<line x1="${mapX(el.x1)}" y1="${mapY(el.y1)}" x2="${mapX(el.x2)}" y2="${mapY(el.y2)}" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="round"${dash} />`
      )
    } else if (el.type === 'schematic_rect') {
      const x = mapX(el.center.x - el.width / 2)
      const y = mapY(el.center.y + el.height / 2)
      const w = el.width * scale
      const h = el.height * scale
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.is_filled ? fillColor : 'none'}" stroke="${strokeColor}" stroke-width="${sw}" />`
      )
    } else if (el.type === 'schematic_circle') {
      parts.push(
        `<circle cx="${mapX(el.center.x)}" cy="${mapY(el.center.y)}" r="${el.radius * scale}" fill="${el.is_filled ? fillColor : 'none'}" stroke="${strokeColor}" stroke-width="${sw}" />`
      )
    } else if (el.type === 'schematic_arc') {
      const start = { x: mapX(el.start.x), y: mapY(el.start.y) }
      const mid = { x: mapX(el.mid.x), y: mapY(el.mid.y) }
      const end = { x: mapX(el.end.x), y: mapY(el.end.y) }
      parts.push(
        `<path d="M ${start.x} ${start.y} Q ${mid.x} ${mid.y} ${end.x} ${end.y}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="round" />`
      )
    }
  }

  const fontSize = Math.max(2.8, 1.1 * scale)
  const pinDotR = Math.max(1.1, 0.35 * scale)
  for (const pin of pins) {
    const inner = { x: mapX(pin.x), y: mapY(pin.y) }
    const outer = pinOuterEnd(pin)
    const outerPt = { x: mapX(outer.x), y: mapY(outer.y) }
    parts.push(
      `<line x1="${inner.x}" y1="${inner.y}" x2="${outerPt.x}" y2="${outerPt.y}" stroke="${strokeColor}" stroke-width="${Math.max(0.7, 0.2 * scale)}" stroke-linecap="round" />`
    )
    parts.push(
      `<circle cx="${outerPt.x}" cy="${outerPt.y}" r="${pinDotR}" fill="${pinColor}" stroke="${strokeColor}" stroke-width="0.4" />`
    )
    const label = pinLabelPos(pin)
    const labelText = pin.name && pin.name !== '~' ? pin.name.replace(/~\{([^}]+)\}/g, '$1') : ''
    if (labelText) {
      const anchor = pin.rotation === 0 ? 'start' : pin.rotation === 180 ? 'end' : 'middle'
      parts.push(
        `<text x="${mapX(label.x)}" y="${mapY(label.y)}" fill="${labelColor}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${fontSize}" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(labelText)}</text>`
      )
    }
    if (showPinNumbers && pin.number) {
      const numPos = { x: outer.x + (PIN_OUTER_DELTA[pin.rotation]?.[0] ?? 0) * 0.8, y: outer.y + (PIN_OUTER_DELTA[pin.rotation]?.[1] ?? 0) * 0.8 }
      parts.push(
        `<text x="${mapX(numPos.x)}" y="${mapY(numPos.y)}" fill="#888" font-family="ui-monospace, monospace" font-size="${fontSize * 0.75}" text-anchor="middle" dominant-baseline="middle">${escapeXml(pin.number)}</text>`
      )
    }
  }

  if (elements.length === 0 && pins.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="12" y="24" fill="#888">No symbol graphics</text></svg>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${background}" />
  ${parts.join('\n  ')}
</svg>`
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function parseGraphicsModel(graphicsPath, graphicsSymbolName) {
  const source = await loadSymbolSource(graphicsPath)
  const bytes = Buffer.from(source, 'utf8')
  const model = KicadParser.parseArrayBuffer(
    path.basename(graphicsPath),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  )
  if (graphicsSymbolName && model.length > 0) {
    return model
  }
  return model
}

async function loadSymbolSvg(symbolPath, options = {}) {
  const symbol = await loadSymbol(symbolPath)
  const model = await parseGraphicsModel(symbol.graphicsPath, symbol.graphicsSymbolName)
  return renderKicadSymbolSvg(model, { ...options, pins: symbol.pins })
}

module.exports = { loadSymbolSvg, renderKicadSymbolSvg, pinOuterEnd, pinLabelPos }
