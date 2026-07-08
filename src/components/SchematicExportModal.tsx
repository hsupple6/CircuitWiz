import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileDown, Loader2, Network, X, AlertTriangle } from 'lucide-react'
import type { Schematic } from '../types/workspace'
import { collectSchematicExport } from '../services/schematicExport/collectSchematic'
import {
  downloadSymbolZip,
  downloadWiringPdf,
  downloadWiringSvg,
  previewSchematicExport,
  type SchematicSymbolPreview,
} from '../services/schematicExport/api'

interface SchematicExportModalProps {
  open: boolean
  onClose: () => void
  schematic: Schematic | null
  projectName: string
}

export function SchematicExportModal({ open, onClose, schematic, projectName }: SchematicExportModalProps) {
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState<SchematicSymbolPreview[]>([])

  const { components, wires } = useMemo(() => collectSchematicExport(schematic), [schematic])

  const loadPreview = useCallback(async () => {
    if (!open || components.length === 0) {
      setParts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await previewSchematicExport(components)
      setParts(result.parts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load symbol data')
      setParts([])
    } finally {
      setLoading(false)
    }
  }, [open, components])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  const runExport = async (kind: 'symbols' | 'wiring-svg' | 'wiring-pdf') => {
    if (components.length === 0) return
    setExporting(kind)
    setError(null)
    try {
      if (kind === 'symbols') await downloadSymbolZip(projectName, components)
      else if (kind === 'wiring-svg') await downloadWiringSvg(projectName, components, wires)
      else await downloadWiringPdf(projectName, components, wires)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(null)
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
            <h2 className="text-lg font-semibold">Export KiCad Schematic</h2>
            <p className="text-sm text-gray-400">
              Full KiCad symbols with pins, plus a wiring diagram of this schematic
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
              Resolving KiCad symbols…
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
                      {part.symbolPath ? (
                        <div className="mt-1 text-xs text-gray-500">{part.symbolPath}</div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-xs text-gray-500">
                      {part.hasSymbolSvg ? `${part.pinCount} pins` : 'no symbol'}
                    </div>
                  </div>
                  {part.error ? (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {part.error}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void runExport('symbols')}
            disabled={!!exporting || loading || components.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'symbols' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Symbol ZIP
          </button>
          <button
            type="button"
            onClick={() => void runExport('wiring-svg')}
            disabled={!!exporting || loading || components.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'wiring-svg' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
            Wiring SVG
          </button>
          <button
            type="button"
            onClick={() => void runExport('wiring-pdf')}
            disabled={!!exporting || loading || components.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'wiring-pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Wiring PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
