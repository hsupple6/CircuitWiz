import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

interface EditorFloatingChromeProps {
  title: string
  backLabel: string
  onBack: () => void
  showSave?: boolean
  saveStatus?: ReactNode
  toolbar: ReactNode
  /** Extra inset from the right (e.g. when a docked panel column exists) */
  className?: string
}

export function EditorFloatingChrome({
  title,
  backLabel,
  onBack,
  showSave,
  saveStatus,
  toolbar,
  className = '',
}: EditorFloatingChromeProps) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="group/back absolute left-4 top-4 z-[60] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-zinc-100"
        aria-label={backLabel}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-white/90 opacity-0 shadow-md shadow-black/10 transition-opacity duration-200 group-hover/back:opacity-75 dark:bg-zinc-900/90 dark:shadow-black/40"
        />
        <ArrowLeft className="relative h-5 w-5 shrink-0 text-gray-600 transition-colors group-hover/back:text-primary-600 dark:text-zinc-400 dark:group-hover/back:text-primary-300" />
        <span className="relative hidden max-w-[9rem] truncate sm:inline">{backLabel}</span>
      </button>

      <header
        className={`group/header absolute left-1/2 top-4 z-50 inline-flex h-14 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center rounded-full border border-gray-200/70 bg-white/92 px-4 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-[box-shadow,max-width] duration-300 ease-out hover:shadow-[0_12px_40px_rgba(0,0,0,0.14)] focus-within:shadow-[0_12px_40px_rgba(0,0,0,0.14)] dark:border-white/[0.08] dark:bg-zinc-950/88 dark:shadow-black/45 dark:hover:shadow-black/55 sm:max-w-[min(calc(100%-2rem),960px)] sm:px-5 ${className}`}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <h1 className="truncate text-base font-semibold text-gray-900 dark:text-zinc-100 sm:max-w-[12rem] sm:text-lg lg:max-w-[16rem]">
            {title}
          </h1>
          {showSave && saveStatus}
        </div>

        <div
          className="pointer-events-none flex max-w-0 items-center gap-2 overflow-hidden opacity-0 transition-[max-width,opacity,margin,padding] duration-300 ease-out group-hover/header:pointer-events-auto group-hover/header:ml-2 group-hover/header:max-w-[min(72vw,960px)] group-hover/header:opacity-100 group-hover/header:pl-1 group-hover/header:pr-0 focus-within:pointer-events-auto focus-within:ml-2 focus-within:max-w-[min(72vw,960px)] focus-within:opacity-100 focus-within:pl-1 sm:group-hover/header:ml-3 sm:group-hover/header:max-w-[min(68vw,960px)] sm:focus-within:ml-3"
        >
          <div className="h-5 w-px shrink-0 bg-gray-200 dark:bg-white/10" />
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">{toolbar}</div>
        </div>
      </header>
    </>
  )
}
