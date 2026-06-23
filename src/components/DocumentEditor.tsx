import { useEffect, useRef, useState } from 'react'

interface DocumentEditorProps {
  name: string
  content: string
  onChange: (content: string) => void
  onNameChange: (name: string) => void
}

export function DocumentEditor({ name, content, onChange, onNameChange }: DocumentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localContent, setLocalContent] = useState(content)
  const [localName, setLocalName] = useState(name)

  useEffect(() => {
    setLocalContent(content)
    setLocalName(name)
  }, [content, name])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-bg">
      <div className="border-b border-gray-200 dark:border-dark-border px-6 py-4">
        <input
          type="text"
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value)
            onNameChange(e.target.value)
          }}
          className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-dark-text-primary placeholder-gray-400"
          placeholder="Untitled Document"
        />
      </div>
      <div className="flex-1 px-6 py-4 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => {
            setLocalContent(e.target.value)
            onChange(e.target.value)
          }}
          placeholder="Start typing..."
          className="w-full h-full resize-none bg-transparent border-none outline-none text-gray-800 dark:text-dark-text-primary text-base leading-relaxed placeholder-gray-400 dark:placeholder-dark-text-muted font-sans"
          spellCheck
        />
      </div>
    </div>
  )
}
