import {
  ProductDefinition,
  ProductDefinitionAnswer,
  ProductSuiteQuestion,
  ProductSuiteSession,
  ProjectFolder,
  ProjectRequirements,
} from '../../types/workspace'
import { newId, touchFolder } from '../helpers'

export const PRODUCT_I_DONT_KNOW = "I don't know"

export function getProductDefinition(folder: ProjectFolder): ProductDefinition | undefined {
  return folder.productDefinition
}

export function getProductSuiteSession(folder: ProjectFolder): ProductSuiteSession | undefined {
  return folder.productSuiteSession
}

export function openProductSuiteSession(
  folder: ProjectFolder,
  params: {
    phase?: ProductSuiteSession['phase']
    idea?: string
    prefill?: Record<string, string>
    questions?: ProductSuiteQuestion[]
  }
): ProjectFolder {
  const idea = (params.idea ?? params.prefill?.idea ?? '').trim()
  const prefill = { ...(params.prefill ?? {}) }
  if (idea && !prefill.idea) prefill.idea = idea

  const questions = params.questions ?? []
  const phase: ProductSuiteSession['phase'] =
    params.phase ?? (questions.length > 0 ? 'questions' : 'blank')

  const session: ProductSuiteSession = {
    id: newId('product-suite'),
    phase,
    idea,
    prefill,
    questions,
    createdAt: new Date().toISOString(),
  }

  return touchFolder({
    ...folder,
    productSuiteSession: session,
  })
}

export function updateProductSuiteSession(
  folder: ProjectFolder,
  patch: Partial<Pick<ProductSuiteSession, 'phase' | 'idea' | 'prefill' | 'questions'>>
): ProjectFolder {
  if (!folder.productSuiteSession) return folder
  return touchFolder({
    ...folder,
    productSuiteSession: { ...folder.productSuiteSession, ...patch },
  })
}

export function completeProductDefinition(
  folder: ProjectFolder,
  params: {
    idea: string
    summary: string
    answers: ProductDefinitionAnswer[]
  }
): ProjectFolder {
  const now = new Date().toISOString()
  const existing = folder.productDefinition

  const definition: ProductDefinition = {
    id: existing?.id ?? newId('product-def'),
    idea: params.idea.trim(),
    summary: params.summary.trim(),
    answers: params.answers,
    metadata: {
      createdAt: existing?.metadata.createdAt ?? now,
      updatedAt: now,
      completedAt: now,
    },
  }

  const requirementsPatch = productDefinitionToRequirements(definition)

  return touchFolder({
    ...folder,
    productDefinition: definition,
    productSuiteSession: undefined,
    requirements: {
      ...folder.requirements,
      ...requirementsPatch,
    },
  })
}

export function clearProductSuiteSession(folder: ProjectFolder): ProjectFolder {
  return touchFolder({ ...folder, productSuiteSession: undefined })
}

function productDefinitionToRequirements(def: ProductDefinition): Partial<ProjectRequirements> {
  const patch: Partial<ProjectRequirements> = {
    useCase: def.idea,
    notes: def.summary,
    custom: {
      productDefinition: def,
    },
  }

  for (const answer of def.answers) {
    const key = (answer.category ?? '').toLowerCase()
    const value = answer.answer
    if (!value || value === PRODUCT_I_DONT_KNOW) continue

    if (key.includes('power') || key.includes('battery')) {
      patch.powerRequirements = value
    } else if (key.includes('comms') || key.includes('connect') || key.includes('wireless')) {
      patch.commsProtocol = value
    } else if (key.includes('environment') || key.includes('deploy')) {
      patch.environment = value
    } else if (key.includes('display') || key.includes('screen')) {
      patch.displaySize = value
    } else if (key.includes('budget') || key.includes('cost')) {
      patch.budgetRange = value
    } else if (key.includes('enclosure') || key.includes('housing') || key.includes('form')) {
      patch.enclosurePreference = value
    } else if (key.includes('quantity') || key.includes('units')) {
      const n = parseInt(value, 10)
      if (!Number.isNaN(n)) patch.unitCount = n
    }
  }

  return patch
}

export function normalizeProductQuestions(raw: unknown): ProductSuiteQuestion[] {
  if (!Array.isArray(raw)) return []

  const questions: ProductSuiteQuestion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const q = item as Record<string, unknown>
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : ''
    if (!prompt) continue

    const kind = q.kind === 'choice' ? 'choice' : 'text'
    const options =
      kind === 'choice' && Array.isArray(q.options)
        ? q.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
        : undefined

    questions.push({
      id: typeof q.id === 'string' && q.id ? q.id : newId('q'),
      prompt,
      kind,
      options,
      technical: Boolean(q.technical),
      suggestedAnswer: typeof q.suggestedAnswer === 'string' ? q.suggestedAnswer : undefined,
      category: typeof q.category === 'string' ? q.category : undefined,
    })
  }

  return questions
}
