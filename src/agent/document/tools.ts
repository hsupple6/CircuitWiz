import { AgentTool } from '../types'
import { fail, makeTool, ok, okRead } from '../helpers'
import { updateDocumentInFolder } from '../project/operations'
import * as ops from './operations'

export const documentAgentTools: AgentTool[] = [
  makeTool(
    'document_get',
    'Get full content of a document by id or active document.',
    'document',
    [{ name: 'documentId', type: 'string', description: 'Document id (optional — uses active)', required: false }],
    (ctx, args) => {
      const id = (args.documentId as string) || ctx.activeDocumentId
      if (!id) return fail('No document specified.')
      const doc = ctx.folder.documents.find((d) => d.id === id)
      if (!doc) return fail(`Document not found: ${id}`)
      return okRead(ctx, 'Document retrieved.', { document: doc })
    }
  ),

  makeTool(
    'document_set_content',
    'Replace entire document content. Fully overwrites existing content.',
    'document',
    [
      { name: 'documentId', type: 'string', description: 'Document id (optional)', required: false },
      { name: 'content', type: 'string', description: 'New full content (markdown)', required: true },
      { name: 'name', type: 'string', description: 'Rename document (optional)', required: false },
    ],
    (ctx, args) => {
      const id = (args.documentId as string) || ctx.activeDocumentId
      if (!id) return fail('No document specified.')
      const { folder, document } = updateDocumentInFolder(ctx.folder, id, {
        content: args.content as string,
        name: args.name as string | undefined,
      })
      if (!document) return fail(`Document not found: ${id}`)
      return ok(ctx, folder, 'Document content updated.', { document: { id: document.id, name: document.name } })
    }
  ),

  makeTool(
    'document_append',
    'Append text to the end of a document.',
    'document',
    [
      { name: 'documentId', type: 'string', description: 'Document id (optional)', required: false },
      { name: 'text', type: 'string', description: 'Text to append', required: true },
    ],
    (ctx, args) => {
      const id = (args.documentId as string) || ctx.activeDocumentId
      if (!id) return fail('No document specified.')
      const doc = ctx.folder.documents.find((d) => d.id === id)
      if (!doc) return fail(`Document not found: ${id}`)
      const updated = ops.appendToDocument(doc, args.text as string)
      const folder = {
        ...ctx.folder,
        documents: ctx.folder.documents.map((d) => (d.id === id ? updated : d)),
      }
      return ok(ctx, folder, 'Text appended to document.')
    }
  ),

  makeTool(
    'document_replace_section',
    'Replace or create a markdown section by heading (## Heading).',
    'document',
    [
      { name: 'documentId', type: 'string', description: 'Document id (optional)', required: false },
      { name: 'heading', type: 'string', description: 'Section heading without ##', required: true },
      { name: 'content', type: 'string', description: 'Section body content', required: true },
    ],
    (ctx, args) => {
      const id = (args.documentId as string) || ctx.activeDocumentId
      if (!id) return fail('No document specified.')
      const doc = ctx.folder.documents.find((d) => d.id === id)
      if (!doc) return fail(`Document not found: ${id}`)
      const updated = ops.replaceDocumentSection(doc, args.heading as string, args.content as string)
      const folder = {
        ...ctx.folder,
        documents: ctx.folder.documents.map((d) => (d.id === id ? updated : d)),
      }
      return ok(ctx, folder, `Section "${args.heading}" updated.`)
    }
  ),

  makeTool(
    'document_search',
    'Find documents by name substring.',
    'document',
    [{ name: 'query', type: 'string', description: 'Search query', required: true }],
    (ctx, args) =>
      okRead(ctx, 'Search complete.', {
        documents: ops.findDocumentsByName(ctx.folder.documents, args.query as string).map((d) => ({
          id: d.id,
          name: d.name,
        })),
      })
  ),
]
