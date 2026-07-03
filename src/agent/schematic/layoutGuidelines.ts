/** Shared schematic layout rules — referenced by agent tools and system prompt. */
export const SCHEMATIC_LAYOUT_GUIDELINES = {
  placementOrigin: { x: 10, y: 10 },
  summary:
    'Origin: (10, 10)',
} as const

export function layoutGuidelinesForAgent() {
  return SCHEMATIC_LAYOUT_GUIDELINES
}
