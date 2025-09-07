// Real Arduino compiler service that calls the backend API

export interface CompilationResult {
  success: boolean;
  output?: string;
  errors?: CompilationError[];
  firmware?: string; // Base64 encoded .bin file
  filename?: string;
  size?: number;
  binPath?: string; // Path to the original compiled .bin file
}

export interface CompilationError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ArduinoProject {
  name: string;
  files: ArduinoFile[];
  board: string;
  libraries: string[];
  createdAt: Date;
  modifiedAt: Date;
}

export interface ArduinoFile {
  name: string;
  content: string;
  type: 'ino' | 'h' | 'cpp' | 'c';
  isMain: boolean;
}

export interface SystemStatus {
  arduinoCliAvailable: boolean;
  version?: string;
  cores?: string;
  boards?: string;
  error?: string;
}

export class ArduinoCompilerReal {
  private apiBaseUrl: string;
  private projects: Map<string, ArduinoProject> = new Map();

  constructor(apiBaseUrl: string = 'http://localhost:3001/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.loadProjectsFromStorage();
  }

  /**
   * Compile Arduino code using real Arduino CLI via backend API
   */
  async compileSketch(code: string, board: string = 'esp32:esp32:esp32'): Promise<CompilationResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code, 
          board,
          libraries: [] // TODO: Add library support
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          output: result.message,
          firmware: result.firmware,
          filename: result.filename,
          size: result.size,
          binPath: result.binPath
        };
      } else {
        return {
          success: false,
          output: result.details || result.error,
          errors: result.errors || []
        };
      }
    } catch (error) {
      console.error('Compilation API error:', error);
      return {
        success: false,
        output: `Failed to connect to compilation server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [{
          file: 'compiler',
          line: 0,
          column: 0,
          message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Compile a complete Arduino project
   */
  async compileProject(project: ArduinoProject): Promise<CompilationResult> {
    const mainFile = project.files.find(f => f.isMain);
    if (!mainFile) {
      return {
        success: false,
        errors: [{
          file: 'project',
          line: 0,
          column: 0,
          message: 'No main file found in project',
          severity: 'error'
        }]
      };
    }

    return this.compileSketch(mainFile.content, project.board);
  }

  /**
   * Check system status and Arduino CLI availability
   */
  async checkSystemStatus(): Promise<SystemStatus> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/status`);
      const status = await response.json();
      return status;
    } catch (error) {
      return {
        arduinoCliAvailable: false,
        error: `Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Download firmware as .bin file
   */
  downloadFirmware(firmware: string, filename: string): void {
    try {
      // Convert base64 to blob
      const binaryString = atob(firmware);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download firmware:', error);
      throw new Error('Failed to download firmware file');
    }
  }

  /**
   * Save a project to localStorage
   */
  async saveProject(project: ArduinoProject): Promise<void> {
    const updatedProject = {
      ...project,
      modifiedAt: new Date()
    };
    
    this.projects.set(project.name, updatedProject);
    this.saveProjectsToStorage();
  }

  /**
   * Load a project from localStorage
   */
  async loadProject(projectName: string): Promise<ArduinoProject | null> {
    return this.projects.get(projectName) || null;
  }

  /**
   * List all saved projects
   */
  async listProjects(): Promise<string[]> {
    return Array.from(this.projects.keys());
  }

  /**
   * Create a new project
   */
  createNewProject(name: string, template?: any): ArduinoProject {
    const project: ArduinoProject = {
      name,
      files: template ? template.files.map((f: any) => ({ ...f, isMain: f.type === 'ino' })) : [{
        name: `${name}.ino`,
        content: '// Your code here\nvoid setup() {\n  // Initialize pins\n}\n\nvoid loop() {\n  // Main program loop\n}',
        type: 'ino',
        isMain: true
      }],
      board: template?.board || 'esp32:esp32:esp32',
      libraries: template?.libraries || [],
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    this.projects.set(name, project);
    this.saveProjectsToStorage();
    return project;
  }

  /**
   * Delete a project
   */
  async deleteProject(projectName: string): Promise<void> {
    this.projects.delete(projectName);
    this.saveProjectsToStorage();
  }

  /**
   * Load projects from localStorage
   */
  private loadProjectsFromStorage(): void {
    try {
      const stored = localStorage.getItem('circuitwiz-arduino-projects');
      if (stored) {
        const projects = JSON.parse(stored);
        Object.entries(projects).forEach(([name, project]) => {
          this.projects.set(name, {
            ...project as ArduinoProject,
            createdAt: new Date(project.createdAt),
            modifiedAt: new Date(project.modifiedAt)
          });
        });
      }
    } catch (error) {
      console.error('Failed to load projects from storage:', error);
    }
  }

  /**
   * Save projects to localStorage
   */
  private saveProjectsToStorage(): void {
    try {
      const projectsObj = Object.fromEntries(this.projects);
      localStorage.setItem('circuitwiz-arduino-projects', JSON.stringify(projectsObj));
    } catch (error) {
      console.error('Failed to save projects to storage:', error);
    }
  }
}
