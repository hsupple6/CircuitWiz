import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, Play } from 'lucide-react'
import { ArduinoCompilerReal } from '../services/ArduinoCompilerReal'
import type { Program, ProgramCompilation } from '../types/workspace'

const BOARD_OPTIONS = [
  { value: 'arduino:avr:uno', label: 'Arduino Uno' },
  { value: 'arduino:avr:nano', label: 'Arduino Nano' },
  { value: 'esp32:esp32:esp32', label: 'ESP32' },
  { value: 'esp32:esp32:esp32s3', label: 'ESP32-S3' },
]

interface ProgramEditorProps {
  program: Program
  onChange: (code: string) => void
  onNameChange: (name: string) => void
  onBoardChange: (board: string) => void
  onCompilationChange: (compilation: ProgramCompilation | undefined) => void
}

export function ProgramEditor({
  program,
  onChange,
  onNameChange,
  onBoardChange,
  onCompilationChange,
}: ProgramEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [localCode, setLocalCode] = useState(program.code)
  const [localName, setLocalName] = useState(program.name)
  const [localBoard, setLocalBoard] = useState(program.board)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compileErrors, setCompileErrors] = useState<string[]>([])
  const [compiler] = useState(() => new ArduinoCompilerReal())

  useEffect(() => {
    setLocalCode(program.code)
    setLocalName(program.name)
    setLocalBoard(program.board)
  }, [program.id, program.code, program.name, program.board])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleCompile = async () => {
    setIsCompiling(true)
    setCompileErrors([])

    try {
      const result = await compiler.compileSketch(localCode, localBoard)
      const compiledAt = new Date().toISOString()

      if (result.success) {
        onCompilationChange({
          success: true,
          compiledAt,
          output: result.output,
          firmware: result.firmware,
          filename: result.filename,
          size: result.size,
          binPath: result.binPath,
        })
        setCompileErrors([])
      } else {
        const errors = (result.errors || []).map(
          (e) => `${e.file}:${e.line}:${e.column} — ${e.message}`
        )
        setCompileErrors(errors.length > 0 ? errors : ['Compilation failed'])
        onCompilationChange({
          success: false,
          compiledAt,
          errors: result.errors,
          output: result.output,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown compilation error'
      setCompileErrors([message])
      onCompilationChange({
        success: false,
        compiledAt: new Date().toISOString(),
        errors: [{ file: 'compiler', line: 0, column: 0, message, severity: 'error' }],
      })
    } finally {
      setIsCompiling(false)
    }
  }

  const isCompiled = program.compilation?.success === true

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-zinc-100">
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-4 flex-wrap">
        <input
          type="text"
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value)
            onNameChange(e.target.value)
          }}
          className="flex-1 min-w-[200px] text-2xl font-semibold bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500"
          placeholder="Untitled Program"
        />
        <select
          value={localBoard}
          onChange={(e) => {
            setLocalBoard(e.target.value)
            onBoardChange(e.target.value)
          }}
          className="rounded-md border border-white/10 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-primary-500"
        >
          {BOARD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleCompile}
          disabled={isCompiling}
          className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50 transition-colors"
        >
          {isCompiling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isCompiling ? 'Compiling…' : 'Compile'}
        </button>
        {isCompiled && !isCompiling && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-400">
            <Check className="h-4 w-4" />
            Compiled
            {program.compilation?.compiledAt && (
              <span className="text-zinc-500">
                · {new Date(program.compilation.compiledAt).toLocaleString()}
              </span>
            )}
          </span>
        )}
      </div>

      {(compileErrors.length > 0 || (program.compilation && !program.compilation.success)) && (
        <div className="border-b border-red-500/30 bg-red-950/40 px-6 py-3">
          <div className="flex items-start gap-2 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1 font-mono text-xs">
              {compileErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
              {compileErrors.length === 0 &&
                program.compilation?.errors?.map((e, i) => (
                  <div key={i}>
                    {e.file}:{e.line}:{e.column} — {e.message}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={localCode}
          onChange={(e) => {
            setLocalCode(e.target.value)
            onChange(e.target.value)
          }}
          spellCheck={false}
          className="w-full h-full resize-none bg-transparent border-none outline-none px-6 py-4 text-sm leading-relaxed font-mono text-zinc-100 placeholder-zinc-600"
          placeholder="// Write your Arduino sketch here..."
        />
      </div>
    </div>
  )
}
