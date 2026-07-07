const express = require('express')
const {
  loadDatasheetIndex,
  groupCategories,
  partsForCategory,
  entryById,
} = require('../services/kicad/libraryIndex')
const { resolvePartById, toKicadHttpPart } = require('../services/kicad/resolvePart')

const router = express.Router()

/** KiCad HTTP Library API — https://dev-docs.kicad.org/en/apis-and-binding/http-libraries/ */
router.get('/v1/categories.json', async (_req, res) => {
  try {
    const index = await loadDatasheetIndex()
    const categories = groupCategories(index.entries).map((c) => ({
      id: c.id,
      name: c.name,
      path: c.path,
      description: `${c.partCount} symbols`,
    }))
    res.json(categories)
  } catch (error) {
    console.error('KiCad categories error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/v1/categories/:categoryId/parts.json', async (req, res) => {
  try {
    const index = await loadDatasheetIndex()
    const parts = partsForCategory(index.entries, req.params.categoryId).map((entry) => ({
      id: entry.id,
      name: entry.symbol,
      symbolIdStr: `${entry.library}:${entry.symbol}`,
      description: entry.description,
    }))
    res.json(parts)
  } catch (error) {
    console.error('KiCad category parts error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/v1/parts/:partId.json', async (req, res) => {
  try {
    const partId = decodeURIComponent(req.params.partId)
    const part = await resolvePartById(partId)
    res.json(toKicadHttpPart(part))
  } catch (error) {
    console.error('KiCad part detail error:', error)
    res.status(404).json({ error: error.message })
  }
})

/** CircuitWiz helper — resolve by module palette name */
router.get('/v1/modules/:moduleName.json', async (req, res) => {
  try {
    const { resolvePartByModuleName } = require('../services/kicad/resolvePart')
    const moduleName = decodeURIComponent(req.params.moduleName)
    const part = await resolvePartByModuleName(moduleName)
    res.json(toKicadHttpPart(part))
  } catch (error) {
    console.error('KiCad module resolve error:', error)
    res.status(404).json({ error: error.message })
  }
})

/** Search index entries */
router.get('/v1/search', async (req, res) => {
  try {
    const index = await loadDatasheetIndex()
    const q = String(req.query.q ?? '')
    const { searchEntries } = require('../services/kicad/libraryIndex')
    res.json(searchEntries(index.entries, q, 40))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
