import { useEffect, useState } from 'react'
import { GROUP_BOX_SYMBOL_SVG } from '../modules/kicadSymbolMap'
import { loadKicadSymbolSvg } from '../utils/kicadSymbolLoader'

interface KicadSymbolProps {
  moduleName: string
  logicModule?: string
  className?: string
}

export function KicadSymbol({ moduleName, logicModule, className = '' }: KicadSymbolProps) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(
    moduleName === 'Group Box' ? GROUP_BOX_SYMBOL_SVG : null
  )

  useEffect(() => {
    if (moduleName === 'Group Box') {
      setSvgMarkup(GROUP_BOX_SYMBOL_SVG)
      return
    }

    let cancelled = false

    loadKicadSymbolSvg(moduleName, { width: 48, height: 40 }, logicModule).then((svg) => {
      if (!cancelled) setSvgMarkup(svg)
    })

    return () => {
      cancelled = true
    }
  }, [moduleName, logicModule])

  if (!svgMarkup) {
    return (
      <div
        className={`flex h-10 w-12 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-dark-bg ${className}`}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={`kicad-symbol flex h-10 w-12 shrink-0 items-center justify-center text-gray-800 dark:text-zinc-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
      aria-hidden
    />
  )
}
