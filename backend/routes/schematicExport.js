const express = require('express')

/** Force an <svg> root to render at (w×h) pt while keeping its viewBox so the
 *  content scales to fit. svg-to-pdfkit otherwise uses the intrinsic width/height. */
function setSvgSize(svg, w, h) {
  return svg
    .replace(/width="[\d.]+"/, `width="${w}"`)
    .replace(/height="[\d.]+"/, `height="${h}"`)
}
const archiver = require('archiver')
const { resolvePartByModuleName } = require('../services/kicad/resolvePart')
const { loadSymbolSvg } = require('../services/kicad/symbolSvg')
const { composeWiringSchematic } = require('../services/kicad/composeWiringSchematic')

const router = express.Router()

function uniqueModuleNames(components) {
  const counts = new Map()
  for (const c of components ?? []) {
    const name = String(c.moduleName ?? '').trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + (c.quantity ?? 1))
  }
  return counts
}

router.post('/preview', async (req, res) => {
  try {
    const { components } = req.body ?? {}
    const counts = uniqueModuleNames(components)
    const parts = []
    for (const [moduleName, quantity] of counts.entries()) {
      try {
        const part = await resolvePartByModuleName(moduleName)
        parts.push({
          moduleName,
          name: part.name,
          quantity,
          symbolPath: part.symbolPath,
          pinCount: part.pins?.length ?? 0,
          hasSymbolSvg: Boolean(part.symbolSvg),
          error: null,
        })
      } catch (error) {
        parts.push({
          moduleName,
          name: moduleName,
          quantity,
          symbolPath: '',
          pinCount: 0,
          hasSymbolSvg: false,
          error: error.message,
        })
      }
    }
    res.json({ parts })
  } catch (error) {
    console.error('Schematic export preview error:', error)
    res.status(500).json({ error: error.message || 'Failed to preview schematic export' })
  }
})

router.post('/symbols.zip', async (req, res) => {
  try {
    const { projectName, components } = req.body ?? {}
    const counts = uniqueModuleNames(components)
    if (counts.size === 0) {
      return res.status(400).json({ error: 'No components provided' })
    }

    const safeName = (projectName || 'circuitwiz-symbols').replace(/[^a-z0-9-_]+/gi, '-')
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-symbols.zip"`)

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', (err) => {
      console.error('Symbol zip error:', err)
      if (!res.headersSent) res.status(500).end()
    })
    archive.pipe(res)

    for (const [moduleName, quantity] of counts.entries()) {
      try {
        const part = await resolvePartByModuleName(moduleName)
        const svg = await loadSymbolSvg(part.symbolPath, {
          width: 320,
          height: 220,
          showPinNumbers: true,
        })
        const fileBase = moduleName.replace(/[^a-z0-9-_]+/gi, '_')
        archive.append(svg, { name: `${fileBase}.svg` })
        archive.append(
          JSON.stringify(
            {
              moduleName,
              quantity,
              symbolPath: part.symbolPath,
              pins: part.pins,
              footprint: part.footprint,
              datasheet: part.datasheet,
            },
            null,
            2
          ),
          { name: `${fileBase}.json` }
        )
      } catch (error) {
        archive.append(`Error loading ${moduleName}: ${error.message}\n`, {
          name: `_errors/${moduleName.replace(/[^a-z0-9-_]+/gi, '_')}.txt`,
        })
      }
    }

    await archive.finalize()
  } catch (error) {
    console.error('Symbol zip export error:', error)
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Failed to export symbols' })
  }
})

router.post('/wiring.svg', async (req, res) => {
  try {
    const { projectName, components, wires } = req.body ?? {}
    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'components array is required' })
    }
    const svg = await composeWiringSchematic({ projectName, components, wires: wires ?? [] })
    const safeName = (projectName || 'circuitwiz-wiring').replace(/[^a-z0-9-_]+/gi, '-')
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-wiring.svg"`)
    res.send(svg)
  } catch (error) {
    console.error('Wiring SVG export error:', error)
    res.status(500).json({ error: error.message || 'Failed to export wiring schematic' })
  }
})

