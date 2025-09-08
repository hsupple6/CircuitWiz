import { GridCell, WireConnection } from '../modules/types'
import { ComponentState } from '../systems/ElectricalSystem'

export interface UserProject {
  id: string
  name: string
  description?: string
  gridData: GridCell[][]
  wires: WireConnection[]
  componentStates: Record<string, ComponentState>
  metadata: {
    createdAt: string
    updatedAt: string
    version: string
    gridSize: { width: number; height: number }
    zoom: number
    gridOffset: { x: number; y: number }
  }
  arduinoProject?: {
    name: string
    files: Array<{
      name: string
      content: string
      type: 'ino' | 'h' | 'cpp' | 'c'
      isMain: boolean
    }>
    board: string
    libraries: string[]
  }
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  defaultGridSize: { width: number; height: number }
  autoSave: boolean
  showGrid: boolean
  snapToGrid: boolean
  defaultZoom: number
  notifications: {
    compilation: boolean
    errors: boolean
    warnings: boolean
  }
  editor: {
    fontSize: number
    tabSize: number
    wordWrap: boolean
  }
}

export interface UserData {
  id: string
  email: string
  name: string
  picture?: string
  nickname?: string
  settings: UserSettings
  projects: UserProject[]
  createdAt: string
  updatedAt: string
}

export class UserDatabaseService {
  private baseUrl: string
  private getAccessToken: () => Promise<string>

  constructor(getAccessToken: () => Promise<string>) {
    this.baseUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001'
    this.getAccessToken = getAccessToken
  }

  private async makeAuthenticatedRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    try {
      const token = await this.getAccessToken()
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error occurred')
    }
  }

  // User data operations
  async getUserData(): Promise<UserData> {
    const response = await this.makeAuthenticatedRequest('/api/user/data')
    return response.json()
  }

  async updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const response = await this.makeAuthenticatedRequest('/api/user/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
    return response.json()
  }

  // Project operations
  async getProjects(): Promise<UserProject[]> {
    const response = await this.makeAuthenticatedRequest('/api/user/projects')
    const data = await response.json()
    return data.projects
  }

  async getProject(projectId: string): Promise<UserProject> {
    const response = await this.makeAuthenticatedRequest(`/api/user/projects/${projectId}`)
    return response.json()
  }

  async createProject(project: Omit<UserProject, 'id' | 'metadata'>): Promise<UserProject> {
    const response = await this.makeAuthenticatedRequest('/api/user/projects', {
      method: 'POST',
      body: JSON.stringify(project)
    })
    return response.json()
  }

  async updateProject(projectId: string, updates: Partial<UserProject>): Promise<UserProject> {
    const response = await this.makeAuthenticatedRequest(`/api/user/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
    return response.json()
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.makeAuthenticatedRequest(`/api/user/projects/${projectId}`, {
      method: 'DELETE'
    })
  }

  async duplicateProject(projectId: string, newName: string): Promise<UserProject> {
    const response = await this.makeAuthenticatedRequest(`/api/user/projects/${projectId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name: newName })
    })
    return response.json()
  }

  // Auto-save functionality
  async autoSaveProject(projectId: string, projectData: Partial<UserProject>): Promise<void> {
    try {
      await this.makeAuthenticatedRequest(`/api/user/projects/${projectId}/autosave`, {
        method: 'PATCH',
        body: JSON.stringify(projectData)
      })
    } catch (error) {
      console.warn('Auto-save failed:', error)
      // Don't throw - auto-save failures shouldn't break the UI
    }
  }

  // Export/Import functionality
  async exportProject(projectId: string): Promise<Blob> {
    const response = await this.makeAuthenticatedRequest(`/api/user/projects/${projectId}/export`)
    return response.blob()
  }

  async importProject(file: File): Promise<UserProject> {
    const formData = new FormData()
    formData.append('project', file)
    
    const token = await this.getAccessToken()
    const response = await fetch(`${this.baseUrl}/api/user/projects/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Import failed')
    }

    return response.json()
  }

  // Search and filtering
  async searchProjects(query: string): Promise<UserProject[]> {
    const response = await this.makeAuthenticatedRequest(`/api/user/projects/search?q=${encodeURIComponent(query)}`)
    const data = await response.json()
    return data.projects
  }

  async getRecentProjects(limit: number = 10): Promise<UserProject[]> {
    const response = await this.makeAuthenticatedRequest(`/api/user/projects/recent?limit=${limit}`)
    const data = await response.json()
    return data.projects
  }
}
