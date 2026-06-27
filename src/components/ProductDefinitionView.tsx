import { X, Sparkles } from 'lucide-react'
import type { ProductDefinition } from '../types/workspace'
import { PRODUCT_I_DONT_KNOW } from '../agent/product/operations'

interface ProductDefinitionModalProps {
  definition: ProductDefinition
  onClose: () => void
}

export function ProductDefinitionModal({ definition, onClose }: ProductDefinitionModalProps) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(640px,88vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-carbon-card shadow-2xl dark:border-dark-border dark:bg-dark-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-400/15">
              <Sparkles className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
                Product definition
              </h2>
              <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                Saved from New Product Suite
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.08] dark:bg-carbon-surface">
            <p className="text-xs font-medium uppercase tracking-wide text-primary-500 dark:text-primary-400/80">
              Idea
            </p>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-zinc-100">
              {definition.idea}
            </p>
            {definition.summary && (
              <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{definition.summary}</p>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {definition.answers.map((a) => (
              <div
                key={a.questionId}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-carbon-surface"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-500">
                  {a.category ?? 'Detail'}
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-200">{a.prompt}</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
                  {a.answer && a.answer !== PRODUCT_I_DONT_KNOW ? a.answer : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProductDefinitionCardProps {
  definition: ProductDefinition
  onOpen: () => void
}

export function ProductDefinitionCard({ definition, onOpen }: ProductDefinitionCardProps) {
  const answerCount = definition.answers.filter(
    (a) => a.answer.trim() && a.answer !== PRODUCT_I_DONT_KNOW
  ).length

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group mt-4 w-full rounded-xl border border-primary-400/20 bg-primary-400/[0.06] p-4 text-left transition-all hover:border-primary-400/35 hover:bg-primary-400/10 dark:border-primary-400/25"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-400/15">
            <Sparkles className="h-4 w-4 text-primary-500 dark:text-primary-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400/90">
              Product definition
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-gray-900 dark:text-zinc-100">
              {definition.idea}
            </p>
            {definition.summary && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-zinc-400">
                {definition.summary}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
              {answerCount} answer{answerCount !== 1 ? 's' : ''} · Click to view all
            </p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary-400">
          Open →
        </span>
      </div>
    </button>
  )
}
