import { BookOpen } from 'lucide-react'
import { getExampleTheoryDoc } from '../examples/exampleTheoryDocs'
import { MarkdownPreview } from './MarkdownPreview'

interface ExamplesDocsPanelProps {
  schematicId?: string
  schematicName?: string
}

export function ExamplesDocsPanel({ schematicId, schematicName }: ExamplesDocsPanelProps) {
  const doc = getExampleTheoryDoc(schematicId, schematicName)

  if (!doc) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
        <BookOpen className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          No theory guide yet
        </p>
        <p className="max-w-xs text-xs leading-relaxed text-gray-500 dark:text-zinc-500">
          {schematicName
            ? `A detailed walkthrough for "${schematicName}" is coming soon.`
            : 'Open an Examples schematic to see its theory guide here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-white/10">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400">
          Examples · Theory
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-gray-900 dark:text-zinc-100">{doc.title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <MarkdownPreview content={doc.content} variant="agent" />
      </div>
    </div>
  )
}
