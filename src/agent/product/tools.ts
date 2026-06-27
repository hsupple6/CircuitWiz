import { AgentTool } from '../types'
import { fail, makeTool, ok, okRead } from '../helpers'
import {
  clearProductSuiteSession,
  completeProductDefinition,
  getProductDefinition,
  getProductSuiteSession,
  normalizeProductQuestions,
  openProductSuiteSession,
} from './operations'
import type { ProductDefinitionAnswer } from '../../types/workspace'

const QUESTION_ITEM_SCHEMA = {
  id: { name: 'id', type: 'string' as const, description: 'Stable question id', required: false },
  prompt: { name: 'prompt', type: 'string' as const, description: 'Question text', required: true },
  kind: {
    name: 'kind',
    type: 'string' as const,
    description: 'choice or text',
    required: true,
    enum: ['choice', 'text'],
  },
  options: {
    name: 'options',
    type: 'array' as const,
    description: 'Multiple-choice options (required when kind is choice)',
    required: false,
    items: { name: 'option', type: 'string' as const, description: 'Option label', required: true },
  },
  technical: {
    name: 'technical',
    type: 'boolean' as const,
    description: 'If true, suite adds an "I don\'t know" option',
    required: false,
  },
  suggestedAnswer: {
    name: 'suggestedAnswer',
    type: 'string' as const,
    description: 'AI-suggested answer pre-filled for human review',
    required: false,
  },
  category: {
    name: 'category',
    type: 'string' as const,
    description: 'Semantic category (power, connectivity, form_factor, budget, etc.)',
    required: false,
  },
}

export const productAgentTools: AgentTool[] = [
  makeTool(
    'product_open_new_product_suite',
    `Open the New Product Suite wizard. Two modes:

BLANK (phase "blank"): Use when you have NO product details yet. Opens only the "what do you want to build?" step. Do NOT pass questions. After the user answers, the suite will re-invoke you to generate custom questions.

QUESTIONS (phase "questions"): Use when opening the full questionnaire. REQUIRED: pass idea and 6–12 product-specific custom questions with suggestedAnswer pre-fills. Questions must be tailored to this exact product — never a generic template. You may add 1–2 optional general questions (budget, unit count) at the very end only.

If you already know the idea from chat (e.g. "e ink tagging"), pass idea + questions in one call with phase "questions" and skip the blank suite.

After calling this tool, stop — the human reviews answers in the suite UI.`,
    'product',
    [
      {
        name: 'phase',
        type: 'string',
        description: 'blank = idea capture only; questions = full tailored questionnaire',
        required: false,
        enum: ['blank', 'questions'],
      },
      {
        name: 'idea',
        type: 'string',
        description: 'Product idea (required for questions phase; optional pre-fill for blank)',
        required: false,
      },
      {
        name: 'prefill',
        type: 'object',
        description: 'Any extracted key-value facts from the user message',
        required: false,
        properties: {},
      },
      {
        name: 'questions',
        type: 'array',
        description: 'Required for questions phase — tailored questions with suggestedAnswer pre-fills',
        required: false,
        items: {
          name: 'question',
          type: 'object',
          description: 'A suite question',
          required: true,
          properties: QUESTION_ITEM_SCHEMA,
        },
      },
    ],
    (ctx, args) => {
      const phaseArg = args.phase === 'blank' || args.phase === 'questions' ? args.phase : undefined
      const idea = typeof args.idea === 'string' ? args.idea : undefined
      const prefill =
        args.prefill && typeof args.prefill === 'object'
          ? (args.prefill as Record<string, string>)
          : undefined
      const questions = normalizeProductQuestions(args.questions)

      const phase = phaseArg ?? (questions.length > 0 ? 'questions' : 'blank')

      if (phase === 'questions' && questions.length === 0) {
        return fail('questions phase requires at least one tailored question.')
      }

      const folder = openProductSuiteSession(ctx.folder, { phase, idea, prefill, questions })

      const phaseLabel = phase === 'blank' ? 'blank idea capture' : 'tailored questionnaire'
      return {
        ...ok(ctx, folder, `New Product Suite opened (${phaseLabel}).`, {
          sessionId: folder.productSuiteSession?.id,
          phase: folder.productSuiteSession?.phase,
          idea: folder.productSuiteSession?.idea,
          questionCount: folder.productSuiteSession?.questions.length ?? 0,
        }),
        uiAction: { type: 'open_product_suite' },
      }
    }
  ),

  makeTool(
    'product_get_definition',
    'Get the completed product definition JSON saved from the New Product Suite. Use this to understand exactly what the user wants to build.',
    'product',
    [],
    (ctx) =>
      okRead(ctx, 'Product definition retrieved.', {
        definition: getProductDefinition(ctx.folder) ?? null,
        activeSession: getProductSuiteSession(ctx.folder) ?? null,
      })
  ),

  makeTool(
    'product_save_definition',
    'Save or update the product definition directly (bypassing the suite UI). Prefer product_open_new_product_suite for new products.',
    'product',
    [
      { name: 'idea', type: 'string', description: 'Product idea', required: true },
      { name: 'summary', type: 'string', description: 'Concise summary of the product', required: true },
      {
        name: 'answers',
        type: 'array',
        description: 'Structured Q&A answers',
        required: true,
        items: {
          name: 'answer',
          type: 'object',
          description: 'One answer',
          required: true,
          properties: {
            questionId: { name: 'questionId', type: 'string', description: 'Question id', required: true },
            prompt: { name: 'prompt', type: 'string', description: 'Question text', required: true },
            answer: { name: 'answer', type: 'string', description: 'Answer', required: true },
            category: { name: 'category', type: 'string', description: 'Category', required: false },
          },
        },
      },
    ],
    (ctx, args) => {
      const idea = typeof args.idea === 'string' ? args.idea.trim() : ''
      const summary = typeof args.summary === 'string' ? args.summary.trim() : ''
      if (!idea) return fail('idea is required')
      if (!summary) return fail('summary is required')
      if (!Array.isArray(args.answers)) return fail('answers array is required')

      const answers: ProductDefinitionAnswer[] = []
      for (const item of args.answers) {
        if (!item || typeof item !== 'object') continue
        const a = item as Record<string, unknown>
        if (typeof a.questionId !== 'string' || typeof a.prompt !== 'string' || typeof a.answer !== 'string') {
          continue
        }
        answers.push({
          questionId: a.questionId,
          prompt: a.prompt,
          answer: a.answer,
          category: typeof a.category === 'string' ? a.category : undefined,
        })
      }

      const folder = completeProductDefinition(ctx.folder, { idea, summary, answers })
      return ok(ctx, folder, 'Product definition saved.', { definition: folder.productDefinition })
    }
  ),

  makeTool(
    'product_clear_suite_session',
    'Cancel an in-progress New Product Suite session without saving.',
    'product',
    [],
    (ctx) => ok(ctx, clearProductSuiteSession(ctx.folder), 'Product suite session cleared.')
  ),
]
