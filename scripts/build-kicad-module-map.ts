import fs from 'fs'
import { KICAD_SYMBOL_MAP } from '../src/modules/core/kicadSymbolMap'

const outPath = new URL('../public/kicad-module-map.json', import.meta.url)
fs.writeFileSync(
  outPath,
  JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), map: KICAD_SYMBOL_MAP }, null, 2)
)
console.log(`Wrote ${Object.keys(KICAD_SYMBOL_MAP).length} entries to public/kicad-module-map.json`)
