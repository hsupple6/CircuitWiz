// Browser-compatible Arduino compiler service
// This version works in the browser and can be extended with a backend API later

export interface CompilationResult {
  success: boolean;
  output?: string;
  errors?: CompilationError[];
  hexFile?: string;
  size?: {
    program: number;
    data: number;
  };
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

export class ArduinoCompilerBrowser {
  private projects: Map<string, ArduinoProject> = new Map();

  constructor() {
    this.loadProjectsFromStorage();
  }

  /**
   * Compile an Arduino project (simulated for browser)
   */
  async compileProject(project: ArduinoProject): Promise<CompilationResult> {
    // For now, we'll simulate compilation
    // In a real implementation, this would call a backend API
    return this.simulateCompilation(project);
  }

  /**
   * Compile a single sketch (simulated for browser)
   */
  async compileSketch(code: string, board: string = 'arduino:avr:uno'): Promise<CompilationResult> {
    // For now, we'll simulate compilation
    // In a real implementation, this would call a backend API
    return this.simulateCompilation({ 
      name: 'temp_sketch', 
      files: [{ name: 'sketch.ino', content: code, type: 'ino', isMain: true }],
      board,
      libraries: [],
      createdAt: new Date(),
      modifiedAt: new Date()
    });
  }

  /**
   * Simulate compilation for browser compatibility
   */
  private async simulateCompilation(project: ArduinoProject): Promise<CompilationResult> {
    // Simulate compilation delay
    await new Promise(resolve => setTimeout(resolve, 1000));

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

    // Basic syntax validation
    const errors = this.validateCode(mainFile.content);
    
    if (errors.length > 0) {
      return {
        success: false,
        errors
      };
    }

    // Simulate successful compilation with realistic size estimates
    const codeLength = mainFile.content.length;
    const estimatedProgramSize = Math.max(500, Math.floor(codeLength * 2.5)); // Rough estimate
    const estimatedDataSize = Math.max(50, Math.floor(codeLength * 0.3)); // Rough estimate
    
    return {
      success: true,
      output: 'Compilation successful! (Simulated)',
      size: {
        program: estimatedProgramSize,
        data: estimatedDataSize
      }
    };
  }

  /**
   * Enhanced code validation
   */
  private validateCode(code: string): CompilationError[] {
    const errors: CompilationError[] = [];
    const lines = code.split('\n');

    // Check for basic syntax issues
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();
      
      // Check for missing semicolons
      if (trimmedLine && 
          !trimmedLine.startsWith('//') && 
          !trimmedLine.startsWith('/*') && 
          !trimmedLine.startsWith('*') && 
          !trimmedLine.startsWith('#') &&
          !trimmedLine.includes('{') && 
          !trimmedLine.includes('}') &&
          !trimmedLine.includes('void setup()') &&
          !trimmedLine.includes('void loop()') &&
          !trimmedLine.includes('if (') &&
          !trimmedLine.includes('for (') &&
          !trimmedLine.includes('while (') &&
          !trimmedLine.includes('else') &&
          !trimmedLine.includes('return') &&
          !trimmedLine.includes('delay') &&
          !trimmedLine.includes('Serial.') &&
          !trimmedLine.includes('pinMode') &&
          !trimmedLine.includes('digitalWrite') &&
          !trimmedLine.includes('analogRead') &&
          !trimmedLine.includes('analogWrite') &&
          !trimmedLine.includes('digitalRead') &&
          trimmedLine.length > 0 &&
          !trimmedLine.endsWith(';') &&
          !trimmedLine.endsWith('{') &&
          !trimmedLine.endsWith('}')) {
        errors.push({
          file: 'sketch.ino',
          line: lineNumber,
          column: line.length,
          message: 'Expected semicolon at end of statement',
          severity: 'error'
        });
      }
      
      // Check for unmatched braces
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      // Check for common syntax errors
      if (line.includes('void setup()') && !line.includes('{')) {
        errors.push({
          file: 'sketch.ino',
          line: lineNumber,
          column: line.indexOf('void setup()') + 1,
          message: 'Expected opening brace after function declaration',
          severity: 'error'
        });
      }
      
      if (line.includes('void loop()') && !line.includes('{')) {
        errors.push({
          file: 'sketch.ino',
          line: lineNumber,
          column: line.indexOf('void loop()') + 1,
          message: 'Expected opening brace after function declaration',
          severity: 'error'
        });
      }

      // Check for undefined variables (basic check)
      if (line.includes('int ') && line.includes('=') && line.includes('undefined')) {
        errors.push({
          file: 'sketch.ino',
          line: lineNumber,
          column: line.indexOf('undefined') + 1,
          message: 'Undefined variable',
          severity: 'error'
        });
      }

      // Check for missing parentheses
      if (line.includes('if ') && !line.includes('(') && !line.includes('//')) {
        errors.push({
          file: 'sketch.ino',
          line: lineNumber,
          column: line.indexOf('if ') + 1,
          message: 'Expected opening parenthesis after if',
          severity: 'error'
        });
      }
    });

    // Check for missing setup() or loop() functions
    const hasSetup = code.includes('void setup()');
    const hasLoop = code.includes('void loop()');
    
    if (!hasSetup) {
      errors.push({
        file: 'sketch.ino',
        line: 1,
        column: 1,
        message: 'Missing setup() function',
        severity: 'error'
      });
    }
    
    if (!hasLoop) {
      errors.push({
        file: 'sketch.ino',
        line: 1,
        column: 1,
        message: 'Missing loop() function',
        severity: 'error'
      });
    }

    return errors;
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
   * Check if Arduino CLI is available (always false in browser)
   */
  async checkArduinoCLI(): Promise<boolean> {
    // In browser, we can't access Arduino CLI directly
    // This would need to be handled by a backend service
    return false;
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
      board: template?.board || 'arduino:avr:uno',
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
}
