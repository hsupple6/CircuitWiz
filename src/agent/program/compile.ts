import type { ProgramCompilation, ProgramCompilationError } from '../../types/workspace'

const API_BASE = 'http://localhost:3001/api'

export async function compileProgramSketch(
  code: string,
  board: string
): Promise<ProgramCompilation> {
  const compiledAt = new Date().toISOString()

  try {
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, board, libraries: [] }),
    })

    const result = await response.json()

    if (response.ok && result.success) {
      return {
        success: true,
        compiledAt,
        output: result.message,
        firmware: result.firmware,
        filename: result.filename,
        size: result.size,
        binPath: result.binPath,
      }
    }

    return {
      success: false,
      compiledAt,
      output: result.details || result.error,
      errors: (result.errors as ProgramCompilationError[] | undefined) ?? [],
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown compilation error'
    return {
      success: false,
      compiledAt,
      output: `Failed to connect to compilation server: ${message}`,
      errors: [
        {
          file: 'compiler',
          line: 0,
          column: 0,
          message: `Network error: ${message}`,
          severity: 'error',
        },
      ],
    }
  }
}
