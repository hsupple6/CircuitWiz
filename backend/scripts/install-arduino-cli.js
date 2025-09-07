#!/usr/bin/env node

const { exec } = require('child_process');
const os = require('os');
const path = require('path');

console.log('🔧 Installing Arduino CLI for CircuitWiz...');

const platform = os.platform();
const arch = os.arch();

let installCommand = '';

switch (platform) {
  case 'darwin':
    if (arch === 'arm64') {
      installCommand = 'brew install arduino-cli';
    } else {
      installCommand = 'brew install arduino-cli';
    }
    break;
  case 'linux':
    installCommand = 'curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh';
    break;
  case 'win32':
    installCommand = 'choco install arduino-cli';
    break;
  default:
    console.error('❌ Unsupported platform:', platform);
    process.exit(1);
}

console.log(`📦 Installing Arduino CLI for ${platform} ${arch}...`);
console.log(`Command: ${installCommand}`);

exec(installCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Installation failed:', error.message);
    console.error('Please install Arduino CLI manually:');
    console.error('https://arduino.github.io/arduino-cli/');
    process.exit(1);
  }

  console.log('✅ Arduino CLI installed successfully!');
  console.log(stdout);

  // Configure Arduino CLI
  console.log('🔧 Configuring Arduino CLI...');
  
  const configCommands = [
    'arduino-cli config init',
    'arduino-cli core update-index',
    'arduino-cli core install esp32:esp32',
    'arduino-cli core install arduino:avr'
  ];

  let currentCommand = 0;
  
  function runNextCommand() {
    if (currentCommand >= configCommands.length) {
      console.log('🎉 Arduino CLI setup complete!');
      console.log('You can now start the CircuitWiz backend server.');
      return;
    }

    const command = configCommands[currentCommand];
    console.log(`Running: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.warn(`⚠️  Warning: ${command} failed:`, error.message);
      } else {
        console.log(`✅ ${command} completed`);
      }
      
      currentCommand++;
      runNextCommand();
    });
  }
  
  runNextCommand();
});
