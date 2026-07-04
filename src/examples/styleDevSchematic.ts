import { buildSchematic } from './schematicBuilder'
import { WIRE_COLORS } from '../theme/colors'

/** Style Lab — one wire per default palette color for visual reference. */
export function createStyleDevSchematic() {
  return buildSchematic(
    'Style Lab',
    'Default wire color swatches — toggle light/dark wire scheme in Appearance.',
    ({ wire }) => {
      WIRE_COLORS.forEach((def, index) => {
        const y = 3 + index * 2
        wire([{ x: 3, y }, { x: 28, y }], { colorId: def.id })
      })
    }
  )
}
