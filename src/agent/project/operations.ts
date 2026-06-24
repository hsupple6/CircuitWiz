import {
  ProjectFolder,
  Schematic,
  Document,
  createSchematic,
  createDocument,
  ProjectRequirements,
  BOM,
  AssemblyGuide,
} from '../../types/workspace'
import { newId, touchFolder } from '../helpers'

export function getProjectState(folder: ProjectFolder) {
  return {
    id: folder.id,
    name: folder.name,
    description: folder.description,
    schematicCount: folder.schematics.length,
    documentCount: folder.documents.length,
    hasRequirements: !!folder.requirements,
    hasBom: !!folder.bom,
    hasAssembly: !!folder.assembly,
    planSpace: {
      id: folder.planSpace.id,
      bubbleCount: folder.planSpace.bubbles.length,
      connectionCount: folder.planSpace.connections.length,
    },
    schematics: folder.schematics.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      hasFirmware: !!s.arduinoProject,
      wireCount: s.wires.length,
    })),
    documents: folder.documents.map((d) => ({
      id: d.id,
      name: d.name,
      contentLength: d.content.length,
    })),
    metadata: folder.metadata,
  }
}

export function updateProjectMetadata(
  folder: ProjectFolder,
  patch: { name?: string; description?: string }
): ProjectFolder {
  return touchFolder({ ...folder, ...patch })
}

export function createSchematicInFolder(
  folder: ProjectFolder,
  name: string,
  description = ''
): { folder: ProjectFolder; schematic: Schematic } {
  const schematic = createSchematic(name, description)
  return {
    folder: touchFolder({ ...folder, schematics: [...folder.schematics, schematic] }),
    schematic,
  }
}

export function updateSchematicMeta(
  folder: ProjectFolder,
  schematicId: string,
  patch: { name?: string; description?: string }
): { folder: ProjectFolder; schematic: Schematic | null } {
  let updated: Schematic | null = null
  const schematics = folder.schematics.map((s) => {
    if (s.id !== schematicId) return s
    updated = {
      ...s,
      ...patch,
      metadata: { ...s.metadata, updatedAt: new Date().toISOString() },
    }
    return updated
  })
  if (!updated) return { folder, schematic: null }
  return { folder: touchFolder({ ...folder, schematics }), schematic: updated }
}

export function deleteSchematicFromFolder(
  folder: ProjectFolder,
  schematicId: string
): ProjectFolder {
  return touchFolder({
    ...folder,
    schematics: folder.schematics.filter((s) => s.id !== schematicId),
  })
}

export function replaceSchematic(
  folder: ProjectFolder,
  schematicId: string,
  schematic: Schematic
): { folder: ProjectFolder; schematic: Schematic | null } {
  let found = false
  const schematics = folder.schematics.map((s) => {
    if (s.id !== schematicId) return s
    found = true
    return { ...schematic, id: schematicId }
  })
  if (!found) return { folder, schematic: null }
  return { folder: touchFolder({ ...folder, schematics }), schematic }
}

export function createDocumentInFolder(
  folder: ProjectFolder,
  name: string,
  content = ''
): { folder: ProjectFolder; document: Document } {
  const document = createDocument(name, content)
  return {
    folder: touchFolder({ ...folder, documents: [...folder.documents, document] }),
    document,
  }
}

export function updateDocumentInFolder(
  folder: ProjectFolder,
  documentId: string,
  patch: { name?: string; content?: string }
): { folder: ProjectFolder; document: Document | null } {
  let updated: Document | null = null
  const documents = folder.documents.map((d) => {
    if (d.id !== documentId) return d
    updated = {
      ...d,
      ...patch,
      metadata: { ...d.metadata, updatedAt: new Date().toISOString() },
    }
    return updated
  })
  if (!updated) return { folder, document: null }
  return { folder: touchFolder({ ...folder, documents }), document: updated }
}

export function deleteDocumentFromFolder(
  folder: ProjectFolder,
  documentId: string
): ProjectFolder {
  return touchFolder({
    ...folder,
    documents: folder.documents.filter((d) => d.id !== documentId),
  })
}

export function setRequirements(
  folder: ProjectFolder,
  requirements: Partial<ProjectRequirements>
): ProjectFolder {
  return touchFolder({
    ...folder,
    requirements: { ...folder.requirements, ...requirements },
  })
}

export function createDefaultBom(_folder: ProjectFolder, name = 'Bill of Materials'): BOM {
  const now = new Date().toISOString()
  return {
    id: newId('bom'),
    name,
    lineItems: [],
    metadata: { createdAt: now, updatedAt: now },
  }
}

export function ensureBom(folder: ProjectFolder): { folder: ProjectFolder; bom: BOM } {
  if (folder.bom) return { folder, bom: folder.bom }
  const bom = createDefaultBom(folder)
  return { folder: touchFolder({ ...folder, bom }), bom }
}

export function createDefaultAssembly(name = 'Assembly Guide'): AssemblyGuide {
  const now = new Date().toISOString()
  return {
    id: newId('assembly'),
    name,
    checklist: [],
    metadata: { createdAt: now, updatedAt: now },
  }
}

export function ensureAssembly(
  folder: ProjectFolder
): { folder: ProjectFolder; assembly: AssemblyGuide } {
  if (folder.assembly) return { folder, assembly: folder.assembly }
  const assembly = createDefaultAssembly()
  return { folder: touchFolder({ ...folder, assembly }), assembly }
}
