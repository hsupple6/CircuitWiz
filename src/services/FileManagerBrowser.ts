// Browser-compatible file manager service
// This version works in the browser using localStorage

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

export class FileManagerBrowser {
  private templates: ProjectTemplate[] = [];

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Create default project templates
   */
  private initializeTemplates(): void {
    this.templates = [
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
  }

  /**
   * Get available project templates
   */
  async getTemplates(): Promise<ProjectTemplate[]> {
    return this.templates;
  }

  /**
   * Create project from template
   */
  async createProjectFromTemplate(templateName: string, projectName: string): Promise<void> {
    const template = this.templates.find(t => t.name === templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    // In a browser environment, we can't create actual files
    // This would be handled by the Arduino compiler service
    console.log(`Creating project ${projectName} from template ${templateName}`);
  }

  /**
   * Get file tree for a project (simplified for browser)
   */
  async getFileTree(projectName: string): Promise<FileNode[]> {
    // In browser, we'll return a simplified file tree
    // This would be populated from the project data
    return [
      {
        name: `${projectName}.ino`,
        type: 'file',
        path: `${projectName}.ino`,
        size: 0,
        modified: new Date()
      }
    ];
  }

  /**
   * Read file content (from localStorage)
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const content = localStorage.getItem(`circuitwiz-file-${filePath}`);
      return content || '';
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  }

  /**
   * Write file content (to localStorage)
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      localStorage.setItem(`circuitwiz-file-${filePath}`, content);
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
   * Create a new directory (not applicable in browser)
   */
  async createDirectory(dirPath: string): Promise<void> {
    console.log(`Creating directory: ${dirPath} (browser simulation)`);
  }

  /**
   * Delete a file or directory
   */
  async deletePath(pathToDelete: string): Promise<void> {
    try {
      localStorage.removeItem(`circuitwiz-file-${pathToDelete}`);
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
      const content = localStorage.getItem(`circuitwiz-file-${oldPath}`);
      if (content) {
        localStorage.setItem(`circuitwiz-file-${newPath}`, content);
        localStorage.removeItem(`circuitwiz-file-${oldPath}`);
      }
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
      const content = localStorage.getItem(`circuitwiz-file-${sourcePath}`);
      if (content) {
        localStorage.setItem(`circuitwiz-file-${destPath}`, content);
      }
    } catch (error) {
      console.error('Failed to copy path:', error);
      throw error;
    }
  }

  /**
   * Import Arduino project from external directory (simulated)
   */
  async importProject(sourcePath: string, projectName: string): Promise<void> {
    console.log(`Importing project from ${sourcePath} to ${projectName} (browser simulation)`);
    // In a real implementation, this would handle file uploads
  }

  /**
   * Export project to external directory (simulated)
   */
  async exportProject(projectName: string, destPath: string): Promise<void> {
    console.log(`Exporting project ${projectName} to ${destPath} (browser simulation)`);
    // In a real implementation, this would trigger a download
  }

  /**
   * Get project metadata
   */
  async getProjectMetadata(projectName: string): Promise<any> {
    try {
      const metadata = localStorage.getItem(`circuitwiz-metadata-${projectName}`);
      return metadata ? JSON.parse(metadata) : null;
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
      const projects = localStorage.getItem('circuitwiz-arduino-projects');
      if (projects) {
        const projectsObj = JSON.parse(projects);
        return Object.keys(projectsObj);
      }
      return [];
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }
}
