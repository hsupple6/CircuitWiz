const { loadSymbolSvg } = require('./symbolSvg')
const { resolvePartByModuleName } = require('./resolvePart')

/** Pixels per schematic grid cell. Single source of truth for the whole export. */
const CELL_PX = 56
const MARGIN = 64
const HEADER = 56
/** Keep symbols from touching the footprint edges. */
const CELL_INSET = 0.12

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Nest a standalone <svg> at (x,y) so its own viewBox scales it into width/height. */
function placeSvg(svg, x, y) {
  if (!svg) return ''
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" `)
}

async function composeWiringSchematic({ projectName, components, wires }) {
  if (!components?.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="100%" height="100%" fill="#0f0f0f"/><text x="20" y="40" fill="#888">No components</text></svg>`
  }

  // One coordinate system: grid units. Compute the grid bounds spanning every
  // component footprint and every wire vertex.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const component of components) {
    const gx = component.size?.gridX ?? 1
    const gy = component.size?.gridY ?? 1
    minX = Math.min(minX, component.origin.x)
    minY = Math.min(minY, component.origin.y)
    maxX = Math.max(maxX, component.origin.x + gx)
    maxY = Math.max(maxY, component.origin.y + gy)
  }
  for (const wire of wires ?? []) {
    for (const seg of wire.segments ?? []) {
      minX = Math.min(minX, seg.x)
      minY = Math.min(minY, seg.y)
      maxX = Math.max(maxX, seg.x + 1)
      maxY = Math.max(maxY, seg.y + 1)
    }
  }

  // Grid → pixel. Identical mapping for symbols, wires, and pins.
  const px = (gx) => MARGIN + (gx - minX) * CELL_PX
  const py = (gy) => HEADER + MARGIN + (gy - minY) * CELL_PX

  const width = px(maxX) + MARGIN
  const height = py(maxY) + MARGIN

  const parts = []
  parts.push(`<rect width="100%" height="100%" fill="#0f0f0f" />`)

  // Faint grid to make placement legible.
  const gridLines = []
  for (let gx = Math.floor(minX); gx <= Math.ceil(maxX); gx++) {
    gridLines.push(`<line x1="${px(gx)}" y1="${py(minY)}" x2="${px(gx)}" y2="${py(maxY)}" />`)
  }
  for (let gy = Math.floor(minY); gy <= Math.ceil(maxY); gy++) {
    gridLines.push(`<line x1="${px(minX)}" y1="${py(gy)}" x2="${px(maxX)}" y2="${py(gy)}" />`)
  }
  parts.push(`<g stroke="#1e1e1e" stroke-width="1">${gridLines.join('')}</g>`)

  parts.push(
    `<text x="${MARGIN}" y="30" fill="#e5e5e5" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="600">${escapeXml(projectName || 'Wiring Schematic')}</text>`
  )
  parts.push(
    `<text x="${MARGIN}" y="48" fill="#737373" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11">KiCad symbols · ${components.length} component(s) · ${(wires ?? []).length} wire(s)</text>`
  )

  // Wires first, drawn in the same grid coordinate system (cell centers).
  // Each segment is an independent edge from (x,y) to (toX,toY).
  for (const wire of wires ?? []) {
    const color = wire.color && /^#/.test(wire.color) ? wire.color : '#22c55e'
    for (const seg of wire.segments ?? []) {
      if (typeof seg.x !== 'number' || typeof seg.toX !== 'number') continue
      parts.push(
        `<line x1="${px(seg.x + 0.5)}" y1="${py(seg.y + 0.5)}" x2="${px(seg.toX + 0.5)}" y2="${py(seg.toY + 0.5)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.9" />`
      )
    }
  }

  // Components placed into their real grid footprint, symbol scaled to fit.
  for (const component of components) {
    const gx = component.size?.gridX ?? 1
    const gy = component.size?.gridY ?? 1
    const boxX = px(component.origin.x) + CELL_INSET * CELL_PX
    const boxY = py(component.origin.y) + CELL_INSET * CELL_PX
    const boxW = gx * CELL_PX - CELL_INSET * CELL_PX * 2
    const boxH = gy * CELL_PX - CELL_INSET * CELL_PX * 2

    let symbolSvg = null
    let error = null
    try {
      const part = await resolvePartByModuleName(component.moduleName)
      symbolSvg = await loadSymbolSvg(part.symbolPath, {
        width: Math.max(boxW, 24),
        height: Math.max(boxH, 24),
        background: 'transparent',
        strokeColor: '#e8e8e8',
        labelColor: '#cbd5e1',
      })
    } catch (err) {
      error = err.message
    }

    if (symbolSvg) {
      parts.push(placeSvg(symbolSvg, boxX, boxY))
    } else {
      parts.push(
        `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="#1a1a1a" stroke="#444" rx="4" />`
      )
      parts.push(
        `<text x="${boxX + boxW / 2}" y="${boxY + boxH / 2}" fill="#888" font-size="10" text-anchor="middle" dominant-baseline="middle">${escapeXml(component.moduleName)}</text>`
      )
    }

    // Pin dots at the true grid pin coordinates so wire endpoints visibly meet.
    for (const pin of component.pins ?? []) {
      if (typeof pin.x !== 'number' || typeof pin.y !== 'number') continue
      parts.push(
        `<circle cx="${px(pin.x + 0.5)}" cy="${py(pin.y + 0.5)}" r="3" fill="#f97316" stroke="#0f0f0f" stroke-width="1" />`
      )
    }

    // Reference label under the footprint.
    const labelY = py(component.origin.y + gy) + 12
    parts.push(
      `<text x="${px(component.origin.x) + (gx * CELL_PX) / 2}" y="${labelY}" fill="#a3a3a3" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" text-anchor="middle">${escapeXml(component.moduleName)}</text>`
    )
    if (error) {
      parts.push(
        `<text x="${px(component.origin.x) + (gx * CELL_PX) / 2}" y="${labelY + 12}" fill="#f59e0b" font-size="8" text-anchor="middle">${escapeXml(error.slice(0, 40))}</text>`
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${parts.join('\n  ')}
</svg>`
}

module.exports = { composeWiringSchematic, CELL_PX }
