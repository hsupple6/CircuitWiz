export interface SchematicExportComponent {
  id: string
  moduleName: string
  origin: { x: number; y: number }
  size: { gridX: number; gridY: number }
  pins: Array<{ name: string; x: number; y: number }>
  quantity?: number
}

export interface SchematicExportWire {
  id: string
  /** Each entry is an edge from (x,y) to (toX,toY) in grid cells. */
  segments: Array<{ x: number; y: number; toX: number; toY: number }>
  color: string
}

export interface SchematicSymbolPreview {
  moduleName: string
  name: string
  quantity: number
  symbolPath: string
  pinCount: number
  hasSymbolSvg: boolean
  error?: string
}

async function parseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}))
  return body.error || `Request failed (${response.status})`
}

export async function previewSchematicExport(components: SchematicExportComponent[]) {
  const response = await fetch('/api/schematic-export/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ components }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json() as Promise<{ parts: SchematicSymbolPreview[] }>
}

async function downloadBlob(response: Response, filename: string) {
  if (!response.ok) throw new Error(await parseError(response))
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function downloadSymbolZip(projectName: string, components: SchematicExportComponent[]) {
  const response = await fetch('/api/schematic-export/symbols.zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, components }),
  })
  const safeName = projectName.replace(/[^a-z0-9-_]+/gi, '-') || 'circuitwiz-symbols'
  await downloadBlob(response, `${safeName}-symbols.zip`)
}

export async function downloadWiringSvg(
  projectName: string,
  components: SchematicExportComponent[],
  wires: SchematicExportWire[]
) {
  const response = await fetch('/api/schematic-export/wiring.svg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, components, wires }),
  })
  const safeName = projectName.replace(/[^a-z0-9-_]+/gi, '-') || 'circuitwiz-wiring'
  await downloadBlob(response, `${safeName}-wiring.svg`)
}

export async function downloadWiringPdf(
  projectName: string,
  components: SchematicExportComponent[],
  wires: SchematicExportWire[]
) {
  const response = await fetch('/api/schematic-export/wiring.pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, components, wires }),
  })
  const safeName = projectName.replace(/[^a-z0-9-_]+/gi, '-') || 'circuitwiz-wiring'
  await downloadBlob(response, `${safeName}-wiring.pdf`)
}

export async function fetchSymbolSvg(moduleName: string, width = 320, height = 220): Promise<string> {
  const response = await fetch(`/api/kicad-library/v1/modules/${encodeURIComponent(moduleName)}.json`)
  if (!response.ok) throw new Error(await parseError(response))
  const part = await response.json()
  if (part.circuitwiz?.symbolSvg) return part.circuitwiz.symbolSvg
  throw new Error(`No symbol SVG for ${moduleName}`)
}
