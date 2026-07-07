const fs = require('fs-extra')
const { DATASHEET_INDEX_PATH, MODULE_MAP_PATH } = require('./paths')

let indexCache = null
let moduleMapCache = null

async function loadDatasheetIndex() {
  if (indexCache) return indexCache
  const raw = await fs.readJson(DATASHEET_INDEX_PATH)
  indexCache = {
    version: raw.version ?? 1,
    generatedAt: raw.generatedAt,
    entries: raw.entries ?? [],
  }
  return indexCache
}

async function loadModuleMap() {
  if (moduleMapCache) return moduleMapCache
  const raw = await fs.readJson(MODULE_MAP_PATH)
  moduleMapCache = raw.map ?? {}
  return moduleMapCache
}

function entryByPath(entries, symbolPath) {
  return entries.find((e) => e.path === symbolPath) ?? null
}

function entryById(entries, id) {
  return entries.find((e) => e.id === id) ?? null
}

function searchEntries(entries, query, limit = 50) {
  const q = query.trim().toLowerCase()
  if (!q) return entries.slice(0, limit)
  const tokens = q.split(/\s+/).filter(Boolean)
  return entries
    .filter((entry) => tokens.every((t) => entry.searchText?.includes(t)))
    .slice(0, limit)
}

function groupCategories(entries) {
  const byLibrary = new Map()
  for (const entry of entries) {
    const list = byLibrary.get(entry.library) ?? []
    list.push(entry)
    byLibrary.set(entry.library, list)
  }
  return [...byLibrary.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([library, parts], index) => ({
      id: String(index + 1),
      name: library,
      path: library,
      partCount: parts.length,
    }))
}

function partsForCategory(entries, categoryId) {
  const categories = groupCategories(entries)
  const category = categories.find((c) => c.id === String(categoryId))
  if (!category) return []
  return entries.filter((e) => e.library === category.name)
}

module.exports = {
  loadDatasheetIndex,
  loadModuleMap,
  entryByPath,
  entryById,
  searchEntries,
  groupCategories,
  partsForCategory,
}
