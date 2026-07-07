const express = require('express')
const { buildDatasheetPdf, resolveSchematicParts } = require('../services/datasheetPdf')

const router = express.Router()

router.post('/generate', async (req, res) => {
  try {
    const { projectName, components } = req.body ?? {}
    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'components array is required' })
    }

    const moduleNames = components.map((c) => String(c.moduleName ?? c.name ?? '').trim()).filter(Boolean)
    if (moduleNames.length === 0) {
      return res.status(400).json({ error: 'No component module names provided' })
    }

    const parts = await resolveSchematicParts(moduleNames)
    const pdf = await buildDatasheetPdf({ projectName: projectName || 'CircuitWiz Schematic', parts })

    const safeName = (projectName || 'circuitwiz-datasheets').replace(/[^a-z0-9-_]+/gi, '-')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-datasheets.pdf"`)
    res.send(pdf)
  } catch (error) {
    console.error('Datasheet PDF export error:', error)
    res.status(500).json({ error: error.message || 'Failed to generate datasheet PDF' })
  }
})

router.post('/preview', async (req, res) => {
  try {
    const { components } = req.body ?? {}
    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'components array is required' })
    }
    const moduleNames = components.map((c) => String(c.moduleName ?? c.name ?? '').trim()).filter(Boolean)
    const parts = await resolveSchematicParts(moduleNames)
    res.json({
      parts: parts.map((p) => ({
        name: p.name,
        moduleName: p.moduleName,
        quantity: p.quantity,
        description: p.description,
        datasheet: p.datasheet,
        footprint: p.footprint,
        footprintPadCount: p.footprintPadCount,
        footprintError: p.footprintError,
        error: p.error,
        hasSymbolSvg: Boolean(p.symbolSvg),
        hasFootprintSvg: Boolean(p.footprintSvg),
      })),
    })
  } catch (error) {
    console.error('Datasheet preview error:', error)
    res.status(500).json({ error: error.message || 'Failed to preview datasheets' })
  }
})

module.exports = router
