import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
  content?: string;
  size?: number;
  modified?: Date;
}

export interface ProjectTemplate {
  name: string;
  description: string;
  files: {
    name: string;
    content: string;
    type: 'ino' | 'h' | 'cpp' | 'c';
  }[];
  board: string;
  libraries: string[];
}

export class FileManager {
  private projectsDir: string;
  private templatesDir: string;

  constructor() {
    this.projectsDir = path.join(os.homedir(), 'CircuitWiz', 'ArduinoProjects');
    this.templatesDir = path.join(os.homedir(), 'CircuitWiz', 'Templates');
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
      await fs.mkdir(this.templatesDir, { recursive: true });
      await this.createDefaultTemplates();
    } catch (error) {
      console.error('Failed to initialize directories:', error);
    }
  }

  /**
   * Create default project templates
   */
  private async createDefaultTemplates(): Promise<void> {
    const templates: ProjectTemplate[] = [
      {
        name: 'Basic Blink',
        description: 'Simple LED blink example',
        board: 'arduino:avr:uno',
        libraries: [],
        files: [
          {
            name: 'Blink.ino',
            type: 'ino',
            content: `// Basic Blink Example
// This example blinks the built-in LED

void setup() {
  // Initialize digital pin LED_BUILTIN as an output
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);   // Turn the LED on
  delay(1000);                       // Wait for a second
  digitalWrite(LED_BUILTIN, LOW);    // Turn the LED off
  delay(1000);                       // Wait for a second
}`
          }
        ]
      },
      {
        name: 'Analog Read',
        description: 'Read analog sensor values',
        board: 'arduino:avr:uno',
        libraries: [],
        files: [
          {
            name: 'AnalogRead.ino',
            type: 'ino',
            content: `// Analog Read Example
// Reads analog input on pin A0 and prints to serial

void setup() {
  // Initialize serial communication at 9600 bits per second
  Serial.begin(9600);
}

void loop() {
  // Read the input on analog pin 0
  int sensorValue = analogRead(A0);
  
  // Convert the analog reading (0-1023) to a voltage (0-5V)
  float voltage = sensorValue * (5.0 / 1023.0);
  
  // Print out the value
  Serial.print("Sensor Value: ");
  Serial.print(sensorValue);
  Serial.print(" | Voltage: ");
  Serial.println(voltage);
  
  delay(100); // Delay for readability
}`
          }
        ]
      },
      {
        name: 'ESP32 WiFi',
        description: 'ESP32 WiFi connection example',
        board: 'esp32:esp32:esp32',
        libraries: ['WiFi'],
        files: [
          {
            name: 'WiFiExample.ino',
            type: 'ino',
            content: `// ESP32 WiFi Example
#include <WiFi.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Your code here
  delay(1000);
}`
          }
        ]
      }
    ];

    for (const template of templates) {
      const templatePath = path.join(this.templatesDir, `${template.name}.json`);
      try {
        await fs.access(templatePath);
        // Template already exists, skip
      } catch {
        // Template doesn't exist, create it
        await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
      }
    }
  }

  /**
   * Get file tree for a directory
   */
  async getFileTree(dirPath: string): Promise<FileNode[]> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const stats = await fs.stat(fullPath);

        const node: FileNode = {
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: fullPath,
          size: stats.size,
          modified: stats.mtime
        };

        if (item.isDirectory()) {
          node.children = await this.getFileTree(fullPath);
        }

        nodes.push(node);
      }

      return nodes.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Failed to get file tree:', error);
      return [];
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  }

  /**
   * Write file content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  }

  /**
   * Create a new file
   */
  async createFile(filePath: string, content: string = ''): Promise<void> {
    await this.writeFile(filePath, content);
  }

  /**
   * Create a new directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
      throw error;
    }
  }

  /**
   * Delete a file or directory
   */
  async deletePath(pathToDelete: string): Promise<void> {
    try {
      const stats = await fs.stat(pathToDelete);
      if (stats.isDirectory()) {
        await fs.rm(pathToDelete, { recursive: true, force: true });
      } else {
        await fs.unlink(pathToDelete);
      }
    } catch (error) {
      console.error('Failed to delete path:', error);
      throw error;
    }
  }

  /**
   * Rename a file or directory
   */
  async renamePath(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath);
    } catch (error) {
      console.error('Failed to rename path:', error);
      throw error;
    }
  }

  /**
   * Copy a file or directory
   */
  async copyPath(sourcePath: string, destPath: string): Promise<void> {
    try {
      const stats = await fs.stat(sourcePath);
      if (stats.isDirectory()) {
        await fs.cp(sourcePath, destPath, { recursive: true });
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    } catch (error) {
      console.error('Failed to copy path:', error);
      throw error;
    }
  }

  /**
   * Get available project templates
   */
  async getTemplates(): Promise<ProjectTemplate[]> {
    try {
      const templateFiles = await fs.readdir(this.templatesDir);
      const templates: ProjectTemplate[] = [];

      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.templatesDir, file), 'utf8');
          templates.push(JSON.parse(content));
        }
      }

      return templates;
    } catch (error) {
      console.error('Failed to get templates:', error);
      return [];
    }
  }

  /**
   * Create project from template
   */
  async createProjectFromTemplate(templateName: string, projectName: string): Promise<void> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.json`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const template: ProjectTemplate = JSON.parse(templateContent);

      const projectPath = path.join(this.projectsDir, projectName);
      await fs.mkdir(projectPath, { recursive: true });

      // Create all template files
      for (const file of template.files) {
        const filePath = path.join(projectPath, file.name);
        await fs.writeFile(filePath, file.content, 'utf8');
      }

      // Create project metadata
      const metadata = {
        name: projectName,
        template: templateName,
        board: template.board,
        libraries: template.libraries,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      };

      await fs.writeFile(
        path.join(projectPath, 'project.json'),
        JSON.stringify(metadata, null, 2)
      );
    } catch (error) {
      console.error('Failed to create project from template:', error);
      throw error;
    }
  }

  /**
   * Import Arduino project from external directory
   */
  async importProject(sourcePath: string, projectName: string): Promise<void> {
    try {
      const destPath = path.join(this.projectsDir, projectName);
      await this.copyPath(sourcePath, destPath);
    } catch (error) {
      console.error('Failed to import project:', error);
      throw error;
    }
  }

  /**
   * Export project to external directory
   */
  async exportProject(projectName: string, destPath: string): Promise<void> {
    try {
      const sourcePath = path.join(this.projectsDir, projectName);
      await this.copyPath(sourcePath, destPath);
    } catch (error) {
      console.error('Failed to export project:', error);
      throw error;
    }
  }

  /**
   * Get project metadata
   */
  async getProjectMetadata(projectName: string): Promise<any> {
    try {
      const metadataPath = path.join(this.projectsDir, projectName, 'project.json');
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to get project metadata:', error);
      return null;
    }
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<string[]> {
    try {
      const items = await fs.readdir(this.projectsDir, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory())
        .map(item => item.name);
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }
}
