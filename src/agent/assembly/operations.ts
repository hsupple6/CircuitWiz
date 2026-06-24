import { AssemblyGuide, AssemblyChecklistItem } from '../../types/workspace'
import { newId, touchFolder } from '../helpers'
import { ProjectFolder } from '../../types/workspace'

export function touchAssembly(assembly: AssemblyGuide): AssemblyGuide {
  return { ...assembly, metadata: { ...assembly.metadata, updatedAt: new Date().toISOString() } }
}

export function addChecklistItem(
  folder: ProjectFolder,
  title: string,
  description = ''
): { folder: ProjectFolder; item: AssemblyChecklistItem } | { error: string } {
  if (!folder.assembly) return { error: 'No assembly guide. Call assembly_ensure first.' }
  const step = folder.assembly.checklist.length + 1
  const item: AssemblyChecklistItem = {
    id: newId('step'),
    step,
    title,
    description,
    completed: false,
  }
  const assembly = touchAssembly({
    ...folder.assembly,
    checklist: [...folder.assembly.checklist, item],
  })
  return { folder: touchFolder({ ...folder, assembly }), item }
}

export function updateChecklistItem(
  folder: ProjectFolder,
  itemId: string,
  patch: Partial<Omit<AssemblyChecklistItem, 'id' | 'step'>>
): { folder: ProjectFolder; item: AssemblyChecklistItem | null } {
  if (!folder.assembly) return { folder, item: null }
  let updated: AssemblyChecklistItem | null = null
  const checklist = folder.assembly.checklist.map((item) => {
    if (item.id !== itemId) return item
    updated = { ...item, ...patch }
    return updated
  })
  if (!updated) return { folder, item: null }
  return {
    folder: touchFolder({ ...folder, assembly: touchAssembly({ ...folder.assembly, checklist }) }),
    item: updated,
  }
}

export function removeChecklistItem(folder: ProjectFolder, itemId: string): ProjectFolder {
  if (!folder.assembly) return folder
  const checklist = folder.assembly.checklist
    .filter((item) => item.id !== itemId)
    .map((item, i) => ({ ...item, step: i + 1 }))
  return touchFolder({
    ...folder,
    assembly: touchAssembly({ ...folder.assembly, checklist }),
  })
}

export function setAssemblyNotes(
  folder: ProjectFolder,
  patch: { wiringNotes?: string; solderingNotes?: string; flashGuide?: string; name?: string }
): ProjectFolder {
  if (!folder.assembly) return folder
  return touchFolder({
    ...folder,
    assembly: touchAssembly({ ...folder.assembly, ...patch }),
  })
}

export function getAssemblySummary(assembly: AssemblyGuide) {
  const completed = assembly.checklist.filter((c) => c.completed).length
  return {
    id: assembly.id,
    name: assembly.name,
    checklistCount: assembly.checklist.length,
    completedCount: completed,
    progress: assembly.checklist.length > 0 ? completed / assembly.checklist.length : 0,
    wiringNotes: assembly.wiringNotes,
    solderingNotes: assembly.solderingNotes,
    flashGuide: assembly.flashGuide,
    checklist: assembly.checklist,
    metadata: assembly.metadata,
  }
}
