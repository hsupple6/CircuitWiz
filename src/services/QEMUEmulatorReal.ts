/**
 * QEMU Emulator Real Service
 * 
 * Frontend service that communicates with the backend QEMU emulation API.
 * This provides real emulation capabilities when QEMU is available,
 * or simulation when it's not.
 */

export interface GPIOState {
  pin: number
  state: 'HIGH' | 'LOW' | 'INPUT' | 'OUTPUT'
  value: number
  timestamp: number
  register?: string // AVR register name (PORTB, PORTD, PORTC)
}

export interface EmulationResult {
  success: boolean
  output: string
  error?: string
  gpioStates: GPIOState[]
  executionTime: number
  registers?: Record<string, string>
  isSimulation?: boolean
  note?: string
}

export class QEMUEmulatorReal {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl
  }

  /**
   * Start emulation with the provided firmware
   */
  async startEmulation(
    firmware: string,
    board: string = 'esp32:esp32:esp32',
    firmwareType: 'bin' | 'elf' = 'bin',
    binPath?: string
  ): Promise<EmulationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/emulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firmware,
          board,
          firmwareType,
          binPath
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Emulation request failed:', error)
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        gpioStates: [],
        executionTime: 0
      }
    }
  }

  /**
   * Check if the emulation service is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`)
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  /**
   * Get GPIO states from emulation result
   */
  getGPIOStates(result: EmulationResult): GPIOState[] {
    return result.gpioStates || []
  }

  /**
   * Get GPIO state for a specific pin
   */
  getGPIOStateForPin(result: EmulationResult, pin: number): GPIOState | null {
    const states = this.getGPIOStates(result)
    return states.find(state => state.pin === pin) || null
  }

  /**
   * Get all pins that were set HIGH during emulation
   */
  getHighPins(result: EmulationResult): number[] {
    const states = this.getGPIOStates(result)
    return states
      .filter(state => state.state === 'HIGH')
      .map(state => state.pin)
  }

  /**
   * Get all pins that were set LOW during emulation
   */
  getLowPins(result: EmulationResult): number[] {
    const states = this.getGPIOStates(result)
    return states
      .filter(state => state.state === 'LOW')
      .map(state => state.pin)
  }

  /**
   * Get register values from emulation result
   */
  getRegisters(result: EmulationResult): Record<string, string> {
    return result.registers || {}
  }

  /**
   * Get PORTx register values specifically
   */
  getPORTRegisters(result: EmulationResult): { PORTB: string, PORTD: string, PORTC: string } {
    const registers = this.getRegisters(result)
    return {
      PORTB: registers.PORTB || '0x00',
      PORTD: registers.PORTD || '0x00', 
      PORTC: registers.PORTC || '0x00'
    }
  }

  /**
   * Get pins that changed state during emulation (with before/after values)
   */
  getPinChanges(result: EmulationResult): Array<{
    pin: number
    from: 'HIGH' | 'LOW'
    to: 'HIGH' | 'LOW'
    register: string
    timestamp: number
  }> {
    const states = this.getGPIOStates(result)
    const changes: Array<{
      pin: number
      from: 'HIGH' | 'LOW'
      to: 'HIGH' | 'LOW'
      register: string
      timestamp: number
    }> = []

    // Group states by pin to find changes
    const pinStates = new Map<number, GPIOState[]>()
    states.forEach(state => {
      if (!pinStates.has(state.pin)) {
        pinStates.set(state.pin, [])
      }
      pinStates.get(state.pin)!.push(state)
    })

    // Find state changes for each pin
    pinStates.forEach((pinStateList, pin) => {
      if (pinStateList.length > 1) {
        // Sort by timestamp
        pinStateList.sort((a, b) => a.timestamp - b.timestamp)
        
        // Find transitions
        for (let i = 1; i < pinStateList.length; i++) {
          const prev = pinStateList[i - 1]
          const curr = pinStateList[i]
          
          if (prev.state !== curr.state) {
            changes.push({
              pin,
              from: prev.state as 'HIGH' | 'LOW',
              to: curr.state as 'HIGH' | 'LOW',
              register: curr.register || 'Unknown',
              timestamp: curr.timestamp
            })
          }
        }
      }
    })

    return changes
  }

  /**
   * Format GPIO states for display
   */
  formatGPIOStates(result: EmulationResult): string {
    const states = this.getGPIOStates(result)
    if (states.length === 0) {
      return 'No GPIO activity detected'
    }

    const formatted = states.map(state => {
      const time = new Date(state.timestamp).toLocaleTimeString()
      return `Pin ${state.pin}: ${state.state} (${state.value}) at ${time}`
    }).join('\n')

    return formatted
  }

  /**
   * Get a summary of the emulation result
   */
  getSummary(result: EmulationResult): string {
    if (!result.success) {
      return `Emulation failed: ${result.error}`
    }

    const states = this.getGPIOStates(result)
    const highPins = this.getHighPins(result)
    const lowPins = this.getLowPins(result)
    const pinChanges = this.getPinChanges(result)
    const portRegisters = this.getPORTRegisters(result)
    const executionTime = (result.executionTime / 1000).toFixed(2)
    
    let summary = `Emulation completed in ${executionTime}s\n`
    summary += `GPIO changes: ${states.length}\n`
    summary += `Pin state transitions: ${pinChanges.length}\n`
    summary += `Pins set HIGH: ${highPins.length > 0 ? highPins.join(', ') : 'none'}\n`
    summary += `Pins set LOW: ${lowPins.length > 0 ? lowPins.join(', ') : 'none'}\n`
    
    // Add PORTx register information
    summary += `\nFinal PORTx Register States:\n`
    summary += `- PORTB: ${portRegisters.PORTB} (pins 8-13)\n`
    summary += `- PORTD: ${portRegisters.PORTD} (pins 0-7)\n`
    summary += `- PORTC: ${portRegisters.PORTC} (pins A0-A5)\n`
    
    // Add pin change details if any
    if (pinChanges.length > 0) {
      summary += `\nPin State Changes:\n`
      pinChanges.slice(-5).forEach(change => {
        summary += `- Pin ${change.pin}: ${change.from} → ${change.to} (${change.register})\n`
      })
      if (pinChanges.length > 5) {
        summary += `... and ${pinChanges.length - 5} more changes\n`
      }
    }
    
    if (result.isSimulation) {
      summary += `\nNote: ${result.note || 'This was a simulation'}`
    } else {
      summary += `\nNote: GPIO changes detected via direct PORTx register monitoring`
    }

    return summary
  }
}

// Create a default instance
export const qemuEmulator = new QEMUEmulatorReal()