router.post('/wiring.pdf', async (req, res) => {
  try {
    const { projectName, components, wires } = req.body ?? {}
    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'components array is required' })
    }
    const svg = await composeWiringSchematic({ projectName, components, wires: wires ?? [] })
    const counts = uniqueModuleNames(components)
    const parts = []
    for (const [moduleName] of counts.entries()) {
      try {
        const part = await resolvePartByModuleName(moduleName)
        parts.push({ ...part, quantity: counts.get(moduleName) })
      } catch {
        parts.push({ name: moduleName, moduleName, quantity: counts.get(moduleName), symbolSvg: null })
      }
    }

    const PDFDocument = require('pdfkit')
    const SVGtoPDF = require('svg-to-pdfkit')

    // Diagram intrinsic size, so we can scale the WHOLE thing onto one page.
    const dim = svg.match(/width="(\d+(?:\.\d+)?)"\s+height="(\d+(?:\.\d+)?)"/)
    const svgW = dim ? parseFloat(dim[1]) : 800
    const svgH = dim ? parseFloat(dim[2]) : 600

    // US Letter (8.5×11in = 612×792pt). Orient to match the diagram so the
    // scaled drawing fills as much of the page as possible.
    const landscape = svgW >= svgH
    const pageW = landscape ? 792 : 612
    const pageH = landscape ? 612 : 792
    const MARGIN = 36
    const HEADER = 64

    const availW = pageW - MARGIN * 2
    const availH = pageH - HEADER - MARGIN
    const fit = Math.min(availW / svgW, availH / svgH)
    const drawW = svgW * fit
    const drawH = svgH * fit
    const drawX = (pageW - drawW) / 2
    const drawY = HEADER + (availH - drawH) / 2

    const pdf = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: MARGIN,
        size: 'LETTER',
        layout: landscape ? 'landscape' : 'portrait',
        autoFirstPage: false,
      })
      const chunks = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Page 1: full wiring diagram scaled to fit.
      doc.addPage()
      doc.fontSize(18).fillColor('#111').text(projectName || 'Wiring Schematic', MARGIN, 28, {
        width: pageW - MARGIN * 2,
        align: 'center',
      })
      doc.fontSize(9).fillColor('#666').text(`Generated ${new Date().toLocaleString()}`, MARGIN, 50, {
        width: pageW - MARGIN * 2,
        align: 'center',
      })
      const fittedSvg = setSvgSize(svg, drawW, drawH)
      SVGtoPDF(doc, fittedSvg, drawX, drawY, { assumePt: true })

      // Following pages: component symbol catalog.
      doc.addPage({ margin: MARGIN, size: 'LETTER', layout: 'portrait' })
      doc.fontSize(14).fillColor('#111').text('Component Symbols', MARGIN, MARGIN)
      doc.moveDown(0.5)
      const colW = 250
      const rowH = 185
      const symW = colW - 24
      const symH = Math.round(symW * (180 / 280))
      let col = 0
      let rowY = doc.y
      for (const part of parts) {
        if (rowY + rowH > 792 - MARGIN) {
          doc.addPage({ margin: MARGIN, size: 'LETTER', layout: 'portrait' })
          rowY = MARGIN
          col = 0
        }
        const cellX = MARGIN + col * colW
        doc.fontSize(10).fillColor('#222').text(part.name, cellX, rowY, { width: colW - 12 })
        if (part.symbolSvg) {
          SVGtoPDF(doc, setSvgSize(part.symbolSvg, symW, symH), cellX, rowY + 16, { assumePt: true })
        }
        col += 1
        if (col >= 2) {
          col = 0
          rowY += rowH
        }
      }

      doc.end()
    })

    const safeName = (projectName || 'circuitwiz-wiring').replace(/[^a-z0-9-_]+/gi, '-')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-wiring.pdf"`)
    res.send(pdf)
  } catch (error) {
    console.error('Wiring PDF export error:', error)
    res.status(500).json({ error: error.message || 'Failed to export wiring PDF' })
  }
})

module.exports = router
