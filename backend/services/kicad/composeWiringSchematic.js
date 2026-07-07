const { loadSymbolSvg, renderKicadSymbolSvg } = require('./symbolSvg')
const { resolvePartByModuleName } = require('./resolvePart')

const CELL_PX = 44
const SYMBOL_W = 120
const SYMBOL_H = 90

function gridToPx(x, y, offsetX, offsetY) {
  return {
    x: offsetX + x * CELL_PX,
    y: offsetY + y * CELL_PX,
  }
}

function wirePolyline(segments) {
  if (!segments?.length) return ''
  const pts = segments.map((s) => `${s.x},${s.y}`).join(' ')
  return `<polyline points="${pts}" fill="none" stroke="#22c55e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`
}

function extractInnerSvg(svg) {
  if (!svg) return ''
  const open = svg.indexOf('>')
  const close = svg.lastIndexOf('</svg>')
  if (open === -1 || close === -1) return svg
  return svg.slice(open + 1, close)
}

async function composeWiringSchematic({ projectName, components, wires }) {
  if (!components?.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="20" y="40" fill="#888">No components</text></svg>`
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const component of components) {
    minX = Math.min(minX, component.origin.x)
    minY = Math.min(minY, component.origin.y)
    maxX = Math.max(maxX, component.origin.x + (component.size?.gridX ?? 1))
    maxY = Math.max(maxY, component.origin.y + (component.size?.gridY ?? 1))
  }
  for (const wire of wires ?? []) {
    for (const seg of wire.segments ?? []) {
      minX = Math.min(minX, seg.x)
      minY = Math.min(minY, seg.y)
      maxX = Math.max(maxX, seg.x)
      maxY = Math.max(maxY, seg.y)
    }
  }

  const margin = 80
  const offsetX = margin - minX * CELL_PX
  const offsetY = margin - minY * CELL_PX
  const width = Math.max((maxX - minX + 2) * CELL_PX + margin * 2, 400)
  const height = Math.max((maxY - minY + 2) * CELL_PX + margin * 2, 300)

  const parts = []
  parts.push(`<rect width="100%" height="100%" fill="#0f0f0f" />`)
  parts.push(
    `<text x="${margin}" y="28" fill="#e5e5e5" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="600">${escapeXml(projectName || 'Wiring Schematic')}</text>`
  )
  parts.push(
    `<text x="${margin}" y="46" fill="#737373" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11">KiCad symbols · ${components.length} component(s) · ${(wires ?? []).length} wire(s)</text>`
  )

  for (const wire of wires ?? []) {
    const segments = (wire.segments ?? []).map((seg) => gridToPx(seg.x, seg.y, offsetX, offsetY + 20))
    parts.push(wirePolyline(segments))
  }

  for (const component of components) {
    let symbolSvg = null
    let error = null
    try {
      const part = await resolvePartByModuleName(component.moduleName)
      symbolSvg = await loadSymbolSvg(part.symbolPath, {
        width: SYMBOL_W,
        height: SYMBOL_H,
        background: 'transparent',
        strokeColor: '#e8e8e8',
      })
    } catch (err) {
      error = err.message
    }

    const pos = gridToPx(
      component.origin.x + (component.size?.gridX ?? 1) / 2,
      component.origin.y + (component.size?.gridY ?? 1) / 2,
      offsetX,
      offsetY + 20
    )
    const x = pos.x - SYMBOL_W / 2
    const y = pos.y - SYMBOL_H / 2

    if (symbolSvg) {
      parts.push(
        `<g transform="translate(${x}, ${y})">${extractInnerSvg(symbolSvg)}</g>`
      )
    } else {
      parts.push(
        `<rect x="${x}" y="${y}" width="${SYMBOL_W}" height="${SYMBOL_H}" fill="#1a1a1a" stroke="#444" rx="4" />`
      )
      parts.push(
        `<text x="${pos.x}" y="${pos.y}" fill="#888" font-size="10" text-anchor="middle" dominant-baseline="middle">${escapeXml(component.moduleName)}</text>`
      )
    }

    const refY = y + SYMBOL_H + 14
    parts.push(
      `<text x="${pos.x}" y="${refY}" fill="#a3a3a3" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" text-anchor="middle">${escapeXml(component.moduleName)}</text>`
    )
    if (error) {
      parts.push(
        `<text x="${pos.x}" y="${refY + 12}" fill="#f59e0b" font-size="8" text-anchor="middle">${escapeXml(error.slice(0, 40))}</text>`
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
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

module.exports = { composeWiringSchematic, CELL_PX }
