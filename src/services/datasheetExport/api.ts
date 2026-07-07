export interface DatasheetPartPreview {
  name: string
  moduleName: string
  quantity: number
  description: string
  datasheet: string
  footprint: string
  footprintPadCount: number
  footprintError?: string
  error?: string
  hasSymbolSvg: boolean
  hasFootprintSvg: boolean
}

export interface DatasheetExportComponent {
  moduleName: string
  quantity?: number
}

export async function previewDatasheetExport(
  projectName: string,
  components: DatasheetExportComponent[]
): Promise<{ parts: DatasheetPartPreview[] }> {
  const response = await fetch('/api/datasheet-export/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, components }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Preview failed (${response.status})`)
  }
  return response.json()
}

export async function downloadDatasheetPdf(
  projectName: string,
  components: DatasheetExportComponent[]
): Promise<void> {
  const response = await fetch('/api/datasheet-export/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, components }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `PDF export failed (${response.status})`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName = projectName.replace(/[^a-z0-9-_]+/gi, '-')
  link.href = url
  link.download = `${safeName || 'circuitwiz'}-datasheets.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function fetchKicadModulePart(moduleName: string) {
  const response = await fetch(`/api/kicad-library/v1/modules/${encodeURIComponent(moduleName)}.json`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Part lookup failed (${response.status})`)
  }
  return response.json()
}
