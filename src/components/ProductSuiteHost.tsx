import { useCallback, useContext, useRef } from 'react'
import { clearProductSuiteSession } from '../agent/product/operations'
import { AgentContext } from '../contexts/AgentContext'
import { ProductSuite } from './ProductSuite'
import type { ProjectFolder } from '../types/workspace'

interface ProductSuiteHostProps {
  onProjectUpdate: (folder: ProjectFolder) => void
}

export function ProductSuiteHost({ onProjectUpdate }: ProductSuiteHostProps) {
  const agent = useContext(AgentContext)
  const saveStartedRef = useRef(false)

  const projectContext = agent?.projectContext
  const productSuiteOpen = agent?.productSuiteOpen ?? false
  const productSuiteLoading = agent?.productSuiteLoading ?? false
  const closeProductSuite = agent?.closeProductSuite
  const submitProductIdea = agent?.submitProductIdea
  const submitProductSuiteCompletion = agent?.submitProductSuiteCompletion

  const folder = projectContext?.folder
  const session = folder?.productSuiteSession

  const handleClose = useCallback(() => {
    const current = projectContext?.folder
    if (current?.productSuiteSession) {
      onProjectUpdate(clearProductSuiteSession(current))
    }
    closeProductSuite?.()
  }, [projectContext?.folder, onProjectUpdate, closeProductSuite])

  const handleSave = useCallback(
    (updated: ProjectFolder) => {
      if (!submitProductSuiteCompletion || saveStartedRef.current) return
      saveStartedRef.current = true
      void submitProductSuiteCompletion(updated).finally(() => {
        saveStartedRef.current = false
      })
    },
    [submitProductSuiteCompletion]
  )

  if (!agent || !productSuiteOpen || !folder || !submitProductIdea) return null

  return (
    <ProductSuite
      folder={folder}
      session={session}
      loading={productSuiteLoading}
      onSave={handleSave}
      onClose={handleClose}
      onIdeaSubmitted={submitProductIdea}
    />
  )
}
