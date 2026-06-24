import { Schematic } from '../../types/workspace'
import { listComponents } from '../schematic/operations'

export function getFirmwareState(schematic: Schematic) {
  const project = schematic.arduinoProject
  if (!project) {
    return { hasFirmware: false as const }
  }
  return {
    hasFirmware: true as const,
    name: project.name,
    board: project.board,
    libraries: project.libraries,
    files: project.files.map((f) => ({
      name: f.name,
      type: f.type,
      isMain: f.isMain,
      contentLength: f.content.length,
      preview: f.content.slice(0, 300),
    })),
  }
}

export function ensureFirmwareProject(
  schematic: Schematic,
  name?: string,
  board = 'arduino:avr:uno'
): Schematic {
  if (schematic.arduinoProject) return schematic
  const now = new Date().toISOString()
  const projectName = name ?? schematic.name.replace(/\s+/g, '_')
  return {
    ...schematic,
    arduinoProject: {
      name: projectName,
      board,
      libraries: [],
      files: [
        {
          name: `${projectName}.ino`,
          content: `// ${schematic.name} firmware\n\nvoid setup() {\n  \n}\n\nvoid loop() {\n  \n}\n`,
          type: 'ino',
          isMain: true,
        },
      ],
    },
    metadata: { ...schematic.metadata, updatedAt: now },
  }
}

export function setFirmwareFile(
  schematic: Schematic,
  fileName: string,
  content: string
): { schematic: Schematic } | { error: string } {
  const project = schematic.arduinoProject
  if (!project) return { error: 'No firmware project. Call firmware_ensure first.' }

  const files = project.files.map((f) =>
    f.name === fileName ? { ...f, content } : f
  )
  if (!files.some((f) => f.name === fileName)) {
    const ext = fileName.split('.').pop() as 'ino' | 'h' | 'cpp' | 'c'
    files.push({
      name: fileName,
      content,
      type: ext === 'ino' ? 'ino' : ext,
      isMain: ext === 'ino' && !files.some((f) => f.isMain),
    })
  }

  return {
    schematic: {
      ...schematic,
      arduinoProject: { ...project, files },
      metadata: { ...schematic.metadata, updatedAt: new Date().toISOString() },
    },
  }
}

export function deleteFirmwareFile(
  schematic: Schematic,
  fileName: string
): { schematic: Schematic } | { error: string } {
  const project = schematic.arduinoProject
  if (!project) return { error: 'No firmware project.' }
  const target = project.files.find((f) => f.name === fileName)
  if (!target) return { error: `File not found: ${fileName}` }
  if (target.isMain && project.files.filter((f) => f.type === 'ino').length === 1) {
    return { error: 'Cannot delete the only main .ino file' }
  }
  return {
    schematic: {
      ...schematic,
      arduinoProject: {
        ...project,
        files: project.files.filter((f) => f.name !== fileName),
      },
      metadata: { ...schematic.metadata, updatedAt: new Date().toISOString() },
    },
  }
}

export function setFirmwareBoard(schematic: Schematic, board: string): Schematic {
  const project = schematic.arduinoProject
  if (!project) return ensureFirmwareProject(schematic, undefined, board)
  return {
    ...schematic,
    arduinoProject: { ...project, board },
    metadata: { ...schematic.metadata, updatedAt: new Date().toISOString() },
  }
}

export function setFirmwareLibraries(schematic: Schematic, libraries: string[]): Schematic {
  const project = schematic.arduinoProject
  if (!project) return { ...ensureFirmwareProject(schematic), arduinoProject: { ...ensureFirmwareProject(schematic).arduinoProject!, libraries } }
  return {
    ...schematic,
    arduinoProject: { ...project, libraries },
    metadata: { ...schematic.metadata, updatedAt: new Date().toISOString() },
  }
}

export function suggestPinMap(schematic: Schematic) {
  const components = listComponents(schematic)
  const mcus = components.filter((c) => c.category === 'microcontrollers')
  const peripherals = components.filter((c) => c.category !== 'microcontrollers')

  const suggestions: Array<{
    peripheral: string
    componentId: string
    suggestedPins: string[]
    notes?: string
  }> = []

  for (const p of peripherals) {
    const signalPins = p.pins.filter((pin) => !['VCC', 'GND'].includes(pin.type))
    const mcu = mcus[0]
    if (!mcu) {
      suggestions.push({
        peripheral: p.moduleName,
        componentId: p.id,
        suggestedPins: [],
        notes: 'No MCU on schematic',
      })
      continue
    }
    const gpioPins = mcu.pins.filter((pin) => ['GPIO', 'PWM', 'ANALOG'].includes(pin.type))
    suggestions.push({
      peripheral: p.moduleName,
      componentId: p.id,
      suggestedPins: gpioPins.slice(0, signalPins.length).map((pin) => pin.name),
      notes: signalPins.length > gpioPins.length ? 'More signals than available GPIO' : undefined,
    })
  }

  return { mcus: mcus.map((m) => ({ id: m.id, module: m.moduleName, pins: m.pins })), suggestions }
}
