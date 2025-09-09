import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { UserDatabaseService, UserProject, UserSettings, ProjectSaveData } from '../services/UserDatabaseService'

export function useUserDatabase() {
  const { getAccessToken, isAuthenticated } = useAuth()
  const [userDatabase, setUserDatabase] = useState<UserDatabaseService | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && getAccessToken) {
      setUserDatabase(new UserDatabaseService(getAccessToken))
    } else {
      setUserDatabase(null)
    }
  }, [isAuthenticated, getAccessToken])

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    if (!userDatabase) {
      setError('User database not available')
      return null
    }

    setLoading(true)
    setError(null)
    
    try {
      const result = await operation()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('User database operation failed:', err)
      
      // Don't show authentication errors to the user
      if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('Access token')) {
        setError(null)
      }
      
      return null
    } finally {
      setLoading(false)
    }
  }, [userDatabase])

  // Project operations
  const getProjects = useCallback(async (): Promise<UserProject[]> => {
    const result = await executeWithErrorHandling(() => userDatabase!.getProjects())
    return result || []
  }, [executeWithErrorHandling, userDatabase])

  const getProject = useCallback(async (projectId: string): Promise<UserProject | null> => {
    return await executeWithErrorHandling(() => userDatabase!.getProject(projectId))
  }, [executeWithErrorHandling, userDatabase])

  const createProject = useCallback(async (project: Omit<UserProject, 'id' | 'metadata'>): Promise<UserProject | null> => {
    return await executeWithErrorHandling(() => userDatabase!.createProject(project))
  }, [executeWithErrorHandling, userDatabase])

  const updateProject = useCallback(async (projectId: string, updates: Partial<UserProject>): Promise<UserProject | null> => {
    return await executeWithErrorHandling(() => userDatabase!.updateProject(projectId, updates))
  }, [executeWithErrorHandling, userDatabase])

  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    const result = await executeWithErrorHandling(() => userDatabase!.deleteProject(projectId))
    return result !== null
  }, [executeWithErrorHandling, userDatabase])

  const duplicateProject = useCallback(async (projectId: string, newName: string): Promise<UserProject | null> => {
    return await executeWithErrorHandling(() => userDatabase!.duplicateProject(projectId, newName))
  }, [executeWithErrorHandling, userDatabase])

  const autoSaveProject = useCallback(async (projectId: string, projectData: ProjectSaveData): Promise<void> => {
    await executeWithErrorHandling(() => userDatabase!.autoSaveProject(projectId, projectData))
  }, [executeWithErrorHandling, userDatabase])

  const searchProjects = useCallback(async (query: string): Promise<UserProject[]> => {
    const result = await executeWithErrorHandling(() => userDatabase!.searchProjects(query))
    return result || []
  }, [executeWithErrorHandling, userDatabase])

  const getRecentProjects = useCallback(async (limit: number = 10): Promise<UserProject[]> => {
    const result = await executeWithErrorHandling(() => userDatabase!.getRecentProjects(limit))
    return result || []
  }, [executeWithErrorHandling, userDatabase])

  // Settings operations
  const updateUserSettings = useCallback(async (settings: Partial<UserSettings>): Promise<UserSettings | null> => {
    return await executeWithErrorHandling(() => userDatabase!.updateUserSettings(settings))
  }, [executeWithErrorHandling, userDatabase])

  // Export/Import operations
  const exportProject = useCallback(async (projectId: string): Promise<Blob | null> => {
    return await executeWithErrorHandling(() => userDatabase!.exportProject(projectId))
  }, [executeWithErrorHandling, userDatabase])

  const importProject = useCallback(async (file: File): Promise<UserProject | null> => {
    return await executeWithErrorHandling(() => userDatabase!.importProject(file))
  }, [executeWithErrorHandling, userDatabase])

  return {
    // State
    loading,
    error,
    isReady: !!userDatabase,
    
    // Project operations
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
    autoSaveProject,
    searchProjects,
    getRecentProjects,
    
    // Settings operations
    updateUserSettings,
    
    // Export/Import operations
    exportProject,
    importProject
  }
}
