export interface DynamicGPIOState {
  pin: number
  state: 'HIGH' | 'LOW' | 'PULSING' | 'INPUT'
  value: number
  timestamp: number
  pattern?: 'BLINK' | 'FADE' | 'STATIC' | 'RANDOM'
  frequency?: number // Hz for blinking
  dutyCycle?: number // 0-1 for pulse width
  microcontrollerId?: string // Added for multi-microcontroller support
}

export interface GPIOAnimation {
  pin: number
  pattern: 'BLINK' | 'FADE' | 'STATIC' | 'RANDOM'
  frequency: number
  dutyCycle: number
  startTime: number
  duration?: number // ms, undefined = infinite
}

export class DynamicGPIO {
  private animations: Map<number, GPIOAnimation> = new Map()
  private currentStates: Map<number, DynamicGPIOState> = new Map()
  private animationId: number | null = null
  private isRunning: boolean = false
  private startTime: number = 0

  /**
   * Analyze Arduino code to detect GPIO patterns
   */
  analyzeCode(code: string): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    const lines = code.split('\n')
    
    // Look for common patterns
    const blinkPattern = this.detectBlinkPattern(lines)
    const fadePattern = this.detectFadePattern(lines)
    const staticPattern = this.detectStaticPattern(lines)
    
    animations.push(...blinkPattern, ...fadePattern, ...staticPattern)
    
