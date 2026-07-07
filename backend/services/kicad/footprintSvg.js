const LAYER_COLORS = {
  'F.SilkS': '#00cc66',
  'B.SilkS': '#00cc66',
  'F.Fab': '#3366ff',
  'B.Fab': '#3366ff',
  'F.CrtYd': '#cc9933',
  'B.CrtYd': '#cc9933',
  'F.Cu': '#cc3333',
  'B.Cu': '#cc3333',
  'F.Mask': '#cc333366',
  'B.Mask': '#cc333366',
}

function layerColor(layer) {
  return LAYER_COLORS[layer] ?? '#888888'
}

function collectBounds(footprint) {
  const points = []
  for (const line of footprint.lines) {
    points.push({ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 })
  }
  for (const circle of footprint.circles) {
    points.push(
      { x: circle.cx - circle.radius, y: circle.cy - circle.radius },
      { x: circle.cx + circle.radius, y: circle.cy + circle.radius }
    )
  }
  for (const pad of footprint.pads) {
    const hw = pad.width / 2
    const hh = pad.height / 2
    points.push({ x: pad.x - hw, y: pad.y - hh }, { x: pad.x + hw, y: pad.y + hh })
  }
  if (points.length === 0) {
    return { minX: -2, minY: -2, maxX: 2, maxY: 2 }
  }
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  }
}

function renderFootprintSvg(footprint, options = {}) {
  const padding = options.padding ?? 1
  const width = options.width ?? 320
  const height = options.height ?? 240
  const bounds = collectBounds(footprint)
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.5)
  const spanY = Math.max(bounds.maxY - bounds.minY, 0.5)
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2

  const mapX = (x) => width / 2 + (x - cx) * scale
  const mapY = (y) => height / 2 + (y - cy) * scale

  const parts = []

  for (const line of footprint.lines) {
    const stroke = layerColor(line.layer)
    const sw = Math.max(line.width * scale, 0.5)
    parts.push(
      `<line x1="${mapX(line.x1)}" y1="${mapY(line.y1)}" x2="${mapX(line.x2)}" y2="${mapY(line.y2)}" stroke="${stroke}" stroke-width="${sw}" />`
    )
  }

  for (const circle of footprint.circles) {
    const stroke = layerColor(circle.layer)
    const sw = Math.max(circle.width * scale, 0.5)
    parts.push(
      `<circle cx="${mapX(circle.cx)}" cy="${mapY(circle.cy)}" r="${circle.radius * scale}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`
    )
  }

  for (const pad of footprint.pads) {
    const w = pad.width * scale
    const h = pad.height * scale
    const x = mapX(pad.x) - w / 2
    const y = mapY(pad.y) - h / 2
    const fill = pad.type === 'thru_hole' ? '#cc6600' : '#cc3333'
    if (pad.shape === 'circle' || (pad.drill > 0 && pad.width === pad.height)) {
      const r = Math.max(w, h) / 2
      parts.push(`<circle cx="${mapX(pad.x)}" cy="${mapY(pad.y)}" r="${r}" fill="${fill}" stroke="#111" stroke-width="0.5" />`)
      if (pad.drill > 0) {
        parts.push(
          `<circle cx="${mapX(pad.x)}" cy="${mapY(pad.y)}" r="${(pad.drill * scale) / 2}" fill="#111" />`
        )
      }
    } else {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#111" stroke-width="0.5" rx="${Math.min(w, h) * 0.15}" />`
      )
      if (pad.drill > 0) {
        parts.push(
          `<circle cx="${mapX(pad.x)}" cy="${mapY(pad.y)}" r="${(pad.drill * scale) / 2}" fill="#111" />`
        )
      }
    }
    parts.push(
      `<text x="${mapX(pad.x)}" y="${mapY(pad.y) + 3}" text-anchor="middle" font-size="9" fill="#eee" font-family="monospace">${pad.number}</text>`
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#1a1a1a" />
  ${parts.join('\n  ')}
</svg>`
}

module.exports = { renderFootprintSvg, collectBounds }
