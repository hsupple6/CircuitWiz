const fs = require('fs-extra')
const path = require('path')
const { SYMBOLS_DIR, symbolCachePath, symbolRemoteUrl, ensureDirs } = require('./paths')

/** Normalize GitLab symdir paths (`Device.kicad_symdir/R.kicad_sym`) to the
 *  internal library format (`Device/R.kicad_sym`) used by the bundle + remote URL. */
function normalizeSymbolPath(symbolPath) {
  return String(symbolPath).replace(/\.kicad_symdir\//g, '/')
}

async function loadSymbolSource(rawSymbolPath) {
  const symbolPath = normalizeSymbolPath(rawSymbolPath)
  const bundledPath = path.join(SYMBOLS_DIR, symbolPath)
  if (await fs.pathExists(bundledPath)) {
    return fs.readFile(bundledPath, 'utf8')
  }

  await ensureDirs()
  const cachePath = symbolCachePath(symbolPath)
  if (await fs.pathExists(cachePath)) {
    return fs.readFile(cachePath, 'utf8')
  }

  const url = symbolRemoteUrl(symbolPath)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Symbol not found: ${symbolPath} (${response.status})`)
  }
  const source = await response.text()
  await fs.ensureDir(path.dirname(cachePath))
  await fs.writeFile(cachePath, source, 'utf8')
  return source
}

function symbolPathForName(libraryDir, symbolName) {
  return `${libraryDir}/${symbolName}.kicad_sym`
}

function libraryDirFromSymbolPath(symbolPath) {
  return path.posix.dirname(symbolPath)
}

function symbolNameFromPath(symbolPath) {
  return path.basename(symbolPath, '.kicad_sym')
}

module.exports = {
  loadSymbolSource,
  normalizeSymbolPath,
  symbolPathForName,
  libraryDirFromSymbolPath,
  symbolNameFromPath,
}
