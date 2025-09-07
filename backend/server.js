const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create temp directories for compilation and emulation
const TEMP_DIR = path.join(os.tmpdir(), 'circuitwiz-compile');
const EMULATION_DIR = path.join(os.tmpdir(), 'circuitwiz-emulation');
fs.ensureDirSync(TEMP_DIR);
fs.ensureDirSync(EMULATION_DIR);

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
      
      // Don't clean up temp directory - we need the .bin file for emulation
      
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

// QEMU emulation endpoint
app.post('/api/emulate', async (req, res) => {
  try {
    const { firmware, board = 'esp32:esp32:esp32', firmwareType = 'bin', binPath } = req.body;

    if (!firmware) {
      return res.status(400).json({
        success: false,
        error: 'No firmware provided'
      });
    }

    console.log('Starting enhanced QEMU emulation...');
    console.log('Board:', board);
    console.log('Firmware type:', firmwareType);

    // Use the original compiled .bin file if available, otherwise create from base64
    let firmwarePath;
    let projectDir = null;
    if (binPath && await fs.pathExists(binPath)) {
      firmwarePath = binPath;
      console.log(`Using original compiled file: ${path.basename(firmwarePath)}`);
    } else {
      // Fallback: create from base64
      const projectId = uuidv4();
      projectDir = path.join(EMULATION_DIR, projectId);
      await fs.ensureDir(projectDir);

      const firmwareBuffer = Buffer.from(firmware, 'base64');
      const timestamp = Date.now();
      firmwarePath = path.join(projectDir, `firmware-${timestamp}.${firmwareType}`);
      await fs.writeFile(firmwarePath, firmwareBuffer);
      console.log(`Created firmware file from base64: ${path.basename(firmwarePath)}`);
      
      // Analyze the firmware for debugging
      analyzeArduinoFirmware(firmwareBuffer);
    }

    // Check if QEMU is available
    const qemuCheck = await execCommand('qemu-system-avr --version');
    if (qemuCheck.error) {
      if (projectDir) {
        await fs.remove(projectDir);
      }
      
      return res.status(500).json({
        success: false,
        error: 'QEMU not available',
        details: 'QEMU is not installed on this system. Please install QEMU to use emulation features.',
        suggestion: 'Install QEMU: brew install qemu (macOS) or apt install qemu-system (Ubuntu)'
      });
    }

    // Run enhanced QEMU emulation
    let emulationResult;
    try {
      emulationResult = await runEnhancedQEMUEmulation(firmwarePath);
    } catch (error) {
      console.log('Enhanced emulation failed, trying basic mode...', error.message);
      emulationResult = await runBasicQEMUEmulation(firmwarePath);
    }
    
    // Clean up temp directory
    if (projectDir) {
      await fs.remove(projectDir);
      console.log('Cleaned up temp directory');
    } else if (binPath) {
      try {
        await fs.remove(path.dirname(binPath));
        console.log('Cleaned up compiled files');
      } catch (error) {
        console.log(`Could not clean up compiled files: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      output: emulationResult.output,
      gpioStates: emulationResult.gpioStates,
      executionTime: emulationResult.executionTime,
      registers: emulationResult.registers,
      isSimulation: false
    });

  } catch (error) {
    console.error('Emulation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});
// Enhanced QEMU emulation with improved GPIO detection
async function runEnhancedQEMUEmulation(firmwarePath) {
    const startTime = Date.now();
    
    console.log(`\n=== ENHANCED QEMU EMULATION STARTED ===`);
    console.log(`Firmware path: ${firmwarePath}`);
    
    // Check firmware exists and get info
    try {
      const stats = await fs.stat(firmwarePath);
      const buffer = await fs.readFile(firmwarePath);
      console.log(`Firmware size: ${stats.size} bytes`);
      console.log(`Firmware hash: ${crypto.createHash('md5').update(buffer).digest('hex')}`);
    } catch (error) {
      throw new Error(`Firmware file not accessible: ${error.message}`);
    }
    
    // Convert HEX to binary if needed
    let binaryPath = firmwarePath;
    if (firmwarePath.endsWith('.hex')) {
      const tempBinPath = firmwarePath.replace('.hex', '.bin');
      const converted = await convertHexToBinary(firmwarePath, tempBinPath);
      if (converted) {
        binaryPath = tempBinPath;
        console.log('Converted HEX to binary for QEMU');
      }
    }
    
    // Enhanced QEMU arguments with more detailed logging
    const debugLogPath = path.join(os.tmpdir(), `qemu-debug-${Date.now()}.log`);
    const qemuArgs = [
      '-machine', 'arduino-uno',
      '-bios', binaryPath,
      '-nographic',
      '-monitor', 'tcp:127.0.0.1:0,server,nowait',
      '-serial', 'null',
      '-d', 'cpu_reset,exec,in_asm,out_asm,int,cpu,mmu,pcall,ioport', // More comprehensive debugging
      '-D', debugLogPath,
      '-icount', 'shift=3,align=off,sleep=off',
      '-rtc', 'base=localtime',
      '-no-reboot',
      '-no-shutdown'
    ];
    
    console.log(`QEMU Command: qemu-system-avr ${qemuArgs.join(' ')}`);
    console.log(`Debug log will be written to: ${debugLogPath}`);
  
    const result = await new Promise((resolve, reject) => {
      const child = spawn('qemu-system-avr', qemuArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let gpioStates = [];
      let registerStates = {
        PORTB: null,
        DDRB: null,
        PORTD: null,
        DDRD: null,
        PORTC: null,
        DDRC: null
      };
      let executionCount = 0;
      let outputBuffer = '';
      let errorBuffer = '';
      
      // Enhanced output parsing with multiple detection methods
      child.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        parseQEMUOutput(output, registerStates, gpioStates, executionCount);
      });
  
      child.stderr.on('data', (data) => {
        const error = data.toString();
        errorBuffer += error;
        
        // Parse stderr for additional debug info
        parseQEMUOutput(error, registerStates, gpioStates, executionCount);
        
        if (!error.includes('terminating on signal') && !error.includes('VNC server running')) {
          console.log(`QEMU Stderr: ${error.trim()}`);
        }
      });
  
      // Set reasonable timeout
      const timeout = setTimeout(async () => {
        console.log('Emulation timeout reached, analyzing debug log...');
        
        // Try to read and parse the debug log file
        try {
          await parseQEMUDebugLog(debugLogPath, registerStates, gpioStates);
        } catch (error) {
          console.log('Could not parse debug log:', error.message);
        }
        
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (!child.killed) {
            console.log('Force killing QEMU process...');
            child.kill('SIGKILL');
          }
        }, 2000);
      }, 15000); // 15 seconds
  
      child.on('close', async (code) => {
        clearTimeout(timeout);
        console.log(`QEMU process exited with code ${code}`);
        
        // Final attempt to parse debug log
        try {
          await parseQEMUDebugLog(debugLogPath, registerStates, gpioStates);
        } catch (error) {
          console.log('Could not parse final debug log:', error.message);
        }
        
        // Generate summary
        const summary = generateEmulationSummary(gpioStates, registerStates, executionCount, code, outputBuffer);
        
        // Clean up debug log
        try {
          await fs.remove(debugLogPath);
        } catch (e) {}
        
        resolve({
          success: code === 0 || code === null,
          output: summary,
          gpioStates,
          executionTime: Date.now() - startTime,
          registers: registerStates
        });
      });
  
      child.on('error', (error) => {
        clearTimeout(timeout);
        console.error('QEMU process error:', error);
        
        if (error.code === 'ENOENT') {
          reject(new Error('QEMU not found. Please install qemu-system-avr'));
        } else {
          reject(error);
        }
      });
    });
  
    console.log(`\n=== ENHANCED QEMU EMULATION COMPLETE ===`);
    console.log(`GPIO changes: ${result.gpioStates.length}`);
    console.log(`Execution time: ${result.executionTime}ms`);
    console.log(`===========================================\n`);
  
    return result;
  }
  
  // Enhanced output parsing function
  function parseQEMUOutput(output, registerStates, gpioStates, executionCount) {
    const lines = output.split('\n');
    
    lines.forEach(line => {
      // Count execution traces
      if (line.includes('Trace') || line.includes('IN:') || line.match(/0x[0-9a-fA-F]+:/)) {
        executionCount++;
      }
      
      // Method 1: Look for I/O port operations
      const ioMatch = line.match(/(?:out|in)\s+0x([0-9a-fA-F]+),?\s*(?:0x)?([0-9a-fA-F]+)/i);
      if (ioMatch) {
        const port = parseInt(ioMatch[1], 16);
        const value = parseInt(ioMatch[2], 16);
        
        console.log(`I/O Operation detected: port=0x${port.toString(16)}, value=0x${value.toString(16)}`);
        processRegisterChange(port, value, registerStates, gpioStates);
      }
      
      // Method 2: Look for specific AVR instructions affecting GPIO registers
      const sbiMatch = line.match(/sbi\s+0x([0-9a-fA-F]+),\s*([0-9]+)/i);
      if (sbiMatch) {
        const ioAddr = parseInt(sbiMatch[1], 16);
        const bit = parseInt(sbiMatch[2]);
        
        console.log(`SBI instruction: addr=0x${ioAddr.toString(16)}, bit=${bit}`);
        
        if (ioAddr === 0x05 && bit === 5) { // PORTB bit 5 (pin 13)
          const newValue = (registerStates.PORTB || 0) | (1 << bit);
          processRegisterChange(0x05, newValue, registerStates, gpioStates);
        }
      }
      
      const cbiMatch = line.match(/cbi\s+0x([0-9a-fA-F]+),\s*([0-9]+)/i);
      if (cbiMatch) {
        const ioAddr = parseInt(cbiMatch[1], 16);
        const bit = parseInt(cbiMatch[2]);
        
        console.log(`CBI instruction: addr=0x${ioAddr.toString(16)}, bit=${bit}`);
        
        if (ioAddr === 0x05 && bit === 5) { // PORTB bit 5 (pin 13)
          const newValue = (registerStates.PORTB || 0) & ~(1 << bit);
          processRegisterChange(0x05, newValue, registerStates, gpioStates);
        }
      }
      
      // Method 3: Look for memory operations at register addresses
      const memMatch = line.match(/(?:st|ld)\s+.*,?\s*0x([0-9a-fA-F]+)/i) ||
                       line.match(/0x([0-9a-fA-F]+):\s*(?:st|ld)/i);
      if (memMatch) {
        const addr = parseInt(memMatch[1], 16);
        
        // Arduino register memory mappings
        if (addr >= 0x20 && addr <= 0x5F) { // I/O register range
          const ioPort = addr - 0x20;
          console.log(`Memory operation at I/O register: mem=0x${addr.toString(16)}, io=0x${ioPort.toString(16)}`);
          
          // We can't get the value from this pattern, but we know something changed
          if (ioPort === 0x04) console.log('  -> DDRB access detected');
          if (ioPort === 0x05) console.log('  -> PORTB access detected');
        }
      }
      
      // Method 4: Look for function calls to digitalWrite/pinMode equivalents
      if (line.includes('call') || line.includes('rcall')) {
        const callMatch = line.match(/(?:r?call)\s+0x([0-9a-fA-F]+)/i);
        if (callMatch) {
          const addr = parseInt(callMatch[1], 16);
          console.log(`Function call detected: 0x${addr.toString(16)}`);
          
          // These are rough estimates based on typical Arduino library addresses
          if (addr >= 0x100 && addr <= 0x200) {
            console.log('  -> Possible pinMode/digitalWrite call');
          }
        }
      }
    });
  }
  
  // Process register changes and detect GPIO state changes
  function processRegisterChange(port, value, registerStates, gpioStates) {
    // Map I/O ports to register names
    let registerName = null;
    if (port === 0x04) registerName = 'DDRB';
    else if (port === 0x05) registerName = 'PORTB';
    else if (port === 0x0A) registerName = 'DDRD';
    else if (port === 0x0B) registerName = 'PORTD';
    else if (port === 0x07) registerName = 'DDRC';
    else if (port === 0x08) registerName = 'PORTC';
    
    if (registerName) {
      const oldValue = registerStates[registerName];
      registerStates[registerName] = value;
      
      console.log(`${registerName} = 0x${value.toString(16)} (was 0x${oldValue?.toString(16) || 'null'})`);
      
      // Detect Pin 13 changes (PORTB bit 5)
      if (registerName === 'PORTB' && oldValue !== null && oldValue !== value) {
        const oldPin13 = (oldValue >> 5) & 1;
        const newPin13 = (value >> 5) & 1;
        
        if (oldPin13 !== newPin13) {
          const change = {
            pin: 13,
            state: newPin13 ? 'HIGH' : 'LOW',
            value: newPin13,
            timestamp: Date.now(),
            register: 'PORTB',
            bit: 5,
            oldValue: oldValue,
            newValue: value
          };
          
          gpioStates.push(change);
          console.log(`*** PIN 13 STATE CHANGE: ${oldPin13 ? 'HIGH' : 'LOW'} -> ${newPin13 ? 'HIGH' : 'LOW'} ***`);
        }
      }
    }
  }
  
  // Parse QEMU debug log file for additional information
  async function parseQEMUDebugLog(logPath, registerStates, gpioStates) {
    try {
      if (!(await fs.pathExists(logPath))) {
        console.log('Debug log file not found');
        return;
      }
      
      console.log('Parsing QEMU debug log...');
      const logContent = await fs.readFile(logPath, 'utf8');
      const lines = logContent.split('\n');
      
      let ioOperations = 0;
      let instructionCount = 0;
      
      for (const line of lines) {
        // Count instructions
        if (line.match(/IN:\s+0x[0-9a-fA-F]+/)) {
          instructionCount++;
        }
        
        // Look for I/O operations in the debug log
        const ioLogMatch = line.match(/(?:OUT|IN)\s+0x([0-9a-fA-F]+)\s+0x([0-9a-fA-F]+)/i);
        if (ioLogMatch) {
          ioOperations++;
          const port = parseInt(ioLogMatch[1], 16);
          const value = parseInt(ioLogMatch[2], 16);
          
          console.log(`Debug log I/O: port=0x${port.toString(16)}, value=0x${value.toString(16)}`);
          processRegisterChange(port, value, registerStates, gpioStates);
        }
        
        // Look for specific instructions
        if (line.includes('sbi') || line.includes('cbi') || line.includes('out')) {
          console.log(`Debug log instruction: ${line.trim()}`);
        }
      }
      
      console.log(`Debug log analysis: ${instructionCount} instructions, ${ioOperations} I/O operations`);
      
    } catch (error) {
      console.log('Error parsing debug log:', error.message);
    }
  }
  
  // Simulation fallback when QEMU doesn't capture GPIO changes
  function simulateArduinoBlink(registerStates) {
    console.log('No GPIO changes detected in QEMU, running Arduino simulation...');
    
    const simulatedStates = [];
    const startTime = Date.now();
    
    // Simulate typical Arduino blink behavior
    for (let i = 0; i < 10; i++) {
      const isHigh = i % 2 === 0;
      simulatedStates.push({
        pin: 13,
        state: isHigh ? 'HIGH' : 'LOW',
        value: isHigh ? 1 : 0,
        timestamp: startTime + (i * 1000), // 1 second intervals
        register: 'PORTB',
        bit: 5,
        simulated: true
      });
    }
    
    // Set simulated register states
    registerStates.DDRB = 0x20; // Pin 13 as output
    registerStates.PORTB = 0x00; // Pin 13 low
    
    return simulatedStates;
  }
  
  // Enhanced summary with simulation detection
  function generateEnhancedEmulationSummary(gpioStates, registerStates, executionCount, exitCode, rawOutput = '') {
    const pin13Changes = gpioStates.filter(state => state.pin === 13);
    const hasSimulation = gpioStates.some(state => state.simulated);
    
    let summary = `=== ENHANCED QEMU EMULATION RESULTS ===\n\n`;
    summary += `Exit Code: ${exitCode}\n`;
    summary += `Execution Instructions: ${executionCount.toLocaleString()}\n`;
    summary += `Total GPIO Changes: ${gpioStates.length}${hasSimulation ? ' (simulated)' : ''}\n`;
    summary += `Pin 13 Changes: ${pin13Changes.length}\n\n`;
    
    if (hasSimulation) {
      summary += `⚠️  NOTE: QEMU did not detect GPIO changes, showing simulated Arduino behavior\n`;
      summary += `This suggests the emulation needs further refinement for this Arduino program\n\n`;
    }
    
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
        const simFlag = change.simulated ? ' (sim)' : '';
        summary += `${index + 1}. ${change.state} at ${time}${simFlag}\n`;
      });
    } else if (!hasSimulation) {
      summary += `\n❌ No Pin 13 changes detected in QEMU emulation\n`;
      summary += `🔍 This could indicate:\n`;
      summary += `   - The Arduino program isn't using standard digitalWrite() functions\n`;
      summary += `   - QEMU's AVR emulation isn't capturing all I/O operations\n`;
      summary += `   - The program is stuck in initialization or delay loops\n`;
    }
    
    return summary;
  }
  
  // Improved fallback basic QEMU emulation
  async function runBasicQEMUEmulation(firmwarePath) {
    console.log('Running basic QEMU emulation as fallback...');
    
    // Try a very simple QEMU setup
    const qemuArgs = [
      '-machine', 'arduino-uno',
      '-bios', firmwarePath,
      '-nographic',
      '-no-reboot',
      '-no-shutdown'
    ];
  
    return new Promise((resolve) => {
      const child = spawn('qemu-system-avr', qemuArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let hasData = false;
  
      child.stdout.on('data', (data) => {
        output += data.toString();
        hasData = true;
      });
      
      child.stderr.on('data', (data) => {
        output += data.toString();
        hasData = true;
      });
  
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 1000);
      }, 8000);
  
      child.on('close', (code) => {
        clearTimeout(timeout);
        
        resolve({
          success: true,
          output: hasData ? 
            `Basic QEMU emulation completed.\nOutput:\n${output}\nExit code: ${code}` :
            'Basic QEMU emulation completed (no output captured)',
          gpioStates: [],
          executionTime: 8000,
          registers: {}
        });
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          output: `Basic QEMU emulation failed: ${error.message}`,
          gpioStates: [],
          executionTime: 0,
          registers: {}
        });
      });
    });
  }
  
  // Enhanced emulation summary with more detailed analysis
  function generateEmulationSummary(gpioStates, registerStates, executionCount, exitCode, rawOutput = '') {
    const pin13Changes = gpioStates.filter(state => state.pin === 13);
    
    let summary = `=== ENHANCED QEMU EMULATION RESULTS ===\n\n`;
    summary += `Exit Code: ${exitCode}\n`;
    summary += `Execution Instructions: ${executionCount.toLocaleString()}\n`;
    summary += `Total GPIO Changes: ${gpioStates.length}\n`;
    summary += `Pin 13 Changes: ${pin13Changes.length}\n\n`;
    
    summary += `Final Register States:\n`;
    Object.entries(registerStates).forEach(([reg, value]) => {
      if (value !== null) {
        const binaryStr = value.toString(2).padStart(8, '0');
        summary += `- ${reg}: 0x${value.toString(16).padStart(2, '0')} (${binaryStr})\n`;
        
        // Special analysis for DDRB and PORTB
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
      pin13Changes.slice(-10).forEach((change, index) => {
        const time = new Date(change.timestamp).toLocaleTimeString();
        summary += `${index + 1}. ${change.state} at ${time}\n`;
      });
      
      // Analyze timing pattern
      if (pin13Changes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < pin13Changes.length; i++) {
          intervals.push(pin13Changes[i].timestamp - pin13Changes[i-1].timestamp);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        summary += `\nAverage change interval: ${avgInterval.toFixed(1)}ms\n`;
        
        if (avgInterval > 900 && avgInterval < 1100) {
          summary += `✅ Timing matches 1-second delay pattern\n`;
        } else if (avgInterval > 450 && avgInterval < 550) {
          summary += `✅ Timing matches 500ms delay pattern\n`;
        } else {
          summary += `⚠️  Unusual timing pattern detected\n`;
        }
      }
    } else {
      summary += `\n❌ No Pin 13 changes detected.\n`;
      
      const ddrb = registerStates.DDRB;
      const portb = registerStates.PORTB;
      
      if (ddrb !== null) {
        const pin13IsOutput = (ddrb >> 5) & 1;
        if (!pin13IsOutput) {
          summary += `\n🔍 DIAGNOSIS: Pin 13 is not configured as OUTPUT\n`;
          summary += `   DDRB bit 5 = ${pin13IsOutput} (should be 1 for OUTPUT)\n`;
          summary += `   ➡️  Add pinMode(13, OUTPUT); to your setup() function\n`;
        } else {
          summary += `\n🔍 Pin 13 is configured as OUTPUT but no state changes detected\n`;
          if (portb !== null) {
            const pin13State = (portb >> 5) & 1;
            summary += `   Current Pin 13 state: ${pin13State ? 'HIGH' : 'LOW'}\n`;
            summary += `   ➡️  Check digitalWrite(13, HIGH/LOW) calls in your loop\n`;
          } else {
            summary += `   ➡️  No PORTB writes detected - check your digitalWrite() calls\n`;
          }
        }
      } else {
        summary += `\n🔍 DIAGNOSIS: No DDRB register access detected\n`;
        summary += `   This suggests Arduino initialization may not be working\n`;
        summary += `   ➡️  Verify your Arduino code compiles for the correct board\n`;
      }
    }
    
    // Add instruction count analysis
    if (executionCount > 0) {
      summary += `\n📊 Execution Analysis:\n`;
      if (executionCount > 10000) {
        summary += `   High instruction count (${executionCount.toLocaleString()}) suggests active execution\n`;
      } else if (executionCount > 1000) {
        summary += `   Moderate instruction count (${executionCount.toLocaleString()})\n`;
      } else {
        summary += `   Low instruction count (${executionCount}) - may indicate early termination\n`;
      }
    }
    
    return summary;
  }
  
  // Improved HEX to binary conversion with better error handling
  async function convertHexToBinary(hexPath, binPath) {
    try {
      console.log(`Converting ${path.basename(hexPath)} to ${path.basename(binPath)}`);
      
      const hexContent = await fs.readFile(hexPath, 'utf8');
      const lines = hexContent.split('\n').filter(line => line.trim().startsWith(':'));
      
      if (lines.length === 0) {
        throw new Error('No valid Intel HEX records found');
      }
      
      // Use a more reasonable max size for Arduino programs
      const maxSize = 32 * 1024; // 32KB
      const binaryData = Buffer.alloc(maxSize, 0xFF);
      let hasData = false;
      let minAddr = Infinity;
      let maxAddr = -1;
      
      console.log(`Processing ${lines.length} HEX records...`);
      
      for (const line of lines) {
        try {
          if (line.length < 11) continue; // Minimum valid record length
          
          const recordLength = parseInt(line.substr(1, 2), 16);
          const address = parseInt(line.substr(3, 4), 16);
          const recordType = parseInt(line.substr(7, 2), 16);
          
          if (recordType === 0x00) { // Data record
            if (line.length < 11 + (recordLength * 2)) continue;
            
            for (let i = 0; i < recordLength; i++) {
              const byteOffset = 9 + (i * 2);
              if (byteOffset + 2 > line.length) break;
              
              const byteValue = parseInt(line.substr(byteOffset, 2), 16);
              const fullAddress = address + i;
              
              if (fullAddress < maxSize) {
                binaryData[fullAddress] = byteValue;
                hasData = true;
                minAddr = Math.min(minAddr, fullAddress);
                maxAddr = Math.max(maxAddr, fullAddress);
              }
            }
          } else if (recordType === 0x01) { // End of File
            break;
          }
        } catch (err) {
          console.log(`Skipping invalid HEX line: ${line.substr(0, 20)}...`);
        }
      }
      
      if (hasData && minAddr !== Infinity) {
        // Trim binary data to actual used range
        const usedSize = maxAddr + 1;
        const trimmedData = binaryData.slice(0, usedSize);
        
        await fs.writeFile(binPath, trimmedData);
        console.log(`✅ Converted HEX to binary: ${trimmedData.length} bytes (0x${minAddr.toString(16)}-0x${maxAddr.toString(16)})`);
        return true;
      }
      
      console.log('❌ No valid data found in HEX file');
      return false;
    } catch (error) {
      console.error('❌ Failed to convert HEX to binary:', error.message);
      return false;
    }
  }

// Start server
app.listen(PORT, async () => {
  console.log(`CircuitWiz Backend running on port ${PORT}`);
  console.log(`Temp directory: ${TEMP_DIR}`);
  
  await ensureArduinoCLI();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  process.exit(0);
});