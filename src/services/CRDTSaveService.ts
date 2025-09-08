/**
 * CRDT Save Service
 * 
 * Handles saving CRDT operations to the backend with proper error handling
 * and retry logic for robust data persistence.
 */

import { CRDTService, CRDTOperation, crdtService } from './CRDTService'

export interface SaveResult {
  success: boolean
  error?: string
  timestamp: number
  operationsCount: number
}

export class CRDTSaveService {
  private crdtService: CRDTService
  private saveQueue: CRDTOperation[] = []
  private isSaving: boolean = false
  private retryCount: number = 0
  private maxRetries: number = 3
  private saveTimeout: number = 5000 // 5 seconds
  private getAccessToken: () => Promise<string>

  constructor(crdtService: CRDTService, getAccessToken: () => Promise<string>) {
    this.crdtService = crdtService
    this.getAccessToken = getAccessToken
  }

  /**
   * Add an operation to the save queue and trigger a save
   */
  async queueOperation(operation: CRDTOperation, projectId: string): Promise<SaveResult> {
    console.log('🔧 CRDTSaveService: Queueing operation:', {
      type: operation.type,
      id: operation.id,
      timestamp: operation.timestamp,
      projectId
    })

    // Add to queue
    this.saveQueue.push(operation)

    // Trigger save
    return this.saveOperations(projectId)
  }

  /**
   * Save all queued operations to the backend
   */
  private async saveOperations(projectId: string): Promise<SaveResult> {
    if (this.isSaving) {
      console.log('🔧 CRDTSaveService: Save already in progress, queuing operation')
      return { success: true, timestamp: Date.now(), operationsCount: 0 }
    }

    if (this.saveQueue.length === 0) {
      return { success: true, timestamp: Date.now(), operationsCount: 0 }
    }

    this.isSaving = true
    const operationsToSave = [...this.saveQueue]
    this.saveQueue = []

    try {
      console.log('🔧 CRDTSaveService: Saving operations:', {
        count: operationsToSave.length,
        projectId,
        retryCount: this.retryCount
      })

      // Get current CRDT state
      const crdtState = this.crdtService.getState()

      // Get access token
      const token = await this.getAccessToken()
      
      // Save to backend
      const response = await fetch(`/api/user/projects/${projectId}/crdt-save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          operations: operationsToSave,
          crdtState,
          timestamp: Date.now()
        })
      })

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      console.log('✅ CRDTSaveService: Save successful:', {
        operationsCount: operationsToSave.length,
        timestamp: result.timestamp
      })

      // Reset retry count on success
      this.retryCount = 0

      return {
        success: true,
        timestamp: result.timestamp || Date.now(),
        operationsCount: operationsToSave.length
      }

    } catch (error) {
      console.error('❌ CRDTSaveService: Save failed:', error)
      
      // Re-queue operations for retry
      this.saveQueue.unshift(...operationsToSave)
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(`🔧 CRDTSaveService: Retrying save (attempt ${this.retryCount}/${this.maxRetries})`)
        
        // Exponential backoff
        const delay = Math.pow(2, this.retryCount) * 1000
        setTimeout(() => {
          this.saveOperations(projectId)
        }, delay)
      } else {
        console.error('❌ CRDTSaveService: Max retries exceeded, operations lost')
        this.retryCount = 0
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        operationsCount: operationsToSave.length
      }
    } finally {
      this.isSaving = false
    }
  }

  /**
   * Force save all pending operations
   */
  async forceSave(projectId: string): Promise<SaveResult> {
    console.log('🔧 CRDTSaveService: Force saving all operations')
    return this.saveOperations(projectId)
  }

  /**
   * Get the current save queue status
   */
  getQueueStatus(): {
    queueLength: number
    isSaving: boolean
    retryCount: number
  } {
    return {
      queueLength: this.saveQueue.length,
      isSaving: this.isSaving,
      retryCount: this.retryCount
    }
  }

  /**
   * Clear the save queue (useful for testing or error recovery)
   */
  clearQueue(): void {
    console.log('🔧 CRDTSaveService: Clearing save queue')
    this.saveQueue = []
    this.retryCount = 0
  }
}

// Create a function to get the CRDT save service with proper auth
let crdtSaveServiceInstance: CRDTSaveService | null = null

export function getCRDTSaveService(getAccessToken: () => Promise<string>): CRDTSaveService {
  if (!crdtSaveServiceInstance) {
    crdtSaveServiceInstance = new CRDTSaveService(crdtService, getAccessToken)
  }
  return crdtSaveServiceInstance
}

// The CRDTSaveService class is already exported above
