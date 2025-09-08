const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class SQLiteDatabase {
  constructor() {
    // Create database directory if it doesn't exist
    const dbDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = path.join(dbDir, 'circuitwiz.db');
    this.db = null;
    this.initialize();
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database:', this.dbPath);
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          picture TEXT,
          nickname TEXT,
          settings TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createProjectsTable = `
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          grid_data TEXT DEFAULT '[]',
          wires TEXT DEFAULT '[]',
          component_states TEXT DEFAULT '{}',
          arduino_project TEXT DEFAULT '{}',
          metadata TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      this.db.serialize(() => {
        this.db.run(createUsersTable, (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            reject(err);
          }
        });

        this.db.run(createProjectsTable, (err) => {
          if (err) {
            console.error('Error creating projects table:', err);
            reject(err);
          } else {
            console.log('Database tables created successfully');
            resolve();
          }
        });
      });
    });
  }

  // User operations
  async createOrUpdateUser(userData) {
    return new Promise((resolve, reject) => {
      const { id, email, name, picture, nickname } = userData;
      const settings = JSON.stringify({});
      
      const sql = `
        INSERT OR REPLACE INTO users (id, email, name, picture, nickname, settings, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(sql, [id, email, name, picture, nickname, settings], function(err) {
        if (err) {
          console.error('Error creating/updating user:', err);
          reject(err);
        } else {
          resolve({ id, email, name, picture, nickname, settings: {} });
        }
      });
    });
  }

  async getUser(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE id = ?';
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          console.error('Error getting user:', err);
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            settings: JSON.parse(row.settings || '{}')
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async updateUserSettings(userId, settings) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [JSON.stringify(settings), userId], function(err) {
        if (err) {
          console.error('Error updating user settings:', err);
          reject(err);
        } else {
          resolve(settings);
        }
      });
    });
  }

  // Project operations
  async getUserProjects(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC';
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          console.error('Error getting user projects:', err);
          reject(err);
        } else {
          const projects = rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            gridData: JSON.parse(row.grid_data || '[]'),
            wires: JSON.parse(row.wires || '[]'),
            componentStates: JSON.parse(row.component_states || '{}'),
            arduinoProject: JSON.parse(row.arduino_project || '{}'),
            metadata: {
              ...JSON.parse(row.metadata || '{}'),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }
          }));
          resolve(projects);
        }
      });
    });
  }

  async getProject(projectId, userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM projects WHERE id = ? AND user_id = ?';
      this.db.get(sql, [projectId, userId], (err, row) => {
        if (err) {
          console.error('❌ SQLite: Error getting project:', err);
          reject(err);
        } else if (row) {
          const gridData = JSON.parse(row.grid_data || '[]');
          const wires = JSON.parse(row.wires || '[]');
          const componentStates = JSON.parse(row.component_states || '{}');
          
          console.log('🔧 SQLite: Loading project:', row.name, {
            gridDataRows: gridData.length,
            wiresCount: wires.length,
            componentStatesCount: Object.keys(componentStates).length,
            hasGridData: gridData.length > 0,
            hasWires: wires.length > 0,
            hasComponentStates: Object.keys(componentStates).length > 0
          });
          
          resolve({
            id: row.id,
            name: row.name,
            description: row.description,
            gridData,
            wires,
            componentStates,
            arduinoProject: JSON.parse(row.arduino_project || '{}'),
            metadata: {
              ...JSON.parse(row.metadata || '{}'),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }
          });
        } else {
          console.log('🔧 SQLite: Project not found:', projectId);
          resolve(null);
        }
      });
    });
  }

  async createProject(userId, projectData) {
    return new Promise((resolve, reject) => {
      const projectId = this.generateId();
      const {
        name,
        description = '',
        gridData = [],
        wires = [],
        componentStates = {},
        arduinoProject = {},
        metadata = {}
      } = projectData;

      const defaultMetadata = {
        version: '1.0.0',
        gridSize: { width: 50, height: 50 },
        zoom: 1,
        gridOffset: { x: -200, y: -200 },
        ...metadata
      };

      const sql = `
        INSERT INTO projects (
          id, user_id, name, description, grid_data, wires, 
          component_states, arduino_project, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        projectId,
        userId,
        name,
        description,
        JSON.stringify(gridData),
        JSON.stringify(wires),
        JSON.stringify(componentStates),
        JSON.stringify(arduinoProject),
        JSON.stringify(defaultMetadata)
      ], function(err) {
        if (err) {
          console.error('Error creating project:', err);
          reject(err);
        } else {
          resolve({
            id: projectId,
            name,
            description,
            gridData,
            wires,
            componentStates,
            arduinoProject,
            metadata: {
              ...defaultMetadata,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          });
        }
      });
    });
  }

  async updateProject(projectId, userId, updates) {
    return new Promise((resolve, reject) => {
      const {
        name,
        description,
        gridData,
        wires,
        componentStates,
        arduinoProject,
        metadata
      } = updates;

      const updateFields = [];
      const values = [];

      if (name !== undefined) {
        updateFields.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updateFields.push('description = ?');
        values.push(description);
      }
      if (gridData !== undefined) {
        updateFields.push('grid_data = ?');
        values.push(JSON.stringify(gridData));
      }
      if (wires !== undefined) {
        updateFields.push('wires = ?');
        values.push(JSON.stringify(wires));
      }
      if (componentStates !== undefined) {
        updateFields.push('component_states = ?');
        values.push(JSON.stringify(componentStates));
      }
      if (arduinoProject !== undefined) {
        updateFields.push('arduino_project = ?');
        values.push(JSON.stringify(arduinoProject));
      }
      if (metadata !== undefined) {
        updateFields.push('metadata = ?');
        values.push(JSON.stringify(metadata));
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId, userId);

      const sql = `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

      this.db.run(sql, values, function(err) {
        if (err) {
          console.error('Error updating project:', err);
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Project not found or access denied'));
        } else {
          // Return the updated project
          resolve({ id: projectId, ...updates });
        }
      });
    });
  }

  async deleteProject(projectId, userId) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM projects WHERE id = ? AND user_id = ?';
      this.db.run(sql, [projectId, userId], function(err) {
        if (err) {
          console.error('Error deleting project:', err);
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Project not found or access denied'));
        } else {
          resolve(true);
        }
      });
    });
  }

  async duplicateProject(projectId, userId, newName) {
    return new Promise((resolve, reject) => {
      // First get the original project
      this.getProject(projectId, userId).then(originalProject => {
        if (!originalProject) {
          reject(new Error('Project not found'));
          return;
        }

        // Create a new project with the same data but new name
        const duplicateData = {
          ...originalProject,
          name: newName,
          metadata: {
            ...originalProject.metadata,
            version: '1.0.0'
          }
        };

        this.createProject(userId, duplicateData).then(resolve).catch(reject);
      }).catch(reject);
    });
  }

  async autoSaveProject(projectId, userId, projectData) {
    return new Promise((resolve, reject) => {
      console.log('🔧 SQLite: Auto-saving project:', projectId, {
        hasGridData: projectData.gridData !== undefined,
        hasWires: projectData.wires !== undefined,
        hasComponentStates: projectData.componentStates !== undefined,
        hasMetadata: projectData.metadata !== undefined
      });

      const updateFields = [];
      const values = [];

      if (projectData.gridData !== undefined) {
        updateFields.push('grid_data = ?');
        values.push(JSON.stringify(projectData.gridData));
        console.log('🔧 SQLite: Saving grid data with', projectData.gridData.length, 'rows');
      }
      if (projectData.wires !== undefined) {
        updateFields.push('wires = ?');
        values.push(JSON.stringify(projectData.wires));
        console.log('🔧 SQLite: Saving', projectData.wires.length, 'wires');
      }
      if (projectData.componentStates !== undefined) {
        updateFields.push('component_states = ?');
        values.push(JSON.stringify(projectData.componentStates));
        console.log('🔧 SQLite: Saving component states for', Object.keys(projectData.componentStates).length, 'components');
      }
      if (projectData.metadata !== undefined) {
        updateFields.push('metadata = ?');
        values.push(JSON.stringify(projectData.metadata));
      }

      if (updateFields.length === 0) {
        console.log('🔧 SQLite: No fields to update, skipping auto-save');
        resolve(true);
        return;
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId, userId);

      const sql = `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

      this.db.run(sql, values, function(err) {
        if (err) {
          console.error('❌ SQLite: Error auto-saving project:', err);
          reject(err);
        } else {
          console.log('✅ SQLite: Auto-save successful, updated', this.changes, 'rows');
          resolve(true);
        }
      });
    });
  }

  async searchProjects(userId, query) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM projects 
        WHERE user_id = ? AND (name LIKE ? OR description LIKE ?)
        ORDER BY updated_at DESC
      `;
      const searchTerm = `%${query}%`;
      this.db.all(sql, [userId, searchTerm, searchTerm], (err, rows) => {
        if (err) {
          console.error('Error searching projects:', err);
          reject(err);
        } else {
          const projects = rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            gridData: JSON.parse(row.grid_data || '[]'),
            wires: JSON.parse(row.wires || '[]'),
            componentStates: JSON.parse(row.component_states || '{}'),
            arduinoProject: JSON.parse(row.arduino_project || '{}'),
            metadata: {
              ...JSON.parse(row.metadata || '{}'),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }
          }));
          resolve(projects);
        }
      });
    });
  }

  async getRecentProjects(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?';
      this.db.all(sql, [userId, limit], (err, rows) => {
        if (err) {
          console.error('Error getting recent projects:', err);
          reject(err);
        } else {
          const projects = rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            gridData: JSON.parse(row.grid_data || '[]'),
            wires: JSON.parse(row.wires || '[]'),
            componentStates: JSON.parse(row.component_states || '{}'),
            arduinoProject: JSON.parse(row.arduino_project || '{}'),
            metadata: {
              ...JSON.parse(row.metadata || '{}'),
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }
          }));
          resolve(projects);
        }
      });
    });
  }

  async exportProject(projectId, userId) {
    return new Promise((resolve, reject) => {
      this.getProject(projectId, userId).then(project => {
        if (!project) {
          reject(new Error('Project not found'));
          return;
        }
        resolve(project);
      }).catch(reject);
    });
  }

  async importProject(userId, projectData) {
    return new Promise((resolve, reject) => {
      this.createProject(userId, projectData).then(resolve).catch(reject);
    });
  }

  // Utility methods
  generateId() {
    return 'proj_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  async saveCRDTOperations(projectId, userId, crdtData) {
    return new Promise((resolve, reject) => {
      const { operations, crdtState, timestamp } = crdtData;
      
      console.log('🔧 SQLiteDatabase: Saving CRDT operations:', {
        projectId,
        operationsCount: operations?.length || 0,
        timestamp
      });

      // Convert CRDT state to grid format for storage
      const gridData = crdtState.components ? this.crdtStateToGridData(crdtState) : null;
      const wires = crdtState.wires || [];
      const componentStates = crdtState.components ? this.crdtStateToComponentStates(crdtState) : {};

      const updateFields = [];
      const values = [];

      if (gridData) {
        updateFields.push('grid_data = ?');
        values.push(JSON.stringify(gridData));
      }
      if (wires) {
        updateFields.push('wires = ?');
        values.push(JSON.stringify(wires));
      }
      if (componentStates) {
        updateFields.push('component_states = ?');
        values.push(JSON.stringify(componentStates));
      }
      
      // Store CRDT operations separately
      if (operations && operations.length > 0) {
        updateFields.push('crdt_operations = ?');
        values.push(JSON.stringify(operations));
      }

      if (updateFields.length === 0) {
        resolve(true);
        return;
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId, userId);

      const sql = `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
      
      this.db.run(sql, values, function(err) {
        if (err) {
          console.error('Error saving CRDT operations:', err);
          reject(err);
        } else {
          console.log('✅ SQLiteDatabase: CRDT operations saved successfully:', {
            changes: this.changes,
            operationsCount: operations?.length || 0
          });
          resolve(true);
        }
      });
    });
  }

  // Helper method to convert CRDT state to grid data format
  crdtStateToGridData(crdtState) {
    // This is a simplified conversion - in a real implementation,
    // you'd want to properly reconstruct the grid from CRDT components
    const components = crdtState.components || [];
    const gridSize = { width: 50, height: 50 }; // Default grid size
    
    // Initialize empty grid
    const gridData = [];
    for (let y = 0; y < gridSize.height; y++) {
      const row = [];
      for (let x = 0; x < gridSize.width; x++) {
        row.push({
          x,
          y,
          occupied: false,
          componentId: undefined,
          componentType: undefined,
          moduleDefinition: undefined,
          isPowered: false,
          cellIndex: undefined,
          isClickable: false
        });
      }
      gridData.push(row);
    }

    // Place components on the grid
    for (const component of components) {
      if (component.position && component.size) {
        const { x, y } = component.position;
        const { width, height } = component.size;

        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const cellX = x + dx;
            const cellY = y + dy;

            if (cellX >= 0 && cellX < gridSize.width && cellY >= 0 && cellY < gridSize.height) {
              gridData[cellY][cellX] = {
                ...gridData[cellY][cellX],
                occupied: true,
                componentId: component.id,
                componentType: component.type,
                moduleDefinition: component.moduleDefinition,
                isPowered: component.isPowered || false,
                cellIndex: dy * width + dx,
                isClickable: component.isClickable || false
              };
            }
          }
        }
      }
    }

    return gridData;
  }

  // Helper method to convert CRDT state to component states format
  crdtStateToComponentStates(crdtState) {
    const componentStates = {};
    const components = crdtState.components || [];

    for (const component of components) {
      componentStates[component.id] = {
        ...component,
        position: component.position,
        size: component.size
      };
    }

    return componentStates;
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = SQLiteDatabase;
