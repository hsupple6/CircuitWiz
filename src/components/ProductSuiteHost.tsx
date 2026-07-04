import { useCallback, useRef } from 'react'
import { clearProductSuiteSession } from '../agent/product/operations'
import { useAgent } from '../contexts/AgentContext'
import { ProductSuite } from './ProductSuite'
import type { ProjectFolder } from '../types/workspace'

interface ProductSuiteHostProps {
  onProjectUpdate: (folder: ProjectFolder) => void
}

export function ProductSuiteHost({ onProjectUpdate }: ProductSuiteHostProps) {
  const {
    projectContext,
    productSuiteOpen,
    productSuiteLoading,
    closeProductSuite,
    submitProductIdea,
    submitProductSuiteCompletion,
  } = useAgent()

  const saveStartedRef = useRef(false)
  const folder = projectContext?.folder
  const session = folder?.productSuiteSession

  const handleClose = useCallback(() => {
    const current = projectContext?.folder
    if (current?.productSuiteSession) {
      onProjectUpdate(clearProductSuiteSession(current))
    }
    closeProductSuite()
  }, [projectContext?.folder, onProjectUpdate, closeProductSuite])

  const handleSave = useCallback(
    (updated: ProjectFolder) => {
      if (saveStartedRef.current) return
      saveStartedRef.current = true
      void submitProductSuiteCompletion(updated).finally(() => {
        saveStartedRef.current = false
      })
    },
    [submitProductSuiteCompletion]
  )

  if (!productSuiteOpen || !folder) return null

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
