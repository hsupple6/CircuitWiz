import { KicadParser } from 'kicad-toolkit'
import { getKicadSymbolPath } from '../modules/kicadSymbolMap'
import { parseKicadPinsFromSource } from './parseKicadPins'
import { renderKicadSymbolSvg } from './renderKicadSymbolSvg'

const svgCache = new Map<string, string>()

export async function loadKicadSymbolSvg(
  moduleName: string,
  options: { width?: number; height?: number } = {},
  logicModule?: string
): Promise<string | null> {
  const cacheKey = `${moduleName}:${logicModule ?? ''}:${options.width ?? 48}:${options.height ?? 40}`
  const cached = svgCache.get(cacheKey)
  if (cached) return cached

  const symbolPath = getKicadSymbolPath(moduleName, logicModule)
  if (!symbolPath) return null

  const response = await fetch(`/kicad-symbols/${symbolPath}`)
  if (!response.ok) return null

  const source = await response.text()
  if (!source.trimStart().startsWith('(')) return null

  const bytes = new TextEncoder().encode(source)
  const model = KicadParser.parseArrayBuffer(
    symbolPath.split('/').pop() ?? 'symbol.kicad_sym',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  )

  const pins = parseKicadPinsFromSource(source)
  const svg = renderKicadSymbolSvg(model, { ...options, pins })
  if (!svg) return null

  svgCache.set(cacheKey, svg)
  return svg
}
