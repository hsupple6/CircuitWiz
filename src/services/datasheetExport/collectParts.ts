import { listComponents } from '../../agent/schematic/operations'
import { getModule } from '../../modules/registry'
import type { Schematic } from '../../types/workspace'
import type { DatasheetExportComponent } from './api'

export function collectDatasheetComponents(schematic: Schematic | null | undefined): DatasheetExportComponent[] {
  if (!schematic) return []
  const counts = new Map<string, number>()
  for (const component of listComponents(schematic)) {
    counts.set(component.moduleName, (counts.get(component.moduleName) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moduleName, quantity]) => {
      const def = getModule(moduleName)
      return {
        moduleName,
        quantity,
        partNumber: def?.partNumber,
        manufacturer: def?.manufacturer,
      }
    })
}
