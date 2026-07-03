import {
  AgentProjectContext,
  AgentTool,
  AgentToolParameter,
  AgentToolResult,
} from './types'
import { PlanSpace, ProjectFolder, Schematic } from '../types/workspace'

export function touchFolder(folder: ProjectFolder): ProjectFolder {
  return {
    ...folder,
    metadata: { ...folder.metadata, updatedAt: new Date().toISOString() },
  }
}

export function getPlanSpace(ctx: AgentProjectContext): PlanSpace {
  return ctx.folder.planSpace
}

export function withPlanSpace(ctx: AgentProjectContext, planSpace: PlanSpace): AgentProjectContext {
  return { ...ctx, folder: touchFolder({ ...ctx.folder, planSpace }) }
}

export function resolveSchematicId(
  ctx: AgentProjectContext,
  schematicId?: string | null
): string | null {
  if (schematicId) return schematicId
  if (ctx.activeSchematicId) return ctx.activeSchematicId
  if (ctx.folder.schematics.length === 1) return ctx.folder.schematics[0].id
  return null
}

export function getSchematic(
  folder: ProjectFolder,
  schematicId: string
): Schematic | undefined {
  return folder.schematics.find((s) => s.id === schematicId)
}

export function updateSchematicInFolder(
  folder: ProjectFolder,
  schematicId: string,
  updater: (schematic: Schematic) => Schematic
): ProjectFolder | null {
  let found = false
  const schematics = folder.schematics.map((s) => {
    if (s.id !== schematicId) return s
    found = true
    const now = new Date().toISOString()
    const updated = updater(s)
    return {
      ...updated,
      metadata: {
        ...s.metadata,
        ...updated.metadata,
        updatedAt: now,
      },
    }
  })
  if (!found) return null
  return touchFolder({ ...folder, schematics })
}

export function ok(
  _ctx: AgentProjectContext,
  folder: ProjectFolder,
  message: string,
  data?: unknown,
  meta?: Pick<AgentToolResult, 'activeSchematicId' | 'activeDocumentId' | 'uiAction'>
): AgentToolResult {
  const touched = touchFolder(folder)
  return {
    success: true,
    message,
    folder: touched,
    planSpace: touched.planSpace,
    data,
    ...meta,
  }
}

export function okPlanSpace(
  ctx: AgentProjectContext,
  planSpace: PlanSpace,
  message: string,
  data?: unknown
): AgentToolResult {
  return ok(ctx, { ...ctx.folder, planSpace }, message, data)
}

export function okRead(ctx: AgentProjectContext, message: string, data?: unknown): AgentToolResult {
  return ok(ctx, ctx.folder, message, data)
}

export function fail(message: string, data?: unknown): AgentToolResult {
  return { success: false, message, data }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function makeTool(
  name: string,
  description: string,
  category: string,
  parameters: AgentToolParameter[],
  execute: AgentTool['execute']
): AgentTool {
  return { name, description, category, parameters, execute }
}

export function pointParam(name: string, description: string): AgentToolParameter {
  return {
    name,
    type: 'object',
    description,
    required: true,
    properties: {
      x: { name: 'x', type: 'number', description: 'Grid X', required: true },
      y: { name: 'y', type: 'number', description: 'Grid Y', required: true },
    },
  }
}
