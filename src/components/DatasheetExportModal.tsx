import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileDown, Loader2, X, ExternalLink, AlertTriangle } from 'lucide-react'
import type { Schematic } from '../types/workspace'
import { collectDatasheetComponents } from '../services/datasheetExport/collectParts'
import {
  downloadDatasheetPdf,
  previewDatasheetExport,
  type DatasheetPartPreview,
} from '../services/datasheetExport/api'

interface DatasheetExportModalProps {
  open: boolean
  onClose: () => void
  schematic: Schematic | null
  projectName: string
}

export function DatasheetExportModal({ open, onClose, schematic, projectName }: DatasheetExportModalProps) {
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState<DatasheetPartPreview[]>([])

  const components = useMemo(() => collectDatasheetComponents(schematic), [schematic])

  const loadPreview = useCallback(async () => {
    if (!open || components.length === 0) {
      setParts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await previewDatasheetExport(projectName, components)
      setParts(result.parts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load part data')
      setParts([])
    } finally {
      setLoading(false)
    }
  }, [open, components, projectName])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  const handleExport = async () => {
    if (components.length === 0) return
    setExporting(true)
    setError(null)
    try {
      await downloadDatasheetPdf(projectName, components)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#161616] text-gray-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Export Datasheet PDF</h2>
            <p className="text-sm text-gray-400">
              KiCad metadata, datasheet links, schematic symbols, and 2D footprints
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {components.length === 0 ? (
            <p className="text-sm text-gray-400">Place components on the schematic first.</p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Resolving parts from KiCad library…
            </div>
          ) : (
            <ul className="space-y-3">
              {parts.map((part) => (
                <li
                  key={`${part.moduleName}-${part.name}`}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">
                        {part.name}
                        {part.quantity > 1 ? <span className="text-gray-400"> ×{part.quantity}</span> : null}
                      </div>
                      {part.description ? <div className="mt-1 text-gray-400">{part.description}</div> : null}
                    </div>
                    <div className="shrink-0 text-right text-xs text-gray-500">
                      {part.hasFootprintSvg ? `${part.footprintPadCount} pads` : 'no footprint'}
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-400">
                    {part.footprint ? <div>Footprint: {part.footprint}</div> : null}
                    {part.datasheet ? (
                      <a
                        href={part.datasheet}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                      >
                        Datasheet <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <div>No datasheet URL in KiCad metadata</div>
                    )}
                    {part.footprintError || part.error ? (
                      <div className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        {part.footprintError || part.error}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || loading || components.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {exporting ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
