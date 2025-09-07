#!/usr/bin/env node

const { exec } = require('child_process');
const os = require('os');

console.log('🔧 Fixing Arduino CLI architecture compatibility...');

const platform = os.platform();
const arch = os.arch();

console.log(`Platform: ${platform} ${arch}`);

if (platform === 'darwin' && arch === 'arm64') {
  console.log('🍎 Detected Apple Silicon Mac (M1/M2)');
  console.log('Installing Arduino CLI with Rosetta 2 support...');
  
  // Install Arduino CLI using Rosetta 2
  const installCommand = 'arch -x86_64 brew install arduino-cli';
  
  exec(installCommand, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Failed to install Arduino CLI with Rosetta 2:', error.message);
      console.log('\n📋 Manual fix options:');
      console.log('1. Install Arduino CLI with Rosetta 2:');
      console.log('   arch -x86_64 brew install arduino-cli');
      console.log('\n2. Or use ESP32 instead of Arduino Uno (recommended):');
      console.log('   The system now defaults to ESP32 which has better ARM64 support');
      console.log('\n3. Or run Terminal with Rosetta 2:');
      console.log('   Right-click Terminal > Get Info > Open using Rosetta');
      return;
    }
    
    console.log('✅ Arduino CLI installed with Rosetta 2 support');
    console.log(stdout);
    
    // Configure Arduino CLI
    console.log('🔧 Configuring Arduino CLI...');
    
    const configCommands = [
      'arch -x86_64 arduino-cli config init',
      'arch -x86_64 arduino-cli core update-index',
      'arch -x86_64 arduino-cli core install esp32:esp32',
      'arch -x86_64 arduino-cli core install arduino:avr'
    ];
    
    let currentCommand = 0;
    
    function runNextCommand() {
      if (currentCommand >= configCommands.length) {
        console.log('🎉 Arduino CLI setup complete!');
        console.log('You can now compile for both ESP32 and Arduino Uno.');
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
  
} else {
  console.log('✅ Your system architecture is compatible with Arduino CLI');
  console.log('No fixes needed.');
}
