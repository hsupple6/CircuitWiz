import {
  Plus,
  FileText,
  CircuitBoard,
  Map,
  Trash2,
  ChevronRight,
  Code,
  Check,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ProjectFolder } from '../types/workspace'
import { ProjectPreview } from './ProjectPreview'
import { ProductDefinitionCard, ProductDefinitionModal } from './ProductDefinitionView'
import { MarkdownPreview } from './MarkdownPreview'

interface ProjectFolderViewProps {
  folder: ProjectFolder
  onOpenSchematic: (schematicId: string) => void
  onOpenDocument: (documentId: string) => void
  onOpenProgram: (programId: string) => void
  onOpenPlanSpace: () => void
  onCreateSchematic: () => void
  onCreateDocument: () => void
  onCreateProgram: () => void
  onDeleteSchematic: (schematicId: string) => void
  onDeleteDocument: (documentId: string) => void
  onDeleteProgram: (programId: string) => void
  onNameChange?: (name: string) => void
  onDescriptionChange?: (description: string) => void
}

export function ProjectFolderView({
  folder,
  onOpenSchematic,
  onOpenDocument,
  onOpenProgram,
  onOpenPlanSpace,
  onCreateSchematic,
  onCreateDocument,
  onCreateProgram,
  onDeleteSchematic,
  onDeleteDocument,
  onDeleteProgram,
  onNameChange,
  onDescriptionChange,
}: ProjectFolderViewProps) {
  const [localName, setLocalName] = useState(folder.name)
  const [localDescription, setLocalDescription] = useState(folder.description ?? '')
  const [productDefOpen, setProductDefOpen] = useState(false)

  useEffect(() => {
    setLocalName(folder.name)
    setLocalDescription(folder.description ?? '')
  }, [folder.name, folder.description])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <input
            type="text"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value)
              onNameChange?.(e.target.value)
            }}
            className="w-full bg-transparent text-3xl font-bold text-gray-900 outline-none placeholder-gray-400 dark:text-dark-text-primary dark:placeholder-dark-text-muted"
            placeholder="Project name"
          />
          <textarea
            value={localDescription}
            onChange={(e) => {
              setLocalDescription(e.target.value)
              onDescriptionChange?.(e.target.value)
            }}
            rows={2}
            className="mt-2 w-full resize-none bg-transparent text-gray-600 outline-none placeholder-gray-400 dark:text-dark-text-secondary dark:placeholder-dark-text-muted"
            placeholder="Add a project description…"
          />
          {folder.productDefinition && (
            <ProductDefinitionCard
              definition={folder.productDefinition}
              onOpen={() => setProductDefOpen(true)}
            />
          )}
        </div>

        {productDefOpen && folder.productDefinition && (
          <ProductDefinitionModal
            definition={folder.productDefinition}
            onClose={() => setProductDefOpen(false)}
          />
        )}

        {/* Plan Space — always present */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary mb-4 flex items-center gap-2">
            <Map className="h-5 w-5 text-purple-500" />
            Plan Space
          </h2>
          <button
            onClick={onOpenPlanSpace}
            className="card w-full sm:w-80 p-0 overflow-hidden hover:shadow-lg transition-all text-left group"
          >
            <div className="h-36 bg-gradient-to-br from-purple-100 to-indigo-200 dark:from-purple-900/30 dark:to-indigo-800/30 flex items-center justify-center relative">
              <div className="flex flex-col items-center gap-2 text-purple-600 dark:text-purple-300">
                <Map className="h-10 w-10" />
                <span className="text-sm font-medium">Visual project roadmap</span>
              </div>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary">Plan Space</h3>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1">
                {folder.planSpace.bubbles.length} nodes · {folder.planSpace.connections.length} connections
              </p>
            </div>
          </button>
        </section>

        {/* Schematics */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary flex items-center gap-2">
              <CircuitBoard className="h-5 w-5 text-primary-500" />
              Schematics
            </h2>
            <button
              onClick={onCreateSchematic}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              <Plus className="h-4 w-4" />
              New Schematic
            </button>
          </div>

          {folder.schematics.length === 0 ? (
            <div className="card p-8 text-center border-2 border-dashed border-gray-200 dark:border-dark-border">
              <CircuitBoard className="h-10 w-10 text-gray-300 dark:text-dark-text-muted mx-auto mb-3" />
              <p className="text-gray-500 dark:text-dark-text-muted text-sm mb-3">No schematics yet</p>
              <button
                onClick={onCreateSchematic}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Create your first schematic
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folder.schematics.map((schematic) => (
                <div
                  key={schematic.id}
                  className="card overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => onOpenSchematic(schematic.id)}
                >
                  <div className="relative h-36 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 overflow-hidden">
                    <div className="absolute inset-0 opacity-25">
                      <ProjectPreview
                        gridData={schematic.gridData}
                        wires={schematic.wires}
                        className="w-full h-full"
                      />
                    </div>
                    <button
                      className="absolute top-2 left-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSchematic(schematic.id)
                      }}
                      title="Delete schematic"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary truncate">
                      {schematic.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">
                      {formatDate(schematic.metadata.updatedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Programs */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary flex items-center gap-2">
              <Code className="h-5 w-5 text-emerald-500" />
              Programs
            </h2>
            <button
              onClick={onCreateProgram}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              <Plus className="h-4 w-4" />
              New Program
            </button>
          </div>

          {folder.programs.length === 0 ? (
            <div className="card p-8 text-center border-2 border-dashed border-gray-200 dark:border-dark-border">
              <Code className="h-10 w-10 text-gray-300 dark:text-dark-text-muted mx-auto mb-3" />
              <p className="text-gray-500 dark:text-dark-text-muted text-sm mb-3">No programs yet</p>
              <button
                onClick={onCreateProgram}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Create your first program
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folder.programs.map((program) => (
                <div
                  key={program.id}
                  className="card overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => onOpenProgram(program.id)}
                >
                  <div className="h-36 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 flex flex-col relative">
                    <p className="text-xs text-gray-600 dark:text-dark-text-secondary line-clamp-5 flex-1 whitespace-pre-wrap font-mono">
                      {program.code || '// Empty program'}
                    </p>
                    {program.compilation?.success && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
                        <Check className="h-3 w-3" />
                        Compiled
                      </span>
                    )}
                  </div>
                  <div className="p-3 relative">
                    <button
                      className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteProgram(program.id)
                      }}
                      title="Delete program"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary truncate pr-8">
                      {program.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">
                      {formatDate(program.metadata.updatedAt)}
                      {program.compilation?.success ? ' · Compiled' : ' · Sketch only'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Documents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              Documents
            </h2>
            <button
              onClick={onCreateDocument}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              <Plus className="h-4 w-4" />
              New Document
            </button>
          </div>

          {folder.documents.length === 0 ? (
            <div className="card p-8 text-center border-2 border-dashed border-gray-200 dark:border-dark-border">
              <FileText className="h-10 w-10 text-gray-300 dark:text-dark-text-muted mx-auto mb-3" />
              <p className="text-gray-500 dark:text-dark-text-muted text-sm mb-3">No documents yet</p>
              <button
                onClick={onCreateDocument}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Create your first document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folder.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="card overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => onOpenDocument(doc.id)}
                >
                  <div className="h-36 overflow-hidden border-b border-white/[0.04] bg-gradient-to-br from-[#121218] to-[#0c0c10] p-3 dark:from-[#121218] dark:to-[#0c0c10]">
                    <div className="pointer-events-none line-clamp-[7]">
                      <MarkdownPreview
                        content={doc.content}
                        variant="card"
                        emptyLabel="Empty document"
                      />
                    </div>
                  </div>
                  <div className="p-3 relative">
                    <button
                      className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteDocument(doc.id)
                      }}
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary truncate pr-8">
                      {doc.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1">
                      {formatDate(doc.metadata.updatedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
