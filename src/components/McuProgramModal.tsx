import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Check,
  Code,
  Loader2,
  Play,
  Save,
  Square,
  X,
} from 'lucide-react'
import type { CompilationError } from '../services/ArduinoCompilerReal'
import type { Program } from '../types/workspace'

interface McuProgramModalProps {
  microcontrollerName: string
  position: { x: number; y: number }
  boardLabel: string
  code: string
  onCodeChange: (code: string) => void
  onClose: () => void
  isCompiling: boolean
  isCompiled: boolean
  compileErrors: CompilationError[]
  firmwareSize?: number
  onCompile: () => void
  onRunSimulation: () => void
  onStopSimulation: () => void
  isSimulationRunning: boolean
  canCompile: boolean
  saveStatusText: string
  projectPrograms?: Program[]
  linkedProgramId?: string
  onLinkProgram?: (program: Program) => void
  onSave?: () => void
}

export function McuProgramModal({
  microcontrollerName,
  position,
  boardLabel,
  code,
  onCodeChange,
  onClose,
  isCompiling,
  isCompiled,
  compileErrors,
  firmwareSize,
  onCompile,
  onRunSimulation,
  onStopSimulation,
  isSimulationRunning,
  canCompile,
  saveStatusText,
  projectPrograms = [],
  linkedProgramId,
  onLinkProgram,
  onSave,
}: McuProgramModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasErrors = compileErrors.length > 0
  const canRun = code.trim().length > 0

  useEffect(() => {
    textareaRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSave?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onSave])

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Program ${microcontrollerName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative flex h-[min(90vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="shrink-0 border-b border-white/10 pr-14 pl-5 pt-4 pb-3">
          <h2 className="truncate text-lg font-semibold">{microcontrollerName}</h2>
          <p className="text-xs text-zinc-500">
            ({position.x}, {position.y}) · {boardLabel}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onCompile}
            disabled={isCompiling || !canCompile}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCompiling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Code className="h-4 w-4" />
            )}
            {isCompiling ? 'Compiling…' : 'Compile'}
          </button>

          {isSimulationRunning ? (
            <button
              type="button"
              onClick={onStopSimulation}
              className="inline-flex items-center gap-2 rounded-md bg-red-600/90 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onRunSimulation}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Run
            </button>
          )}

          {projectPrograms.length > 0 && onLinkProgram && (
            <select
              value={linkedProgramId ?? ''}
              onChange={(e) => {
                const program = projectPrograms.find((p) => p.id === e.target.value)
                if (program) onLinkProgram(program)
              }}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-primary-500 sm:max-w-[220px] sm:flex-none"
            >
              <option value="">Import program…</option>
              {projectPrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                  {!program.compilation?.success ? ' (not compiled)' : ''}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-3 text-xs">
            {isCompiled && !isCompiling && (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Compiled
                {firmwareSize != null && (
                  <span className="text-zinc-500">· {firmwareSize} B</span>
                )}
              </span>
            )}
            {!canCompile && (
              <span className="text-amber-400/90">CLI unavailable</span>
            )}
          </div>
        </div>

        {hasErrors && (
          <div className="shrink-0 border-b border-red-500/30 bg-red-950/40 px-5 py-2.5">
            <div className="flex items-start gap-2 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="max-h-24 space-y-1 overflow-y-auto font-mono text-xs">
                {compileErrors.map((err, i) => (
                  <div key={i}>
                    {err.file}:{err.line}:{err.column} — {err.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none border-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="// Write your sketch here..."
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-2.5 text-xs text-zinc-500">
          <span>{saveStatusText}</span>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-sm text-zinc-300 transition-colors hover:bg-white/5"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
