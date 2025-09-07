import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

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

export class ArduinoCompiler {
  private tempDir: string;
  private projectsDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'circuitwiz-arduino');
    this.projectsDir = path.join(os.homedir(), 'CircuitWiz', 'ArduinoProjects');
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.projectsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize directories:', error);
    }
  }

  /**
   * Compile an Arduino project
   */
  async compileProject(project: ArduinoProject): Promise<CompilationResult> {
    const projectDir = path.join(this.tempDir, `project_${Date.now()}`);
    
    try {
      // Create project directory
      await fs.mkdir(projectDir, { recursive: true });

      // Write all project files
      for (const file of project.files) {
        const filePath = path.join(projectDir, file.name);
        await fs.writeFile(filePath, file.content, 'utf8');
      }

      // Compile using Arduino CLI
      const result = await this.runArduinoCLI(projectDir, project.board);
      
      // Clean up temporary directory
      await this.cleanupDirectory(projectDir);
      
      return result;
    } catch (error) {
      await this.cleanupDirectory(projectDir);
      return {
        success: false,
        errors: [{
          file: 'compiler',
          line: 0,
          column: 0,
          message: `Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Compile a single sketch (for quick compilation)
   */
  async compileSketch(code: string, board: string = 'arduino:avr:uno'): Promise<CompilationResult> {
    const tempFile = path.join(this.tempDir, `sketch_${Date.now()}.ino`);
    
    try {
      await fs.writeFile(tempFile, code, 'utf8');
      const result = await this.runArduinoCLI(path.dirname(tempFile), board);
      
      // Clean up
      await fs.unlink(tempFile);
      
      return result;
    } catch (error) {
      // Clean up on error
      try {
        await fs.unlink(tempFile);
      } catch {}
      
      return {
        success: false,
        errors: [{
          file: 'sketch.ino',
          line: 0,
          column: 0,
          message: `Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Run Arduino CLI compilation
   */
  private async runArduinoCLI(projectDir: string, board: string): Promise<CompilationResult> {
    return new Promise((resolve) => {
      const command = 'arduino-cli';
      const args = [
        'compile',
        '--fqbn', board,
        '--output-dir', path.join(projectDir, 'build'),
        '--verbose',
        projectDir
      ];

      console.log(`Running: ${command} ${args.join(' ')}`);

      const process = spawn(command, args, {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        const success = code === 0;
        const errors = this.parseCompilationErrors(stderr + stdout);
        
        if (success) {
          // Try to find the compiled hex file
          const hexFile = this.findHexFile(path.join(projectDir, 'build'));
          const size = this.parseSizeInfo(stdout);
          
          resolve({
            success: true,
            output: stdout,
            hexFile,
            size
          });
        } else {
          resolve({
            success: false,
            output: stderr + stdout,
            errors
          });
        }
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          errors: [{
            file: 'arduino-cli',
            line: 0,
            column: 0,
            message: `Failed to run Arduino CLI: ${error.message}`,
            severity: 'error'
          }]
        });
      });
    });
  }

  /**
   * Parse compilation errors from Arduino CLI output
   */
  private parseCompilationErrors(output: string): CompilationError[] {
    const errors: CompilationError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Arduino CLI error format: file:line:column: error: message
      const errorMatch = line.match(/^(.+):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/);
      if (errorMatch) {
        const [, file, lineStr, colStr, severity, message] = errorMatch;
        errors.push({
          file: path.basename(file),
          line: parseInt(lineStr),
          column: parseInt(colStr),
          message: message.trim(),
          severity: severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info'
        });
      }
    }

    return errors;
  }

  /**
   * Find the compiled hex file
   */
  private findHexFile(buildDir: string): string | undefined {
    try {
      // This would need to be implemented based on Arduino CLI output structure
      // For now, return undefined as we'd need to scan the build directory
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse size information from compilation output
   */
  private parseSizeInfo(output: string): { program: number; data: number } | undefined {
    const sizeMatch = output.match(/Sketch uses (\d+) bytes.*Global variables use (\d+) bytes/);
    if (sizeMatch) {
      return {
        program: parseInt(sizeMatch[1]),
        data: parseInt(sizeMatch[2])
      };
    }
    return undefined;
  }

  /**
   * Clean up temporary directory
   */
  private async cleanupDirectory(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup directory:', error);
    }
  }

  /**
   * Save a project to the projects directory
   */
  async saveProject(project: ArduinoProject): Promise<void> {
    const projectPath = path.join(this.projectsDir, project.name);
    await fs.mkdir(projectPath, { recursive: true });

    // Save project metadata
    const metadata = {
      ...project,
      createdAt: project.createdAt.toISOString(),
      modifiedAt: new Date().toISOString()
    };
    await fs.writeFile(
      path.join(projectPath, 'project.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Save all project files
    for (const file of project.files) {
      await fs.writeFile(
        path.join(projectPath, file.name),
        file.content,
        'utf8'
      );
    }
  }

  /**
   * Load a project from the projects directory
   */
  async loadProject(projectName: string): Promise<ArduinoProject | null> {
    try {
      const projectPath = path.join(this.projectsDir, projectName);
      const metadataPath = path.join(projectPath, 'project.json');
      
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      // Load all project files
      const files: ArduinoFile[] = [];
      const dirContents = await fs.readdir(projectPath);
      
      for (const fileName of dirContents) {
        if (fileName !== 'project.json') {
          const content = await fs.readFile(path.join(projectPath, fileName), 'utf8');
          const extension = path.extname(fileName).slice(1);
          
          files.push({
            name: fileName,
            content,
            type: extension as ArduinoFile['type'],
            isMain: extension === 'ino'
          });
        }
      }

      return {
        ...metadata,
        files,
        createdAt: new Date(metadata.createdAt),
        modifiedAt: new Date(metadata.modifiedAt)
      };
    } catch (error) {
      console.error('Failed to load project:', error);
      return null;
    }
  }

  /**
   * List all saved projects
   */
  async listProjects(): Promise<string[]> {
    try {
      const contents = await fs.readdir(this.projectsDir);
      return contents.filter(item => {
        // Check if it's a directory with a project.json file
        return true; // Simplified for now
      });
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }

  /**
   * Check if Arduino CLI is installed
   */
  async checkArduinoCLI(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('arduino-cli version', (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * Install Arduino CLI if not present
   */
  async installArduinoCLI(): Promise<boolean> {
    // This would need platform-specific implementation
    // For now, return false and let the user install manually
    return false;
  }
}