    return animations
  }

  /**
   * Detect blinking patterns (digitalWrite in loop)
   */
  private detectBlinkPattern(lines: string[]): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    let inLoop = false
    let loopStartLine = -1
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Detect loop start
      if (line.includes('void loop()') || line.includes('void loop ()')) {
        inLoop = true
        loopStartLine = i
        continue
      }
      
      // Detect loop end
      if (inLoop && (line.includes('}') && i > loopStartLine + 1)) {
        inLoop = false
        continue
      }
      
      // Look for digitalWrite patterns in loop
      if (inLoop) {
        const digitalWriteMatch = line.match(/digitalWrite\s*\(\s*(\d+)\s*,\s*(HIGH|LOW)\s*\)/)
        if (digitalWriteMatch) {
          const pin = parseInt(digitalWriteMatch[1])
          const state = digitalWriteMatch[2]
          
          // Look for delay patterns
          const delayMatch = lines[i + 1]?.match(/delay\s*\(\s*(\d+)\s*\)/)
          if (delayMatch) {
            const delayMs = parseInt(delayMatch[1])
            const frequency = 1000 / (delayMs * 2) // Convert to Hz (HIGH + LOW = 2 delays)
            
            animations.push({
              pin,
              pattern: 'BLINK',
              frequency,
              dutyCycle: 0.5, // Assume 50% duty cycle for simple blink
              startTime: 0
            })
          }
        }
      }
    }
    
    return animations
  }

  /**
   * Detect fade patterns (analogWrite in loop)
   */
  private detectFadePattern(lines: string[]): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    let inLoop = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes('void loop()')) {
        inLoop = true
        continue
      }
      
      if (inLoop && line.includes('}')) {
        inLoop = false
        continue
      }
      
      if (inLoop) {
        const analogWriteMatch = line.match(/analogWrite\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/)
        if (analogWriteMatch) {
          const pin = parseInt(analogWriteMatch[1])
          const value = parseInt(analogWriteMatch[2])
          
          // Look for increment/decrement patterns
          const nextLine = lines[i + 1]?.trim()
          if (nextLine?.includes('delay')) {
            const delayMatch = nextLine.match(/delay\s*\(\s*(\d+)\s*\)/)
            if (delayMatch) {
              const delayMs = parseInt(delayMatch[1])
              
              animations.push({
                pin,
                pattern: 'FADE',
                frequency: 1000 / delayMs,
                dutyCycle: value / 255, // PWM duty cycle
                startTime: 0
              })
            }
          }
        }
      }
    }
    
    return animations
  }

  /**
   * Detect static patterns (digitalWrite in setup)
   */
  private detectStaticPattern(lines: string[]): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    let inSetup = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes('void setup()')) {
        inSetup = true
        continue
      }
      
      if (inSetup && line.includes('}')) {
        inSetup = false
        continue
      }
      
      if (inSetup) {
        const digitalWriteMatch = line.match(/digitalWrite\s*\(\s*(\d+)\s*,\s*(HIGH|LOW)\s*\)/)
        if (digitalWriteMatch) {
          const pin = parseInt(digitalWriteMatch[1])
          const state = digitalWriteMatch[2]
          
          animations.push({
            pin,
            pattern: 'STATIC',
            frequency: 0,
            dutyCycle: state === 'HIGH' ? 1 : 0,
            startTime: 0
          })
        }
      }
    }
    
    return animations
  }

  /**
   * Start dynamic GPIO simulation
   */
  startSimulation(animations: GPIOAnimation[]): void {
    this.animations.clear()
    this.currentStates.clear()
    
    // Initialize animations
    animations.forEach(animation => {
      this.animations.set(animation.pin, animation)
    })
    
    this.isRunning = true
    this.startTime = Date.now()
    
    // Start animation loop
    this.animate()
  }

  /**
   * Stop dynamic GPIO simulation
   */
  stopSimulation(): void {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  /**
   * Get current GPIO states
   */
  getCurrentStates(): Map<number, DynamicGPIOState> {
    return new Map(this.currentStates)
  }

  /**
   * Animation loop
   */
  private animate(): void {
    if (!this.isRunning) return
    
    const currentTime = Date.now() - this.startTime
    
    // Update each animated pin
    this.animations.forEach((animation, pin) => {
      const state = this.calculatePinState(animation, currentTime)
      this.currentStates.set(pin, state)
    })
    
    // Continue animation
    this.animationId = requestAnimationFrame(() => this.animate())
  }

  /**
   * Calculate pin state based on animation pattern
   */
  private calculatePinState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    switch (animation.pattern) {
      case 'BLINK':
        return this.calculateBlinkState(animation, currentTime)
      case 'FADE':
        return this.calculateFadeState(animation, currentTime)
      case 'STATIC':
        return this.calculateStaticState(animation)
      case 'RANDOM':
        return this.calculateRandomState(animation, currentTime)
      default:
        return {
          pin: animation.pin,
          state: 'LOW',
          value: 0,
          timestamp: currentTime
        }
    }
  }

  /**
   * Calculate blinking state
   */
  private calculateBlinkState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    const period = 1000 / animation.frequency // ms
    const cycleTime = currentTime % period
    const isHigh = cycleTime < (period * animation.dutyCycle)
    
    return {
      pin: animation.pin,
      state: isHigh ? 'HIGH' : 'LOW',
      value: isHigh ? 1 : 0,
      timestamp: currentTime,
      pattern: 'BLINK',
      frequency: animation.frequency,
      dutyCycle: animation.dutyCycle
    }
  }

  /**
   * Calculate fading state
   */
  private calculateFadeState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    const period = 1000 / animation.frequency // ms
    const cycleTime = currentTime % period
    const normalizedTime = cycleTime / period
    
    // Simple sine wave fade
    const value = (Math.sin(normalizedTime * Math.PI * 2) + 1) / 2
    const pwmValue = Math.floor(value * 255)
    
    return {
      pin: animation.pin,
      state: 'PULSING',
      value: pwmValue / 255,
      timestamp: currentTime,
      pattern: 'FADE',
      frequency: animation.frequency,
      dutyCycle: value
    }
  }

  /**
   * Calculate static state
   */
  private calculateStaticState(animation: GPIOAnimation): DynamicGPIOState {
    return {
      pin: animation.pin,
      state: animation.dutyCycle > 0 ? 'HIGH' : 'LOW',
      value: animation.dutyCycle,
      timestamp: Date.now() - this.startTime,
      pattern: 'STATIC',
      frequency: 0,
      dutyCycle: animation.dutyCycle
    }
  }

  /**
   * Calculate random state
   */
  private calculateRandomState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    const value = Math.random()
    
    return {
      pin: animation.pin,
      state: value > 0.5 ? 'HIGH' : 'LOW',
      value,
      timestamp: currentTime,
      pattern: 'RANDOM',
      frequency: animation.frequency,
      dutyCycle: value
    }
  }
}

// Export singleton instance for backward compatibility
export const dynamicGPIO = new DynamicGPIO()

// Multi-microcontroller GPIO manager
export class MultiMicrocontrollerGPIO {
  private microcontrollers: Map<string, DynamicGPIO> = new Map()
  private globalStates: Map<number, DynamicGPIOState> = new Map()
  private animationId: number | null = null
  private isRunning: boolean = false

