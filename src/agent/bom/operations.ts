import { BOM, BOMLineItem, ProjectFolder } from '../../types/workspace'
import { listComponents } from '../schematic/operations'
import { getSchematic } from '../helpers'
import { newId, touchFolder } from '../helpers'

const DEFAULT_UNIT_PRICES: Record<string, number> = {
  'Arduino Uno R3': 27.6,
  ESP32: 9.95,
  Battery: 3.5,
  LED: 0.15,
  Resistor: 0.05,
  Capacitor: 0.12,
  Inductor: 0.18,
  Diode: 0.08,
  ZenerDiode: 0.12,
  NPNTransistor: 0.35,
  OpAmp: 0.85,
  BridgeRectifier: 1.2,
  ACSource: 4.5,
  'Temperature Sensor': 4.95,
  Motor: 8.5,
  Servo: 12.99,
  Buzzer: 1.25,
  Switch: 0.85,
  'Push Button': 0.45,
}

export function touchBom(bom: BOM): BOM {
  return { ...bom, metadata: { ...bom.metadata, updatedAt: new Date().toISOString() } }
}

export function generateBomFromSchematic(
  folder: ProjectFolder,
  schematicId: string,
  quantityPerLine = 1
): { folder: ProjectFolder; bom: BOM; added: number } | { error: string } {
  const schematic = getSchematic(folder, schematicId)
  if (!schematic) return { error: `Schematic not found: ${schematicId}` }

  const components = listComponents(schematic)
  const counts = new Map<string, { moduleName: string; ids: string[] }>()

  for (const c of components) {
    const entry = counts.get(c.moduleName) ?? { moduleName: c.moduleName, ids: [] }
    entry.ids.push(c.id)
    counts.set(c.moduleName, entry)
  }

  const now = new Date().toISOString()
  const existing = folder.bom ?? {
    id: newId('bom'),
    name: 'Bill of Materials',
    lineItems: [],
    metadata: { createdAt: now, updatedAt: now },
  }

  const lineItems: BOMLineItem[] = [...existing.lineItems]

  for (const [, { moduleName, ids }] of counts) {
    const existingLine = lineItems.find((l) => l.description === moduleName)
    if (existingLine) {
      existingLine.quantity = Math.max(existingLine.quantity, ids.length * quantityPerLine)
      existingLine.schematicComponentIds = [
        ...new Set([...(existingLine.schematicComponentIds ?? []), ...ids]),
      ]
    } else {
      lineItems.push({
        id: newId('bom-line'),
        description: moduleName,
        quantity: ids.length * quantityPerLine,
        unitPrice: DEFAULT_UNIT_PRICES[moduleName],
        schematicComponentIds: ids,
        substitutes: [],
      })
    }
  }

  const bom = touchBom({ ...existing, lineItems })
  return {
    folder: touchFolder({ ...folder, bom }),
    bom,
    added: counts.size,
  }
}

export function addBomLine(
  folder: ProjectFolder,
  line: Omit<BOMLineItem, 'id'>
): { folder: ProjectFolder; lineItem: BOMLineItem } | { error: string } {
  const bom = folder.bom
  if (!bom) return { error: 'No BOM exists. Call bom_ensure or bom_generate_from_schematic first.' }

  const lineItem: BOMLineItem = { ...line, id: newId('bom-line') }
  const updated = touchBom({ ...bom, lineItems: [...bom.lineItems, lineItem] })
  return { folder: touchFolder({ ...folder, bom: updated }), lineItem }
}

export function updateBomLine(
  folder: ProjectFolder,
  lineId: string,
  patch: Partial<Omit<BOMLineItem, 'id'>>
): { folder: ProjectFolder; lineItem: BOMLineItem | null } {
  const bom = folder.bom
  if (!bom) return { folder, lineItem: null }

  let updated: BOMLineItem | null = null
  const lineItems = bom.lineItems.map((l) => {
    if (l.id !== lineId) return l
    updated = { ...l, ...patch }
    return updated
  })
  if (!updated) return { folder, lineItem: null }
  return {
    folder: touchFolder({ ...folder, bom: touchBom({ ...bom, lineItems }) }),
    lineItem: updated,
  }
}

export function removeBomLine(folder: ProjectFolder, lineId: string): ProjectFolder {
  if (!folder.bom) return folder
  return touchFolder({
    ...folder,
    bom: touchBom({
      ...folder.bom,
      lineItems: folder.bom.lineItems.filter((l) => l.id !== lineId),
    }),
  })
}

export function getBomSummary(bom: BOM) {
  const lineItems = bom.lineItems.map((l) => ({
    ...l,
    lineTotal: l.unitPrice != null ? l.unitPrice * l.quantity : undefined,
  }))
  const totalCost = lineItems.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0)
  return {
    id: bom.id,
    name: bom.name,
    lineItemCount: lineItems.length,
    totalCost: totalCost > 0 ? totalCost : undefined,
    lineItems,
    metadata: bom.metadata,
  }
}

export function exportBomCsv(bom: BOM): string {
  const headers = [
    'Description',
    'Part Number',
    'Manufacturer',
    'Quantity',
    'Unit Price',
    'Line Total',
    'Substitutes',
    'Purchase URL',
    'Notes',
  ]
  const rows = bom.lineItems.map((l) => [
    l.description,
    l.partNumber ?? '',
    l.manufacturer ?? '',
    String(l.quantity),
    l.unitPrice != null ? l.unitPrice.toFixed(2) : '',
    l.unitPrice != null ? (l.unitPrice * l.quantity).toFixed(2) : '',
    (l.substitutes ?? []).join('; '),
    l.purchaseUrl ?? '',
    l.notes ?? '',
  ])
  return [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
}
