import type { KicadPin } from './renderKicadSymbolSvg'

/** Minimal pin extraction from bundled .kicad_sym source (no extends resolution). */
export function parseKicadPinsFromSource(source: string): KicadPin[] {
  const pins: KicadPin[] = []
  const pinBlocks = source.match(/\(pin\s+[\s\S]*?\n\t\t\t\)/g) ?? []
  for (const block of pinBlocks) {
    const atMatch = block.match(/\(at\s+([-\d.]+)\s+([-\d.]+)\s+(\d+)\)/)
    if (!atMatch) continue
    const lengthMatch = block.match(/\(length\s+([-\d.]+)\)/)
    const nameMatch = block.match(/\(name\s+"([^"]*)"/)
    const numberMatch = block.match(/\(number\s+"([^"]*)"/)
    const typeMatch = block.match(/^\(pin\s+(\S+)/m)
    pins.push({
      type: typeMatch?.[1] ?? 'passive',
      x: Number(atMatch[1]),
      y: Number(atMatch[2]),
      rotation: Number(atMatch[3]),
      length: lengthMatch ? Number(lengthMatch[1]) : 2.54,
      name: nameMatch?.[1] ?? '',
      number: numberMatch?.[1] ?? '',
    })
  }
  return pins
}