  /**
   * Start simulation for a specific microcontroller
   */
  startMicrocontrollerSimulation(microcontrollerId: string, code: string): void {
    console.log(`[MULTI_MCU_GPIO] Starting simulation for ${microcontrollerId}`)
    
    // Create or get existing GPIO instance for this microcontroller
    let mcuGPIO = this.microcontrollers.get(microcontrollerId)
    if (!mcuGPIO) {
      mcuGPIO = new DynamicGPIO()
      this.microcontrollers.set(microcontrollerId, mcuGPIO)
    }
    
    // Analyze code for GPIO patterns
    const animations = mcuGPIO.analyzeCode(code)
    console.log(`[MULTI_MCU_GPIO] Detected patterns for ${microcontrollerId}:`, animations)
    
    // Start simulation for this microcontroller
    mcuGPIO.startSimulation(animations)
    
    // Start global animation loop if not already running
    if (!this.isRunning) {
      this.startGlobalAnimationLoop()
    }
    
    // Update global states
    this.updateGlobalStates()
  }

  /**
   * Stop simulation for a specific microcontroller
   */
  stopMicrocontrollerSimulation(microcontrollerId: string): void {
    console.log(`[MULTI_MCU_GPIO] Stopping simulation for ${microcontrollerId}`)
    
    const mcuGPIO = this.microcontrollers.get(microcontrollerId)
    if (mcuGPIO) {
      mcuGPIO.stopSimulation()
      this.microcontrollers.delete(microcontrollerId)
    }
    
    // Stop global animation loop if no microcontrollers are running
    if (this.microcontrollers.size === 0) {
      this.stopGlobalAnimationLoop()
    }
    
    // Update global states
    this.updateGlobalStates()
  }

  /**
   * Stop all simulations
   */
  stopAllSimulations(): void {
    console.log('[MULTI_MCU_GPIO] Stopping all simulations')
    
    this.microcontrollers.forEach((mcuGPIO, microcontrollerId) => {
      mcuGPIO.stopSimulation()
    })
    
    this.microcontrollers.clear()
    this.globalStates.clear()
    this.stopGlobalAnimationLoop()
  }

  /**
   * Get GPIO states for a specific microcontroller
   */
  getMicrocontrollerStates(microcontrollerId: string): Map<number, DynamicGPIOState> {
    const mcuGPIO = this.microcontrollers.get(microcontrollerId)
    return mcuGPIO ? mcuGPIO.getCurrentStates() : new Map()
  }

  /**
   * Get all GPIO states from all microcontrollers
   */
  getAllGPIOStates(): Map<number, DynamicGPIOState> {
    return new Map(this.globalStates)
  }

  /**
   * Update global states by merging all microcontroller states
   */
  private updateGlobalStates(): void {
    this.globalStates.clear()
    
    this.microcontrollers.forEach((mcuGPIO, microcontrollerId) => {
      const mcuStates = mcuGPIO.getCurrentStates()
      mcuStates.forEach((state, pin) => {
        // Add microcontroller ID to the state for debugging
        const enhancedState = {
          ...state,
          microcontrollerId
        }
        this.globalStates.set(pin, enhancedState)
      })
    })
    
    console.log(`[MULTI_MCU_GPIO] Updated global states:`, Array.from(this.globalStates.entries()))
  }

  /**
   * Get list of running microcontrollers
   */
  getRunningMicrocontrollers(): string[] {
    return Array.from(this.microcontrollers.keys())
  }

  /**
   * Check if a microcontroller is running
   */
  isMicrocontrollerRunning(microcontrollerId: string): boolean {
    return this.microcontrollers.has(microcontrollerId)
  }

  /**
   * Start the global animation loop
   */
  private startGlobalAnimationLoop(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('[MULTI_MCU_GPIO] Starting global animation loop')
    this.globalAnimationLoop()
  }

  /**
   * Stop the global animation loop
   */
  private stopGlobalAnimationLoop(): void {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    console.log('[MULTI_MCU_GPIO] Stopped global animation loop')
  }

  /**
   * Global animation loop that continuously updates states from all microcontrollers
   */
  private globalAnimationLoop(): void {
    if (!this.isRunning) return
    
    // Update global states from all microcontrollers
    this.updateGlobalStates()
    
    // Continue animation
    this.animationId = requestAnimationFrame(() => this.globalAnimationLoop())
  }
}

// Export singleton instance for multi-microcontroller support
export const multiMCUGPIO = new MultiMicrocontrollerGPIO()
