import { useCallback } from 'react'
import { clearProductSuiteSession } from '../agent/product/operations'
import { useAgent } from '../contexts/AgentContext'
import { ProductSuite } from './ProductSuite'

interface ProductSuiteHostProps {
  onProjectUpdate: (folder: import('../types/workspace').ProjectFolder) => void
}

export function ProductSuiteHost({ onProjectUpdate }: ProductSuiteHostProps) {
  const {
    projectContext,
    productSuiteOpen,
    productSuiteLoading,
    closeProductSuite,
    submitProductIdea,
  } = useAgent()

  const folder = projectContext?.folder
  const session = folder?.productSuiteSession

  const handleClose = useCallback(() => {
    if (folder) {
      onProjectUpdate(clearProductSuiteSession(folder))
    }
    closeProductSuite()
  }, [folder, onProjectUpdate, closeProductSuite])

  const handleSave = useCallback(
    (updated: import('../types/workspace').ProjectFolder) => {
      onProjectUpdate(updated)
      closeProductSuite()
    },
    [onProjectUpdate, closeProductSuite]
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
