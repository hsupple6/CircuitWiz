import { useEffect, useRef, useState } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { MarkdownPreview } from './MarkdownPreview'

interface DocumentEditorProps {
  name: string
  content: string
  onChange: (content: string) => void
  onNameChange: (name: string) => void
}

type DocumentViewMode = 'preview' | 'edit'

export function DocumentEditor({ name, content, onChange, onNameChange }: DocumentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localContent, setLocalContent] = useState(content)
  const [localName, setLocalName] = useState(name)
  const [viewMode, setViewMode] = useState<DocumentViewMode>('preview')

  useEffect(() => {
    setLocalContent(content)
    setLocalName(name)
  }, [content, name])

  useEffect(() => {
    if (viewMode === 'edit') {
      textareaRef.current?.focus()
    }
  }, [viewMode])

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <input
            type="text"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value)
              onNameChange(e.target.value)
            }}
            className="min-w-0 flex-1 border-none bg-transparent text-2xl font-semibold text-zinc-50 outline-none placeholder-zinc-600"
            placeholder="Untitled Document"
          />
          <div className="flex shrink-0 rounded-lg border border-white/[0.08] bg-carbon-surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'bg-primary-400/15 text-primary-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'edit'
                  ? 'bg-primary-400/15 text-primary-300'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {viewMode === 'preview' ? (
          <MarkdownPreview content={localContent} />
        ) : (
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => {
              setLocalContent(e.target.value)
              onChange(e.target.value)
            }}
            placeholder="Write markdown…"
            className="h-full min-h-[480px] w-full resize-none border-none bg-transparent font-mono text-sm leading-relaxed text-zinc-300 outline-none placeholder-zinc-600"
            spellCheck
          />
        )}
      </div>
    </div>
  )
}
