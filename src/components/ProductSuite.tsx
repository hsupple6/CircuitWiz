import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import type {
  ProductDefinitionAnswer,
  ProductSuiteQuestion,
  ProductSuiteSession,
  ProjectFolder,
} from '../types/workspace'
import { PRODUCT_I_DONT_KNOW } from '../agent/product/operations'
import { CarbonWeaveLoader } from './CarbonWeaveLoader'

export interface ProductSuiteProps {
  folder: ProjectFolder
  session?: ProductSuiteSession
  loading?: boolean
  onSave: (folder: ProjectFolder) => void
  onClose: () => void
  onIdeaSubmitted: (idea: string) => Promise<void>
}

type SuiteSlide =
  | { type: 'idea' }
  | { type: 'question'; question: ProductSuiteQuestion }
  | { type: 'summary' }

function buildSummary(idea: string, answers: ProductDefinitionAnswer[]): string {
  const lines = answers
    .filter((a) => a.answer.trim() && a.answer !== PRODUCT_I_DONT_KNOW)
    .map((a) => `${a.prompt}: ${a.answer}`)
  return [idea, ...lines].filter(Boolean).join('. ')
}

function initialAnswerForQuestion(
  question: ProductSuiteQuestion,
  prefill: Record<string, string>
): string {
  if (question.suggestedAnswer?.trim()) return question.suggestedAnswer.trim()

  const category = question.category?.toLowerCase() ?? ''
  for (const [key, value] of Object.entries(prefill)) {
    if (key.toLowerCase() === category || question.prompt.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  if (question.kind === 'choice' && question.options?.length) {
    return question.options[0]
  }

  return ''
}

export function ProductSuite({
  folder,
  session,
  loading = false,
  onSave,
  onClose,
  onIdeaSubmitted,
}: ProductSuiteProps) {
  const isBlankPhase = session?.phase === 'blank'
  const questions = session?.questions ?? []

  const [idea, setIdea] = useState(session?.idea ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [slideIndex, setSlideIndex] = useState(0)
  const [submittingIdea, setSubmittingIdea] = useState(false)
  const [saving, setSaving] = useState(false)

  const prefill = session?.prefill ?? {}

  useEffect(() => {
    if (session) {
      setIdea(session.idea ?? '')
      setSlideIndex(0)
      setAnswers({})
    }
  }, [session?.id])

  const needsIdeaSlide = !session || isBlankPhase || !session.idea?.trim()

  const slides: SuiteSlide[] = useMemo(() => {
    if (!session || isBlankPhase) return [{ type: 'idea' }]

    const list: SuiteSlide[] = []
    if (needsIdeaSlide) list.push({ type: 'idea' })
    for (const question of questions) {
      list.push({ type: 'question', question })
    }
    list.push({ type: 'summary' })
    return list
  }, [session, isBlankPhase, needsIdeaSlide, questions])

  const currentSlide = slides[slideIndex]
  const totalSteps = slides.length
  const isFirst = slideIndex === 0
  const isLast = slideIndex === totalSteps - 1
  const showWeave = loading || !session

  useEffect(() => {
    if (questions.length === 0) return
    setAnswers((prev) => {
      const next = { ...prev }
      for (const q of questions) {
        if (next[q.id] === undefined) {
          next[q.id] = initialAnswerForQuestion(q, prefill)
        }
      }
      return next
    })
  }, [questions, prefill])

  const resolvedAnswers = useMemo((): ProductDefinitionAnswer[] => {
    return questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      answer: answers[q.id] ?? '',
      category: q.category,
    }))
  }, [questions, answers])

  const canAdvance = useMemo(() => {
    if (!currentSlide) return false
    if (currentSlide.type === 'idea') return idea.trim().length > 0
    if (currentSlide.type === 'question') {
      const value = answers[currentSlide.question.id] ?? ''
      return value.trim().length > 0
    }
    return true
  }, [currentSlide, idea, answers])

  const handleNext = useCallback(() => {
    if (!canAdvance || isLast) return
    setSlideIndex((i) => Math.min(i + 1, totalSteps - 1))
  }, [canAdvance, isLast, totalSteps])

  const handleBack = useCallback(() => {
    setSlideIndex((i) => Math.max(i - 1, 0))
  }, [])

  const handleIdeaContinue = useCallback(async () => {
    const trimmed = idea.trim()
    if (!trimmed) return
    setSubmittingIdea(true)
    try {
      await onIdeaSubmitted(trimmed)
    } finally {
      setSubmittingIdea(false)
    }
  }, [idea, onIdeaSubmitted])

  const handleComplete = useCallback(async () => {
    const trimmedIdea = idea.trim() || session?.idea?.trim() || 'Untitled product'
    setSaving(true)

    const { completeProductDefinition } = await import('../agent/product/operations')
    const summary = buildSummary(trimmedIdea, resolvedAnswers)
    const updated = completeProductDefinition(folder, {
      idea: trimmedIdea,
      summary,
      answers: resolvedAnswers,
    })

    onSave(updated)
    setSaving(false)
    onClose()
  }, [idea, session?.idea, resolvedAnswers, folder, onSave, onClose])

  if (!showWeave && session && !isBlankPhase && questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="max-w-md rounded-2xl border border-white/[0.08] bg-carbon-card p-6 text-center">
          <p className="text-sm text-red-400">
            No tailored questions were provided. Ask Carbon to try again.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.06]"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const renderChoiceOptions = (question: ProductSuiteQuestion) => {
    const options = [...(question.options ?? [])]
    if (question.technical && !options.includes(PRODUCT_I_DONT_KNOW)) {
      options.push(PRODUCT_I_DONT_KNOW)
    }

    return (
      <div className="mt-6 space-y-2">
        {options.map((option) => {
          const selected = answers[question.id] === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                selected
                  ? 'border-primary-400/60 bg-primary-400/10 text-zinc-50'
                  : 'border-white/[0.08] bg-carbon-surface text-zinc-300 hover:border-white/[0.14] hover:bg-carbon-elevated'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    )
  }

  const subtitle = showWeave
    ? 'Carbon is weaving your suite…'
    : isBlankPhase
      ? 'Describe what you want to build'
      : 'Review pre-filled answers, then continue'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex h-[min(720px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-carbon-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-400/15">
              <Sparkles className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-50">New Product Suite</h2>
              <p className="text-xs text-zinc-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submittingIdea && loading}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-40"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!showWeave && !isBlankPhase && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= slideIndex ? 'bg-primary-400' : 'bg-white/[0.08]'
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Step {slideIndex + 1} of {totalSteps}
            </p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {showWeave ? (
            <div className="flex h-full min-h-[280px] items-center justify-center">
              <CarbonWeaveLoader />
            </div>
          ) : currentSlide?.type === 'idea' ? (
            <div>
              <h3 className="text-xl font-semibold text-zinc-50">What do you want to build?</h3>
              <p className="mt-2 text-sm text-zinc-400">
                {isBlankPhase
                  ? 'Carbon will generate tailored questions for your specific product next.'
                  : 'Confirm or edit your product idea before continuing.'}
              </p>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                autoFocus
                placeholder="e.g. A wallet tracker with BLE and 6-month battery life"
                className="mt-6 w-full resize-none rounded-xl border border-white/[0.08] bg-carbon-surface px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-primary-400/50 focus:ring-1 focus:ring-primary-400/30"
              />
            </div>
          ) : currentSlide?.type === 'question' ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary-400/80">
                {currentSlide.question.category ?? 'Details'}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-zinc-50">{currentSlide.question.prompt}</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Suggested answer is pre-filled — edit if needed before continuing.
              </p>

              {currentSlide.question.kind === 'choice' ? (
                renderChoiceOptions(currentSlide.question)
              ) : (
                <textarea
                  value={answers[currentSlide.question.id] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [currentSlide.question.id]: e.target.value }))
                  }
                  rows={4}
                  autoFocus
                  className="mt-6 w-full resize-none rounded-xl border border-white/[0.08] bg-carbon-surface px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-primary-400/50 focus:ring-1 focus:ring-primary-400/30"
                />
              )}

              {currentSlide.question.technical && currentSlide.question.kind === 'text' && (
                <button
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentSlide.question.id]: PRODUCT_I_DONT_KNOW,
                    }))
                  }
                  className="mt-3 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  I don&apos;t know
                </button>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-semibold text-zinc-50">Review your product definition</h3>
              <p className="mt-2 text-sm text-zinc-400">
                This summary is saved to your project for Carbon to reference throughout design.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-carbon-surface p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Idea</p>
                  <p className="mt-1 text-sm text-zinc-100">{idea.trim() || session?.idea}</p>
                </div>

                {resolvedAnswers.map((a) => (
                  <div
                    key={a.questionId}
                    className="rounded-xl border border-white/[0.08] bg-carbon-surface p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {a.category ?? 'Detail'}
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-200">{a.prompt}</p>
                    <p className="mt-2 text-sm text-zinc-400">{a.answer || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!showWeave && (
          <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-6 py-4">
            {!isBlankPhase ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isFirst}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {isBlankPhase ? (
              <button
                type="button"
                onClick={handleIdeaContinue}
                disabled={!canAdvance || submittingIdea}
                className="flex items-center gap-2 rounded-lg bg-primary-400 px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-primary-300 disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : isLast ? (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-400 px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-primary-300 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Save product definition
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance}
                className="flex items-center gap-2 rounded-lg bg-primary-400 px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-primary-300 disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
