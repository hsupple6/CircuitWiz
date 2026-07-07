import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, LayoutGrid, X } from 'lucide-react'
import type { Schematic } from '../types/workspace'
import {
  applyTidyLayout,
  formatTidyLayoutExport,
  planTidyLayout,
  type TidyLayoutPlan,
} from '../utils/schematicTidyLayout'

interface SchematicTidyModalProps {
  schematic: Schematic
  onClose: () => void
  onApply: (updated: Schematic) => void
}

export function SchematicTidyModal({ schematic, onClose, onApply }: SchematicTidyModalProps) {
  const plan = useMemo(() => planTidyLayout(schematic), [schematic])
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = formatTidyLayoutExport(plan, schematic.name)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleApply = () => {
    onApply(applyTidyLayout(schematic, plan))
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-carbon-surface"
        role="dialog"
        aria-labelledby="tidy-layout-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
              <LayoutGrid className="h-5 w-5" />
              <h2 id="tidy-layout-title" className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                Tidy schematic layout
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{plan.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {plan.nodes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500">Place components on the grid first.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-gray-500 dark:bg-carbon-surface dark:text-zinc-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Component</th>
                  <th className="py-2 pr-3 font-medium">Now</th>
                  <th className="py-2 pr-3 font-medium">After</th>
                  <th className="py-2 font-medium">Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {plan.nodes.map((node) => (
                  <NodeRow key={node.id} node={node} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={handleCopy}
            disabled={plan.nodes.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy list'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!plan.hasChanges}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply layout
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}

function NodeRow({ node }: { node: TidyLayoutPlan['nodes'][number] }) {
  const moved =
    node.currentOrigin.x !== node.proposedOrigin.x || node.currentOrigin.y !== node.proposedOrigin.y

  return (
    <tr className={moved ? '' : 'opacity-60'}>
      <td className="py-2.5 pr-3">
        <div className="font-medium text-gray-900 dark:text-zinc-100">{node.moduleName}</div>
        <div className="text-xs text-gray-500 dark:text-zinc-500">{node.category}</div>
      </td>
      <td className="py-2.5 pr-3 font-mono text-xs text-gray-600 dark:text-zinc-400">
        ({node.currentOrigin.x}, {node.currentOrigin.y})
      </td>
      <td className="py-2.5 pr-3 font-mono text-xs text-primary-700 dark:text-primary-300">
        ({node.proposedOrigin.x}, {node.proposedOrigin.y})
      </td>
      <td className="py-2.5 font-mono text-xs text-gray-500 dark:text-zinc-500">L{node.layer}</td>
    </tr>
  )
}
