const PDFDocument = require('pdfkit')
const SVGtoPDF = require('svg-to-pdfkit')
const { resolvePartByModuleName } = require('./kicad/resolvePart')

function addSvgPage(doc, svg, x, y, width) {
  if (!svg) return
  doc.save()
  SVGtoPDF(doc, svg, x, y, { width, assumePt: false })
  doc.restore()
}

async function buildDatasheetPdf({ projectName, parts }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER', autoFirstPage: false })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.addPage()
    doc.fontSize(22).fillColor('#111').text(projectName || 'CircuitWiz Project', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(12).fillColor('#444').text('Component Datasheet & Footprint Package', { align: 'center' })
    doc.moveDown(1.5)
    doc.fontSize(11).fillColor('#222').text(`Generated ${new Date().toLocaleString()}`)
    doc.moveDown()
    doc.text(`${parts.length} unique part(s)`)
    doc.moveDown()
    parts.forEach((part, index) => {
      doc.fontSize(10).fillColor('#333').text(`${index + 1}. ${part.name}${part.quantity > 1 ? ` ×${part.quantity}` : ''}`)
      if (part.datasheet) doc.text(`   Datasheet: ${part.datasheet}`, { link: part.datasheet, underline: true })
      if (part.footprint) doc.text(`   Footprint: ${part.footprint}`)
    })

    for (const part of parts) {
      doc.addPage()
      doc.fontSize(18).fillColor('#111').text(part.name)
      doc.moveDown(0.25)
      doc.fontSize(10).fillColor('#555').text(part.description || 'No description')
      doc.moveDown(0.75)

      doc.fontSize(11).fillColor('#222').text('Details', { underline: true })
      doc.moveDown(0.35)
      doc.fontSize(10)
      doc.text(`Quantity: ${part.quantity}`)
      if (part.footprint) doc.text(`Footprint: ${part.footprint}`)
      if (part.footprintDescription) doc.text(`Package: ${part.footprintDescription}`)
      if (part.datasheet) {
        doc.text('Datasheet: ', { continued: true })
        doc.fillColor('#0645ad').text(part.datasheet, { link: part.datasheet, underline: true })
        doc.fillColor('#222')
      } else {
        doc.text('Datasheet: not available in KiCad metadata')
      }
      if (part.footprintPads?.length) {
        doc.moveDown(0.25)
        doc.text(`Pads: ${part.footprintPads.map((p) => `${p.number}@${p.x.toFixed(2)},${p.y.toFixed(2)}mm`).join('  ')}`)
      }
      if (part.footprintError) {
        doc.moveDown(0.25)
        doc.fillColor('#aa3300').text(`Footprint load note: ${part.footprintError}`)
        doc.fillColor('#222')
      }

      doc.moveDown(0.75)
      const topY = doc.y
      doc.fontSize(11).text('Schematic Symbol')
      addSvgPage(doc, part.symbolSvg, 48, topY + 14, 220)

      doc.fontSize(11).text('PCB Footprint (2D)', 320, topY)
      addSvgPage(doc, part.footprintSvg, 320, topY + 14, 220)

      doc.y = Math.max(doc.y, topY + 200)
      doc.moveDown(0.5)
      doc.fontSize(9).fillColor('#666').text('Footprint layers: silk (green), fab (blue), courtyard (amber), pads (copper/red).')
    }

    doc.end()
  })
}

async function resolveSchematicParts(componentNames) {
  const counts = new Map()
  for (const name of componentNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const resolved = []
  for (const [moduleName, quantity] of counts.entries()) {
    try {
      const part = await resolvePartByModuleName(moduleName)
      resolved.push({ ...part, quantity })
    } catch (error) {
      resolved.push({
        id: moduleName,
        name: moduleName,
        moduleName,
        quantity,
        description: '',
        datasheet: '',
        footprint: '',
        footprintDescription: '',
        footprintPads: [],
        symbolSvg: null,
        footprintSvg: null,
        footprintError: error.message,
        error: error.message,
      })
    }
  }
  return resolved
}

module.exports = { buildDatasheetPdf, resolveSchematicParts }
