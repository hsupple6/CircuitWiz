# Backend API Structure for Arduino Compilation

This document outlines the backend API structure needed to support real Arduino compilation in CircuitWiz.

## Overview

The current implementation uses browser-compatible services that simulate compilation. To enable real Arduino compilation, a backend API is needed to handle:

1. Arduino CLI execution
2. File system operations
3. Project management
4. Compilation results

## API Endpoints

### Compilation Endpoints

#### POST /api/compile
Compile an Arduino sketch or project.

**Request Body:**
```json
{
  "code": "void setup() { ... }",
  "board": "arduino:avr:uno",
  "libraries": ["WiFi", "SPI"],
  "projectName": "MyProject"
}
```

**Response:**
```json
{
  "success": true,
  "output": "Compilation successful!",
  "errors": [],
  "size": {
    "program": 1234,
    "data": 567
  },
  "hexFile": "base64-encoded-hex-file"
}
```

#### POST /api/compile-project
Compile a complete Arduino project with multiple files.

**Request Body:**
```json
{
  "project": {
    "name": "MyProject",
    "files": [
      {
        "name": "main.ino",
        "content": "void setup() { ... }",
        "type": "ino",
        "isMain": true
      },
      {
        "name": "sensor.h",
        "content": "#ifndef SENSOR_H...",
        "type": "h",
        "isMain": false
      }
    ],
    "board": "arduino:avr:uno",
    "libraries": ["WiFi"]
  }
}
```

### Project Management Endpoints

#### GET /api/projects
List all saved projects.

**Response:**
```json
{
  "projects": [
    {
      "name": "MyProject",
      "createdAt": "2024-01-01T00:00:00Z",
      "modifiedAt": "2024-01-01T12:00:00Z",
      "board": "arduino:avr:uno"
    }
  ]
}
```

#### POST /api/projects
Create a new project.

#### GET /api/projects/:name
Get project details and files.

#### PUT /api/projects/:name
Update an existing project.

#### DELETE /api/projects/:name
Delete a project.

### File Management Endpoints

#### GET /api/projects/:name/files
List files in a project.

#### POST /api/projects/:name/files
Add a file to a project.

#### PUT /api/projects/:name/files/:filename
Update a file in a project.

#### DELETE /api/projects/:name/files/:filename
Delete a file from a project.

### System Endpoints

#### GET /api/status
Check system status and Arduino CLI availability.

**Response:**
```json
{
  "arduinoCliAvailable": true,
  "installedBoards": [
    "arduino:avr:uno",
    "esp32:esp32:esp32"
  ],
  "installedLibraries": [
    "WiFi",
    "SPI",
    "Wire"
  ]
}
```

#### POST /api/install-board
Install a new Arduino board.

#### POST /api/install-library
Install a new Arduino library.

## Implementation Options

### Option 1: Node.js/Express Backend
- Use the existing Arduino CLI integration
- File system operations with Node.js
- RESTful API with Express.js
- WebSocket support for real-time compilation updates

### Option 2: Python/FastAPI Backend
- Use Arduino CLI through subprocess calls
- File system operations with Python
- FastAPI for high-performance API
- Async support for concurrent compilations

### Option 3: Docker-based Backend
- Containerized Arduino CLI environment
- Isolated compilation environment
- Easy deployment and scaling
- Support for multiple Arduino versions

## Frontend Integration

The browser-compatible services can be easily extended to call the backend API:

```typescript
// Example API integration
class ArduinoCompilerAPI extends ArduinoCompilerBrowser {
  private apiBaseUrl = 'http://localhost:3001/api';

  async compileSketch(code: string, board: string): Promise<CompilationResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, board })
      });

      return await response.json();
    } catch (error) {
      // Fallback to browser simulation
      return super.compileSketch(code, board);
    }
  }
}
```

## Security Considerations

1. **Input Validation**: Validate all code inputs to prevent injection attacks
2. **File System Isolation**: Use chroot or containers to isolate file operations
3. **Resource Limits**: Limit compilation time and memory usage
4. **Authentication**: Implement user authentication for project access
5. **Rate Limiting**: Prevent abuse of compilation endpoints

## Deployment

### Development
```bash
# Start backend API
cd backend
npm install
npm run dev

# Start frontend
cd frontend
npm run dev
```

### Production
```bash
# Build and deploy with Docker
docker-compose up -d
```

## Next Steps

1. Choose implementation option (Node.js recommended for consistency)
2. Set up backend project structure
3. Implement core compilation endpoints
4. Add project management functionality
5. Integrate with frontend services
6. Add authentication and security
7. Deploy and test

This structure provides a clear path from the current browser-compatible implementation to a full-featured Arduino development environment.
