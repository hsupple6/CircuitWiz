import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const fullComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-5 mt-10 border-b border-white/[0.08] pb-3 text-3xl font-bold tracking-tight text-zinc-50 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-9 text-2xl font-semibold tracking-tight text-zinc-100">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-7 text-xl font-semibold text-zinc-100">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-5 text-lg font-medium text-zinc-200">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-4 leading-7 text-zinc-300 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-2 pl-6 text-zinc-300 marker:text-primary-400/80">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-2 pl-6 text-zinc-300 marker:text-primary-400/80">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-5 border-l-4 border-primary-400/60 bg-white/[0.03] py-1 pl-4 pr-2 italic text-zinc-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-white/[0.08]" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary-400 underline decoration-primary-400/40 underline-offset-2 transition-colors hover:text-primary-300 hover:decoration-primary-300/60"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className={`${className ?? ''} font-mono text-[13px] leading-relaxed text-zinc-200`} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.9em] text-primary-300"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-5 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/50 p-4">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full min-w-[320px] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.04] text-zinc-200">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-white/[0.06]">{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-white/[0.02]">{children}</tr>,
  th: ({ children }) => (
    <th className="border-b border-white/[0.08] px-4 py-3 font-semibold text-zinc-100">{children}</th>
  ),
  td: ({ children }) => <td className="px-4 py-3 text-zinc-300">{children}</td>,
}

const cardComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-1 mt-0 text-sm font-bold leading-snug text-zinc-100">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1 mt-1.5 text-[13px] font-semibold leading-snug text-zinc-100">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-0.5 mt-1 text-xs font-semibold leading-snug text-zinc-200">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-0.5 mt-1 text-xs font-medium leading-snug text-zinc-300">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-1 text-[11px] leading-relaxed text-zinc-400 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-400">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-1 list-disc space-y-0.5 pl-3.5 text-[11px] text-zinc-400 marker:text-primary-400/70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-1 list-decimal space-y-0.5 pl-3.5 text-[11px] text-zinc-400 marker:text-primary-400/70">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-1 border-l-2 border-primary-400/50 pl-2 text-[11px] italic text-zinc-500">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-1.5 border-white/[0.06]" />,
  a: ({ children }) => <span className="text-primary-400">{children}</span>,
  code: ({ children, ...props }) => (
    <code className="rounded bg-white/[0.08] px-1 font-mono text-[10px] text-primary-300" {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-1 overflow-hidden rounded border border-white/[0.06] bg-black/40 p-1.5 text-[10px]">
      {children}
    </pre>
  ),
  table: () => null,
}

export function MarkdownPreview({
  content,
  className = '',
  variant = 'full',
  emptyLabel = 'This document is empty.',
}: {
  content: string
  className?: string
  variant?: 'full' | 'card'
  emptyLabel?: string
}) {
  if (!content.trim()) {
    return (
      <p className={`italic text-zinc-500 ${variant === 'card' ? 'text-[11px]' : 'text-sm'}`}>
        {emptyLabel}
      </p>
    )
  }

  const components = variant === 'card' ? cardComponents : fullComponents

  return (
    <article
      className={`markdown-preview ${variant === 'full' ? 'max-w-3xl' : ''} ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
