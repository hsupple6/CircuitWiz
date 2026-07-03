import { AgentTool } from '../types'
import { fail, makeTool, ok, okRead } from '../helpers'
import { DOCUMENT_TEMPLATES, type DocumentTemplateId } from '../document/operations'
import * as ops from './operations'

export const projectAgentTools: AgentTool[] = [
  makeTool(
    'project_get_state',
    'Get a summary of the entire project folder: schematics, documents, plan space, BOM, requirements, and assembly status.',
    'project',
    [],
    (ctx) => okRead(ctx, 'Project state retrieved.', ops.getProjectState(ctx.folder))
  ),

  makeTool(
    'project_update_metadata',
    'Update project name or description. All project content remains fully editable.',
    'project',
    [
      { name: 'name', type: 'string', description: 'Project name', required: false },
      { name: 'description', type: 'string', description: 'Project description', required: false },
    ],
    (ctx, args) => {
      const folder = ops.updateProjectMetadata(ctx.folder, {
        name: args.name as string | undefined,
        description: args.description as string | undefined,
      })
      return ok(ctx, folder, 'Project metadata updated.')
    }
  ),

  makeTool(
    'project_list_schematics',
    'List all schematics in the project with id, name, and component counts.',
    'project',
    [],
    (ctx) =>
      okRead(ctx, 'Schematics listed.', {
        schematics: ctx.folder.schematics.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          wireCount: s.wires.length,
          hasFirmware: !!s.arduinoProject,
        })),
        activeSchematicId: ctx.activeSchematicId,
      })
  ),

  makeTool(
    'project_create_schematic',
    'Create a new empty schematic in the project. Use for subsystem-specific circuits (power, MCU, display, etc.).',
    'project',
    [
      { name: 'name', type: 'string', description: 'Schematic name', required: true },
      { name: 'description', type: 'string', description: 'Schematic description', required: false },
    ],
    (ctx, args) => {
      const { folder, schematic } = ops.createSchematicInFolder(
        ctx.folder,
        args.name as string,
        (args.description as string) ?? ''
      )
      return ok(
        ctx,
        folder,
        `Schematic "${schematic.name}" created.`,
        { schematic: { id: schematic.id, name: schematic.name } },
        { activeSchematicId: schematic.id }
      )
    }
  ),

  makeTool(
    'project_update_schematic',
    'Rename or update description of an existing schematic.',
    'project',
    [
      { name: 'schematicId', type: 'string', description: 'Schematic id', required: true },
      { name: 'name', type: 'string', description: 'New name', required: false },
      { name: 'description', type: 'string', description: 'New description', required: false },
    ],
    (ctx, args) => {
      const { folder, schematic } = ops.updateSchematicMeta(ctx.folder, args.schematicId as string, {
        name: args.name as string | undefined,
        description: args.description as string | undefined,
      })
      if (!schematic) return fail(`Schematic not found: ${args.schematicId}`)
      return ok(ctx, folder, 'Schematic updated.', { schematic: { id: schematic.id, name: schematic.name } })
    }
  ),

  makeTool(
    'project_delete_schematic',
    'Delete a schematic from the project. No content is locked — any schematic can be removed.',
    'project',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id to delete', required: true }],
    (ctx, args) => {
      const exists = ctx.folder.schematics.some((s) => s.id === args.schematicId)
      if (!exists) return fail(`Schematic not found: ${args.schematicId}`)
      return ok(ctx, ops.deleteSchematicFromFolder(ctx.folder, args.schematicId as string), 'Schematic deleted.')
    }
  ),

  makeTool(
    'project_list_documents',
    'List all documents in the project.',
    'project',
    [],
    (ctx) =>
      okRead(ctx, 'Documents listed.', {
        documents: ctx.folder.documents.map((d) => ({ id: d.id, name: d.name, contentLength: d.content.length })),
        activeDocumentId: ctx.activeDocumentId,
      })
  ),

  makeTool(
    'project_create_document',
    'Create a new document for architecture docs, protocol specs, assembly guides, or notes.',
    'project',
    [
      { name: 'name', type: 'string', description: 'Document name', required: true },
      { name: 'content', type: 'string', description: 'Initial markdown content', required: false },
      {
        name: 'template',
        type: 'string',
        description: 'Optional template id',
        required: false,
        enum: ['system_architecture', 'comms_protocol', 'assembly_guide', 'elicitation_summary'],
      },
    ],
    (ctx, args) => {
      const template = args.template as DocumentTemplateId | undefined
      const content =
        (args.content as string) ??
        (template ? DOCUMENT_TEMPLATES[template] : '')
      const { folder, document } = ops.createDocumentInFolder(ctx.folder, args.name as string, content)
      return ok(ctx, folder, `Document "${document.name}" created.`, { document: { id: document.id, name: document.name } })
    }
  ),

  makeTool(
    'project_delete_document',
    'Delete a document. All documents are fully revisable and removable.',
    'project',
    [{ name: 'documentId', type: 'string', description: 'Document id', required: true }],
    (ctx, args) => {
      const exists = ctx.folder.documents.some((d) => d.id === args.documentId)
      if (!exists) return fail(`Document not found: ${args.documentId}`)
      return ok(ctx, ops.deleteDocumentFromFolder(ctx.folder, args.documentId as string), 'Document deleted.')
    }
  ),

  makeTool(
    'project_set_active_schematic',
    'Set the active schematic for tools that default to a single schematic context.',
    'project',
    [{ name: 'schematicId', type: 'string', description: 'Schematic id (null to clear)', required: true }],
    (ctx, args) => {
      const id = args.schematicId as string
      if (id && !ctx.folder.schematics.some((s) => s.id === id)) {
        return fail(`Schematic not found: ${id}`)
      }
      return ok(
        ctx,
        ctx.folder,
        'Active schematic set.',
        { activeSchematicId: id || null },
        { activeSchematicId: id || null }
      )
    }
  ),

  makeTool(
    'project_set_active_document',
    'Set the active document for tools that default to a single document context.',
    'project',
    [{ name: 'documentId', type: 'string', description: 'Document id', required: true }],
    (ctx, args) => {
      const id = args.documentId as string
      if (!ctx.folder.documents.some((d) => d.id === id)) {
        return fail(`Document not found: ${id}`)
      }
      return okRead({ ...ctx, activeDocumentId: id }, 'Active document set.', { activeDocumentId: id })
    }
  ),
]
