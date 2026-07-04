import type { Schematic } from '../types/workspace'
import { createStyleDevSchematic } from '../examples/styleDevSchematic'

const SCHEMATIC_KEY = 'circuitwiz-style-dev-schematic'

export function loadStyleDevSchematic(): Schematic {
  try {
    const raw = localStorage.getItem(SCHEMATIC_KEY)
    if (raw) return JSON.parse(raw) as Schematic
  } catch {
    /* fall through */
  }
  const seed = createStyleDevSchematic()
  saveStyleDevSchematic(seed)
  return seed
}

export function saveStyleDevSchematic(schematic: Schematic): void {
  localStorage.setItem(SCHEMATIC_KEY, JSON.stringify(schematic))
}

export function resetStyleDevSchematic(): Schematic {
  const seed = createStyleDevSchematic()
  saveStyleDevSchematic(seed)
  return seed
}
