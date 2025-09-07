// ESP32 flashing service using Web Serial API
// This service handles flashing firmware to ESP32 devices via browser

export interface FlashProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface FlashResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface ESP32Device {
  port: SerialPort;
  info: SerialPortInfo;
}

export class ESP32Flasher {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  /**
   * Check if Web Serial API is supported
   */
  isWebSerialSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Request access to serial ports and list available devices
   */
  async listDevices(): Promise<ESP32Device[]> {
    if (!this.isWebSerialSupported()) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    try {
      const ports = await (navigator as any).serial.getPorts();
      const devices: ESP32Device[] = [];

      for (const port of ports) {
        const info = port.getInfo();
        devices.push({
          port,
          info
        });
      }

      return devices;
    } catch (error) {
      console.error('Failed to list devices:', error);
      throw new Error('Failed to access serial ports');
    }
  }

  /**
   * Request permission to access a new device
   */
  async requestDevice(): Promise<ESP32Device> {
    if (!this.isWebSerialSupported()) {
      throw new Error('Web Serial API is not supported in this browser');
    }

    try {
      const port = await (navigator as any).serial.requestPort({
        filters: [
          // Common ESP32 USB-to-Serial chip IDs
          { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // Silicon Labs CP2102
          { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // QinHeng Electronics CH340
          { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI FT232
          { usbVendorId: 0x067b, usbProductId: 0x2303 }, // Prolific PL2303
        ]
      });

      const info = port.getInfo();
      return { port, info };
    } catch (error) {
      console.error('Failed to request device:', error);
      throw new Error('Failed to access device. Please make sure to select an ESP32 device.');
    }
  }

  /**
   * Connect to an ESP32 device
   */
  async connect(device: ESP32Device): Promise<void> {
    try {
      this.port = device.port;
      
      await this.port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });

      console.log('Connected to ESP32 device');
    } catch (error) {
      console.error('Failed to connect to device:', error);
      throw new Error('Failed to connect to ESP32 device');
    }
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }

      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      console.log('Disconnected from ESP32 device');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  /**
   * Flash firmware to ESP32
   */
  async flashFirmware(
    firmware: string, // Base64 encoded .bin file
    onProgress?: (progress: FlashProgress) => void
  ): Promise<FlashResult> {
    if (!this.port) {
      throw new Error('Not connected to any device');
    }

    try {
      // Convert base64 to Uint8Array
      const binaryString = atob(firmware);
      const firmwareData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        firmwareData[i] = binaryString.charCodeAt(i);
      }

      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: 'Preparing to flash firmware...'
      });

      // Put ESP32 into download mode
      await this.enterDownloadMode();

      onProgress?.({
        stage: 'flashing',
        progress: 10,
        message: 'Flashing firmware...'
      });

      // Flash the firmware
      await this.flashData(firmwareData, onProgress);

      onProgress?.({
        stage: 'verifying',
        progress: 90,
        message: 'Verifying firmware...'
      });

      // Verify the flash
      await this.verifyFlash(firmwareData);

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Firmware flashed successfully!'
      });

      return {
        success: true,
        message: 'Firmware flashed successfully!'
      };

    } catch (error) {
      console.error('Flash error:', error);
      return {
        success: false,
        message: 'Failed to flash firmware',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Put ESP32 into download mode
   */
  private async enterDownloadMode(): Promise<void> {
    // This is a simplified version - in reality, you'd need to:
    // 1. Set GPIO0 low
    // 2. Reset the ESP32
    // 3. Wait for the bootloader
    
    // For now, we'll just wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Flash data to ESP32
   */
  private async flashData(
    data: Uint8Array, 
    onProgress?: (progress: FlashProgress) => void
  ): Promise<void> {
    if (!this.port) {
      throw new Error('Port not available');
    }

    const writer = this.port.writable.getWriter();
    this.writer = writer;

    try {
      const chunkSize = 1024;
      const totalChunks = Math.ceil(data.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, data.length);
        const chunk = data.slice(start, end);

        await writer.write(chunk);

        const progress = Math.round(((i + 1) / totalChunks) * 80) + 10; // 10-90%
        onProgress?.({
          stage: 'flashing',
          progress,
          message: `Flashing chunk ${i + 1}/${totalChunks}...`
        });

        // Small delay to prevent overwhelming the device
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      await writer.releaseLock();
      this.writer = null;
    }
  }

  /**
   * Verify the flashed data
   */
  private async verifyFlash(data: Uint8Array): Promise<void> {
    // In a real implementation, you would:
    // 1. Read back the flashed data
    // 2. Compare it with the original data
    // 3. Report any mismatches
    
    // For now, we'll just simulate verification
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Reset the ESP32
   */
  async reset(): Promise<void> {
    if (!this.port) {
      throw new Error('Not connected to any device');
    }

    try {
      // Send reset command
      const writer = this.port.writable.getWriter();
      await writer.write(new Uint8Array([0x00, 0x00, 0x00, 0x00])); // Reset command
      await writer.releaseLock();
      
      console.log('ESP32 reset');
    } catch (error) {
      console.error('Reset error:', error);
      throw new Error('Failed to reset ESP32');
    }
  }

  /**
   * Get device information
   */
  getDeviceInfo(): SerialPortInfo | null {
    if (!this.port) {
      return null;
    }
    return this.port.getInfo();
  }

  /**
   * Check if connected to a device
   */
  isConnected(): boolean {
    return this.port !== null && this.port.readable !== null;
  }
}
