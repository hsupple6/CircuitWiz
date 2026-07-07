const express = require('express')
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
    const pdf = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'LETTER', layout: 'landscape', autoFirstPage: false })
      const chunks = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.addPage()
      doc.fontSize(18).fillColor('#111').text(projectName || 'Wiring Schematic', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(10).fillColor('#555').text(`Generated ${new Date().toLocaleString()}`, { align: 'center' })
      doc.moveDown()
      SVGtoPDF(doc, svg, 36, 72, { width: doc.page.width - 72, assumePt: false })

      doc.addPage()
      doc.fontSize(14).text('Component Symbols')
      doc.moveDown(0.5)
      let y = doc.y
      for (const part of parts) {
        if (doc.y > doc.page.height - 160) {
          doc.addPage()
          y = doc.y
        }
        doc.fontSize(11).fillColor('#222').text(part.name)
        if (part.symbolSvg) {
          SVGtoPDF(doc, part.symbolSvg, 36, doc.y + 4, { width: 200, assumePt: false })
        }
        doc.moveDown(12)
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
