/** Shared schematic layout rules — referenced by agent tools and system prompt. */
export const SCHEMATIC_LAYOUT_GUIDELINES = {
  placementOrigin: { x: 10, y: 10 },
  /** Empty grid cells between adjacent component footprints. */
  minGapCells: 1,
  summary:
    'Tight layout: start at (10, 10) with only 1 empty cell between parts. Horizontal: next X = previous origin X + previous gridX + 1. Vertical: next Y = previous origin Y + previous gridY + 1.',
  rules: [
    'Place components tightly — leave only 1 empty grid cell between adjacent footprints.',
    'Left-to-right chains: next origin X = previous origin X + previous gridX + minGapCells; keep the same Y.',
    'Vertical stacks: next origin Y = previous origin Y + previous gridY + minGapCells; keep the same X.',
    'Read size.gridX/gridY from schematic_list_components; use suggestedNextPlacement from schematic_get_state when chaining parts.',
    'Avoid large empty gaps — do not space parts 5+ cells apart unless routing a tall module requires it.',
  ],
} as const

export function layoutGuidelinesForAgent() {
  return SCHEMATIC_LAYOUT_GUIDELINES
}

export function nextHorizontalOrigin(
  originX: number,
  gridX: number,
  gap = SCHEMATIC_LAYOUT_GUIDELINES.minGapCells
): number {
  return originX + gridX + gap
}

export function nextVerticalOrigin(
  originY: number,
  gridY: number,
  gap = SCHEMATIC_LAYOUT_GUIDELINES.minGapCells
): number {
  return originY + gridY + gap
}
