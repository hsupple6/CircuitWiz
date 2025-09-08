// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');
const { authenticateToken, optionalAuth } = require('./middleware/auth');
const SQLiteDatabase = require('./services/SQLiteDatabase');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize SQLite database
let userDatabase;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// User management endpoints
app.post('/api/users/sync', authenticateToken, async (req, res) => {
  try {
    const user = await userDatabase.createOrUpdateUser(req.user);
    res.json({ user });
  } catch (error) {
    console.error('User sync error:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    const user = await userDatabase.getUser(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.put('/api/user/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await userDatabase.updateUserSettings(req.user.id, req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Update user settings error:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

// Project management endpoints
app.get('/api/user/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await userDatabase.getUserProjects(req.user.id);
    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

app.get('/api/user/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const project = await userDatabase.getProject(req.params.projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

app.post('/api/user/projects', authenticateToken, async (req, res) => {
  try {
    const project = await userDatabase.createProject(req.user.id, req.body);
    res.json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/api/user/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const project = await userDatabase.updateProject(req.params.projectId, req.user.id, req.body);
    res.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/user/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    await userDatabase.deleteProject(req.params.projectId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.post('/api/user/projects/:projectId/duplicate', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    const project = await userDatabase.duplicateProject(req.params.projectId, req.user.id, name);
    res.json({ project });
  } catch (error) {
    console.error('Duplicate project error:', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

app.patch('/api/user/projects/:projectId/autosave', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Backend: Auto-saving project:', req.params.projectId, {
      hasGridData: !!req.body.gridData,
      hasWires: !!req.body.wires,
      hasComponentStates: !!req.body.componentStates,
      gridDataRows: req.body.gridData?.length || 0,
      wiresCount: req.body.wires?.length || 0,
      componentStatesCount: Object.keys(req.body.componentStates || {}).length
    });
    
    const success = await userDatabase.autoSaveProject(req.params.projectId, req.user.id, req.body);
    
    console.log('✅ Backend: Auto-save result:', success);
    res.json({ success });
  } catch (error) {
    console.error('❌ Backend: Auto-save project error:', error);
    res.status(500).json({ error: 'Failed to auto-save project' });
  }
});

// CRDT Save endpoint for robust concurrent editing
app.post('/api/user/projects/:projectId/crdt-save', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Backend: CRDT saving project:', req.params.projectId, {
      operationsCount: req.body.operations?.length || 0,
      hasCrdtState: !!req.body.crdtState,
      timestamp: req.body.timestamp
    });
    
    const { operations, crdtState, timestamp } = req.body;
    
    // Save CRDT operations to database
    const success = await userDatabase.saveCRDTOperations(req.params.projectId, req.user.id, {
      operations,
      crdtState,
      timestamp
    });
    
    console.log('✅ Backend: CRDT save result:', success);
    res.json({ 
      success, 
      timestamp: Date.now(),
      operationsCount: operations?.length || 0
    });
  } catch (error) {
    console.error('❌ Backend: CRDT save project error:', error);
    res.status(500).json({ error: 'Failed to CRDT save project' });
  }
});

app.get('/api/user/projects/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const projects = await userDatabase.searchProjects(req.user.id, q);
    res.json({ projects });
  } catch (error) {
    console.error('Search projects error:', error);
    res.status(500).json({ error: 'Failed to search projects' });
  }
});

app.get('/api/user/projects/recent', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const projects = await userDatabase.getRecentProjects(req.user.id, limit);
    res.json({ projects });
  } catch (error) {
    console.error('Get recent projects error:', error);
    res.status(500).json({ error: 'Failed to get recent projects' });
  }
});

// Export/Import endpoints
app.get('/api/user/projects/:projectId/export', authenticateToken, async (req, res) => {
  try {
    const exportData = await userDatabase.exportProject(req.params.projectId, req.user.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="project-${req.params.projectId}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export project error:', error);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

app.post('/api/user/projects/import', authenticateToken, async (req, res) => {
  try {
    const project = await userDatabase.importProject(req.user.id, req.body);
    res.json({ project });
  } catch (error) {
    console.error('Import project error:', error);
    res.status(500).json({ error: 'Failed to import project' });
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create temp directories for compilation
const TEMP_DIR = path.join(os.tmpdir(), 'circuitwiz-compile');
fs.ensureDirSync(TEMP_DIR);

// Arduino CLI configuration
const ARDUINO_CLI_PATH = process.env.ARDUINO_CLI_PATH || 'arduino-cli';
const ARDUINO_CONFIG_PATH = path.join(os.homedir(), '.arduino15');

// Ensure Arduino CLI is configured
async function ensureArduinoCLI() {
  try {
    // Check if Arduino CLI is available
    await execCommand(`${ARDUINO_CLI_PATH} version`);
    
    // Update core index
    await execCommand(`${ARDUINO_CLI_PATH} core update-index`);
    
    // Install ESP32 core if not present
    try {
      await execCommand(`${ARDUINO_CLI_PATH} core install esp32:esp32`);
    } catch (error) {
      console.log('ESP32 core already installed or installation failed:', error.message);
    }
    
    console.log('Arduino CLI is ready');
  } catch (error) {
    console.error('Arduino CLI setup failed:', error.message);
    console.error('Please install Arduino CLI: https://arduino.github.io/arduino-cli/');
  }
}

// Utility function to execute shell commands
function execCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      // Always resolve, don't reject - we want to handle errors in the calling code
      resolve({ 
        stdout, 
        stderr, 
        error: error || null,
        exitCode: error ? error.code : 0
      });
    });
  });
}

// Analyze Arduino firmware for debugging
function analyzeArduinoFirmware(firmwareBuffer) {
  console.log('\n=== FIRMWARE ANALYSIS ===');
  
  // Calculate firmware hash for uniqueness verification
  const firmwareHash = crypto.createHash('md5').update(firmwareBuffer).digest('hex');
  console.log(`Firmware MD5 hash: ${firmwareHash}`);
  console.log(`Firmware size: ${firmwareBuffer.length} bytes`);
  
  // Check if this is Intel HEX format
  const firmwareText = firmwareBuffer.toString('utf8');
  const isIntelHex = firmwareText.startsWith(':');
  console.log(`Format detected: ${isIntelHex ? 'Intel HEX' : 'Binary'}`);
  
  let binaryData = firmwareBuffer;
  
  // Convert Intel HEX to binary for analysis
  if (isIntelHex) {
    console.log('Converting Intel HEX to binary for analysis...');
    try {
      binaryData = convertIntelHexToBinary(firmwareText);
      console.log(`Binary data extracted: ${binaryData.length} bytes`);
    } catch (error) {
      console.log('HEX parsing failed:', error.message);
      return;
    }
  }
  
  // Look for Arduino AVR instruction patterns (now using binary data)
  const patterns = {
    'SBI DDRB,5 (pinMode 13 OUTPUT)': [0x9A, 0xCD], // sbi 0x04, 5 (set bit 5 in DDRB)
    'SBI PORTB,5 (digitalWrite 13 HIGH)': [0x9A, 0xD5], // sbi 0x05, 5 (set bit 5 in PORTB)  
    'CBI PORTB,5 (digitalWrite 13 LOW)': [0x98, 0xD5], // cbi 0x05, 5 (clear bit 5 in PORTB)
    'LDI instruction': [0xE0], // LDI (Load Immediate)
    'OUT instruction': [0xB8], // OUT (Output to I/O port)
    'delay() call pattern': [0x0E, 0x94], // Call instruction pattern
  };
  
  Object.entries(patterns).forEach(([name, pattern]) => {
    let count = 0;
    for (let i = 0; i <= binaryData.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (binaryData[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) count++;
    }
    console.log(`${name}: ${count} occurrences`);
  });
  
  // Look for specific I/O register addresses
  const registerAddresses = [
    { name: 'DDRB address (0x24)', byte: 0x24 },
    { name: 'PORTB address (0x25)', byte: 0x25 },
    { name: 'Pin 13 bit mask (0x20)', byte: 0x20 },
    { name: 'Arduino init pattern', byte: 0x11 }
  ];
  
  registerAddresses.forEach(({ name, byte }) => {
    const count = Array.from(binaryData).filter(b => b === byte).length;
    console.log(`${name}: ${count} occurrences`);
  });
  
  // Show first and last 16 bytes for debugging
  console.log(`First 16 bytes: ${Array.from(binaryData.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  console.log(`Last 16 bytes: ${Array.from(binaryData.slice(-16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  
  console.log('========================\n');
}

// Convert Intel HEX string to binary buffer
function convertIntelHexToBinary(hexText) {
  const lines = hexText.split('\n').filter(line => line.trim().startsWith(':'));
  const binaryData = [];
  let baseAddress = 0;
  
  for (const line of lines) {
    const recordLength = parseInt(line.substr(1, 2), 16);
    const address = parseInt(line.substr(3, 4), 16);
    const recordType = parseInt(line.substr(7, 2), 16);
    
    if (recordType === 0x00) { // Data record
      const fullAddress = baseAddress + address;
      
      for (let i = 0; i < recordLength; i++) {
        const byteOffset = 9 + (i * 2);
        const byteValue = parseInt(line.substr(byteOffset, 2), 16);
        
        // Ensure array is large enough
        while (binaryData.length <= fullAddress + i) {
          binaryData.push(0xFF);
        }
        
        binaryData[fullAddress + i] = byteValue;
      }
    } else if (recordType === 0x04) { // Extended Linear Address
      baseAddress = parseInt(line.substr(9, 4), 16) << 16;
    } else if (recordType === 0x01) { // End of File
      break;
    }
  }
  
  return Buffer.from(binaryData);
}

// Compile Arduino sketch
app.post('/api/compile', async (req, res) => {
  try {
    const { code, board = 'esp32:esp32:esp32', libraries = [] } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }

    // Create unique project directory
    const projectId = uuidv4();
    const projectDir = path.join(TEMP_DIR, projectId);
    await fs.ensureDir(projectDir);

    // Write sketch file with the same name as the directory (Arduino CLI requirement)
    const sketchName = `${projectId}.ino`;
    const sketchPath = path.join(projectDir, sketchName);
    await fs.writeFile(sketchPath, code, 'utf8');

    // Create libraries directory if needed
    if (libraries.length > 0) {
      const libDir = path.join(projectDir, 'libraries');
      await fs.ensureDir(libDir);
      // Note: In a real implementation, you'd download/install libraries here
    }

    // Compile using Arduino CLI - try to get raw binary without bootloader
    const compileCommand = `${ARDUINO_CLI_PATH} compile --fqbn ${board} --output-dir ${path.join(projectDir, 'build')} --build-property "upload.use_1200bps_touch=false" --build-property "upload.wait_for_upload_port=false" ${projectDir}`;
    
    console.log('Compiling with command:', compileCommand);
    console.log('Board:', board);
    
    const result = await execCommand(compileCommand);
    
    // Check if compilation was successful
    const buildDir = path.join(projectDir, 'build');
    const binFiles = await fs.readdir(buildDir).catch(() => []);
    
    // Look for different file types - prefer raw .bin over .hex and bootloader versions
    let binFile = binFiles.find(file => file.endsWith('.bin') && !file.includes('bootloader'));
    if (!binFile) {
      binFile = binFiles.find(file => file.endsWith('.hex'));
    }
    if (!binFile) {
      binFile = binFiles.find(file => file.endsWith('.bin'));
    }
    
    console.log('Available binary files:', binFiles);
    console.log('Selected binary file:', binFile);
    console.log('File selection logic: Prefer raw .bin > .hex > .with_bootloader.bin');
    
    if (binFile) {
      // Compilation successful
      const binPath = path.join(buildDir, binFile);
      const binBuffer = await fs.readFile(binPath);
      
      // Analyze the compiled firmware
      analyzeArduinoFirmware(binBuffer);
      
      // Keep temp directory for potential future use
      
      res.json({
        success: true,
        message: 'Compilation successful',
        firmware: binBuffer.toString('base64'),
        filename: binFile,
        size: binBuffer.length,
        binPath: binPath  // Include the path to the original .bin file
      });
    } else {
      // Compilation failed
      const errorOutput = result.stderr || result.stdout;
      
      // Clean up temp directory
      await fs.remove(projectDir);
      
      res.status(400).json({
        success: false,
        error: 'Compilation failed',
        details: errorOutput,
        errors: parseCompilationErrors(errorOutput)
      });
    }

  } catch (error) {
    console.error('Compilation error:', error);
    
    // Check for architecture issues
    if (error.message.includes('bad CPU type in executable')) {
      res.status(500).json({
        success: false,
        error: 'Architecture compatibility issue',
        details: 'The Arduino toolchain is not compatible with your system architecture. Try using ESP32 instead of Arduino Uno, or install Arduino CLI with Rosetta 2 support.',
        suggestion: 'Use board: "esp32:esp32:esp32" for better ARM64 compatibility'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Parse compilation errors from Arduino CLI output
function parseCompilationErrors(output) {
  const errors = [];
  const lines = output.split('\n');
  
  lines.forEach((line, index) => {
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
  });
  
  return errors;
}

// Get system status
app.get('/api/status', async (req, res) => {
  try {
    // Check Arduino CLI version
    const versionResult = await execCommand(`${ARDUINO_CLI_PATH} version`);
    
    // List installed cores
    const coresResult = await execCommand(`${ARDUINO_CLI_PATH} core list`);
    
    // List installed boards
    const boardsResult = await execCommand(`${ARDUINO_CLI_PATH} board listall`);
    
    res.json({
      arduinoCliAvailable: true,
      version: versionResult.stdout.trim(),
      cores: coresResult.stdout,
      boards: boardsResult.stdout
    });
  } catch (error) {
    res.json({
      arduinoCliAvailable: false,
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Wokwi-based emulation endpointhows 
app.post('/api/emulate', async (req, res) => {
  try {
    const { firmware, board = 'arduino:avr:uno', firmwareType = 'ino', sourceCode } = req.body;

    if (!firmware) {
      return res.status(400).json({
        success: false,
        error: 'No firmware provided'
      });
    }

    console.log('Starting Wokwi-based emulation...');
    console.log('Board:', board);
    console.log('Firmware type:', firmwareType);

    // Run Wokwi-based emulation
    // If we have source code, use it; otherwise use the firmware
    const codeToAnalyze = sourceCode || firmware;
    const emulationResult = await runWokwiEmulation(codeToAnalyze, board, firmwareType, req);

    res.json(emulationResult);

  } catch (error) {
    console.error('Emulation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Wokwi API integration endpoint
app.post('/api/wokwi/emulate', async (req, res) => {
  try {
    const { code, board = 'arduino:avr:uno', components = [] } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'No Arduino code provided'
      });
    }

    console.log('Starting Wokwi API emulation...');
    console.log('Board:', board);
    console.log('Components:', components.length);

    // Create Wokwi project configuration
    const wokwiProject = {
      version: 1,
      author: "CircuitWiz",
      editor: "wokwi",
      parts: [
        {
          id: "uno",
          type: "wokwi-arduino-uno",
          x: 0,
          y: 0,
          rotate: 0
        },
        ...components
      ],
      connections: [],
      serialMonitor: {
        display: "always",
        newline: "lf"
      },
      dhtSensor: {
        temperatureUnit: "celsius"
      }
    };

    // For now, we'll use a simple simulation approach
    // In the future, this will integrate with Wokwi's API
    const simulationResult = await runWokwiSimulation(code, wokwiProject, board);

    res.json({
      success: true,
      result: simulationResult,
      message: 'Wokwi simulation completed'
    });

  } catch (error) {
    console.error('Wokwi emulation error:', error);
    res.status(500).json({
      success: false,
      error: 'Wokwi emulation failed',
      details: error.message
    });
  }
});

// Wokwi simulation function
async function runWokwiSimulation(code, wokwiProject, board) {
  console.log(`\n=== WOKWI SIMULATION STARTED ===`);
  console.log(`Board: ${board}`);
  console.log(`Components: ${wokwiProject.parts.length}`);
  
  try {
    // Analyze Arduino code for common patterns
    const codeAnalysis = analyzeArduinoCode(code);
    
    // Generate pin changes based on code analysis
    const pinChanges = generatePinChangesFromCode(codeAnalysis);
    
    // Create simulation result
    const result = {
      pinChanges,
      serialOutput: codeAnalysis.serialOutput || [],
      executionTime: 10000, // 10 seconds simulation
      components: wokwiProject.parts,
      summary: generateWokwiSummary(pinChanges, codeAnalysis)
    };
    
    console.log(`\n=== WOKWI SIMULATION COMPLETE ===`);
    console.log(`Pin changes: ${pinChanges.length}`);
    console.log(`Serial messages: ${result.serialOutput.length}`);
    console.log(`=====================================\n`);
    
    return result;
  } catch (error) {
    console.error('Wokwi simulation error:', error);
    throw error;
  }
}

// Simple Wokwi-based emulation
async function runWokwiEmulation(firmware, board = 'arduino:avr:uno', firmwareType = 'ino', req = null) {
  console.log(`\n=== WOKWI EMULATION STARTED ===`);
  console.log(`Board: ${board}`);
  console.log(`Firmware type: ${firmwareType}`);
  
  try {
    // Check if we have source code or compiled firmware
    if (firmwareType === 'ino' || firmwareType === 'cpp' || firmwareType === 'c') {
      // This is source code - analyze it directly
      console.log('Analyzing Arduino source code...');
      const simulationResult = await simulateArduinoBehavior(firmware, board);
      
      console.log(`\n=== WOKWI EMULATION COMPLETE ===`);
      console.log(`GPIO changes: ${simulationResult.gpioStates.length}`);
      console.log(`=====================================\n`);
      
      return simulationResult;
    } else {
      // This is compiled firmware - check if we have source code to analyze
      if (req.body.sourceCode) {
        console.log('Compiled firmware with source code - analyzing source code for accurate simulation...');
        const simulationResult = await simulateArduinoBehavior(req.body.sourceCode, board);
        
        console.log(`\n=== WOKWI EMULATION COMPLETE ===`);
        console.log(`GPIO changes: ${simulationResult.gpioStates.length}`);
        console.log(`=====================================\n`);
        
        return simulationResult;
      } else {
        // This is compiled firmware without source code - provide a generic simulation
        console.log('Compiled firmware detected - providing generic Arduino simulation...');
        const simulationResult = await simulateGenericArduinoBehavior(board);
        
        console.log(`\n=== WOKWI EMULATION COMPLETE ===`);
        console.log(`GPIO changes: ${simulationResult.gpioStates.length}`);
        console.log(`=====================================\n`);
        
        return simulationResult;
      }
    }
  } catch (error) {
    console.error('Wokwi emulation error:', error);
    throw error;
  }
}
// Simple Arduino behavior simulation
async function simulateArduinoBehavior(firmware, board) {
  console.log('Running Arduino behavior simulation...');
  
  // For now, create a simple simulation that detects common Arduino patterns
  const gpioStates = [];
  const registerStates = {
    PORTB: null,
    DDRB: null,
    PORTD: null,
    DDRD: null,
    PORTC: null,
    DDRC: null
  };
  
  // Analyze the Arduino code to understand what it does
  const analysis = analyzeArduinoCode(firmware);
  
  // Generate pin changes based on the analysis
  const pinChanges = generatePinChangesFromCode(analysis);
  
  // Convert pin changes to GPIO states format
  pinChanges.forEach(change => {
    const { register, bit } = getRegisterAndBitForPin(change.pin);
    gpioStates.push({
      pin: change.pin,
      state: change.state,
      value: change.value,
      timestamp: change.timestamp,
      register: register,
      bit: bit,
      simulated: true
    });
  });
  
  // Set register states based on pinMode calls
  analysis.pinModeCalls.forEach(call => {
    if (call.mode === 'OUTPUT') {
      const { register, bit } = getRegisterAndBitForPin(call.pin);
      if (registerStates[register] === null) {
        registerStates[register] = 0;
      }
      registerStates[register] |= (1 << bit);
    }
  });
  
  const summary = generateSimpleEmulationSummary(gpioStates, registerStates);
  
  return {
    success: true,
    output: summary,
    gpioStates,
    executionTime: 10000, // 10 seconds
    registers: registerStates
  };
}
// Generate simple emulation summary
function generateSimpleEmulationSummary(gpioStates, registerStates) {
  const pin13Changes = gpioStates.filter(state => state.pin === 13);
  
  let summary = `=== WOKWI SIMULATION RESULTS ===\n\n`;
  summary += `Total GPIO Changes: ${gpioStates.length}\n`;
  summary += `Pin 13 Changes: ${pin13Changes.length}\n\n`;
  
  summary += `Final Register States:\n`;
  Object.entries(registerStates).forEach(([reg, value]) => {
    if (value !== null) {
      const binaryStr = value.toString(2).padStart(8, '0');
      summary += `- ${reg}: 0x${value.toString(16).padStart(2, '0')} (${binaryStr})\n`;
      
      if (reg === 'DDRB') {
        const pin13IsOutput = (value >> 5) & 1;
        summary += `  * Pin 13 (bit 5): ${pin13IsOutput ? 'OUTPUT' : 'INPUT'}\n`;
      } else if (reg === 'PORTB') {
        const pin13State = (value >> 5) & 1;
        summary += `  * Pin 13 (bit 5): ${pin13State ? 'HIGH' : 'LOW'}\n`;
      }
    }
  });
  
  if (pin13Changes.length > 0) {
    summary += `\nPin 13 Activity Timeline:\n`;
    pin13Changes.slice(0, 10).forEach((change, index) => {
      const time = new Date(change.timestamp).toLocaleTimeString();
      summary += `${index + 1}. ${change.state} at ${time}\n`;
    });
  }
  
  summary += `\n✅ Simulation completed successfully\n`;
  summary += `📝 Note: This is a basic simulation. Full Wokwi integration coming soon.\n`;
  
  return summary;
}

// Analyze Arduino code for common patterns
function analyzeArduinoCode(code) {
  console.log('Analyzing Arduino code...');
  
  const analysis = {
    hasSetup: code.includes('void setup()'),
    hasLoop: code.includes('void loop()'),
    digitalWriteCalls: [],
    analogWriteCalls: [],
    pinModeCalls: [],
    delayCalls: [],
    serialOutput: [],
    servoCalls: [],
    motorCalls: [],
    blinkPattern: false
  };
  
  // Extract digitalWrite calls
  const digitalWriteRegex = /digitalWrite\s*\(\s*(\d+)\s*,\s*(HIGH|LOW)\s*\)/g;
  let match;
  while ((match = digitalWriteRegex.exec(code)) !== null) {
    analysis.digitalWriteCalls.push({
      pin: parseInt(match[1]),
      state: match[2],
      line: code.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract pinMode calls
  const pinModeRegex = /pinMode\s*\(\s*(\d+)\s*,\s*(INPUT|OUTPUT|INPUT_PULLUP)\s*\)/g;
  while ((match = pinModeRegex.exec(code)) !== null) {
    analysis.pinModeCalls.push({
      pin: parseInt(match[1]),
      mode: match[2],
      line: code.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract analogWrite calls
  const analogWriteRegex = /analogWrite\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  while ((match = analogWriteRegex.exec(code)) !== null) {
    analysis.analogWriteCalls.push({
      pin: parseInt(match[1]),
      value: parseInt(match[2]),
      line: code.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract delay calls
  const delayRegex = /delay\s*\(\s*(\d+)\s*\)/g;
  while ((match = delayRegex.exec(code)) !== null) {
    analysis.delayCalls.push({
      duration: parseInt(match[1]),
      line: code.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract servo calls
  const servoWriteRegex = /(\w+)\.write\s*\(\s*(\d+)\s*\)/g;
  while ((match = servoWriteRegex.exec(code)) !== null) {
    analysis.servoCalls.push({
      servoName: match[1],
      angle: parseInt(match[2]),
      line: code.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract servo attach calls
  const servoAttachRegex = /(\w+)\.attach\s*\(\s*(\d+)\s*\)/g;
  while ((match = servoAttachRegex.exec(code)) !== null) {
    analysis.servoCalls.push({
      servoName: match[1],
      pin: parseInt(match[2]),
      action: 'attach',
      line: code.substring(0, match.index).split('\n').length
    });
  }
  
  // Extract Serial.print calls
  const serialRegex = /Serial\.(print|println)\s*\(\s*["']([^"']*)["']\s*\)/g;
  while ((match = serialRegex.exec(code)) !== null) {
    analysis.serialOutput.push({
      method: match[1],
      message: match[2],
      line: code.substring(0, match.index).split('\n').length
    });
  }
  
  // Detect blink pattern
  if (analysis.digitalWriteCalls.length >= 2 && analysis.delayCalls.length >= 1) {
    analysis.blinkPattern = true;
  }
  
  console.log(`Found ${analysis.digitalWriteCalls.length} digitalWrite calls`);
  console.log(`Found ${analysis.analogWriteCalls.length} analogWrite calls`);
  console.log(`Found ${analysis.pinModeCalls.length} pinMode calls`);
  console.log(`Found ${analysis.delayCalls.length} delay calls`);
  console.log(`Found ${analysis.servoCalls.length} servo calls`);
  console.log(`Blink pattern detected: ${analysis.blinkPattern}`);
  
  return analysis;
}

// Generate pin changes based on code analysis
function generatePinChangesFromCode(analysis) {
  const pinChanges = [];
  const startTime = Date.now();
  
  if (analysis.blinkPattern) {
    // Simulate blink behavior with multiple pins
    const blinkCount = 10;
    const delayMs = analysis.delayCalls[0]?.duration || 1000;
    
    // Get all unique pins from digitalWrite calls
    const pins = [...new Set(analysis.digitalWriteCalls.map(call => call.pin))];
    
    for (let i = 0; i < blinkCount; i++) {
      const isHigh = i % 2 === 0;
      
      // Simulate each pin
      pins.forEach(pin => {
        pinChanges.push({
          pin,
          state: isHigh ? 'HIGH' : 'LOW',
          value: isHigh ? 1 : 0,
          timestamp: startTime + (i * delayMs),
          type: 'digitalWrite',
          simulated: true
        });
      });
    }
  } else {
    // Simulate individual pin changes with proper timing
    let currentTime = startTime;
    
    // Handle digitalWrite calls
    analysis.digitalWriteCalls.forEach((call, index) => {
      pinChanges.push({
        pin: call.pin,
        state: call.state,
        value: call.state === 'HIGH' ? 1 : 0,
        timestamp: currentTime,
        type: 'digitalWrite',
        simulated: true
      });
      
      // Add delay between calls if there are delay calls
      if (analysis.delayCalls.length > 0) {
        currentTime += analysis.delayCalls[0]?.duration || 1000;
      } else {
        currentTime += 100; // Default 100ms between calls
      }
    });
    
    // Handle analogWrite calls (PWM)
    analysis.analogWriteCalls.forEach((call, index) => {
      pinChanges.push({
        pin: call.pin,
        state: 'PWM',
        value: call.value,
        timestamp: currentTime,
        type: 'analogWrite',
        simulated: true
      });
      
      // Add delay between calls if there are delay calls
      if (analysis.delayCalls.length > 0) {
        currentTime += analysis.delayCalls[0]?.duration || 1000;
      } else {
        currentTime += 100; // Default 100ms between calls
      }
    });
    
    // Handle servo calls
    analysis.servoCalls.forEach((call, index) => {
      if (call.action === 'attach') {
        // Servo attach - set pin as output
        pinChanges.push({
          pin: call.pin,
          state: 'ATTACHED',
          value: 0,
          timestamp: currentTime,
          type: 'servoAttach',
          simulated: true
        });
      } else if (call.angle !== undefined) {
        // Servo write - simulate PWM-like behavior
        pinChanges.push({
          pin: call.pin,
          state: 'PWM',
          value: call.angle,
          timestamp: currentTime,
          type: 'servoWrite',
          simulated: true
        });
      }
      
      // Add delay between calls if there are delay calls
      if (analysis.delayCalls.length > 0) {
        currentTime += analysis.delayCalls[0]?.duration || 1000;
      } else {
        currentTime += 100; // Default 100ms between calls
      }
    });
  }
  
  return pinChanges;
}

// Generate Wokwi simulation summary
function generateWokwiSummary(pinChanges, analysis) {
  let summary = `=== WOKWI SIMULATION SUMMARY ===\n\n`;
  
  summary += `Code Analysis:\n`;
  summary += `- Setup function: ${analysis.hasSetup ? 'Yes' : 'No'}\n`;
  summary += `- Loop function: ${analysis.hasLoop ? 'Yes' : 'No'}\n`;
  summary += `- DigitalWrite calls: ${analysis.digitalWriteCalls.length}\n`;
  summary += `- PinMode calls: ${analysis.pinModeCalls.length}\n`;
  summary += `- Delay calls: ${analysis.delayCalls.length}\n`;
  summary += `- Serial output: ${analysis.serialOutput.length}\n`;
  summary += `- Blink pattern: ${analysis.blinkPattern ? 'Yes' : 'No'}\n\n`;
  
  summary += `Pin Changes: ${pinChanges.length}\n`;
  
  if (pinChanges.length > 0) {
    const pinGroups = {};
    pinChanges.forEach(change => {
      if (!pinGroups[change.pin]) {
        pinGroups[change.pin] = [];
      }
      pinGroups[change.pin].push(change);
    });
    
    Object.entries(pinGroups).forEach(([pin, changes]) => {
      summary += `\nPin ${pin}: ${changes.length} changes\n`;
      changes.slice(0, 5).forEach((change, index) => {
        const time = new Date(change.timestamp).toLocaleTimeString();
        summary += `  ${index + 1}. ${change.state} at ${time}\n`;
      });
      if (changes.length > 5) {
        summary += `  ... and ${changes.length - 5} more\n`;
      }
    });
  }
  
  if (analysis.serialOutput.length > 0) {
    summary += `\nSerial Output:\n`;
    analysis.serialOutput.forEach((output, index) => {
      summary += `${index + 1}. ${output.method}("${output.message}")\n`;
    });
  }
  
  summary += `\n✅ Simulation completed successfully\n`;
  summary += `📝 Note: This is a code-based simulation. Full Wokwi API integration coming soon.\n`;
  
  return summary;
}

// Helper function to get register and bit for a pin
function getRegisterAndBitForPin(pin) {
  // Arduino Uno pin mapping
  const pinMap = {
    0: { register: 'PORTD', bit: 0 },
    1: { register: 'PORTD', bit: 1 },
    2: { register: 'PORTD', bit: 2 },
    3: { register: 'PORTD', bit: 3 },
    4: { register: 'PORTD', bit: 4 },
    5: { register: 'PORTD', bit: 5 },
    6: { register: 'PORTD', bit: 6 },
    7: { register: 'PORTD', bit: 7 },
    8: { register: 'PORTB', bit: 0 },
    9: { register: 'PORTB', bit: 1 },
    10: { register: 'PORTB', bit: 2 },
    11: { register: 'PORTB', bit: 3 },
    12: { register: 'PORTB', bit: 4 },
    13: { register: 'PORTB', bit: 5 },
    14: { register: 'PORTC', bit: 0 }, // A0
    15: { register: 'PORTC', bit: 1 }, // A1
    16: { register: 'PORTC', bit: 2 }, // A2
    17: { register: 'PORTC', bit: 3 }, // A3
    18: { register: 'PORTC', bit: 4 }, // A4
    19: { register: 'PORTC', bit: 5 }  // A5
  };
  
  return pinMap[pin] || { register: 'PORTB', bit: 5 }; // Default to pin 13
}

// Generic Arduino behavior simulation for compiled firmware
async function simulateGenericArduinoBehavior(board) {
  console.log('Running generic Arduino behavior simulation...');
  
  // Create a generic simulation that shows typical Arduino behavior
  const gpioStates = [];
  const registerStates = {
    PORTB: null,
    DDRB: null,
    PORTD: null,
    DDRD: null,
    PORTC: null,
    DDRC: null
  };
  
  // Simulate common Arduino pins (12, 13) since we can't analyze compiled firmware
  const startTime = Date.now();
  const commonPins = [12, 13]; // Common pins used in Arduino projects
  
  for (let i = 0; i < 10; i++) {
    const isHigh = i % 2 === 0;
    
    // Simulate each common pin
    commonPins.forEach(pin => {
      const { register, bit } = getRegisterAndBitForPin(pin);
      gpioStates.push({
        pin,
        state: isHigh ? 'HIGH' : 'LOW',
        value: isHigh ? 1 : 0,
        timestamp: startTime + (i * 1000), // 1 second intervals
        register,
        bit,
        simulated: true
      });
    });
  }
  
  // Set simulated register states for common pins
  registerStates.DDRB = 0x30; // Pins 12 and 13 as output (bits 4 and 5)
  registerStates.PORTB = 0x00; // Both pins low
  
  const summary = generateSimpleEmulationSummary(gpioStates, registerStates);
  
  return {
    success: true,
    output: summary,
    gpioStates,
    executionTime: 10000, // 10 seconds
    registers: registerStates
  };
}

// Start server
app.listen(PORT, async () => {
  console.log(`CircuitWiz Backend running on port ${PORT}`);
  console.log(`Temp directory: ${TEMP_DIR}`);
  
  // Initialize database
  try {
    userDatabase = new SQLiteDatabase();
    await userDatabase.initialize();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
  
  await ensureArduinoCLI();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  if (userDatabase) {
    userDatabase.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  if (userDatabase) {
    userDatabase.close();
  }
  process.exit(0);
});