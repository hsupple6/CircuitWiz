// Simple in-memory database for user data
// In production, this would be replaced with a real database like PostgreSQL or DynamoDB

class UserDatabase {
  constructor() {
    // In-memory storage - in production, this would be a real database
    this.users = new Map() // userId -> user data
    this.projects = new Map() // projectId -> project data
    this.userProjects = new Map() // userId -> Set of projectIds
  }

  // User management
  async createOrUpdateUser(userData) {
    const userId = userData.id
    const existingUser = this.users.get(userId)
    
    const user = {
      id: userId,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      nickname: userData.nickname,
      settings: existingUser?.settings || this.getDefaultSettings(),
      createdAt: existingUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    this.users.set(userId, user)
    return user
  }

  async getUser(userId) {
    return this.users.get(userId) || null
  }

  async updateUserSettings(userId, settings) {
    const user = this.users.get(userId)
    if (!user) {
      throw new Error('User not found')
    }
    
    user.settings = { ...user.settings, ...settings }
    user.updatedAt = new Date().toISOString()
    this.users.set(userId, user)
    return user.settings
  }

  // Project management
  async createProject(userId, projectData) {
    const projectId = this.generateId()
    const project = {
      id: projectId,
      userId,
      name: projectData.name,
      description: projectData.description || '',
      gridData: projectData.gridData || [],
      wires: projectData.wires || [],
      componentStates: projectData.componentStates || {},
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        gridSize: projectData.metadata?.gridSize || { width: 50, height: 50 },
        zoom: projectData.metadata?.zoom || 1,
        gridOffset: projectData.metadata?.gridOffset || { x: -200, y: -200 }
      },
      arduinoProject: projectData.arduinoProject || null
    }
    
    this.projects.set(projectId, project)
    
    // Add to user's project list
    if (!this.userProjects.has(userId)) {
      this.userProjects.set(userId, new Set())
    }
    this.userProjects.get(userId).add(projectId)
    
    return project
  }

  async getProject(projectId, userId) {
    const project = this.projects.get(projectId)
    if (!project || project.userId !== userId) {
      return null
    }
    return project
  }

  async getUserProjects(userId) {
    const userProjectIds = this.userProjects.get(userId) || new Set()
    const projects = []
    
    for (const projectId of userProjectIds) {
      const project = this.projects.get(projectId)
      if (project) {
        projects.push(project)
      }
    }
    
    // Sort by updated date (newest first)
    return projects.sort((a, b) => new Date(b.metadata.updatedAt) - new Date(a.metadata.updatedAt))
  }

  async updateProject(projectId, userId, updates) {
    const project = this.projects.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found or access denied')
    }
    
    // Update project data
    Object.assign(project, updates)
    project.metadata.updatedAt = new Date().toISOString()
    
    this.projects.set(projectId, project)
    return project
  }

  async deleteProject(projectId, userId) {
    const project = this.projects.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found or access denied')
    }
    
    this.projects.delete(projectId)
    
    // Remove from user's project list
    const userProjectIds = this.userProjects.get(userId)
    if (userProjectIds) {
      userProjectIds.delete(projectId)
    }
    
    return true
  }

  async duplicateProject(projectId, userId, newName) {
    const originalProject = this.projects.get(projectId)
    if (!originalProject || originalProject.userId !== userId) {
      throw new Error('Project not found or access denied')
    }
    
    const newProjectData = {
      name: newName,
      description: originalProject.description,
      gridData: JSON.parse(JSON.stringify(originalProject.gridData)), // Deep copy
      wires: JSON.parse(JSON.stringify(originalProject.wires)),
      componentStates: JSON.parse(JSON.stringify(originalProject.componentStates)),
      metadata: {
        ...originalProject.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      arduinoProject: originalProject.arduinoProject ? JSON.parse(JSON.stringify(originalProject.arduinoProject)) : null
    }
    
    return await this.createProject(userId, newProjectData)
  }

  async searchProjects(userId, query) {
    const projects = await this.getUserProjects(userId)
    const searchTerm = query.toLowerCase()
    
    return projects.filter(project => 
      project.name.toLowerCase().includes(searchTerm) ||
      (project.description && project.description.toLowerCase().includes(searchTerm))
    )
  }

  async getRecentProjects(userId, limit = 10) {
    const projects = await this.getUserProjects(userId)
    return projects.slice(0, limit)
  }

  // Auto-save functionality
  async autoSaveProject(projectId, userId, projectData) {
    const project = this.projects.get(projectId)
    if (!project || project.userId !== userId) {
      return false
    }
    
    // Only save occupied components and wires - exclude componentStates and other fields
    if (projectData.occupiedComponents) project.occupiedComponents = projectData.occupiedComponents
    if (projectData.wires) project.wires = projectData.wires
    
    // Update metadata timestamp
    project.metadata.updatedAt = new Date().toISOString()
    this.projects.set(projectId, project)
    return true
  }

  // Utility methods
  generateId() {
    return 'proj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
  }

  getDefaultSettings() {
    return {
      theme: 'system',
      defaultGridSize: { width: 50, height: 50 },
      autoSave: true,
      showGrid: true,
      snapToGrid: true,
      defaultZoom: 1,
      notifications: {
        compilation: true,
        errors: true,
        warnings: true
      },
      editor: {
        fontSize: 14,
        tabSize: 2,
        wordWrap: true
      }
    }
  }

  // Export/Import functionality
  async exportProject(projectId, userId) {
    const project = this.projects.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Project not found or access denied')
    }
    
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      project: project
    }
  }

  async importProject(userId, projectData) {
    // Validate project data
    if (!projectData.project || !projectData.project.name) {
      throw new Error('Invalid project data')
    }
    
    const importedProject = {
      name: projectData.project.name,
      description: projectData.project.description || '',
      gridData: projectData.project.gridData || [],
      wires: projectData.project.wires || [],
      componentStates: projectData.project.componentStates || {},
      metadata: {
        ...projectData.project.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      arduinoProject: projectData.project.arduinoProject || null
    }
    
    return await this.createProject(userId, importedProject)
  }
}

// Create a singleton instance
const userDatabase = new UserDatabase()

module.exports = userDatabase
