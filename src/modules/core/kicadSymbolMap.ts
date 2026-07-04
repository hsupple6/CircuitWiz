import { mergeKicadSymbolMap } from './buildAliases'
import { ALL_ALIASES } from './allAliases'
import { ANCHOR_LOGIC_INDEX } from './logicIndex'

const anchorSymbols = Object.fromEntries(
  Object.values(ANCHOR_LOGIC_INDEX).map((p) => [p.anchorId, p.kicadSymbol])
) as Record<string, string>

/** Limit Switch / Push Button share shader with Push Button anchor */
anchorSymbols['Limit Switch'] = 'Switch/SW_Push.kicad_sym'

export const KICAD_SYMBOL_MAP: Record<string, string> = mergeKicadSymbolMap(
  anchorSymbols,
  ALL_ALIASES
)

export function getKicadSymbolPath(moduleName: string, logicModule?: string): string | null {
  return (
    KICAD_SYMBOL_MAP[moduleName] ??
    (logicModule ? KICAD_SYMBOL_MAP[logicModule] : null) ??
    null
  )
}

export const GROUP_BOX_SYMBOL_SVG =
  '<svg width="48" height="40" viewBox="0 0 48 40" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="8" width="36" height="24" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" rx="2" /></svg>'
